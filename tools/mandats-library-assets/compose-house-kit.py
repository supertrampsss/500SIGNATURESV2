"""Substitute only the two inspected house roots in an architecture GLB."""
import argparse
import copy
import hashlib
import json
import struct
from pathlib import Path


def read_glb(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<III", data)
    assert (magic, version, total) == (0x46546C67, 2, len(data))
    size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    document = json.loads(data[20:20 + size])
    size2, kind2 = struct.unpack_from("<II", data, 20 + size)
    assert kind2 == 0x004E4942 and 28 + size + size2 == len(data)
    return document, data[28 + size:], hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--house", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, help="Architecture JSON to preserve and update beside the output.")
    args = parser.parse_args()
    assert args.output.resolve() not in {args.base.resolve(), args.house.resolve()}
    base, binary, base_sha = read_glb(args.base)
    house, added, house_sha = read_glb(args.house)
    house_counts = {node["name"]: sum(house["accessors"][primitive["indices"]]["count"] // 3
        for primitive in house["meshes"][node["mesh"]]["primitives"])
        for node in house["nodes"] if "mesh" in node}
    assert not house.get("extensionsUsed") and not house.get("skins") and not house.get("animations")
    original = copy.deepcopy(base)
    keys = ["bufferViews", "accessors", "samplers", "images", "textures", "materials", "meshes", "nodes"]
    delta = {key: len(base.get(key, [])) for key in keys}
    assert len(binary) % 4 == 0
    for view in house["bufferViews"]:
        assert view["buffer"] == 0
        view["byteOffset"] = view.get("byteOffset", 0) + len(binary)
    for accessor in house["accessors"]:
        accessor["bufferView"] += delta["bufferViews"]
    for item in house["images"]:
        assert "uri" not in item
        item["bufferView"] += delta["bufferViews"]
    for texture in house["textures"]:
        texture["source"] += delta["images"]
        if "sampler" in texture:
            texture["sampler"] += delta["samplers"]

    def texture_indices(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key.endswith("Texture") and isinstance(item, dict):
                    item["index"] += delta["textures"]
                else:
                    texture_indices(item)
        elif isinstance(value, list):
            for item in value:
                texture_indices(item)

    texture_indices(house["materials"])
    for mesh in house["meshes"]:
        for primitive in mesh["primitives"]:
            primitive["material"] += delta["materials"]
            primitive["indices"] += delta["accessors"]
            primitive["attributes"] = {key: index + delta["accessors"]
                                       for key, index in primitive["attributes"].items()}
    for node in house["nodes"]:
        if "mesh" in node:
            node["mesh"] += delta["meshes"]
        if "children" in node:
            node["children"] = [index + delta["nodes"] for index in node["children"]]
    expected = {"maison_alsace_01", "maison_alsace_01_distant"}
    new_roots = house["scenes"][house.get("scene", 0)]["nodes"]
    assert {house["nodes"][index]["name"] for index in new_roots} == expected
    previous = {index for index, node in enumerate(original["nodes"])
                if node.get("name") in expected}
    assert len(previous) == 2, "Use the original architecture kit, not an already composed export."
    for key in keys:
        base.setdefault(key, []).extend(house.get(key, []))
        assert base[key][:delta[key]] == original.get(key, [])
    old_roots = original["scenes"][original.get("scene", 0)]["nodes"]
    assert previous <= set(old_roots)
    base["scenes"][base.get("scene", 0)]["nodes"] = [index for index in old_roots
        if index not in previous] + [index + delta["nodes"] for index in new_roots]
    base["buffers"][0]["byteLength"] = len(binary) + len(added)
    document = json.dumps(base, separators=(",", ":")).encode()
    document += b" " * (-len(document) % 4)
    combined = binary + added
    combined += b"\0" * (-len(combined) % 4)
    result = struct.pack("<III", 0x46546C67, 2, 28 + len(document) + len(combined))
    result += struct.pack("<II", len(document), 0x4E4F534A) + document
    result += struct.pack("<II", len(combined), 0x004E4942) + combined
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(result)
    if args.metadata:
        metadata = json.loads(args.metadata.read_text())
        for name in expected:
            model = metadata["models"][name]
            model["triangles"] = house_counts[name]
            model["primitives"] = 1
            model["atlasPixels"] = 128 if name.endswith("_distant") else 512
            model["source"] = "Quaternius Medieval Village MegaKit standard 2025, CC0"
            model.pop("bodyHeight", None)
            if name.endswith("_distant"):
                model["lodRatio"] = house_counts[name] / house_counts["maison_alsace_01"]
        args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
    report = {"baseSHA256": base_sha, "houseSHA256": house_sha,
        "outputSHA256": hashlib.sha256(result).hexdigest(), "bytes": len(result),
        "replacedRoots": sorted(expected), "preservedOriginalSections": keys,
        "preservedOriginalBinaryBytes": len(binary),
        "unchangedActiveRoots": len(old_roots) - len(previous),
        "limits": ["Unused original house data remains in the buffer.",
                   "This composition check does not validate physical placement or artistic fidelity."]}
    args.output.with_suffix(".receipt.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
