"""Reuse real low-storey prefabs; keep a small authored hierarchy of accents.

This edits only model/height in a table copy. All XZ geometry, offset and scale
contracts are checked from both HIGH/LOD raw metadata before any substitution.
The source kit and its windows, roofs, atlas and pivots are never regenerated.
"""
import argparse
import json
import pathlib
import re


def compose(source_path, metadata_path, output_path):
    source_path, output_path = pathlib.Path(source_path), pathlib.Path(output_path)
    if source_path.resolve() == output_path.resolve():
        raise ValueError("Write an external candidate, never overwrite the input table")
    text = source_path.read_text()
    towns = json.loads(re.search(r"const RETAINED_NATIONAL_SETTLEMENTS[^=]*= ([\s\S]*?);", text).group(1))
    models = json.loads(pathlib.Path(metadata_path).read_text())["models"]
    candidate, changes, kept = text, [], []
    for town in towns:
        accents = [h for block in town["blocks"] for h in block["buildings"]
                   if h["model"].endswith("_dominante")]
        # Wider footprints support real four-storey accents without narrow towers.
        retained = sorted(accents, key=lambda h: (-h["width"] * h["depth"], h["id"]))[:2 if town["major"] else 1]
        kept.extend({"town": town["name"], "id": h["id"], "model": h["model"]} for h in retained)
        retained_ids = {h["id"] for h in retained}
        for house in accents:
            if house["id"] in retained_ids:
                continue
            previous, base = house["model"], house["model"].removesuffix("_dominante")
            for suffix in ("", "_distant"):
                before, after = models[previous + suffix], models[base + suffix]
                if any(before[key][axis] != after[key][axis] for key in ("min", "max") for axis in (0, 2)):
                    raise ValueError("Raw footprint differs for " + house["id"])
                if before["min"][1] != after["min"][1] or after["min"][1] != 0:
                    raise ValueError("Ground pivot differs for " + house["id"])
            high_before, high_after = models[previous], models[base]
            raw_before = high_before["max"][1] - high_before["min"][1]
            raw_after = high_after["max"][1] - high_after["min"][1]
            height = house["height"] * raw_after / raw_before
            # This retains the former vertical model scale. Base roofs/windows
            # come directly from their authored two/three-storey geometry.
            pattern = re.compile(r'("id": "' + re.escape(house["id"]) + r'",\s*"model": ")'
                + re.escape(previous) + r'("[\s\S]*?"height": )([^,\n]+)')
            candidate, replacements = pattern.subn(lambda m: m[1] + base + m[2] + repr(height), candidate, count=1)
            if replacements != 1:
                raise ValueError("Named address not found exactly once")
            changes.append({"town": town["name"], "id": house["id"], "beforeModel": previous,
                "model": base, "previousHeight": house["height"], "height": height,
                "ratio": height / house["height"], "rawFootAndGroundPivotExact": True,
                "highTriangleDelta": high_after["triangles"] - high_before["triangles"],
                "lodTriangleDelta": models[base + "_distant"]["triangles"] - models[previous + "_distant"]["triangles"]})
    output_path.write_text(candidate)
    return {"changes": changes, "keptAccents": kept, "sameFootprints": True,
        "scope": "Actual static model/height table only; no placement/terrain/render validation"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=pathlib.Path)
    parser.add_argument("models", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--audit", type=pathlib.Path, required=True)
    args = parser.parse_args()
    report = compose(args.source, args.models, args.output)
    args.audit.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"changed": len(report["changes"]), "retainedAccents": len(report["keptAccents"]),
        "minHeightRatio": min(h["ratio"] for h in report["changes"]),
        "maxHeightRatio": max(h["ratio"] for h in report["changes"]),
        "highTriangleDelta": sum(h["highTriangleDelta"] for h in report["changes"]),
        "lodTriangleDelta": sum(h["lodTriangleDelta"] for h in report["changes"])}))
