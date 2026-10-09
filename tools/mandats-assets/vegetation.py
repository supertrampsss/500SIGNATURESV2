"""Authored miniature vegetation. Run: blender -b --python tools/mandats-assets/vegetation.py"""
import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

DEST = Path(__file__).resolve().parents[2] / "site/public/mandats/models/vegetation.glb"
DEST.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(58307)

def rgb(hex_color):
    color = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in color) + (1,)

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    mat['authored_tint'] = rgb(color)
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    shader.inputs['Roughness'].default_value = .94
    attribute = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    attribute.layer_name = 'contact-shade'
    mat.node_tree.links.new(attribute.outputs['Color'], shader.inputs['Base Color'])
    return mat

bark = material('weathered-bark', '63563D')
leaf = material('canopy-olive', '596D2D')
leaf_light = material('canopy-sunlit', '728441')
leaf_dark = material('canopy-shade', '334925')
needle = material('pine-needles', '3D542C')
silver = material('olive-silver', '7D8960')
rock_mat = material('weathered-limestone', 'B3A285')

parts = []
def branch(a, b, radius, mat=bark, top=.45):
    a, b = Vector(a), Vector(b)
    delta = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=radius,
        radius2=radius * top, depth=delta.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    parts.append(obj)
    return obj

def crown(center, size, mat=leaf, irregular=.12, seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=center)
    obj = bpy.context.object
    rng = random.Random(seed)
    for vertex in obj.data.vertices:
        vertex.co *= 1 + rng.uniform(-irregular, irregular)
    obj.scale = size
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    parts.append(obj)
    return obj

