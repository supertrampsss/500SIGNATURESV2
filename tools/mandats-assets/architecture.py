"""Author and bake the MANDATS regional architecture kit with Blender 4.3.

Run from the repository root:
  blender --background --python tools/mandats-assets/architecture.py

The GLB contains one root and one mesh for each model. Geometry is real, with
shared UV atlases and separate PBR contact occlusion; no screenshot is used as scenery.
"""
from __future__ import annotations

import argparse
from array import array
import json
import math
import pathlib
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "site/public/mandats/models"
SOURCE = pathlib.Path(__file__).resolve().parent
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)

args = argparse.ArgumentParser()
args.add_argument("--skip-bake", action="store_true")
args.add_argument("--preview-only", action="store_true")
args.add_argument("--albedo-only", action="store_true",
    help="Freshly bake the source palette using the existing UV layout and PBR maps")
args.add_argument("--skip-preview", action="store_true")
opts = args.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])

preserved_uvs = {}
if opts.albedo_only:
    if opts.skip_bake or opts.preview_only:
        args.error("--albedo-only requires a fresh production albedo bake")
    required = [SOURCE / "architecture.blend", *[
        SOURCE / f"architecture-{kind}.png"
        for kind in ("normal", "roughness", "metallic", "ao", "orm")]]
    if any(not path.exists() for path in required):
        args.error("--albedo-only requires the existing authored blend and all PBR maps")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "architecture.blend"))
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.name.endswith("_mesh"):
            preserved_uvs[obj.name] = {
                "mesh_name": obj.data.name,
                "vertices": [tuple(vertex.co) for vertex in obj.data.vertices],
                "polygons": [tuple(polygon.vertices) for polygon in obj.data.polygons],
                "uvs": [tuple(loop.uv) for loop in obj.data.uv_layers.active.data],
            }

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
if opts.albedo_only:
    for data in list(bpy.data.meshes):
        if data.users == 0:
            bpy.data.meshes.remove(data)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)

PALETTE = {
    "pierre": (0.76, 0.64, 0.45),
    "calcaire": (0.86, 0.77, 0.60),
    "enduit": (0.91, 0.79, 0.61),
    "enduit_rose": (0.84, 0.55, 0.42),
    "enduit_ocre": (0.88, 0.63, 0.36),
    "brique": (0.63, 0.275, 0.14),
    "tuile": (0.60, 0.16, 0.06),
    "tuile_claire": (0.74, 0.295, 0.095),
    "ardoise": (.025, .045, .075),
    "zinc": (0.35, 0.38, 0.40),
    "bois": (0.22, 0.12, 0.06),
    "volet": (0.20, 0.28, 0.20),
    "vitrage": (0.013, 0.037, 0.050),
    "vitrage_clair": (0.16, 0.23, 0.24),
    "metal": (0.14, 0.17, 0.16),
}

MATS = {}
ROUGHNESS = {
    "pierre": (.45,.62), "calcaire": (.44,.60),
    "enduit": (.57,.70), "enduit_rose": (.57,.70), "enduit_ocre": (.57,.70),
    "brique": (.53,.66), "tuile": (.34,.47), "tuile_claire": (.34,.47),
    "ardoise": (.26,.41), "zinc": (.28,.40),
    "bois": (.61,.74), "volet": (.63,.75),
    "vitrage": (.09,.16), "vitrage_clair": (.09,.16), "metal": (.25,.34),
}
for name, color in PALETTE.items():
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = sum(ROUGHNESS[name])/2
    shader.inputs["Metallic"].default_value = .70 if name=="metal" else .45 if name=="zinc" else 0
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 28 if name.startswith("tuile") else 16
    noise.inputs["Detail"].default_value = 2.4
    noise.inputs["Roughness"].default_value = 0.65
    coord = nodes.new("ShaderNodeTexCoord")
    links.new(coord.outputs["Object"], noise.inputs["Vector"])
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = .16 if name in {"pierre","calcaire","enduit","enduit_rose","enduit_ocre"} else .20
    mix.inputs[1].default_value = (*color, 1)
    links.new(noise.outputs["Fac"], mix.inputs[2])
    links.new(mix.outputs["Color"], shader.inputs["Base Color"])
    if name in {"tuile","tuile_claire","brique","pierre","calcaire"}:
        separate=nodes.new("ShaderNodeSeparateXYZ")
        combine=nodes.new("ShaderNodeCombineXYZ")
        links.new(coord.outputs["Object"],separate.inputs["Vector"])
        links.new(separate.outputs["X"],combine.inputs["X"])
        links.new(separate.outputs["Z"],combine.inputs["Y"])
        bricks=nodes.new("ShaderNodeTexBrick")
        links.new(combine.outputs["Vector"],bricks.inputs["Vector"])
        bricks.inputs["Scale"].default_value=2.7 if name.startswith("tuile") else 2.1
        bricks.inputs["Brick Width"].default_value=.33 if name.startswith("tuile") else .46
        bricks.inputs["Row Height"].default_value=.12 if name.startswith("tuile") else .17
        bricks.inputs["Mortar Size"].default_value=.006 if name.startswith("tuile") else .012
        bricks.inputs["Mortar Smooth"].default_value=.006
        bricks.inputs["Color1"].default_value=(*color,1)
        bricks.inputs["Color2"].default_value=(*(c*.76 for c in color),1)
        mortar=.69 if name.startswith("tuile") else .77
        bricks.inputs["Mortar"].default_value=(*(c*mortar for c in color),1)
        pattern=nodes.new("ShaderNodeMixRGB")
        pattern.inputs[0].default_value=.38 if name in {"pierre","calcaire"} else .65
        links.new(mix.outputs["Color"],pattern.inputs[1])
        links.new(bricks.outputs["Color"],pattern.inputs[2])
        links.new(pattern.outputs["Color"],shader.inputs["Base Color"])
    bump=nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value=.18
    bump.inputs["Distance"].default_value=.0035 if name in {"pierre","calcaire"} else .004
    links.new(noise.outputs["Fac"],bump.inputs["Height"])
    links.new(bump.outputs["Normal"],shader.inputs["Normal"])
    roughness=nodes.new("ShaderNodeMapRange")
    roughness.inputs["To Min"].default_value=ROUGHNESS[name][0]
    roughness.inputs["To Max"].default_value=ROUGHNESS[name][1]
    links.new(noise.outputs["Fac"],roughness.inputs["Value"])
    links.new(roughness.outputs["Result"],shader.inputs["Roughness"])
    links.new(shader.outputs["BSDF"], out.inputs["Surface"])
    MATS[name] = mat

