"""Bake the inspected CC0 house into one shared PBR surface per LoD.

blender -b --disable-autoexec --python-exit-code 1 --python this-file.py -- \
  --source <library-house-miniature-seated.glb> --output-dir <external-directory>
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector, Matrix

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--output-dir", type=Path, required=True)
parser.add_argument("--skip-preview", action="store_true")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
args.output_dir.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.source))
bpy.context.view_layer.update()
objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
assert len(objects) == 2, "Expect the detailed and distant house, nothing else."
for obj in objects:
    parent = obj.parent
    obj.data.transform(obj.matrix_world)
    obj.parent = None
    obj.matrix_world.identity()
    if parent:
        obj.name = parent.name
    assert obj.name in {"maison_alsace_01", "maison_alsace_01_distant"}
objects.sort(key=lambda obj: obj.name.endswith("_distant"))
detail, distant = objects
# The old 287-triangle candidate loses wall and roof joins in a close board.
# Build the distance mesh from the inspected detailed geometry instead. There
# are only two placements in the current country; preserve those joins rather
# than keeping a reduction that visibly opens the house.
target_min = [min(vertex.co[i] for vertex in detail.data.vertices) for i in range(3)]
target_max = [max(vertex.co[i] for vertex in detail.data.vertices) for i in range(3)]
distant.data = detail.data.copy()
bpy.context.view_layer.objects.active = distant
bm = bmesh.new()
bm.from_mesh(distant.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
bm.to_mesh(distant.data)
bm.free()
reduction = distant.modifiers.new("Preserve miniature joins", "DECIMATE")
reduction.ratio = .5
reduction.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=reduction.name)
triangulation = distant.modifiers.new("Explicit export faces", "TRIANGULATE")
triangulation.keep_custom_normals = True
bpy.ops.object.modifier_apply(modifier=triangulation.name)
referenced = {index for face in distant.data.polygons for index in face.vertices}
low = [min(distant.data.vertices[index].co[i] for index in referenced) for i in range(3)]
high = [max(distant.data.vertices[index].co[i] for index in referenced) for i in range(3)]
scale = [(target_max[i] - target_min[i]) / (high[i] - low[i]) for i in range(3)]
fit = Matrix.Diagonal(Vector((*scale, 1.)))
fit.translation = Vector([target_min[i] - low[i] * scale[i] for i in range(3)])
normals = [fit.to_3x3().inverted().transposed() @ normal.vector
           for normal in distant.data.corner_normals]
distant.data.transform(fit)
distant.data.normals_split_custom_set([normal.normalized() for normal in normals])
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
scene.render.bake.margin = 8
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
scene.render.bake.use_selected_to_active = False


def image(name, colour=False):
    result = bpy.data.images.new(name, width=pixels, height=pixels, alpha=False)
    result.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    return result


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    # The two LoDs occupy the same origin. The other one must not occlude the
    # selected surface during the AO bake or darken its contact channel.
    for other in bpy.data.objects:
        other.hide_render = other != obj
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bake(obj, target, kind):
    select(obj)
    for material in obj.data.materials:
        node = material.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = target
        material.node_tree.nodes.active = node
    bpy.ops.object.bake(type=kind)
    for material in obj.data.materials:
        nodes = material.node_tree.nodes
        for node in list(nodes):
            if node.type == "TEX_IMAGE" and node.image == target:
                nodes.remove(node)


def bake_channel(obj, socket_name, target):
    restores = []
    for material in obj.data.materials:
        graph = material.node_tree
        output = next(node for node in graph.nodes if node.type == "OUTPUT_MATERIAL")
        link = output.inputs["Surface"].links[0]
        previous = link.from_socket
        shader = next(node for node in graph.nodes if node.type == "BSDF_PRINCIPLED")
        socket = shader.inputs[socket_name]
        emission = graph.nodes.new("ShaderNodeEmission")
        if socket.is_linked:
            graph.links.new(socket.links[0].from_socket, emission.inputs["Color"])
        else:
            emission.inputs["Color"].default_value = (socket.default_value,) * 3 + (1,)
        graph.links.new(emission.outputs["Emission"], output.inputs["Surface"])
        restores.append((graph, output, previous, emission))
    bake(obj, target, "EMIT")
    for graph, output, previous, emission in restores:
        graph.links.new(previous, output.inputs["Surface"])
        graph.nodes.remove(emission)


records = []
materials = []
normal_fixes = []
for obj in objects:
    select(obj)
    pixels = 128 if obj.name.endswith("_distant") else 512
    # Each LoD needs its own atlas: their surviving faces have different UVs.
    # Texture nodes explicitly keep the old UV set during the surface bake.
    # The six materials are copied so the two LoDs cannot change each other.
    for i, material in enumerate(obj.data.materials):
        obj.data.materials[i] = material.copy()
    mesh = obj.data
    # The source also contains an unused zero UV set. glTF textures explicitly
    # use TEXCOORD_0, which is not necessarily Blender's active import layer.
    source_uv = mesh.uv_layers[0]
    source_uv.name = "SourceUV"
    for material in mesh.materials:
        graph = material.node_tree
        source = graph.nodes.new("ShaderNodeUVMap")
        source.uv_map = source_uv.name
        for node in list(graph.nodes):
            if node.type == "TEX_IMAGE":
                graph.links.new(source.outputs["UV"], node.inputs["Vector"])
            elif node.type == "NORMAL_MAP":
                node.uv_map = source_uv.name
    # Reduce the texture motif to roof-scale tiles; geometry and footprint stay
    # fixed. All source PBR channels follow the same denser original UVs.
    roof_slots = {i for i, material in enumerate(mesh.materials)
                  if material.name.startswith("MI_RoundTiles")}
    assert len(roof_slots) == 1
    for polygon in mesh.polygons:
        if polygon.material_index in roof_slots:
            for loop in polygon.loop_indices:
                source_uv.data[loop].uv *= 2.5
    # Imported custom normals can oppose a tiny decimated face. Fix only those
    # loops, preserving the imported normals on every other polygon.
    mesh.calc_loop_triangles()
    normals = [normal.vector.copy() for normal in mesh.corner_normals]
    corrected = set()
    for triangle in mesh.loop_triangles:
        mean = sum((normals[i] for i in triangle.loops), Vector())
        a, b, c = (mesh.vertices[index].co for index in triangle.vertices)
        face_normal = (b - a).cross(c - a).normalized()
        if face_normal.dot(mean) < -1e-8:
            corrected.add(triangle.polygon_index)
    for polygon_index in corrected:
        polygon = mesh.polygons[polygon_index]
        for loop in polygon.loop_indices:
            normals[loop] = polygon.normal.copy()
    mesh.normals_split_custom_set(normals)
    normal_fixes.append({"model": obj.name, "correctedPolygons": sorted(corrected)})
    atlas_uv = mesh.uv_layers.new(name="AtlasUV")
    mesh.uv_layers.active = atlas_uv
    atlas_uv.active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.012,
                             area_weight=.25, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    albedo = image(obj.name + "-albedo", True)
    normal = image(obj.name + "-normal")
    roughness = image(obj.name + "-roughness")
    metallic = image(obj.name + "-metallic")
    occlusion = image(obj.name + "-occlusion")
    bake(obj, albedo, "DIFFUSE")
    bake(obj, normal, "NORMAL")
    bake_channel(obj, "Roughness", roughness)
    bake_channel(obj, "Metallic", metallic)
    # Contact occlusion occupies its own channel; no lighting enters albedo.
    scene.world = bpy.data.worlds.new(obj.name + "-bake-world")
    bake(obj, occlusion, "AO")
    orm = image(obj.name + "-orm")
    channels = [list(channel.pixels) for channel in (occlusion, roughness, metallic)]
    packed = [0.] * (pixels * pixels * 4)
    for i in range(0, len(packed), 4):
        packed[i:i + 4] = [channels[0][i], channels[1][i], channels[2][i], 1.]
    orm.pixels.foreach_set(packed)
    for texture in (albedo, normal, orm):
        # The archived source already uses JPEG for its normal and ORM maps.
        # Keep the same local format, with a higher encoding quality of 90.
        texture.filepath_raw = str(args.output_dir / (texture.name + ".jpg"))
        texture.file_format = "JPEG"
        scene.render.image_settings.quality = 90
        texture.save()
        texture.pack()
    material = bpy.data.materials.new(obj.name + "-atlas")
    material.use_nodes = True
    graph = material.node_tree
    shader = graph.nodes.get("Principled BSDF")
    shader.inputs["Metallic"].default_value = 0
    tex = graph.nodes.new("ShaderNodeTexImage")
    tex.image = albedo
    graph.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    tex = graph.nodes.new("ShaderNodeTexImage")
    tex.image = normal
    bump = graph.nodes.new("ShaderNodeNormalMap")
    bump.uv_map = "AtlasUV"
    graph.links.new(tex.outputs["Color"], bump.inputs["Color"])
    graph.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    tex = graph.nodes.new("ShaderNodeTexImage")
    tex.image = orm
    split = graph.nodes.new("ShaderNodeSeparateColor")
    graph.links.new(tex.outputs["Color"], split.inputs["Color"])
    graph.links.new(split.outputs["Green"], shader.inputs["Roughness"])
    graph.links.new(split.outputs["Blue"], shader.inputs["Metallic"])
    # The glTF exporter recognizes the dedicated occlusion input group.
    group = bpy.data.node_groups.new(obj.name + "-glTF Material Output", "ShaderNodeTree")
    group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    auxiliary = graph.nodes.new("ShaderNodeGroup")
    auxiliary.node_tree = group
    auxiliary.name = "glTF Material Output"
    graph.links.new(split.outputs["Red"], auxiliary.inputs["Occlusion"])
    mesh.materials.clear()
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.material_index = 0
    for name in [layer.name for layer in mesh.uv_layers if layer.name != "AtlasUV"]:
        mesh.uv_layers.remove(mesh.uv_layers[name])
    mesh.calc_loop_triangles()
    records.append({"model": obj.name, "trianglesBeforeExport": len(mesh.loop_triangles),
                    "materials": len(mesh.materials), "atlasPixels": pixels,
                    "bounds": [[min(vertex.co[i] for vertex in mesh.vertices) for i in range(3)],
                               [max(vertex.co[i] for vertex in mesh.vertices) for i in range(3)]]})
    materials.append(material)
    print(json.dumps(records[-1]), flush=True)

for obj in bpy.data.objects:
    obj.select_set(obj in objects)
    if obj in objects:
        obj.hide_render = False
bpy.context.view_layer.objects.active = detail
asset = args.output_dir / "library-house-atlas.glb"
bpy.ops.export_scene.gltf(filepath=str(asset), export_format="GLB", use_selection=True,
    export_yup=True, export_apply=True, export_materials="EXPORT", export_cameras=False,
    export_lights=False, export_image_format="AUTO")
bpy.ops.wm.save_as_mainfile(filepath=str(args.output_dir / "library-house-atlas.blend"))
report = {"status": "candidate-requires-browser-and-placement-review",
    "sourceSHA256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
    "exportSHA256": hashlib.sha256(asset.read_bytes()).hexdigest(),
    "bytes": asset.stat().st_size, "atlasPixels": 512, "roofUVFrequency": 2.5,
    "normalCorrections": normal_fixes, "models": records,
    "albedo": "Diffuse colour only, direct and indirect lighting excluded.",
    "ORM": "New mesh contact AO, source roughness and metallic in separate R/G/B channels.",
    "limits": ["Roof geometry remains the original miniature silhouette.",
               "One separate material per LoD still needs Babylon LoD pairing.",
               "A Blender bake alone establishes no runtime or visual conformity."]}
(args.output_dir / "house-atlas-receipt.json").write_text(json.dumps(report, indent=2) + "\n")
if args.skip_preview:
    print(json.dumps(report), flush=True)
    sys.exit(0)

# Studio-only scenery added after exporting the asset.
distant.hide_render = True
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.003))
floor = bpy.context.object
floor_mat = bpy.data.materials.new("Studio ground")
floor_mat.diffuse_color = (.24, .28, .18, 1)
floor.data.materials.append(floor_mat)
world = bpy.data.worlds.new("Studio")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.20, .28, .34, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = .6
scene.world = world
bpy.ops.object.light_add(type="AREA", location=(-6, -9, 14))
light = bpy.context.object
light.data.energy = 2000
light.data.size = 7
light.rotation_euler = (Vector((0, 0, .45)) - light.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add(location=(3, -5, 3))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 1.7
camera.rotation_euler = (Vector((0, 0, .45)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera
scene.cycles.samples = 48
scene.cycles.use_denoising = False
scene.render.resolution_x = 1000
scene.render.resolution_y = 850
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
for label, position in (("front", (3, -5, 3)), ("back", (-3, 5, 3))):
    camera.location = position
    camera.rotation_euler = (Vector((0, 0, .45)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(args.output_dir / ("house-atlas-" + label + ".png"))
    bpy.ops.render.render(write_still=True)
print(json.dumps(report), flush=True)