def finish(name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    # Every prefab uses its ground contact as origin, not an exhibition offset.
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Contact shade is authored into vertex colours. The canopy underside and
    # inner branching stay darker in the same physical sun used by Babylon.
    colors = obj.data.color_attributes.new(name='contact-shade', type='BYTE_COLOR', domain='CORNER')
    for poly in obj.data.polygons:
        tint = obj.data.materials[poly.material_index]['authored_tint']
        for index in poly.loop_indices:
            loop = obj.data.loops[index]
            p = obj.data.vertices[loop.vertex_index].co
            underside = max(0, -poly.normal.z)
            lower = max(0, .42 - p.z) / .42
            shade = 1 - underside * .14 - lower * .1
            colors.data[index].color = (tint[0] * shade, tint[1] * shade, tint[2] * shade, 1)
    parts.clear()
    return obj

# An oak has a branching trunk and an asymmetric, spreading crown.
branch((0, 0, 0), (.02, .005, .66), .035)
for i in range(9):
    angle = i * 2.399 + .2
    radius = .21 + (i % 3) * .035
    end = (math.cos(angle) * radius, math.sin(angle) * radius, .56 + (i % 4) * .075)
    branch((.012, 0, .3 + i * .023), end, .012, top=.12)
    for j in range(2):
        crown((end[0] + (j - .5) * .085, end[1], end[2] + j * .05),
            (.16, .145, .17), [leaf, leaf_light, leaf_dark][(i + j) % 3], seed=i * 3 + j)
crown((.02, -.015, .87), (.17, .15, .17), leaf_light, seed=41)
finish('oak')

# A beech carries many smaller lobes above a slender, forked stem.
branch((0, 0, 0), (-.015, 0, .9), .028)
for i in range(12):
    angle = i * 2.399
    height = .44 + (i % 5) * .095
    spread = .19 * (1 - max(0, height - .7))
    end = (math.cos(angle) * spread, math.sin(angle) * spread, height)
    branch((-.01, 0, height - .16), end, .009, top=.12)
    crown(end, (.13, .12, .16), [leaf, leaf_light][i % 2], seed=70 + i)
crown((-.015, .01, .92), (.13, .12, .16), leaf_light, seed=94)
finish('beech')

# Pines use staggered branch whorls and needle clusters, not a stack of cones.
branch((0, 0, 0), (.015, -.008, 1.17), .027, top=.1)
for tier in range(6):
    height = .38 + tier * .125
    spread = .225 * (1 - tier * .13)
    for j in range(5):
        angle = j * math.tau / 5 + tier * .72
        end = (math.cos(angle) * spread, math.sin(angle) * spread, height + .025)
        branch((0, 0, height - .035), end, .0065, top=.1)
        crown(end, (spread * .68, spread * .56, .092), needle if j % 3 else leaf_dark,
            irregular=.19, seed=120 + tier * 5 + j)
crown((.01, -.008, 1.11), (.063, .06, .11), needle, seed=156)
finish('pine')

# Mediterranean cypresses retain a narrow uneven silhouette with visible bark.
branch((0, 0, 0), (0, .008, 1.1), .02)
for i in range(10):
    h = .26 + i * .083
    radius = .08 * (1 - max(0, h - .65) * 1.1)
    crown((math.sin(i * 2.4) * .018, math.cos(i * 2.4) * .018, h),
        (radius, radius * .88, .105), leaf_dark if i % 3 else needle, seed=180 + i)
finish('cypress')

# An old olive tree spreads from a bent trunk into flattened, silver foliage.
branch((0, 0, 0), (.04, -.014, .38), .036)
for i in range(7):
    angle = i * 2.399
    end = (math.cos(angle) * .22, math.sin(angle) * .22, .4 + (i % 3) * .052)
    branch((.025, -.008, .2), end, .016, top=.1)
    crown(end, (.17, .14, .13), silver if i % 3 else leaf_dark, seed=210 + i)
crown((.02, 0, .55), (.19, .16, .13), silver, seed=231)
finish('olive')

# Fruit trees keep a low spreading crown suitable for orchard rows.
branch((0, 0, 0), (0, 0, .43), .025)
for i in range(6):
    angle = i * math.tau / 6
    end = (math.cos(angle) * .13, math.sin(angle) * .13, .36 + (i % 2) * .06)
    branch((0, 0, .23), end, .009)
    crown(end, (.12, .115, .12), leaf_light if i % 2 else leaf, seed=245 + i)
crown((0, 0, .48), (.115, .1, .115), leaf_light, seed=259)
finish('orchard')

# A fractured boulder supplements the continuous sculpted terrain.
crown((0, 0, .18), (.32, .22, .23), rock_mat, irregular=.3, seed=317)
obj = finish('rock')
for poly in obj.data.polygons:
    poly.use_smooth = False

# Small crowns retain their silhouette in the country view. UVs, vertex tint
# and material slots survive the decimation; inspection uses the full model.
for source in list(bpy.data.objects):
    if source.type != 'MESH' or source.name == 'rock':
        continue
    distant = source.copy()
    distant.data = source.data.copy()
    distant.name = source.name + '_distant'
    bpy.context.collection.objects.link(distant)
    bpy.context.view_layer.objects.active = distant
    modifier = distant.modifiers.new('Country view geometry', 'DECIMATE')
    modifier.ratio = {'oak': .085, 'beech': .095, 'pine': .08,
        'cypress': .085, 'olive': .14, 'orchard': .15}[source.name]
    # The ground-connected stem must survive from every direction. Protect
    # only its disconnected component on the distant copy, not every branch.
    edges = [[] for _ in distant.data.vertices]
    for edge in distant.data.edges:
        a, b = edge.vertices
        edges[a].append(b)
        edges[b].append(a)
    pending = [min(distant.data.vertices, key=lambda vertex: vertex.co.z).index]
    stem = set()
    while pending:
        index = pending.pop()
        if index in stem:
            continue
        stem.add(index)
        pending.extend(edges[index])
    group = distant.vertex_groups.new(name='Country stem silhouette')
    group.add(list(stem), 1, 'REPLACE')
    modifier.vertex_group = group.name
    modifier.invert_vertex_group = True
    modifier.vertex_group_factor = 1000
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)

bpy.ops.object.select_all(action='SELECT')
properties = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
options = dict(filepath=str(DEST), export_format='GLB', export_apply=True,
    export_yup=True, export_normals=True, export_texcoords=True,
    export_materials='EXPORT', export_all_vertex_colors=True, export_colors=True,
    export_cameras=False, export_lights=False)
bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in properties})
print('VEGETATION_GLTF', DEST, DEST.stat().st_size)
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        print('PREFAB', obj.name, len(obj.data.vertices), len(obj.data.polygons))
