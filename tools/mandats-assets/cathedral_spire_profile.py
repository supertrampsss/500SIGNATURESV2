"""Narrow only the existing upper cones/pinnacles; keep facade/height/feet.

Deterministic raw GLB geometry edit, same helper from the authoring pipeline.
UV, images, topology and original stone body stay intact. No Scene or Blender.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import math
import pathlib
import struct

spec = importlib.util.spec_from_file_location("cathedral_facade_span",
    pathlib.Path(__file__).with_name("cathedral_facade_span.py"))
codec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(codec)


def slim_spires(glb, metadata_path, factor):
    if not math.isfinite(factor) or not .6 <= factor <= 1:
        raise ValueError("Spire width must be finite and between .6 and 1")
    metadata_path = pathlib.Path(metadata_path)
    metadata = json.loads(metadata_path.read_text())
    profile = metadata.get("authoringProfile", {})
    if profile.get("spireWidth", 1) != 1:
        raise ValueError("Do not apply spire width twice")
    if profile.get("facadeSpan") != 1.2 or abs(metadata["models"]["cathedrale_paris"]["height"] - 2.935) > 1e-5:
        raise ValueError("This profile requires the short .5 upper section and facade span1.2")
    document, binary, blob = codec.read_glb(glb)
    original, original_binary = copy.deepcopy(document), bytes(binary)
    # GLTF X/Z coordinates are authored; main nave roof stays below these cuts.
    # Source finish() re-centres Blender Y by +.21825 before GLTF conversion.
    # Read actual exported positions, rather than the uncentred source Y poses.
    cones = [(-.612, .99825, 2.40, .205, .171),
             (.612, .99825, 2.22, .205, .171),
             (0, -.13175, 2.071, .153, .128)]
    pins = [(cx + sx * .18054, .99825 + sz * .15045, cut, .073, .061)
            for cx, cut in [(-.612, 2.401), (.612, 2.216)]
            for sx in (-1, 1) for sz in (-1, 1)]
    changed_views, results = set(), []
    for mesh in document["meshes"]:
        primitive = mesh["primitives"][0]
        def accessor(index, count):
            a = document["accessors"][index]
            v = document["bufferViews"][a["bufferView"]]
            if v.get("byteStride") or a.get("sparse"):
                raise ValueError("Expected tightly packed static geometry")
            return a, v.get("byteOffset", 0) + a.get("byteOffset", 0)
        pa, po = accessor(primitive["attributes"]["POSITION"], 3)
        na, no = accessor(primitive["attributes"]["NORMAL"], 3)
        ia, io = accessor(primitive["indices"], 1)
        positions = [list(struct.unpack_from("<fff", binary, po + i * 12)) for i in range(pa["count"])]
        fmt, width = ("<I", 4) if ia["componentType"] == 5125 else ("<H", 2)
        indices = [struct.unpack_from(fmt, binary, io + i * width)[0] for i in range(ia["count"])]
        labels = {}
        for i in range(0, len(indices), 3):
            vertices = [positions[j] for j in indices[i:i + 3]]
            if min(p[1] for p in vertices) < 2.071:
                continue
            # A full upper face must fit its ornament region. Large cone/crown
            # faces cannot be mistaken for an adjacent tiny corner pinnacle.
            for zone in pins + cones:
                cx, cz, cut, rx, rz = zone
                if all(y >= cut and ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 <= 1 for x, y, z in vertices):
                    for p in vertices:
                        labels.setdefault(tuple(p), (cx, cz))
                    break
        changed = set()
        for i, point in enumerate(positions):
            x, y, z = point
            zone = labels.get(tuple(point))
            if zone is not None:
                cx, cz = zone
                point[0] = cx + (x - cx) * factor
                point[2] = cz + (z - cz) * factor
                # Welded position labels cover UV/hard-normal duplicates too.
                struct.pack_into("<f", binary, po + i * 12, point[0])
                struct.pack_into("<f", binary, po + i * 12 + 8, point[2])
                point[:] = struct.unpack_from("<fff", binary, po + i * 12)
                changed.add(i)
        # Recompute only normal fans touching edited faces. Split GLTF vertices
        # retain their original hard edges and UV seams; unaffected fans are exact.
        touched = set()
        for i in range(0, len(indices), 3):
            face = indices[i:i + 3]
            if any(j in changed for j in face):
                touched.update(face)
        sums = {i: [0., 0., 0.] for i in touched}
        for i in range(0, len(indices), 3):
            face = indices[i:i + 3]
            if not any(j in touched for j in face):
                continue
            a, b, c = [positions[j] for j in face]
            ux, uy, uz = [b[k] - a[k] for k in range(3)]
            vx, vy, vz = [c[k] - a[k] for k in range(3)]
            normal = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
            for j in face:
                if j in sums:
                    for k in range(3):
                        sums[j][k] += normal[k]
        for i, normal in sums.items():
            length = math.sqrt(sum(v * v for v in normal))
            if length <= 1e-14:
                # Existing zero-area triangles may leave a fan without area.
                continue
            previous = struct.unpack_from("<fff", binary, no + i * 12)
            if sum(normal[k] * previous[k] for k in range(3)) < 0:
                normal = [-v for v in normal]
            struct.pack_into("<fff", binary, no + i * 12, *(v / length for v in normal))
        bounds = {"min": [min(p[k] for p in positions) for k in range(3)],
                  "max": [max(p[k] for p in positions) for k in range(3)]}
        if bounds["min"] != pa["min"] or bounds["max"] != pa["max"]:
            raise ValueError("Spire profile altered overall bounds")
        if not all(math.isfinite(v) for p in positions for v in p):
            raise ValueError("Non-finite edited positions")
        changed_views.update([pa["bufferView"], na["bufferView"]])
        results.append({"vertices": pa["count"], "triangles": ia["count"] // 3,
            "changedUpperVertices": len(changed), "normalFans": len(touched), "bounds": bounds,
            "lowestChangedPositionY": min(positions[i][1] for i in changed)})
    unchanged_views = []
    for i, view in enumerate(document["bufferViews"]):
        if i in changed_views:
            continue
        start, length = view.get("byteOffset", 0), view["byteLength"]
        if binary[start:start + length] != original_binary[start:start + length]:
            raise ValueError("Unrelated buffer changed")
        unchanged_views.append(i)
    if document != original:
        raise ValueError("GLB document changed")
    metadata["authoringProfile"]["spireWidth"] = factor
    codec.write_glb(glb, document, binary)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    return {"sourceSha256": hashlib.sha256(blob).hexdigest(),
        "candidateSha256": hashlib.sha256(pathlib.Path(glb).read_bytes()).hexdigest(),
        "spireWidth": factor, "models": results, "unchangedBufferViews": unchanged_views,
        "unchanged": ["all POSITION Y", "body/main roof/ground POSITION", "all raw bounds",
            "indices", "UV", "images", "materials", "nodes", "triangle counts"],
        "scope": "Actual raw GLB asset, not a rendered/artistic validation"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("glb", type=pathlib.Path)
    parser.add_argument("metadata", type=pathlib.Path)
    parser.add_argument("--width", type=float, required=True)
    parser.add_argument("--audit", type=pathlib.Path, required=True)
    args = parser.parse_args()
    result = slim_spires(args.glb, args.metadata, args.width)
    args.audit.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