PARTS = []
MODELS = []
CURRENT = ""


def part(obj, mat="calcaire"):
    obj.name = f"{CURRENT}_detail_{len(PARTS):04}"
    obj.data.materials.append(MATS[mat])
    PARTS.append(obj)
    return obj


def mesh(name, vertices, faces, mat="calcaire"):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return part(obj, mat)


def box(loc, size, mat="calcaire", bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    part(obj, mat)
    if bevel:
        mod = obj.modifiers.new("Arêtes usées", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        mod = obj.modifiers.new("Normales de façade", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def beam(a, b, width, mat="calcaire", depth=None):
    delta = Vector(b) - Vector(a)
    obj = box((Vector(a) + Vector(b)) / 2, (width, depth or width, delta.length), mat)
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return obj


def cylinder(loc, radius, height, mat="calcaire", vertices=8, radius_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if radius_top is None else radius_top, depth=height, location=loc)
    return part(bpy.context.object, mat)


def roof(x, y, z, w, d, rise, mat="tuile", hip=False, ridge=True):
    over = 0.045
    w += 2 * over
    d += 2 * over
    inset = min(w * 0.20, d * 0.35) if hip else 0
    v = [(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),
         (x-w/2,y+d/2,z),(x-w/2+inset,y,z+rise),(x+w/2-inset,y,z+rise)]
    mesh("couverture", v, [(0,1,5,4),(2,3,4,5),(0,4,3),(1,2,5)], mat)
    if CURRENT.startswith(("maison", "ferme", "boutique")):
        # The roof has a real dark underside and a stone edge. Both remain
        # inside the authored roof bounds, preserving every ground footprint.
        box((x, y, z-.010), (w, d, .020), "bois")
        for side in (-1, 1):
            box((x, y+side*(d/2-.008), z-.002), (w, .016, .023), "calcaire")
    if ridge:
        beam((x-w/2+inset,y,z+rise+0.008),(x+w/2-inset,y,z+rise+0.008),.026,mat)
    if not hip:
        mesh("pignons", [(x-w/2+over,y-d/2+over,z),(x-w/2+over,y+d/2-over,z),
                          (x-w/2+over,y,z+rise-.025),(x+w/2-over,y-d/2+over,z),
                          (x+w/2-over,y+d/2-over,z),(x+w/2-over,y,z+rise-.025)],
                         [(0,2,1),(3,4,5)],"enduit")


def roof_y(x,y,z,w,d,rise,mat="ardoise",hip=False):
    before=len(PARTS)
    roof(0,0,z,d,w,rise,mat,hip=hip)
    transform=Matrix.Translation((x,y,0))@Matrix.Rotation(math.pi/2,4,"Z")
    for obj in PARTS[before:]:
        obj.matrix_world=transform@obj.matrix_world


def window(x, y, z, w=.125, h=.155, shutters=False, stone="calcaire", mullion=True):
    # Street-facing openings are real inset coloured planes with thin stone reveals.
    box((x,y,z),(w,.011,h),"vitrage")
    t = .016 if CURRENT.startswith(("maison", "ferme", "boutique")) else .011
    box((x-w/2-t/2,y-.008,z),(t,.021,h+t*2),stone)
    box((x+w/2+t/2,y-.008,z),(t,.021,h+t*2),stone)
    box((x,y-.010,z-h/2-t/2),(w+t*2,.026,t),stone)
    box((x,y-.010,z+h/2+t/2),(w+t*2,.023,t),stone)
    if mullion:
        box((x,y-.013,z),(.007,.013,h),stone)
        box((x,y-.013,z-.008),(w,.013,.007),stone)
    if shutters:
        for side in (-1,1):
            box((x+side*(w/2+.038),y+.004,z),(.058,.022,h+.006),"volet")


def door(x,y,w=.125,h=.24,mat="bois"):
    box((x,y,h/2+.014),(w,.016,h),mat)
    box((x-w/2-.014,y-.006,h/2+.014),(.025,.035,h+.028),"calcaire")
    box((x+w/2+.014,y-.006,h/2+.014),(.025,.035,h+.028),"calcaire")
    box((x,y-.006,h+.028),(w+.055,.035,.032),"calcaire")
    box((x,y-.07,.023),(w+.07,.11,.046),"pierre")


def dormer(x,y,z,w=.17,d=.18,h=.16,mat="ardoise"):
    box((x,y,z+h/2),(w,d,h),"calcaire")
    window(x,y-d/2-.005,z+h*.57,w*.55,h*.56,stone="calcaire",mullion=False)
    roof(x,y,z+h,w,d,h*.52,mat)


def chimney(x,y,z,mat="brique",h=.20):
    box((x,y,z+h/2),(.085,.10,h),mat)
    box((x,y,z+h+.005),(.11,.125,.025),"pierre")


def start(name):
    global PARTS, CURRENT
    PARTS=[]
    CURRENT=name


def finish(name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name + "_mesh"
    # Joining into a canonical root preserves the exact local ground origin.
    bpy.context.scene.cursor.location = (0,0,0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False) if hasattr(bpy.ops.mesh,"normals_make_consistent") else None
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.calc_loop_triangles()
    MODELS.append(obj)
    return obj


def house(name,w=1,d=.78,h=.51,rise=.30,wall="enduit",cover="tuile",floors=2,
          style="simple",hip=False,shutters=False,offset=0):
    start(name)
    box((0,0,h/2),(w,d,h),wall,bevel=.007)
    box((0,0,.029),(w+.025,d+.025,.058),"pierre")
    box((0,0,h-.018),(w+.075,d+.075,.045),"calcaire")
    # Broad pale bands and corner quoins remain readable in the miniature view.
    for side in (-1, 1):
        for front in (-1, 1):
            box((side*(w/2-.012), front*(d/2-.007), h*.49),
                (.040,.026,h*.94), "calcaire")
    if floors>1:
        bands = [h*level/floors for level in range(1,floors)] if floors>=4 else [h*.49]
        for band in bands:
            box((0,-d/2-.012,band),(w+.025,.025,.018),"calcaire")
    xs = [-w*.31,w*.31] if w<1.1 else [-w*.34,0,w*.34]
    for floor in range(floors):
        z = .18 + floor*((h-.30)/max(floors-1,1))
        for x in xs:
            if floor == 0 and abs(x-offset)<.10:
                continue
            window(x,-d/2-.006,z,w=.12 if floors<3 else .105,h=.14 if floors<3 else .125,
                   shutters=shutters,stone="pierre" if wall=="brique" else "calcaire")
    door(offset,-d/2-.009,w=.14,h=.23 if floors<3 else .21)
    # Rear and side openings are deliberately simpler, avoiding blank cubes at orbit angles.
    rear_levels = [.18 + floor*((h-.30)/max(floors-1,1)) for floor in range(floors)] if floors>=4 else [h*.60]
    for x in (-w*.29,w*.29):
        for level in rear_levels:
            window(x,d/2+.006,level,w=.11,h=.125 if floors>=4 else .135,mullion=False)
    # Side walls carry openings too, so inspection does not expose blank cubes.
    side_levels = [.18 + floor*((h-.30)/max(floors-1,1)) for floor in range(floors)] if floors>=4 else [h*.59]
    for side in (-1, 1):
        before = len(PARTS)
        for level in side_levels:
            window(0, 0, level, w=.115, h=.125 if floors>=4 else .145,
                   shutters=False, stone="calcaire", mullion=False)
        transform = Matrix.Translation((side*(w/2+.008), 0, 0)) @ Matrix.Rotation(side*math.pi/2,4,"Z")
        for obj in PARTS[before:]:
            obj.matrix_world = transform @ obj.matrix_world
    roof(0,0,h,w,d,rise,cover,hip=hip)
    chimney(w*.27,d*.10,h+rise*.71,"brique" if cover=="ardoise" else wall,h=.17)
    if style in {"paris","ardoise"}:
        dormer(-w*.21,-d*.14,h+rise*.51,w=.165,d=.13,h=.13,mat=cover)
        if w>=.98:
            dormer(w*.19,-d*.14,h+rise*.51,w=.165,d=.13,h=.13,mat=cover)
    if style=="colombage":
        front=-d/2-.022
        for x in (-w*.48,0,w*.48):
            box((x,front,h*.52),(.035,.034,h*.94),"bois")
        box((0,front,h*.49),(w,.036,.033),"bois")
        for side in (-1,1):
            beam((side*w*.47,front,.06),(0,front,h*.47),.024,"bois")
            beam((side*w*.47,front,h*.95),(0,front,h*.53),.024,"bois")
    if style=="sud":
        # Warm horizontal balcony, not an extra storey of pale wall.
        box((0,-d/2-.052,h*.53),(w*.76,.12,.025),"pierre")
        for x in (-w*.36,0,w*.36):
            box((x,-d/2-.105,h*.62),(.009,.009,.12),"metal")
        box((0,-d/2-.105,h*.68),(w*.74,.012,.01),"metal")
    if style=="commerce":
        box((0,-d/2-.045,.26),(w*.65,.026,.06),"enduit_rose")
        window(-w*.26,-d/2-.012,.14,w=.22,h=.19,mullion=False)
        window(w*.26,-d/2-.012,.14,w=.22,h=.19,mullion=False)
    authored = finish(name)
    authored["bodyHeight"] = h


HOUSE_SPECS = [
    ("maison_pierre_01",dict(w=1.00,d=.75,h=.47,rise=.31,wall="pierre",cover="tuile_claire",shutters=True)),
    ("maison_pierre_02",dict(w=1.17,d=.72,h=.44,rise=.32,wall="calcaire",cover="tuile",hip=True)),
    ("maison_pierre_03",dict(w=.85,d=.82,h=.64,rise=.40,floors=3,wall="pierre",cover="ardoise",style="ardoise")),
    ("maison_ardoise_01",dict(w=1.06,d=.77,h=.48,rise=.39,wall="enduit",cover="ardoise",style="ardoise")),
    ("maison_ardoise_02",dict(w=.87,d=.84,h=.68,rise=.37,floors=3,wall="pierre",cover="ardoise",style="ardoise",hip=True)),
    ("maison_paris_01",dict(w=1.05,d=.69,h=.66,rise=.29,wall="calcaire",cover="ardoise",style="paris",floors=3)),
    ("maison_paris_02",dict(w=.88,d=.80,h=.65,rise=.31,wall="enduit",cover="zinc",style="paris",floors=3)),
    ("maison_paris_03",dict(w=1.22,d=.74,h=.63,rise=.36,wall="pierre",cover="ardoise",style="paris",floors=3,hip=True)),
    ("maison_brique_01",dict(w=.91,d=.74,h=.68,rise=.36,floors=3,wall="brique",cover="ardoise",style="ardoise")),
    ("maison_brique_02",dict(w=1.12,d=.72,h=.49,rise=.32,wall="brique",cover="tuile",hip=True)),
    ("maison_alsace_01",dict(w=.84,d=.80,h=.51,rise=.45,wall="enduit",cover="tuile",style="colombage")),
    ("maison_alsace_02",dict(w=1.01,d=.70,h=.55,rise=.43,wall="enduit_rose",cover="tuile",style="colombage")),
    ("maison_sud_01",dict(w=1.08,d=.79,h=.46,rise=.23,wall="enduit_ocre",cover="tuile_claire",style="sud",shutters=True,hip=True)),
    ("maison_sud_02",dict(w=.90,d=.75,h=.61,rise=.26,floors=3,wall="enduit_rose",cover="tuile",style="sud",shutters=True)),
    ("maison_sud_03",dict(w=1.19,d=.80,h=.42,rise=.23,wall="enduit",cover="tuile_claire",shutters=True,hip=True)),
    ("ferme_01",dict(w=1.42,d=.64,h=.32,rise=.31,wall="pierre",cover="tuile",floors=1,hip=True,offset=-.28)),
    ("ferme_02",dict(w=1.29,d=.83,h=.34,rise=.38,wall="enduit",cover="ardoise",floors=1,offset=.29)),
    ("boutique_01",dict(w=1.17,d=.71,h=.52,rise=.30,wall="enduit_rose",cover="tuile",style="commerce")),
]


def pointed_shape(x,y,z,w,h,mat="vitrage",steps=6):
    # Lancet opening. The crown follows two arcs, rather than a triangular cutout.
    half=w/2
    verts=[(x-half,y,z),(x+half,y,z),(x+half,y,z+h*.62)]
    for i in range(1,steps+1):
        t=i/steps
        verts.append((x+half*(1-t),y,z+h*(.62+.38*math.sin(t*math.pi/2))))
    for i in range(1,steps+1):
        t=i/steps
        verts.append((x-half*t,y,z+h*(.62+.38*math.cos(t*math.pi/2))))
    mesh("baie_ogivale",verts,[tuple(range(len(verts)))],mat)
    for a,b in zip(verts[2:],verts[3:]):
        beam(a,b,.021,"calcaire")
    beam((x-half,y-.007,z),(x-half,y-.007,z+h*.63),.024,"calcaire")
    beam((x+half,y-.007,z),(x+half,y-.007,z+h*.63),.024,"calcaire")
    beam((x,y-.016,z),(x,y-.016,z+h*.82),.014,"calcaire")
    beam((x-half,y-.015,z+h*.39),(x+half,y-.015,z+h*.39),.010,"calcaire")


def rose(x,y,z,r=.20):
    verts=[(x,y,z)]+[(x+math.cos(i*math.tau/24)*r,y,z+math.sin(i*math.tau/24)*r) for i in range(24)]
    mesh("rosace_vitrail",verts,[(0,i+1,(i+1)%24+1) for i in range(24)],"vitrage")
    for i in range(24):
        a=i*math.tau/24
        b=(i+1)*math.tau/24
        beam((x+math.cos(a)*r,y-.014,z+math.sin(a)*r),
             (x+math.cos(b)*r,y-.014,z+math.sin(b)*r),.023,"calcaire")
    for i in range(12):
        a=i*math.tau/12
        beam((x,y-.022,z),(x+math.cos(a)*r*.94,y-.022,z+math.sin(a)*r*.94),.013,"calcaire")


def flying_buttress(side,y,z=1.18):
    # Continuous curved bridge between nave and outer pier, retaining a valley below.
    inner=side*.41
    outer=side*.87
    segs=8
    pts=[]
    for i in range(segs+1):
        t=i/segs
        x=inner+(outer-inner)*t
        zz=z-.27*t+.10*math.sin(t*math.pi)
        pts.append((x,y,zz))
    for a,b in zip(pts,pts[1:]):
        beam(a,b,.059,"calcaire",depth=.064)
    box((outer,y,.54),(.10,.13,1.08),"pierre",bevel=.007)
    cylinder((outer,y,1.17),.065,.20,"calcaire",6,radius_top=.013)
    cylinder((outer,y,1.31),.026,.12,"calcaire",6,radius_top=0)


def cathedral():
    name="cathedrale_paris"
    start(name)
    box((0,0,.035),(1.92,2.40,.07),"pierre",bevel=.019)
    box((0,.10,.65),(.83,1.91,1.23),"calcaire",bevel=.01)
    # Low aisles and deep crossing give a recognizable church plan from the national camera.
    for side in (-1,1):
        box((side*.57,.13,.40),(.30,1.87,.73),"pierre",bevel=.008)
        roof_y(side*.57,.13,.77,.31,1.83,.13,"ardoise",hip=True)
    roof_y(0,.10,1.28,.86,1.94,.41,"ardoise")
    box((0,.19,.63),(1.70,.48,1.18),"calcaire",bevel=.012)
    roof(0,.19,1.24,1.71,.49,.28,"ardoise")
    for side in (-1,1):
        for y in (-.60,-.27,.07,.42,.76):
            flying_buttress(side,y,1.34)
    # Polygonal apse and radiating chapels.
    cylinder((0,1.04,.51),.48,.96,"pierre",10)
    cylinder((0,1.04,1.08),.49,.20,"ardoise",10,radius_top=.24)
    for i in range(5):
        a=math.pi*i/4
        x=math.cos(a)*.46
        y=1.06+math.sin(a)*.37
        cylinder((x,y,.29),.17,.54,"calcaire",6)
        cylinder((x,y,.63),.18,.17,"ardoise",6,radius_top=.028)
    # Broad western façade, twin sculpted towers, tracery and three portals.
    box((0,-.98,.56),(1.44,.30,1.08),"calcaire",bevel=.008)
    for side in (-1,1):
        x=side*.54
        box((x,-.98,.99),(.41,.41,1.89),"pierre",bevel=.009)
        for level in (.42,.86,1.28,1.74):
            box((x,-.98,level),(.45,.45,.045),"calcaire")
        for wx in (x-.09,x+.09):
            pointed_shape(wx,-1.19,1.30,.11,.32,steps=5)
            pointed_shape(wx,-1.19,.77,.10,.29,steps=5)
        for sx in (-1,1):
            box((x+sx*.215,-1.195,1.00),(.045,.05,1.89),"calcaire")
            cylinder((x+sx*.215,-1.195,2.04),.035,.25,"calcaire",6,radius_top=0)
        cylinder((x,-.98,2.02),.275,.18,"calcaire",8,radius_top=.235)
        cylinder((x,-.98,2.45),.235,.73,"ardoise",8,radius_top=.014)
        cylinder((x,-.98,2.85),.026,.10,"metal",6,radius_top=0)
    for x in (-.46,0,.46):
        pointed_shape(x,-1.145,.08,.26,.48,mat="bois",steps=7)
        beam((x-.155,-1.174,.59),(x,-1.174,.78),.042,"calcaire")
        beam((x,-1.174,.78),(x+.155,-1.174,.59),.042,"calcaire")
    rose(0,-1.147,.96,.205)
    for x in (-.29,-.145,0,.145,.29):
        cylinder((x,-1.165,1.31),.018,.17,"calcaire",6)
        cylinder((x,-1.165,1.42),.035,.04,"calcaire",6)
    box((0,-1.155,1.48),(.75,.052,.048),"calcaire")
    # A slender crossing spire rises above a carved octagonal lantern.
    cylinder((0,.14,1.75),.14,.30,"calcaire",8)
    cylinder((0,.14,2.23),.14,.67,"ardoise",8,radius_top=.014)
    cylinder((0,.14,2.60),.022,.10,"metal",6,radius_top=0)
    # Nave side lancets are oriented onto their own side walls.
    for side in (-1,1):
        for y in (-.61,-.28,.08,.44,.76):
            before=len(PARTS)
            pointed_shape(0,0,0,.135,.35,steps=4)
            transform=Matrix.Translation((side*.433,y,.83))@Matrix.Rotation(side*math.pi/2,4,"Z")
            for obj in PARTS[before:]:
                obj.matrix_world=transform@obj.matrix_world
    finish(name)


def townhall():
    name="mairie_sud"
    start(name)
    box((0,0,.40),(1.70,.72,.76),"enduit_rose",bevel=.012)
    box((0,0,.05),(1.78,.81,.10),"pierre")
    for x in (-.65,-.32,0,.32,.65):
        window(x,-.37,.55,.14,.21,stone="calcaire")
    for x in (-.61,-.30,.30,.61):
        pointed_shape(x,-.38,.10,.17,.29,mat="vitrage",steps=4)
    door(0,-.38,.19,.33)
    for x in (-.85,-.44,.44,.85):
        box((x,-.395,.39),(.055,.07,.69),"calcaire")
    box((0,-.398,.39),(1.73,.078,.043),"calcaire")
    roof(0,0,.79,1.72,.75,.30,"tuile",hip=True)
    box((0,0,1.15),(.26,.30,.25),"pierre",bevel=.007)
    cylinder((0,0,1.40),.21,.25,"tuile",8,radius_top=.03)
    finish(name)


def belfry():
    name="beffroi_nord"
    start(name)
    box((0,0,.30),(1.1,.75,.55),"brique",bevel=.011)
    roof(0,0,.59,1.15,.80,.30,"ardoise",hip=True)
    for x in (-.34,.34):
        window(x,-.386,.31,.17,.21)
    door(0,-.39,.16,.29)
    box((0,.02,.76),(.40,.45,1.39),"brique",bevel=.013)
    for z in (.52,.97,1.39):
        box((0,.02,z),(.46,.50,.055),"calcaire")
    for x in (-.1,.1):
        pointed_shape(x,-.222,1.04,.12,.28,steps=5)
    box((0,.02,1.53),(.50,.54,.19),"pierre",bevel=.009)
    cylinder((0,.02,1.83),.33,.40,"ardoise",8,radius_top=.19)
    cylinder((0,.02,2.19),.19,.34,"ardoise",8,radius_top=.018)
    finish(name)


for name, spec in HOUSE_SPECS:
    house(name,**spec)
# Dominant frontages have real storeys, rather than the low house stretched in Y.
# Their complete XZ fittings are shared with the base model's exact footprint.
for name, spec in HOUSE_SPECS:
    if not name.startswith("maison_"):
        continue
    frontage = dict(spec)
    frontage.update(h=round(.96 + spec["w"]*.14, 4), floors=4,
                    rise=min(spec["rise"], .31))
    house(name + "_dominante", **frontage)
cathedral()
townhall()
belfry()

# Save model dimensions before temporary layout used for atlas baking and authoring.
metadata={}
for index,obj in enumerate(MODELS):
    if opts.albedo_only:
        old = preserved_uvs[obj.name]
        if ([tuple(vertex.co) for vertex in obj.data.vertices] != old["vertices"] or
                [tuple(polygon.vertices) for polygon in obj.data.polygons] != old["polygons"]):
            raise RuntimeError(f"Albedo-only geometry changed: {obj.name}")
        if len(obj.data.uv_layers.active.data) != len(old["uvs"]):
            raise RuntimeError(f"Albedo-only UV topology changed: {obj.name}")
        for loop, uv in zip(obj.data.uv_layers.active.data, old["uvs"]):
            loop.uv = uv
        obj.data.name = old["mesh_name"]
    vertices=[obj.matrix_world@v.co for v in obj.data.vertices]
    low=[min(v[a] for v in vertices) for a in range(3)]
    high=[max(v[a] for v in vertices) for a in range(3)]
    metadata[obj.name.removesuffix("_mesh")]={"width":round(high[0]-low[0],4),
        "depth":round(high[1]-low[1],4),"height":round(high[2]-low[2],4),
        "min":[low[0],low[2],-high[1]],"max":[high[0],high[2],-low[1]],
        "triangles":len(obj.data.loop_triangles)}
    obj.location=(index%5*4,index//5*4,0)

# A single packing mesh prevents overlapping islands in multi-object edit mode.
# Face and loop attributes let us copy the exact packed UVs back to author models.
bpy.ops.object.select_all(action="DESELECT")
copies=[]
for model_index,obj in enumerate(MODELS):
    source=obj.data.attributes.new("asset_source_model","INT","FACE")
    for item in source.data:
        item.value=model_index
    loops=obj.data.attributes.new("asset_source_loop","INT","CORNER")
    for loop_index,item in enumerate(loops.data):
        item.value=loop_index
    duplicate=obj.copy()
    duplicate.data=obj.data.copy()
    bpy.context.collection.objects.link(duplicate)
    duplicate.hide_render=False
    duplicate.select_set(True)
    copies.append(duplicate)
    obj.hide_render=True
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
bake_object=bpy.context.object
if not opts.albedo_only:
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True,margin_method="FRACTION",margin=.0008)
    bpy.ops.object.mode_set(mode="OBJECT")
packed=bake_object.data.uv_layers.active
ids=bake_object.data.attributes["asset_source_model"]
indices=bake_object.data.attributes["asset_source_loop"]
for polygon in bake_object.data.polygons:
    target=MODELS[ids.data[polygon.index].value].data.uv_layers.active
    for loop in polygon.loop_indices:
        target.data[indices.data[loop].value].uv=packed.data[loop].uv
uv_area=0
for polygon in bake_object.data.polygons:
    ring=[packed.data[loop].uv for loop in polygon.loop_indices]
    uv_area+=abs(sum(a.x*b.y-b.x*a.y for a,b in zip(ring,ring[1:]+ring[:1])))/2
if uv_area>1.001:
    raise RuntimeError(f"Architecture UV atlas overlaps: total face area {uv_area:.3f}")
if uv_area<.30:
    raise RuntimeError(f"Architecture UV atlas leaves too little useful surface: {uv_area:.3f}")
print("UV_ATLAS_FACE_AREA",round(uv_area,5),flush=True)

scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=24
scene.cycles.use_denoising=False
scene.cycles.device="CPU"
scene.render.bake.margin=1
scene.render.bake.use_clear=False
scene.world.color=(.08,.08,.08)

atlas_path=SOURCE/"architecture-atlas.png"
atlas=bpy.data.images.new("Architecture albédo sans ombres",width=2048,height=2048,alpha=False)
atlas.colorspace_settings.name="sRGB"
atlas.generated_color=(.34,.28,.21,1)
for mat in MATS.values():
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    shader=next(n for n in nodes if n.type=="BSDF_PRINCIPLED")
    color=shader.inputs["Base Color"].links[0].from_socket
    emit=nodes.new("ShaderNodeEmission")
    links.new(color,emit.inputs["Color"])
    out=next(n for n in nodes if n.type=="OUTPUT_MATERIAL")
    links.new(emit.outputs["Emission"],out.inputs["Surface"])
    tex=nodes.new("ShaderNodeTexImage")
    tex.image=atlas
    tex.select=True
    nodes.active=tex

if not opts.skip_bake and not opts.preview_only:
    print("BAKE_SHARED_ATLAS",len(MODELS),flush=True)
    bpy.ops.object.bake(type="EMIT")
    atlas.filepath_raw=str(atlas_path)
    atlas.file_format="PNG"
    atlas.save()
else:
    if atlas_path.exists():
        bpy.data.images.remove(atlas)
        atlas=bpy.data.images.load(str(atlas_path),check_existing=False)

maps={}
if not opts.preview_only:
    for kind,filename,background in [
            ("NORMAL","architecture-normal.png",(.5,.5,1,1)),
            ("ROUGHNESS","architecture-roughness.png",(.8,.8,.8,1)),
            ("METALLIC","architecture-metallic.png",(0,0,0,1)),
            ("AO","architecture-ao.png",(1,1,1,1))]:
        path=SOURCE/filename
        if (opts.skip_bake or opts.albedo_only) and path.exists():
            baked=bpy.data.images.load(str(path),check_existing=False)
            baked.colorspace_settings.name="Non-Color"
        else:
            baked=bpy.data.images.new(filename,width=1024,height=1024,alpha=False)
            baked.colorspace_settings.name="Non-Color"
            baked.generated_color=background
            for original in MATS.values():
                nodes=original.node_tree.nodes
                links=original.node_tree.links
                shader=next(n for n in nodes if n.type=="BSDF_PRINCIPLED")
                out=next(n for n in nodes if n.type=="OUTPUT_MATERIAL")
                if kind=="METALLIC":
                    emit=nodes.new("ShaderNodeEmission")
                    value=shader.inputs["Metallic"].default_value
                    emit.inputs["Color"].default_value=(value,value,value,1)
                    links.new(emit.outputs["Emission"],out.inputs["Surface"])
                elif kind=="AO":
                    ao=nodes.new("ShaderNodeAmbientOcclusion")
                    ao.inputs["Distance"].default_value=.11
                    ao.samples=24
                    soften=nodes.new("ShaderNodeMixRGB")
                    soften.blend_type="MULTIPLY"
                    soften.inputs[0].default_value=.48
                    soften.inputs[1].default_value=(1,1,1,1)
                    links.new(ao.outputs["Color"],soften.inputs[2])
                    emit=nodes.new("ShaderNodeEmission")
                    links.new(soften.outputs["Color"],emit.inputs["Color"])
                    links.new(emit.outputs["Emission"],out.inputs["Surface"])
                else:
                    links.new(shader.outputs["BSDF"],out.inputs["Surface"])
                target=nodes.new("ShaderNodeTexImage")
                target.image=baked
                nodes.active=target
            print("BAKE_PBR",kind,flush=True)
            bpy.ops.object.bake(type="EMIT" if kind in {"AO","METALLIC"} else kind)
            baked.filepath_raw=str(path)
            baked.file_format="PNG"
            baked.save()
        maps[kind]=baked

bpy.data.objects.remove(bake_object,do_unlink=True)
for obj in MODELS:
    obj.hide_render=False
    obj.data.attributes.remove(obj.data.attributes["asset_source_model"])
    obj.data.attributes.remove(obj.data.attributes["asset_source_loop"])

mat=bpy.data.materials.new("Architecture atlas PBR")
mat.use_nodes=True
shader=mat.node_tree.nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value=.87
shader.inputs["Metallic"].default_value=0
tex=mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image=atlas
mat.node_tree.links.new(tex.outputs["Color"],shader.inputs["Base Color"])
atlas.pack()
if not opts.preview_only:
    normaltex=mat.node_tree.nodes.new("ShaderNodeTexImage")
    normaltex.image=maps["NORMAL"]
    normal=mat.node_tree.nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value=.85
    mat.node_tree.links.new(normaltex.outputs["Color"],normal.inputs["Color"])
    mat.node_tree.links.new(normal.outputs["Normal"],shader.inputs["Normal"])
    # A single glTF ORM texture keeps occlusion out of the albedo and retains
    # distinct roughness for stone, terracotta, slate, glazing and metal.
    if opts.albedo_only:
        orm=bpy.data.images.load(str(SOURCE/"architecture-orm.png"),check_existing=False)
        orm.colorspace_settings.name="Non-Color"
    else:
        count=1024*1024*4
        occlusion=array("f",[0])*count
        roughness=array("f",[0])*count
        metallic=array("f",[0])*count
        maps["AO"].pixels.foreach_get(occlusion)
        maps["ROUGHNESS"].pixels.foreach_get(roughness)
        maps["METALLIC"].pixels.foreach_get(metallic)
        for index in range(0,count,4):
            occlusion[index+1]=roughness[index]
            occlusion[index+2]=metallic[index]
            occlusion[index+3]=1
        orm=bpy.data.images.new("Architecture ORM",width=1024,height=1024,alpha=False)
        orm.colorspace_settings.name="Non-Color"
        orm.pixels.foreach_set(occlusion)
        orm.filepath_raw=str(SOURCE/"architecture-orm.png")
        orm.file_format="PNG"
        orm.save()
    maps["ORM"]=orm
    texture=mat.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image=orm
    separate=mat.node_tree.nodes.new("ShaderNodeSeparateRGB")
    mat.node_tree.links.new(texture.outputs["Color"],separate.inputs[0])
    mat.node_tree.links.new(separate.outputs["G"],shader.inputs["Roughness"])
    mat.node_tree.links.new(separate.outputs["B"],shader.inputs["Metallic"])
    settings=bpy.data.node_groups.new("glTF Material Output","ShaderNodeTree")
    settings.interface.new_socket(name="Occlusion",in_out="INPUT",socket_type="NodeSocketFloat")
    settings.nodes.new("NodeGroupInput")
    settings.nodes.new("NodeGroupOutput")
    settings_node=mat.node_tree.nodes.new("ShaderNodeGroup")
    settings_node.node_tree=settings
    mat.node_tree.links.new(separate.outputs["R"],settings_node.inputs["Occlusion"])
    for baked in maps.values():
        baked.pack()

for obj in MODELS:
    if not opts.preview_only:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for poly in obj.data.polygons:
            poly.material_index=0
    obj.location=(0,0,0)
    empty=bpy.data.objects.new(obj.name.removesuffix("_mesh"),None)
    bpy.context.collection.objects.link(empty)
    obj.parent=empty

if opts.preview_only:
    for original in MATS.values():
        nodes=original.node_tree.nodes
        links=original.node_tree.links
        shader=next(n for n in nodes if n.type=="BSDF_PRINCIPLED")
        out=next(n for n in nodes if n.type=="OUTPUT_MATERIAL")
        links.new(shader.outputs["BSDF"],out.inputs["Surface"])

if not opts.preview_only:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/"architecture.glb"),export_format="GLB",
        use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,
        export_normals=True,export_materials="EXPORT",export_cameras=False,export_lights=False)
    (OUTPUT/"architecture.json").write_text(json.dumps({"version":1,"units":"model units",
        "axes":"GLTF Y-up; local origin centered at ground","models":metadata},ensure_ascii=False,indent=2)+"\n")
    for index,obj in enumerate(MODELS):
        obj.parent.location=(index%5*4,index//5*4,0)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"architecture.blend"),compress=True)
    # The editable .blend retains the complete authored meshes. Distance models
    # share its existing atlases and are exported without another texture bake.
    import importlib.util
    specification=importlib.util.spec_from_file_location("architecture_lod",SOURCE/"architecture_lod.py")
    lod_module=importlib.util.module_from_spec(specification)
    specification.loader.exec_module(lod_module)
    lod_module.export_with_distance_lods(MODELS)

if opts.skip_preview:
    print("KIT_STATS",json.dumps(metadata),flush=True)
    sys.exit(0)

# A real Blender rendering of a composed street and cathedral for first visual review.
for obj in MODELS:
    obj.hide_render=True
selected=["maison_pierre_01","maison_ardoise_01","maison_alsace_01","maison_sud_02","cathedrale_paris"]
positions=[(-2.5,-1.4,0),(-1.3,-1.4,0),(-.1,-1.4,0),(1.1,-1.4,0),(-.55,1.35,0)]
for name,loc in zip(selected,positions):
    obj=bpy.data.objects[name+"_mesh"]
    obj.hide_render=False
    obj.parent.location=loc
    if name=="cathedrale_paris":
        obj.parent.scale=(1.2,1.2,1.2)

ground=bpy.data.materials.new("Prévisualisation terre")
ground.diffuse_color=(.17,.22,.08,1)
ground.use_nodes=True
ground.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(.17,.22,.08,1)
ground.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.95
bpy.ops.mesh.primitive_plane_add(size=200)
bpy.context.object.data.materials.append(ground)
bpy.ops.object.light_add(type="AREA",location=(-3,-4,8))
bpy.context.object.data.energy=950
bpy.context.object.data.size=5
bpy.ops.object.light_add(type="SUN",location=(0,0,7))
bpy.context.object.rotation_euler=(math.radians(28),math.radians(-20),math.radians(-35))
bpy.context.object.data.energy=1.7
bpy.context.object.data.angle=math.radians(5)
bpy.ops.object.camera_add(location=(6,-10,8))
cam=bpy.context.object
target=Vector((-.4,.7,.8))
cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
cam.data.type="ORTHO"
cam.data.ortho_scale=7.5
scene.camera=cam
scene.view_settings.view_transform="AgX"
scene.render.resolution_x=1200
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.cycles.samples=32
scene.render.filepath=str(ROOT.parent/"mandats-verification/architecture-kit-preview.png")
if opts.preview_only:
    scene.render.filepath=str(ROOT.parent/"mandats-verification/architecture-kit-shape-preview.png")
pathlib.Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.render.render(write_still=True)
print("KIT_STATS",json.dumps(metadata),flush=True)
