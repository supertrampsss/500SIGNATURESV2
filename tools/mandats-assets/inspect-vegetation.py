"""Inspect exported glTF buffers; this is model evidence, not browser validation."""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--previous', type=Path)
parser.add_argument('--reproduced-from', type=Path)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--revision', type=int, default=40)
args = parser.parse_args()
source = Path(__file__).resolve().parent
root = source.parent.parent
export = root / 'site/public/mandats/models/vegetation.glb'
baseline = json.loads((source / 'vegetation-bounds.json').read_text())


def inspect(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and length == len(raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4E4F534A
    document = json.loads(raw[20:20 + size])
    binary_size, binary_kind = struct.unpack_from('<II', raw, 20 + size)
    assert binary_kind == 0x004E4942
    binary = raw[28 + size:28 + size + binary_size]

    def values(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        component = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[accessor['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
        stride = view.get('byteStride', width * struct.calcsize(component))
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        decoded = [struct.unpack_from('<' + component * width, binary, start + i * stride)
                   for i in range(accessor['count'])]
        assert all(math.isfinite(c) for row in decoded for c in row)
        return decoded

    models = {}
    for node in document['nodes']:
        if 'mesh' not in node:
            continue
        name = node['name']
        assert not any(key in node for key in ['matrix', 'rotation', 'translation', 'scale']), name
        mesh = document['meshes'][node['mesh']]
        fingerprint = hashlib.sha256()
        triangles, normal_error, degenerates, disagreements = 0, 0, 0, 0
        positions = []
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4
            attributes = {key: values(index) for key, index in primitive['attributes'].items()}
            assert 'COLOR_0' in attributes and 'NORMAL' in attributes
            p, normals = attributes['POSITION'], attributes['NORMAL']
            indices = [value[0] for value in values(primitive['indices'])]
            assert len(indices) % 3 == 0 and max(indices) < len(p)
            assert all(len(a) == len(p) for a in attributes.values())
            positions.extend(p)
            normal_error = max(normal_error, max(abs(math.sqrt(sum(c * c for c in n)) - 1) for n in normals))
            assert normal_error < 1e-4, name
            for k in range(0, len(indices), 3):
                corners = indices[k:k + 3]
                a, b, c = [p[index] for index in corners]
                u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
                cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
                degenerates += sum(x * x for x in cross) <= 1e-20
                mean = [sum(normals[index][axis] for index in corners) for axis in range(3)]
                disagreements += sum(x * y for x, y in zip(cross, mean)) < -1e-12
            triangles += len(indices) // 3
            fingerprint.update(json.dumps({'attributes': attributes, 'indices': indices}, sort_keys=True).encode())
        bounds = {'min': [min(p[i] for p in positions) for i in range(3)],
                  'max': [max(p[i] for p in positions) for i in range(3)]}
        assert bounds == baseline[name], (name, bounds, baseline[name])
        models[name] = {'triangles': triangles, 'primitives': len(mesh['primitives']),
                        'bounds': bounds, 'boundsExact': True, 'fingerprint': fingerprint.hexdigest(),
                        'maximumNormalLengthError': normal_error, 'degenerateTriangles': degenerates,
                        'faceNormalDisagreements': disagreements}
    assert set(models) == set(baseline)
    return {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'models': models}


current = inspect(export)
previous = inspect(args.previous) if args.previous else None
reproduced = args.reproduced_from.read_bytes() if args.reproduced_from else None
report = {'artifactRevision': args.revision, 'generator': 'Blender 4.3.2',
          'method': 'Decoded actual glTF accessors and indices. Exact per-model export bounds, finite attributes, valid indices and unit normals. No browser, timing gate, visual-conformity or hardware-frame-rate claim.',
          'glbSHA256': current['sha256'], 'glbBytes': current['bytes'],
          'sourceSHA256': hashlib.sha256((source / 'vegetation.py').read_bytes()).hexdigest(),
          'boundsSourceSHA256': hashlib.sha256((source / 'vegetation-bounds.json').read_bytes()).hexdigest(),
          'reproductionCommand': 'blender --background --threads 2 --python tools/mandats-assets/vegetation.py',
          'reproductionMatchesRetainedGLB': reproduced == export.read_bytes() if reproduced is not None else None,
          'allHighAndDistantBoundsExact': True,
          'highTriangles': sum(model['triangles'] for name, model in current['models'].items() if not name.endswith('_distant')),
          'distantTriangles': sum(model['triangles'] for name, model in current['models'].items() if name.endswith('_distant')),
          'models': current['models']}
if previous:
    report['previousGLBSHA256'] = previous['sha256']
    report['rockGeometryAndColorsByteIdentical'] = current['models']['rock']['fingerprint'] == previous['models']['rock']['fingerprint']
if reproduced is not None:
    assert report['reproductionMatchesRetainedGLB'], 'Reproduction differs from retained model.'
args.output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({key: value for key, value in report.items() if key != 'models'}, indent=2))
