#!/usr/bin/env python3
"""Author eleven compact decorative rural groups using existing architecture prefabs.

No geometry export or image bake. Bounds/offsets come from the real GLB POSITION
accessors, so every new house keeps the prefab's original XYZ proportions.
Usage: python3 tools/mandats-assets/rural_fine.py --root REPO --output FILE
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

# Names are scenery identifiers only, never MAP_PLACES or narrative locations.
# Surveyed locations can be edited here and reproduced without touching old towns.
GROUPS = [
    ("champagne-nord", 4.68, 49.36, "north", .12, 0),
    ("argonne", 5.20, 49.18, "north", -.24, 1),
    ("lorraine-ouest", 5.33, 48.82, "north", .18, 2),
    ("toul-plaine", 5.56, 48.24, "north", -.12, 0),
    ("barrois", 5.18, 48.45, "stone", .31, 1),
    ("champagne-sud", 4.33, 48.30, "stone", -.33, 2),
    ("morvan-nord", 4.42, 47.80, "stone", .25, 0),
    ("auxerrois", 3.62, 47.85, "stone", -.16, 1),
    ("beauce", 1.3533526689520659, 47.769746127667844, "stone", .11, 2),
    ("sologne", 2.8518520037644235, 47.46111094124938, "stone", -.29, 0),
    ("berry", 2.05, 46.62, "stone", .19, 1),
]
LAYOUTS = [
    [(-.105, .074, 0), (.089, .080, .045), (-.094, -.079, math.pi-.05), (.104, -.085, math.pi+.11)],
    [(-.112, .089, -.09), (.079, .084, .10), (-.105, -.083, math.pi+.07), (.094, -.091, math.pi-.06)],
    [(-.120, .085, .04), (.065, .096, -.03), (.126, -.043, math.pi+.03), (-.095, -.097, math.pi/2-.035)],
]
LANES = [
    [[-.24, .010], [-.07, -.005], [.07, .006], [.23, .010]],
    [[-.24, -.003], [-.08, .006], [.08, -.007], [.23, -.002]],
    [[-.25, -.005], [-.07, .005], [.038, -.005], [.050, -.090], [.052, -.19]],
]


def glb_models(path):
    data = path.read_bytes()
    size, chunk = struct.unpack_from('<II', data, 12)
    if chunk != 0x4E4F534A:
        raise ValueError('Missing GLB JSON')
    doc = json.loads(data[20:20+size])
    models = {}
    for node in doc['nodes']:
        if 'children' not in node or node.get('name', '').endswith('_distant'):
            continue
        minimum, maximum, triangles = [math.inf]*3, [-math.inf]*3, 0
        for child in node['children']:
            for p in doc['meshes'][doc['nodes'][child]['mesh']]['primitives']:
                accessor = doc['accessors'][p['attributes']['POSITION']]
                for axis in range(3):
                    minimum[axis] = min(minimum[axis], accessor['min'][axis])
                    maximum[axis] = max(maximum[axis], accessor['max'][axis])
                triangles += doc['accessors'][p['indices']]['count']//3
        models[node['name']] = {'min': minimum, 'max': maximum,
            'width': maximum[0]-minimum[0], 'height': maximum[1]-minimum[1],
            'depth': maximum[2]-minimum[2], 'triangles': triangles}
    return models, hashlib.sha256(data).hexdigest()


def rotate(x, z, angle):
    c, s = math.cos(angle), math.sin(angle)
    return x*c + z*s, -x*s + z*c


def hull(points):
    pts = sorted(set(points))
    cross = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) > 1 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) > 1 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def make_groups(models):
    towns = []
    for index, (key, lon, lat, region, yaw, layout) in enumerate(GROUPS):
        name = 'hameau-rural36-' + key
        farm = 'ferme_02' if region == 'north' else 'ferme_01'
        family = ['maison_brique_02', 'maison_ardoise_01'] if region == 'north' else \
            ['maison_pierre_02', 'maison_ardoise_01']
        if index % 3 == 1: family[1] = 'maison_pierre_01'
        prefabs = [farm, family[index % 2], family[(index+1) % 2], 'ferme_01' if farm == 'ferme_02' else 'ferme_02']
        widths = [.151 + (index % 3)*.005, .091 + (index % 2)*.005,
                  .103 + (index % 3)*.003, .127 + (index % 2)*.005]
        buildings, corners = [], []
        for j, ((u, v, extra), prefab, width) in enumerate(zip(LAYOUTS[layout], prefabs, widths)):
            raw = models[prefab]
            scale = width/raw['width']
            depth, height = raw['depth']*scale, raw['height']*scale
            offset = (raw['min'][2]+raw['max'][2])/2*scale
            cx, cz = rotate(u, v, yaw)
            angle = yaw+extra
            buildings.append({'id': name+'-'+['logis-ferme','maison-cour','maison-rue','grange'][j],
                'model': prefab, 'x': cx-math.sin(angle)*offset, 'z': cz-math.cos(angle)*offset,
                'angle': angle, 'width': width, 'depth': depth, 'height': height,
                'footprintOffset': offset, 'ruralInfill': True})
            for a, b in [(-width/2-.015, -depth/2-.015), (width/2+.015, -depth/2-.015),
                         (width/2+.015, depth/2+.015), (-width/2-.015, depth/2+.015)]:
                dx, dz = rotate(a, b, angle)
                corners.append((cx+dx, cz+dz))
        points = [list(rotate(x,z,yaw)) for x,z in LANES[layout]]
        if key not in {"champagne-nord", "sologne"}:
            corners.extend(tuple(p) for p in points)
        towns.append({'name': name, 'lon': lon, 'lat': lat, 'region': region, 'major': False,
            'blocks': [{'id': name+'-cour', 'outline': [list(p) for p in hull(corners)], 'buildings': buildings}],
            'streets': [] if key in {'champagne-nord', 'sologne'} else
                [{'id': name+'-chemin', 'width': .010, 'points': points}], 'trees': []})
    return towns


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    models, digest = glb_models(args.root/'site/public/mandats/models/architecture.glb')
    towns = make_groups(models)
    text = ('import type { NationalSettlement } from "./map-city-national.ts";\n\n'
        '/** Eleven decorative farm groups fill the north-east and central plain.\n'
        ' * Existing kit geometry, UVs, materials and regional LODs are reused.\n'
        ' * Each house keeps the prefab’s exact XYZ proportions and ground pivot.\n'
        ' * These identifiers are scenery only: no markers, subjects or game roots.\n'
        ' * Generated by tools/mandats-assets/rural_fine.py; architecture SHA256:\n'
        f' * {digest}\n */\n'
        'export const RURAL_FINE_SETTLEMENTS: readonly NationalSettlement[] = '+
        json.dumps(towns, ensure_ascii=False, indent=2)+';\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text)
    print(json.dumps({'groups': len(towns), 'houses': sum(len(b['buildings']) for t in towns for b in t['blocks']),
        'sourceArchitectureSha256': digest, 'outputSha256': hashlib.sha256(text.encode()).hexdigest()}))

if __name__ == '__main__':
    main()
