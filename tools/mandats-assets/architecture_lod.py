"""Export distance geometry alongside the original MANDATS architecture.

Run after architecture.py, without rebaking or modifying its high detail source:
  blender --background --python tools/mandats-assets/architecture_lod.py
"""
from __future__ import annotations

import json
import importlib.util
import math
import pathlib

import bpy

SOURCE = pathlib.Path(__file__).resolve().parent
OUTPUT = SOURCE.parents[1] / "site/public/mandats/models"


def metrics(obj):
    obj.data.calc_loop_triangles()
    lower = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    upper = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    return {
        "width": round(upper[0] - lower[0], 4),
        "depth": round(upper[1] - lower[1], 4),
        "height": round(upper[2] - lower[2], 4),
        "min": [lower[0], lower[2], -upper[1]],
        "max": [upper[0], upper[2], -lower[1]],
        "triangles": len(obj.data.loop_triangles),
        **({"bodyHeight": float(obj["bodyHeight"])} if "bodyHeight" in obj else {}),
    }


def export_with_distance_lods(models):
    """Duplicate mesh data only; origins, UV atlases and high meshes stay intact."""
    originals = {obj.parent: obj.parent.location.copy() for obj in models}
    distant = []
    metadata = {}
    for high in models:
        name = high.parent.name
        original = metrics(high)
        metadata[name] = original
        ratio = .45 if name == "cathedrale_paris" else .40 if name in {
            "mairie_sud", "beffroi_nord"} else .48
        mesh = high.copy()
        mesh.data = high.data.copy()
        mesh.name = f"{name}_distant_mesh"
        bpy.context.collection.objects.link(mesh)
        root = bpy.data.objects.new(f"{name}_distant", None)
        bpy.context.collection.objects.link(root)
        mesh.parent = root
        mesh.matrix_parent_inverse.identity()
        mesh.location = high.location.copy()
        mesh.rotation_euler = high.rotation_euler.copy()
        mesh.scale = high.scale.copy()
        bpy.ops.object.select_all(action="DESELECT")
        mesh.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        modifier = mesh.modifiers.new("Géométrie de la vue nationale", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        mesh.data.update()
        decimated = metrics(mesh)
        raw_errors = [abs(decimated[edge][axis] - original[edge][axis]) /
                      max(original["max"][axis] - original["min"][axis], .001)
                      for edge in ("min", "max") for axis in range(3)]
        if max(raw_errors) > .015:
            raise RuntimeError(f"Distance silhouette changed excessively: {name}")
        # Collapse slightly rounds tiny fittings and the cathedral's bevelled
        # footing. Restore the original bounds in mesh space (under 1.5 percent)
        # so a LOD switch keeps the same footprint and exact ground level.
        before_min = [decimated["min"][0], -decimated["max"][2], decimated["min"][1]]
        before_max = [decimated["max"][0], -decimated["min"][2], decimated["max"][1]]
        after_min = [original["min"][0], -original["max"][2], original["min"][1]]
        after_max = [original["max"][0], -original["min"][2], original["max"][1]]
        for vertex in mesh.data.vertices:
            for axis in range(3):
                proportion = (vertex.co[axis] - before_min[axis]) / (before_max[axis] - before_min[axis])
                vertex.co[axis] = after_min[axis] + proportion * (after_max[axis] - after_min[axis])
        mesh.data.update()
        result = metrics(mesh)
        for item in mesh.data.uv_layers.active.data:
            if not all(math.isfinite(value) and -.00001 <= value <= 1.00001
                       for value in item.uv):
                raise RuntimeError(f"Invalid distance UVs: {name}")
        for vertex in mesh.data.vertices:
            if not all(math.isfinite(value) for value in vertex.co):
                raise RuntimeError(f"Invalid distance vertex: {name}")
        for normal in mesh.data.corner_normals:
            if not all(math.isfinite(value) for value in normal.vector):
                raise RuntimeError(f"Invalid distance normal: {name}")
        # Keep the high model's ground origin. Small fittings may disappear;
        # dimensional drift must stay below 1.5 percent of the original model.
        errors = [abs(result[edge][axis] - original[edge][axis]) /
                  max(original["max"][axis] - original["min"][axis], .001)
                  for edge in ("min", "max") for axis in range(3)]
        if max(errors) > .015:
            raise RuntimeError(f"Distance silhouette changed excessively: {name}")
        if abs(result["min"][1] - original["min"][1]) > .00001:
            raise RuntimeError(f"Distance ground changed: {name}")
        if list(mesh.data.materials) != list(high.data.materials):
            raise RuntimeError(f"Distance materials no longer shared: {name}")
        result["lodOf"] = name
        result["lodRatio"] = ratio
        result["maximumExtentError"] = round(max(errors), 6)
        result["decimationExtentError"] = round(max(raw_errors), 6)
        metadata[root.name] = result
        distant.append(mesh)

    bpy.ops.object.select_all(action="DESELECT")
    for mesh in [*models, *distant]:
        mesh.parent.location = (0, 0, 0)
        mesh.parent.select_set(True)
        mesh.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / "architecture.glb"), export_format="GLB",
        use_selection=True, export_yup=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_materials="EXPORT",
        export_cameras=False, export_lights=False,
    )
    # The local PNG is authoritative even when .blend keeps an older packed
    # albedo. This runs for full generation and standalone distance exports.
    slate_spec = importlib.util.spec_from_file_location("slate_albedo", SOURCE / "slate_albedo.py")
    slate_module = importlib.util.module_from_spec(slate_spec)
    slate_spec.loader.exec_module(slate_module)
    slate_module.sync_glb_albedo(OUTPUT / "architecture.glb", SOURCE / "architecture-atlas.png")
    (OUTPUT / "architecture.json").write_text(json.dumps({
        "version": 2, "units": "model units",
        "axes": "GLTF Y-up; local origin centered at ground",
        "distanceGeometry": "Explicit named models; high geometry retained for inspection",
        "models": metadata,
    }, ensure_ascii=False, indent=2) + "\n")
    for root, position in originals.items():
        root.location = position
    for mesh in distant:
        mesh.hide_render = True
    print("DISTANCE_GEOMETRY", json.dumps({
        "highTriangles": sum(metadata[mesh.parent.name]["triangles"] for mesh in models),
        "distantTriangles": sum(metadata[mesh.parent.name]["triangles"] for mesh in distant),
        "models": len(models),
    }), flush=True)
    return distant


if __name__ == "__main__":
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "architecture.blend"))
    high_models = [obj for obj in bpy.data.objects if obj.type == "MESH" and
                   obj.name.endswith("_mesh") and not obj.name.endswith("_distant_mesh")]
    export_with_distance_lods(high_models)
    # Do not save: the authored high geometry .blend remains unchanged.
