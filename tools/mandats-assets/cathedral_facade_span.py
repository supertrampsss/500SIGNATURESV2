"""Geometry-only cathedral facade span after geometry export and atlas sync.

The X-only affine transformation is applied to both authored detail levels.
No texture, UV, index, material, node, Y or Z value is changed. Normals use
the inverse transpose. No Blender, renderer or external Python package.
"""
import argparse
import copy
import hashlib
import json
import math
import pathlib
import struct


def read_glb(path):
    blob = pathlib.Path(path).read_bytes()
    if struct.unpack_from("<III", blob) != (0x46546C67, 2, len(blob)):
        raise ValueError("Expected an exact GLB v2 document")
    size, kind = struct.unpack_from("<II", blob, 12)
    if kind != 0x4E4F534A:
        raise ValueError("Expected GLB JSON first")
    document = json.loads(blob[20:20 + size])
    start = 20 + size
    length, kind = struct.unpack_from("<II", blob, start)
    if kind != 0x004E4942 or start + 8 + length != len(blob):
        raise ValueError("Expected one final BIN chunk")
    return document, bytearray(blob[start + 8:]), blob


def write_glb(path, document, binary):
    encoded = json.dumps(document, ensure_ascii=False,
        separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    if len(binary) % 4:
        raise ValueError("Input BIN must already be aligned")
    blob = struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(binary))
    blob += struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
    blob += struct.pack("<II", len(binary), 0x004E4942) + binary
    pathlib.Path(path).write_bytes(blob)


def stretch_facade(glb_path, metadata_path, span):
    """Apply once to a fresh exported kit; return source and preservation facts."""
    if not math.isfinite(span) or not 1 <= span <= 1.4:
        raise ValueError("Facade span must be finite and between 1 and 1.4")
    metadata_path = pathlib.Path(metadata_path)
    metadata = json.loads(metadata_path.read_text())
    if metadata.get("authoringProfile", {}).get("facadeSpan", 1) != 1:
        raise ValueError("Facade span must not be applied twice")
    document, binary, original_blob = read_glb(glb_path)
    original_document, original_binary = copy.deepcopy(document), bytes(binary)
    if len(document["buffers"]) != 1 or document.get("skins") or document.get("animations"):
        raise ValueError("Expected the static one-buffer cathedral kit")
    if any(any(key in node for key in ("matrix", "translation", "rotation", "scale"))
           for node in document["nodes"]):
        raise ValueError("Expected ground-centred identity mesh nodes")
    transformed, bounds = set(), {}
    for node in document["nodes"]:
        if "mesh" not in node:
            continue
        name = node["name"].removesuffix("_mesh")
        mesh = document["meshes"][node["mesh"]]
        if name not in metadata["models"] or len(mesh["primitives"]) != 1:
            raise ValueError("Expected the named single-primitive cathedral models")
        attributes = mesh["primitives"][0]["attributes"]
        if set(attributes) != {"POSITION", "NORMAL", "TEXCOORD_0"}:
            raise ValueError("Unexpected attributes require an explicit transform")
        for semantic in ("POSITION", "NORMAL"):
            accessor_id = attributes[semantic]
            if accessor_id in transformed:
                continue
            transformed.add(accessor_id)
            accessor = document["accessors"][accessor_id]
            view = document["bufferViews"][accessor["bufferView"]]
            if accessor["componentType"] != 5126 or accessor["type"] != "VEC3" or accessor.get("sparse"):
                raise ValueError("Expected nonsparse float32 VEC3 geometry")
            offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            stride = view.get("byteStride", 12)
            minimum, maximum = [math.inf] * 3, [-math.inf] * 3
            for index in range(accessor["count"]):
                address = offset + index * stride
                x, y, z = struct.unpack_from("<fff", binary, address)
                if not all(map(math.isfinite, (x, y, z))):
                    raise ValueError("Non-finite source geometry")
                if semantic == "POSITION":
                    # Pack only X, retaining Y and Z bytes exactly.
                    struct.pack_into("<f", binary, address, x * span)
                else:
                    nx = x / span
                    length = math.sqrt(nx * nx + y * y + z * z)
                    if length <= 1e-12:
                        raise ValueError("Degenerate source normal")
                    struct.pack_into("<fff", binary, address, nx / length, y / length, z / length)
                values = struct.unpack_from("<fff", binary, address)
                for axis, value in enumerate(values):
                    minimum[axis] = min(minimum[axis], value)
                    maximum[axis] = max(maximum[axis], value)
            if semantic == "POSITION":
                accessor["min"], accessor["max"] = minimum, maximum
                bounds[name] = {"min": minimum, "max": maximum,
                    "width": maximum[0] - minimum[0],
                    "height": maximum[1] - minimum[1],
                    "depth": maximum[2] - minimum[2]}
                previous = metadata["models"][name]
                previous.update({"min": minimum, "max": maximum,
                    "width": round(bounds[name]["width"], 5),
                    "height": round(bounds[name]["height"], 5),
                    "depth": round(bounds[name]["depth"], 5)})
    mutable_views = {document["accessors"][i]["bufferView"] for i in transformed}
    unchanged_views = []
    for index, view in enumerate(document["bufferViews"]):
        if index in mutable_views:
            continue
        start, size = view.get("byteOffset", 0), view["byteLength"]
        if bytes(binary[start:start + size]) != original_binary[start:start + size]:
            raise ValueError("An unrelated buffer view changed")
        unchanged_views.append(index)
    expected_document = copy.deepcopy(original_document)
    for i in transformed:
        if "min" in document["accessors"][i]:
            expected_document["accessors"][i] = document["accessors"][i]
    if document != expected_document:
        raise ValueError("Unexpected non-position JSON change")
    metadata["authoringProfile"] = {"facadeSpan": span,
        "axis": "GLTF X only", "normalTransform": "inverse transpose"}
    write_glb(glb_path, document, binary)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    return {"sourceSha256": hashlib.sha256(original_blob).hexdigest(),
        "candidateSha256": hashlib.sha256(pathlib.Path(glb_path).read_bytes()).hexdigest(),
        "facadeSpan": span, "bounds": bounds,
        "changedAccessors": sorted(transformed),
        "unchangedBufferViews": unchanged_views,
        "unchanged": ["Y", "Z", "UV", "indices", "images", "materials",
            "textures", "samplers", "nodes", "counts", "triangles"],
        "validation": "Raw asset facts only, no renderer or terrain survey"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("glb", type=pathlib.Path)
    parser.add_argument("metadata", type=pathlib.Path)
    parser.add_argument("--span", type=float, required=True)
    parser.add_argument("--audit", type=pathlib.Path)
    args = parser.parse_args()
    report = stretch_facade(args.glb, args.metadata, args.span)
    if args.audit:
        args.audit.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))
