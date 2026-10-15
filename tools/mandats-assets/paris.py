"""Original Paris architecture, authored and baked with Blender 4.3.

blender --background --threads 6 --python tools/mandats-assets/paris.py
--shape-preview checks source geometry without replacing production assets.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys

import bpy
from mathutils import Matrix, Vector

SOURCE = pathlib.Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
OUTPUT = ROOT / "site/public/mandats/models"
EVIDENCE = ROOT.parent / "mandats-verification/authored-3d"
OUTPUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument("--shape-preview", action="store_true")
parser.add_argument("--skip-bake", action="store_true")
parser.add_argument("--no-preview", action="store_true")
options = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)

COLORS = {
    "calcaire": (.60, .53, .43),
    "pierre_taille": (.70, .63, .52),
    "pierre_patinee": (.51, .44, .34),
    "enduit_creme": (.67, .57, .42),
    "enduit_rose": (.57, .40, .30),
    "ardoise": (.025, .045, .075),
    "zinc": (.21, .25, .27),
    "tuile": (.40, .16, .083),
    "brique": (.36, .14, .075),
    "fer": (.042, .059, .060),
    "bois": (.16, .075, .035),
    "bois_peint": (.11, .17, .14),
    "verre": (.10, .20, .24),
    "verre_reflet": (.19, .29, .30),
    "rideau": (.51, .46, .35),
    "laiton": (.42, .29, .10),
}
MATERIALS = {}
for name, color in COLORS.items():
    material = bpy.data.materials.new("Paris source " + name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = .31 if name.startswith("verre") else .91
    shader.inputs["Metallic"].default_value = .65 if name in {"fer", "laiton", "zinc"} else 0
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 42 if name.startswith("pierre") or name == "calcaire" else 30
    noise.inputs["Detail"].default_value = 3
    links.new(coordinates.outputs["Object"], noise.inputs["Vector"])
    tint = nodes.new("ShaderNodeMixRGB")
    tint.blend_type = "MULTIPLY"
    tint.inputs[0].default_value = .13 if name.startswith("verre") else .22
    tint.inputs[1].default_value = (*color, 1)
    links.new(noise.outputs["Fac"], tint.inputs[2])
    color_socket = tint.outputs["Color"]
    height_socket = noise.outputs["Fac"]
    if name in {"calcaire", "pierre_patinee", "enduit_creme", "enduit_rose", "ardoise", "tuile", "brique"}:
        separate = nodes.new("ShaderNodeSeparateXYZ")
        combine = nodes.new("ShaderNodeCombineXYZ")
        links.new(coordinates.outputs["Object"], separate.inputs[0])
        links.new(separate.outputs["X"], combine.inputs["X"])
        links.new(separate.outputs["Z"], combine.inputs["Y"])
        bricks = nodes.new("ShaderNodeTexBrick")
        links.new(combine.outputs[0], bricks.inputs["Vector"])
        bricks.inputs["Scale"].default_value = 1
        bricks.inputs["Brick Width"].default_value = .065 if name in {"ardoise", "tuile"} else .24
        bricks.inputs["Row Height"].default_value = .038 if name in {"ardoise", "tuile"} else .10
        bricks.inputs["Mortar Size"].default_value = .0016 if name == "ardoise" else .0023
        bricks.inputs["Mortar Smooth"].default_value = .001
        bricks.inputs["Color1"].default_value = (*color, 1)
        bricks.inputs["Color2"].default_value = (*(component * .86 for component in color), 1)
        bricks.inputs["Mortar"].default_value = (*(component * .63 for component in color), 1)
        mix = nodes.new("ShaderNodeMixRGB")
        mix.inputs[0].default_value = .55 if name in {"ardoise", "tuile", "brique"} else .26
        links.new(tint.outputs[0], mix.inputs[1])
        links.new(bricks.outputs["Color"], mix.inputs[2])
        color_socket = mix.outputs[0]
        height_socket = bricks.outputs["Fac"]
    links.new(color_socket, shader.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .21 if name == "ardoise" else .13
    bump.inputs["Distance"].default_value = .0028
    links.new(height_socket, bump.inputs["Height"])
    links.new(bump.outputs[0], shader.inputs["Normal"])
    roughness = nodes.new("ShaderNodeMapRange")
    roughness.inputs["To Min"].default_value = .10 if name.startswith("verre") else .30 if name in {"fer", "laiton"} else .55
    roughness.inputs["To Max"].default_value = .22 if name.startswith("verre") else .40 if name in {"fer", "laiton"} else .68 if name in {"ardoise", "zinc"} else .75
    links.new(noise.outputs["Fac"], roughness.inputs["Value"])
    links.new(roughness.outputs[0], shader.inputs["Roughness"])
    links.new(shader.outputs[0], output.inputs[0])
    MATERIALS[name] = material

PARTS = []
MODELS = []
CURRENT = ""


def part(obj, material):
    obj.name = f"{CURRENT}_detail_{len(PARTS):04}"
    obj.data.materials.append(MATERIALS[material])
    PARTS.append(obj)
    return obj


def poly(vertices, faces, material="pierre_taille"):
    data = bpy.data.meshes.new("Élément composé")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new("Élément composé", data)
    bpy.context.collection.objects.link(obj)
    return part(obj, material)


def box(location, size, material="pierre_taille", bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    part(obj, material)
    if bevel:
        modifier = obj.modifiers.new("Pierre légèrement adoucie", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        for face in obj.data.polygons:
            face.use_smooth = True
        modifier = obj.modifiers.new("Normales architecturales", "WEIGHTED_NORMAL")
        modifier.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def beam(a, b, thickness=.008, material="fer", width=None):
    delta = Vector(b) - Vector(a)
    obj = box((Vector(a) + Vector(b)) / 2, (thickness, width or thickness, delta.length), material)
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return obj


def cylinder(location, radius, height, material="pierre_taille", count=8, radius_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=count, radius1=radius,
        radius2=radius if radius_top is None else radius_top, depth=height, location=location)
    obj = part(bpy.context.object, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def ring(x, y, z, radius=.023):
    # Four-sided swept iron: the ornament remains a volume even in silhouette.
    vertices, faces = [], []
    for step in range(10):
        angle = step * math.tau / 10
        radial = Vector((math.cos(angle), 0, math.sin(angle)))
        centre = Vector((x, y, z)) + radial * radius
        for offset in (radial * .0033, Vector((0, .0033, 0)), -radial * .0033, Vector((0, -.0033, 0))):
            vertices.append(centre + offset)
    for step in range(10):
        for corner in range(4):
            faces.append((step * 4 + corner, step * 4 + (corner + 1) % 4,
                ((step + 1) % 10) * 4 + (corner + 1) % 4, ((step + 1) % 10) * 4 + corner))
    return poly(vertices, faces, "fer")


def transform_new(start, x=0, y=0, angle=0):
    transform = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(angle, 4, "Z")
    for obj in PARTS[start:]:
        obj.matrix_world = transform @ obj.matrix_world


def wall_cell(x, face, z0, z1, width, opening=.205, height=.285, material="calcaire", centre=None):
    centre = (z0 + z1) / 2 if centre is None else centre
    if not opening:
        box((x, face + .055, (z0 + z1) / 2), (width, .11, z1 - z0), material)
        return
    for side in (-1, 1):
        box((x + side * (width + opening) / 4, face + .055, (z0 + z1) / 2),
            ((width - opening) / 2, .11, z1 - z0), material)
    for low, high in ((z0, centre - height / 2), (centre + height / 2, z1)):
        if high > low:
            box((x, face + .055, (high + low) / 2), (opening, .11, high - low), material)


def window(x, face, z, width=.205, height=.285, ornament=False, shutters=False, sash="bois", frame="pierre_taille"):
    # The wall has a real opening. Glass sits 4 cm behind its outer surface.
    box((x, face + .046, z), (width - .010, .008, height - .01), "verre")
    box((x + width * .12, face + .040, z + height * .12), (width * .30, .006, height * .50), "verre_reflet")
    for side in (-1, 1):
        box((x + side * (width / 2 + .006), face + .012, z), (.027, .073, height + .045), frame, .002)
        box((x + side * (width / 2 - .016), face + .038, z), (.012, .016, height - .012), sash)
        box((x + side * width * .32, face + .043, z), (width * .12, .004, height * .86), "rideau")
    box((x, face + .032, z), (.012, .017, height - .012), sash)
    box((x, face + .032, z + height * .10), (width - .022, .017, .009), sash)
    for side in (-1, 1):
        box((x, face + .032, z + side * (height / 2 - .010)), (width, .017, .012), sash)
    box((x, face - .012, z - height / 2 - .021), (width + .067, .095, .029), frame, .002)
    box((x, face - .016, z + height / 2 + .021), (width + .056, .082, .034), frame, .003)
    if ornament:
        box((x, face - .029, z + height / 2 + .049), (width + .089, .099, .017), frame)
        poly([(x-width*.45,face-.082,z+height/2+.058),(x+width*.45,face-.082,z+height/2+.058),
            (x,face-.082,z+height/2+.089),(x-width*.45,face-.045,z+height/2+.058),
            (x+width*.45,face-.045,z+height/2+.058),(x,face-.045,z+height/2+.089)],
            [(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)], frame)
    if shutters:
        for side in (-1, 1):
            box((x + side * (width / 2 + .065), face - .007, z), (.078, .025, height + .008), "bois_peint", .002)
            for zz in (-.07, .01, .09):
                box((x + side * (width / 2 + .065), face - .023, z + zz), (.069, .010, .006), "bois")


def door(x, face, width=.25, height=.40, z0=.022):
    box((x, face + .037, z0 + height / 2), (width, .018, height), "bois")
    for side in (-1, 1):
        box((x + side * (width / 2 + .015), face - .009, z0 + height / 2), (.040, .092, height + .025), "pierre_taille", .003)
        for zz in (z0 + height * .24, z0 + height * .63):
            box((x + side * width * .235, face + .020, zz), (width * .33, .019, height * .25), "bois_peint", .002)
        cylinder((x + side * .020, face + .008, z0 + height * .48), .005, .026, "laiton", count=6)
    box((x, face - .024, z0 + height + .018), (width + .105, .117, .044), "pierre_taille", .003)
    box((x, face - .043, .010), (width + .09, .116, .020), "pierre_patinee")
    box((x, face + .020, z0 + height * .85), (width * .86, .014, height * .10), "verre_reflet")


def balcony(x, face, z, width=.27, ornate=True):
    box((x, face - .066, z), (width + .025, .17, .023), "pierre_taille", .002)
    front = face - .141
    rail_top = z + .145
    beam((x-width/2,front,rail_top),(x+width/2,front,rail_top),.011)
    beam((x-width/2,front,z+.050),(x+width/2,front,z+.050),.007)
    for side in (-1, 1):
        beam((x+side*width/2,front,z+.020),(x+side*width/2,front,rail_top),.009)
        beam((x+side*width/2,front,rail_top),(x+side*width/2,face-.008,rail_top),.009)
        poly([(x+side*width*.30-.018,face-.12,z-.012),(x+side*width*.30+.018,face-.12,z-.012),
            (x+side*width*.30+.018,face-.003,z-.012),(x+side*width*.30-.018,face-.003,z-.090),
            (x+side*width*.30+.018,face-.003,z-.090),(x+side*width*.30-.018,face-.003,z-.012)],
            [(0,1,2,5),(0,5,3),(1,4,2),(0,3,4,1),(3,5,2,4)], "pierre_taille")
    count = max(3, round(width / .055))
    for index in range(count - 1):
        xx = x - width / 2 + (index + 1) * width / count
        beam((xx,front,z+.024),(xx,front,rail_top),.005)
    if ornate:
        for xx in (-width*.23, width*.23):
            ring(x+xx,front,z+.09,min(.023,width*.08))


def bands(width, depth, height, levels, material="pierre_taille"):
    box((0, 0, .027), (width + .018, depth + .018, .054), "pierre_patinee")
    for z in levels:
        box((0, 0, z), (width + .021, depth + .021, .022), material)
        box((0, 0, z + .014), (width + .033, depth + .033, .009), material)
    # Composed three-step cornice instead of a giant white slab.
    for z, overhang, thickness in ((height-.043,.014,.027),(height-.020,.040,.018),(height,.066,.023)):
        box((0, 0, z), (width + overhang * 2, depth + overhang * 2, thickness), material, .002)


def mansard(width, depth, z, rise=.39, corner=0):
    if corner:
        outline = [(-width/2,-depth/2),(width/2-corner,-depth/2),(width/2,-depth/2+corner),
            (width/2,depth/2),(-width/2,depth/2)]
    else:
        outline = [(-width/2,-depth/2),(width/2,-depth/2),(width/2,depth/2),(-width/2,depth/2)]
    # Steep lower mansard, then four shallow slopes meeting a real ridge.
    # A large flat plateau reads as an industrial box from the game camera.
    rings = []
    for shrink, zz in ((-.048,z+.012),(.115,z+rise*.68)):
        rings.append([(x-math.copysign(shrink,x),y-math.copysign(shrink,y),zz) for x,y in outline])
    n = len(outline)
    vertices = sum(rings, [])
    poly(vertices, [(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],"ardoise")
    upper=rings[-1]+[(-width/2+.29,0,z+rise),(width/2-.29,0,z+rise)]
    faces=[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)] if n==4 else [
        (0,1,6,5),(1,2,6),(2,3,6),(3,4,5,6),(4,0,5)]
    poly(upper,faces,"ardoise")
    beam(upper[-2],upper[-1],.016,"zinc")
    for index in range(n):
        beam(rings[0][index],rings[1][index],.012,"zinc")
        beam(rings[1][index],rings[1][(index+1)%n],.011,"zinc")


def pitched(width, depth, z, rise=.29, material="ardoise", hip=False):
    w, d = width + .07, depth + .07
    inset = .17 if hip else 0
    vertices = [(-w/2,-d/2,z),(w/2,-d/2,z),(w/2,d/2,z),(-w/2,d/2,z),
        (-w/2+inset,0,z+rise),(w/2-inset,0,z+rise)]
    poly(vertices,[(0,1,5,4),(2,3,4,5),(0,4,3),(1,2,5)],material)
    beam(vertices[4],vertices[5],.020,material)
    if not hip:
        for side in (-1,1):
            poly([(side*width/2,-depth/2,z),(side*width/2,depth/2,z),(side*width/2,0,z+rise-.020)],
                [(0,1,2)] if side > 0 else [(2,1,0)], "calcaire")


def dormer(x, face, z, width=.195, height=.22, pediment=True):
    for side in (-1,1):
        box((x+side*(width/2-.009),face+.060,z+height/2),(.018,.17,height),"pierre_taille")
    box((x,face+.136,z+height/2),(width,.028,height),"pierre_taille")
    # Dormer window is a real shallow cut into its constructed front panel.
    wall_cell(x,face-.035,z+.025,z+height-.015,width,opening=width*.63,
        height=height*.64,material="pierre_taille")
    window(x,face-.035,z+height*.53,width*.63,height*.64,sash="bois_peint")
    if pediment:
        poly([(x-width*.61,face-.050,z+height),(x+width*.61,face-.050,z+height),
            (x,face-.050,z+height+.065),(x-width*.61,face+.15,z+height),
            (x+width*.61,face+.15,z+height),(x,face+.15,z+height+.065)],
            [(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)], "zinc")
    else:
        box((x,face+.040,z+height+.018),(width+.06,.22,.036),"zinc")


def chimney(x,y,z,height=.23):
    box((x,y,z+height/2),(.095,.115,height),"brique",.004)
    box((x,y,z+height-.013),(.125,.142,.026),"pierre_patinee")
    for side in (-1,1):
        cylinder((x+side*.029,y,z+height+.030),.018,.07,"tuile",count=8)


def back_elevation(width,depth,height,floors=3):
    # Rear elevation has the same actual recesses as the street, with less ornament.
    start = len(PARTS)
    face = -depth/2
    count = 3
    for level in range(floors):
        low, high = level*height/floors,(level+1)*height/floors
        for index in range(count):
            x = -width/2+(index+.5)*width/count
            wall_cell(x,face,low,high,width/count,.16,.22)
            window(x,face,(low+high)/2,.16,.22,sash="bois_peint")
    transform_new(start,angle=math.pi)


def back_and_side(width,depth,height,floors=3,side_openings=()):
    back_elevation(width,depth,height,floors)
    for side in (-1,1):
        if side not in side_openings:
            box((side*(width/2-.055),0,height/2),(.11,depth-.22,height),"calcaire")
            continue
        before=len(PARTS)
        for level in range(floors):
            low,high=level*height/floors,(level+1)*height/floors
            opening=.145 if level>0 else 0
            wall_cell(0,0,low,high,depth-.22,opening,.235)
            if opening:
                window(0,0,(low+high)/2,opening,.235,sash="bois_peint")
        transform_new(before,side*width/2,0,side*math.pi/2)


def start(name):
    global PARTS, CURRENT
    PARTS = []
    CURRENT = name


def finish():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = CURRENT + "_mesh"
    bpy.context.scene.cursor.location = (0,0,0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    # True ground-centred footprint, including balconies and cornice projection.
    minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    offset = Vector(((minimum[0]+maximum[0])/2,(minimum[1]+maximum[1])/2,minimum[2]))
    for vertex in obj.data.vertices:
        vertex.co -= offset
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.0001,
        margin_method="FRACTION")
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.calc_loop_triangles()
    MODELS.append(obj)
    print("PARIS_MODEL",CURRENT,len(obj.data.loop_triangles),flush=True)
    return obj


def immeuble():
    start("immeuble_paris_01")
    width, depth, height = 1.74,1.07,1.94
    face = -depth/2
    xs = [(index-2)*width/5 for index in range(5)]
    boundaries = [0,.49,.97,1.45,1.90]
    for level in range(4):
        low, high = boundaries[level],boundaries[level+1]
        for index,x in enumerate(xs):
            if level == 0 and index == 2:
                wall_cell(x,face,low,high,width/5,.275,.385,centre=.225)
                door(x,face,.275,.385,.032)
            else:
                opening = .22 if level == 0 else .205
                centre = (low+high)/2+.002
                wall_cell(x,face,low,high,width/5,opening,.31,centre=centre)
                window(x,face,centre,opening,.31,ornament=level in (1,2))
                if level == 1:
                    balcony(x,face,low+.064,width=.265)
                if level == 3:
                    balcony(x,face,low+.064,width=.245,ornate=False)
    for x in (-width/2+.030,width/2-.030):
        box((x,face-.008,height/2),(.056,.040,height-.070),"pierre_taille",.003)
        for level in range(8):
            box((x,face-.031,.13+level*.226),(.065,.020,.073),"pierre_taille")
    # Second-floor continuous wrought-iron balcony is the dominant Paris motif.
    balcony(0,face,1.035,width=1.57,ornate=False)
    for x in (-.52,0,.52):
        ring(x,face-.141,1.128,.026)
    bands(width,depth,height,[.49,.97,1.45])
    back_and_side(width,depth,height,floors=4,side_openings=(-1,1))
    mansard(width,depth,height,.365)
    for x in (-.53,0,.53):
        dormer(x,face-.023,height+.035,width=.205,height=.205,pediment=x!=0)
    chimney(-.64,.17,height+.23,.25)
    chimney(.64,.11,height+.22,.23)
    return finish()


def arcade_cell(x,face,width,z_top=.54,opening=.27,spring=.29,material="calcaire"):
    radius = opening/2
    for side in (-1,1):
        box((x+side*(width+opening)/4,face+.055,z_top/2),((width-opening)/2,.11,z_top),material)
    # Fill above the round vault; the arch opening remains empty all the way back.
    vertices,faces = [],[]
    for index in range(9):
        xx = -radius+index*opening/8
        arch_z = spring + math.sqrt(max(0,radius*radius-xx*xx))
        vertices.extend([(x+xx,face,arch_z),(x+xx,face,z_top),
            (x+xx,face+.11,arch_z),(x+xx,face+.11,z_top)])
    for index in range(8):
        a,b = index*4,(index+1)*4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    poly(vertices,faces,material)
    outline = [(x-radius,face+.05,.026),(x+radius,face+.05,.026),
        (x+radius,face+.05,spring)]
    outline += [(x+radius*math.cos(index*math.pi/8),face+.05,
        spring+radius*math.sin(index*math.pi/8)) for index in range(1,9)]
    poly(outline,[tuple(range(len(outline)))],"verre_reflet")
    for index in range(9):
        a,b = index*math.pi/9,(index+1)*math.pi/9
        vertices = []
        for yy in (face-.030,face+.028):
            for rr,aa in ((radius,a),(radius+.034,a),(radius+.034,b),(radius,b)):
                vertices.append((x+rr*math.cos(aa),yy,spring+rr*math.sin(aa)))
        poly(vertices,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],
            "pierre_taille" if index%3 else "pierre_patinee")
    for side in (-1,1):
        box((x+side*(radius+.015),face-.002,spring/2),(.036,.068,spring),"pierre_taille")
        box((x+side*radius*.90,face+.035,spring*.49),(.013,.018,spring*.94),"bois")
    box((x,face+.035,spring*.50),(.014,.018,spring),"bois")
    box((x,face+.035,.055),(opening,.018,.055),"bois")
    box((x,face+.034,spring-.005),(opening,.020,.021),"bois")


def hotel():
    start("hotel_angle_paris_01")
    width, depth, height, corner = 1.57,1.40,1.78,.24
    face = -depth/2
    # The street corner is physically chamfered; both fronts have opening geometry.
    front_width = width-corner
    front_centre = -corner/2
    xs = [front_centre+(index-1)*front_width/3 for index in range(3)]
    for x in xs:
        arcade_cell(x,face,front_width/3,.50,.285,.265)
        for level,(low,high) in enumerate(((.50,1.12),(1.12,1.73))):
            wall_cell(x,face,low,high,front_width/3,.245,.36)
            window(x,face,(low+high)/2,.245,.36,ornament=level==0)
            if level==0:
                balcony(x,face,low+.075,.31)
    # Right-hand elevation is authored independently, not mirrored decoration.
    start_side = len(PARTS)
    length = depth-corner
    for index in range(3):
        x = -length/2+(index+.5)*length/3
        arcade_cell(x,0,length/3,.50,.235,.265)
        for low,high in ((.50,1.12),(1.12,1.73)):
            wall_cell(x,0,low,high,length/3,.205,.36)
            window(x,0,(low+high)/2,.205,.36,ornament=low==.50)
            if low==.50:
                balcony(x,0,low+.075,.265)
    transform_new(start_side,width/2,corner/2,math.pi/2)
    # A narrow diagonal entrance defines the actual corner between the two streets.
    start_corner = len(PARTS)
    diagonal = corner*math.sqrt(2)
    wall_cell(0,0,0,.50,diagonal,.20,.37,centre=.225)
    door(0,0,.20,.37,.032)
    for low,high in ((.50,1.12),(1.12,1.73)):
        wall_cell(0,0,low,high,diagonal,.18,.35)
        window(0,0,(low+high)/2,.18,.35,ornament=True)
        if low==.50:
            balcony(0,0,low+.075,.245)
    transform_new(start_corner,width/2-corner/2,-depth/2+corner/2,math.pi/4)
    # Flat rear and party walls close the volume. Neither covers the diagonal door.
    # Butt joints between wall segments avoid coincident outward surfaces,
    # which otherwise self-shadow as black vertical strips along the corner.
    back_elevation(width-.22,depth,height,3)
    box((-width/2+.055,0,height/2),(.11,depth-.22,height),"calcaire")
    outline = [(-width/2,-depth/2),(width/2-corner,-depth/2),(width/2,-depth/2+corner),
        (width/2,depth/2),(-width/2,depth/2)]
    # The cornice follows the chamfer instead of protruding across it as a box.
    for z,over,thickness in ((.035,.008,.07),(.50,.012,.028),(1.12,.015,.025),(height-.03,.027,.025),(height,.050,.025)):
        lower = [(x+math.copysign(over,x),y+math.copysign(over,y),z-thickness/2) for x,y in outline]
        upper = [(x,y,z+thickness) for x,y,_ in lower]
        vertices = lower+upper
        n=len(lower)
        poly(vertices,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[
            (i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],"pierre_taille")
    mansard(width,depth,height,.36,corner)
    for x in xs:
        dormer(x,face-.020,height+.045,.19,.195)
    start_side = len(PARTS)
    for x in (-.32,.18):
        dormer(x,0,height+.045,.18,.19,pediment=False)
    transform_new(start_side,width/2+.020,corner/2,math.pi/2)
    chimney(-.46,.27,height+.23,.24)
    chimney(.37,.43,height+.23,.22)
    return finish()


def terrace():
    start("front_mitoyen_paris_01")
    specs = [(-1.04,.99,.95,1.48,"enduit_creme","ardoise"),
        (0,1.08,1.01,1.68,"calcaire","zinc"),
        (1.04,1.00,.94,1.54,"enduit_rose","tuile")]
    for index,(offset,width,depth,height,wall,roof) in enumerate(specs):
        before = len(PARTS)
        face = -depth/2
        xs = [-width*.25,width*.25]
        floor = height/3
        for level in range(3):
            low,high = level*floor,(level+1)*floor-.020
            for bay,x in enumerate(xs):
                if level==0 and bay==0:
                    wall_cell(x,face,low,high,width/2,.23,.36,wall,centre=.21)
                    door(x,face,.23,.36,.025)
                elif level==0 and index==1:
                    wall_cell(x,face,low,high,width/2,.35,.34,wall,centre=.24)
                    window(x,face,.24,.35,.34,sash="bois_peint")
                    box((x,face-.039,.445),(.39,.062,.055),"bois_peint",.003)
                    box((x,face-.082,.405),(.41,.126,.012),"bois_peint")
                else:
                    wall_cell(x,face,low,high,width/2,.215,.30,wall)
                    window(x,face,(low+high)/2,.215,.30,
                        ornament=index==1 and level==1,shutters=index==0 and level>0,
                        sash="bois_peint" if index!=1 else "bois")
                    if index==1 and level==1:
                        balcony(x,face,low+.047,.28)
        bands(width,depth,height,[floor,floor*2])
        back_and_side(width,depth,height,3,
            side_openings=(-1,) if index==0 else (1,) if index==2 else ())
        if index==1:
            mansard(width,depth,height,.30)
            dormer(-.23,face-.015,height+.028,.19,.18)
            dormer(.23,face-.015,height+.028,.19,.18,pediment=False)
        else:
            pitched(width,depth,height,.27 if index==0 else .28,roof,hip=index==2)
            dormer(0,face+.090,height+.065,.20,.17,pediment=index==0)
        chimney(-width*.28,.18,height+.18,.21)
        transform_new(before,offset,[-.012,.022,-.027][index])
    return finish()


immeuble()
hotel()
terrace()


def dimensions(obj):
    obj.data.calc_loop_triangles()
    minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    return {"width":round(maximum[0]-minimum[0],5),"depth":round(maximum[1]-minimum[1],5),
        "height":round(maximum[2]-minimum[2],5),"min":[minimum[0],minimum[2],-maximum[1]],
        "max":[maximum[0],maximum[2],-minimum[1]],"triangles":len(obj.data.loop_triangles)}


scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.cycles.device = "CPU"
scene.render.bake.margin = 1
scene.render.bake.use_clear = False
scene.world.color = (.12,.12,.12)
metadata = {obj.name.removesuffix("_mesh"):dimensions(obj) for obj in MODELS}

if not options.shape_preview:
    # Pack every model once, in one UV object. Separate their physical positions
    # while baking so neighbours from the authoring kit cannot cast phantom AO.
    copies = []
    bpy.ops.object.select_all(action="DESELECT")
    for index,obj in enumerate(MODELS):
        obj.location = (index*6,0,0)
        face_id = obj.data.attributes.new("paris_model","INT","FACE")
        for item in face_id.data:
            item.value=index
        loop_id = obj.data.attributes.new("paris_loop","INT","CORNER")
        for loop,item in enumerate(loop_id.data):
            item.value=loop
        duplicate=obj.copy()
        duplicate.data=obj.data.copy()
        bpy.context.collection.objects.link(duplicate)
        duplicate.select_set(True)
        copies.append(duplicate)
        obj.hide_render=True
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    bake_object=bpy.context.object
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # One projection gives every authored face the same texel density. Fixed
    # UV fractions prevent per-island scaled margins from emptying the atlas.
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.0001,
        margin_method="FRACTION")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True,margin_method="FRACTION",margin=.0008)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv=bake_object.data.uv_layers.active
    ids=bake_object.data.attributes["paris_model"]
    loops=bake_object.data.attributes["paris_loop"]
    uv_area=0
    for face in bake_object.data.polygons:
        target=MODELS[ids.data[face.index].value].data.uv_layers.active
        for loop in face.loop_indices:
            target.data[loops.data[loop].value].uv=uv.data[loop].uv
        ring_uv=[uv.data[loop].uv for loop in face.loop_indices]
        uv_area+=abs(sum(a.x*b.y-b.x*a.y for a,b in zip(ring_uv,ring_uv[1:]+ring_uv[:1])))/2
    if uv_area>1.001:
        raise RuntimeError("Paris atlas islands overlap")
    if uv_area<.40:
        raise RuntimeError("Paris atlas wastes too much usable texture resolution")
    print("PARIS_UV_AREA",round(uv_area,5),flush=True)

    maps={}
    for kind,size,background in (("COLOR",2048,(.43,.37,.28,1)),
        ("NORMAL",1024,(.5,.5,1,1)),("ROUGHNESS",1024,(.9,.9,.9,1)),
        ("METALLIC",1024,(0,0,0,1)),("AO",1024,(1,1,1,1))):
        path=SOURCE/("paris-atlas.png" if kind=="COLOR" else "paris-"+kind.lower()+".png")
        if options.skip_bake and path.exists():
            baked=bpy.data.images.load(str(path),check_existing=False)
            baked.colorspace_settings.name="sRGB" if kind=="COLOR" else "Non-Color"
        else:
            baked=bpy.data.images.new("Paris "+kind,width=size,height=size,alpha=False)
            baked.colorspace_settings.name="sRGB" if kind=="COLOR" else "Non-Color"
            baked.generated_color=background
            for material in MATERIALS.values():
                nodes,links=material.node_tree.nodes,material.node_tree.links
                shader=next(node for node in nodes if node.type=="BSDF_PRINCIPLED")
                output=next(node for node in nodes if node.type=="OUTPUT_MATERIAL")
                if kind=="COLOR":
                    emit=nodes.new("ShaderNodeEmission")
                    links.new(shader.inputs["Base Color"].links[0].from_socket,emit.inputs[0])
                    links.new(emit.outputs[0],output.inputs[0])
                elif kind=="AO":
                    ao=nodes.new("ShaderNodeAmbientOcclusion")
                    ao.inputs["Distance"].default_value=.145
                    ao.samples=32
                    emit=nodes.new("ShaderNodeEmission")
                    links.new(ao.outputs["Color"],emit.inputs[0])
                    links.new(emit.outputs[0],output.inputs[0])
                elif kind=="METALLIC":
                    emit=nodes.new("ShaderNodeEmission")
                    value=shader.inputs["Metallic"].default_value
                    emit.inputs[0].default_value=(value,value,value,1)
                    links.new(emit.outputs[0],output.inputs[0])
                else:
                    links.new(shader.outputs[0],output.inputs[0])
                target=nodes.new("ShaderNodeTexImage")
                target.image=baked
                nodes.active=target
            print("PARIS_BAKE",kind,flush=True)
            bpy.ops.object.bake(type="EMIT" if kind in {"COLOR","METALLIC","AO"} else kind)
            baked.filepath_raw=str(path)
            baked.file_format="PNG"
            baked.save()
        maps[kind]=baked
    bpy.data.objects.remove(bake_object,do_unlink=True)
    for obj in MODELS:
        obj.hide_render=False
        obj.data.attributes.remove(obj.data.attributes["paris_model"])
        obj.data.attributes.remove(obj.data.attributes["paris_loop"])
    material=bpy.data.materials.new("Paris atlas pierre ardoise fer verre")
    material.use_nodes=True
    shader=material.node_tree.nodes.get("Principled BSDF")
    for kind,socket in (("COLOR","Base Color"),("ROUGHNESS","Roughness"),("METALLIC","Metallic")):
        texture=material.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image=maps[kind]
        material.node_tree.links.new(texture.outputs[0],shader.inputs[socket])
    texture=material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image=maps["NORMAL"]
    normal=material.node_tree.nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value=.65
    material.node_tree.links.new(texture.outputs[0],normal.inputs["Color"])
    material.node_tree.links.new(normal.outputs[0],shader.inputs["Normal"])
    # Official exporter socket: Occlusion remains a separate glTF PBR term,
    # so environmental lighting can brighten the unmodified stone albedo.
    settings=bpy.data.node_groups.new("glTF Material Output","ShaderNodeTree")
    settings.interface.new_socket(name="Occlusion",in_out="INPUT",socket_type="NodeSocketFloat")
    settings.nodes.new("NodeGroupInput")
    settings.nodes.new("NodeGroupOutput")
    settings_node=material.node_tree.nodes.new("ShaderNodeGroup")
    settings_node.node_tree=settings
    texture=material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image=maps["AO"]
    material.node_tree.links.new(texture.outputs[0],settings_node.inputs["Occlusion"])
    for baked in maps.values():
        baked.pack()
    for index,obj in enumerate(MODELS):
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for face in obj.data.polygons:
            face.material_index=0
        obj.location=(index*6,0,0)
        root=bpy.data.objects.new(obj.name.removesuffix("_mesh"),None)
        bpy.context.collection.objects.link(root)
        root.location=obj.location
        obj.location=(0,0,0)
        obj.parent=root
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"paris.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in MODELS:
        obj.parent.location=(0,0,0)
        obj.select_set(True)
        obj.parent.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/"paris.glb"),export_format="GLB",
        use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,
        export_normals=True,export_materials="EXPORT",export_cameras=False,export_lights=False)
    (OUTPUT/"paris.json").write_text(json.dumps({"version":1,"axes":"GLTF Y-up; footprint centred at ground",
        "front":"+Z; hotel second facade +X","models":metadata},ensure_ascii=False,indent=2)+"\n")
    import importlib.util
    specification=importlib.util.spec_from_file_location("paris_lod",SOURCE/"paris_lod.py")
    lod_module=importlib.util.module_from_spec(specification)
    specification.loader.exec_module(lod_module)
    lod_module.export_distance_geometry(MODELS)

if not options.no_preview:
    for index,obj in enumerate(MODELS):
        location = (-3.25,0,0) if index==0 else (-.95,.18,0) if index==1 else (2.10,-.08,0)
        if obj.parent:
            obj.parent.location=location
        else:
            obj.location=location
    material=bpy.data.materials.new("Sol de contrôle pierre")
    material.use_nodes=True
    material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(.25,.25,.20,1)
    material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.94
    bpy.ops.mesh.primitive_plane_add(size=200)
    bpy.context.object.data.materials.append(material)
    bpy.ops.object.light_add(type="AREA",location=(-3,-5,7))
    bpy.context.object.data.energy=1100
    bpy.context.object.data.size=4
    bpy.ops.object.light_add(type="AREA",location=(3,2,6))
    bpy.context.object.data.energy=450
    bpy.context.object.data.size=4
    bpy.ops.object.light_add(type="SUN",location=(0,0,7))
    bpy.context.object.rotation_euler=(math.radians(28),math.radians(-20),math.radians(-35))
    bpy.context.object.data.energy=1.5
    bpy.context.object.data.angle=math.radians(5)
    bpy.ops.object.camera_add(location=(7,-12,7))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((-.3,0,1.10))-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type="ORTHO"
    camera.data.ortho_scale=9.8
    scene.camera=camera
    scene.view_settings.view_transform="AgX"
    scene.render.resolution_x=1600
    scene.render.resolution_y=950
    scene.render.resolution_percentage=100
    scene.cycles.samples=24
    scene.render.filepath=str(EVIDENCE/("paris-source-preview.png" if options.shape_preview else "paris-atlas-preview.png"))
    bpy.ops.render.render(write_still=True)
print("PARIS_KIT",json.dumps(metadata),flush=True)
