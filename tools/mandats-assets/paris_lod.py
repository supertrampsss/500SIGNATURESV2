"""Export shared-material distance geometry from the authored Paris source.

blender --background --threads 2 --python tools/mandats-assets/paris_lod.py
The high-detail .blend remains unchanged; no material or texture is duplicated.
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
    return {"width":round(upper[0]-lower[0],5),"depth":round(upper[1]-lower[1],5),
        "height":round(upper[2]-lower[2],5),"min":[lower[0],lower[2],-upper[1]],
        "max":[upper[0],upper[2],-lower[1]],"triangles":len(obj.data.loop_triangles)}


def export_distance_geometry(models):
    metadata = {}
    positions = {obj.parent:obj.parent.location.copy() for obj in models}
    clones = []
    for high in models:
        name = high.parent.name
        for normal in high.data.corner_normals:
            if not all(math.isfinite(value) for value in normal.vector):
                raise RuntimeError("Invalid Paris authored normal: " + name)
        original = metrics(high)
        metadata[name] = original
        # Apartment facade extremities collapse below .16. Other models retain
        # their envelope at .12; use the measured per-model budget.
        ratio = .16 if name == "immeuble_paris_01" else .12
        low = high.copy()
        low.data = high.data.copy()
        low.name = name + "_distant_mesh"
        bpy.context.collection.objects.link(low)
        root = bpy.data.objects.new(name + "_distant", None)
        bpy.context.collection.objects.link(root)
        low.parent = root
        low.matrix_parent_inverse.identity()
        low.location = high.location.copy()
        low.rotation_euler = high.rotation_euler.copy()
        low.scale = high.scale.copy()
        bpy.ops.object.select_all(action="DESELECT")
        low.select_set(True)
        bpy.context.view_layer.objects.active = low
        modifier = low.modifiers.new("Façades en vue nationale", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        # Collapse leaves zero-area triangles on tiny iron and frame pieces.
        # Repair the clone explicitly while keeping UV/custom data, before
        # bounds and triangle accounting. The authored high is never modified.
        topology_repaired=low.data.validate(clean_customdata=False)
        low.data.update()
        measured = metrics(low)
        errors = [abs(measured[edge][axis]-original[edge][axis])/
            max(original["max"][axis]-original["min"][axis],.001)
            for edge in ("min","max") for axis in range(3)]
        if max(errors) > .02:
            raise RuntimeError("Paris LOD silhouette changed excessively: " + name)
        before_min = [measured["min"][0],-measured["max"][2],measured["min"][1]]
        before_max = [measured["max"][0],-measured["min"][2],measured["max"][1]]
        after_min = [original["min"][0],-original["max"][2],original["min"][1]]
        after_max = [original["max"][0],-original["min"][2],original["max"][1]]
        for vertex in low.data.vertices:
            for axis in range(3):
                proportion = (vertex.co[axis]-before_min[axis])/(before_max[axis]-before_min[axis])
                vertex.co[axis] = after_min[axis]+proportion*(after_max[axis]-after_min[axis])
            if not all(math.isfinite(value) for value in vertex.co):
                raise RuntimeError("Invalid Paris distance vertex")
        low.data.update()
        if low.data.validate(clean_customdata=False):
            raise RuntimeError("Paris distance topology changed after extent restoration")
        low.data.update()
        for loop in low.data.uv_layers.active.data:
            if not all(math.isfinite(value) and -.00001 <= value <= 1.00001 for value in loop.uv):
                raise RuntimeError("Invalid Paris distance UV")
        if list(low.data.materials) != list(high.data.materials):
            raise RuntimeError("Paris distance material is not shared")
        for normal in low.data.corner_normals:
            if not all(math.isfinite(value) for value in normal.vector):
                raise RuntimeError("Invalid Paris distance normal: " + name)
        result = metrics(low)
        result.update(lodOf=name,lodRatio=ratio,decimationExtentError=round(max(errors),6),
            topologyRepaired=topology_repaired)
        metadata[root.name] = result
        clones.append(low)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [*models,*clones]:
        obj.parent.location = (0,0,0)
        obj.select_set(True)
        obj.parent.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/"paris.glb"),export_format="GLB",
        use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,
        export_normals=True,export_materials="EXPORT",export_cameras=False,export_lights=False)
    # The local PNG is authoritative even when .blend keeps an older packed
    # albedo. This runs for full generation and standalone distance exports.
    slate_spec = importlib.util.spec_from_file_location("slate_albedo", SOURCE / "slate_albedo.py")
    slate_module = importlib.util.module_from_spec(slate_spec)
    slate_spec.loader.exec_module(slate_module)
    slate_module.sync_glb_albedo(OUTPUT / "paris.glb", SOURCE / "paris-atlas.png")
    (OUTPUT/"paris.json").write_text(json.dumps({"version":2,
        "axes":"GLTF Y-up; footprint centred at ground", "front":"+Z; hotel second facade +X",
        "distanceGeometry":"Named _distant models; high-detail geometry retained",
        "models":metadata},ensure_ascii=False,indent=2)+"\n")
    for root,position in positions.items():
        root.location = position
    for obj in clones:
        obj.hide_render = True
    print("PARIS_LODS",json.dumps(metadata),flush=True)
    return clones


if __name__ == "__main__":
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/"paris.blend"))
    models = [obj for obj in bpy.data.objects if obj.type == "MESH" and
        obj.name.endswith("_mesh") and not obj.name.endswith("_distant_mesh")]
    export_distance_geometry(models)
