"""Original gothic focal monument, authored and baked with Blender 4.3.

blender --background --threads 6 --python tools/mandats-assets/cathedrale.py
--shape-preview checks source geometry without replacing production assets.
"""
from __future__ import annotations

import argparse
from array import array
import json
import importlib.util
import math
import os
import pathlib
import struct
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

SOURCE = pathlib.Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
OUTPUT = ROOT / "site/public/mandats/models"
EVIDENCE = pathlib.Path(os.environ.get("MANDATS_ASSET_EVIDENCE",
    str(ROOT.parent / "mandats-verification/authored-3d")))
OUTPUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument("--shape-preview", action="store_true")
parser.add_argument("--skip-bake", action="store_true")
parser.add_argument("--no-preview", action="store_true")
parser.add_argument("--lod-only", action="store_true")
parser.add_argument("--upper-profile", type=float, default=1.0,
    help="Optional geometry-only upper profile from the existing packed source; requires --lod-only")
parser.add_argument("--facade-span", type=float, default=1.0,
    help="Optional GLTF-X facade stretch after export; requires --no-preview")
parser.add_argument("--spire-width", type=float, default=1.0,
    help="Optional narrow upper cones/pinnacles after the short upper and facade profiles")
options = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
if options.spire_width != 1.0 and (not options.no_preview or options.shape_preview):
    raise RuntimeError("Spire width requires --no-preview and the full exported kit")
if not math.isfinite(options.facade_span) or not 1 <= options.facade_span <= 1.4:
    raise ValueError("Facade span must be finite and between 1 and 1.4")
if options.facade_span != 1.0 and (not options.no_preview or options.shape_preview):
    raise RuntimeError("Facade span uses the exported kit; use --no-preview")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)

COLORS = {
    "calcaire": (.67, .57, .44),
    "pierre_taille": (.76, .68, .55),
    "pierre_patinee": (.55, .47, .35),
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
    material = bpy.data.materials.new("Cathédrale source " + name)
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
    x,y,z=(component/2 for component in size)
    obj=poly([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),
        (-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],
        [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],material)
    obj.location=location
    if bevel:
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
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
    upper=radius if radius_top is None else radius_top
    vertices=[(radius*math.cos(i*math.tau/count),radius*math.sin(i*math.tau/count),-height/2) for i in range(count)]
    faces=[tuple(reversed(range(count)))]
    if upper:
        vertices += [(upper*math.cos(i*math.tau/count),upper*math.sin(i*math.tau/count),height/2) for i in range(count)]
        faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        faces.append(tuple(range(count,count*2)))
    else:
        vertices.append((0,0,height/2))
        faces += [(i,(i+1)%count,count) for i in range(count)]
    obj=poly(vertices,faces,material)
    obj.location=location
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def transform_new(start, x=0, y=0, angle=0):
    transform = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(angle, 4, "Z")
    for obj in PARTS[start:]:
        # Direct mesh authoring deliberately avoids operator-driven dependency
        # graph updates. Compose from live transforms instead of a stale cached
        # matrix_world, which would lose the arch segment positions/rotations.
        local = Matrix.Translation(obj.location) @ obj.rotation_euler.to_matrix().to_4x4() @ Matrix.Diagonal((*obj.scale,1))
        obj.matrix_world = transform @ local


def pointed_outline(width, spring, rise, count=6):
    """Two bowed lancet arches meet in a narrow Gothic point."""
    half = width / 2
    points = [(-half, spring)]
    for step in range(1, count + 1):
        t = step / count
        points.append((-half * (1-t)**2, spring + rise * (2*t-t*t)))
    for step in range(1, count + 1):
        t = step / count
        points.append((half * t*t, spring + rise * (1-t*t)))
    return points


def gothic_window(x, face, bottom, width, spring, rise, tracery=True, door=False):
    outline = [(x-width/2, bottom), (x+width/2, bottom)]
    outline += [(x+xx, zz) for xx,zz in reversed(pointed_outline(width,spring,rise))]
    poly([(xx, face+.047, zz) for xx,zz in outline], [tuple(range(len(outline)))], "bois" if door else "verre")
    # Bright glass is a separate recessed plane, not a painted wall window.
    if not door:
        strip = width*.15
        box((x+width*.13,face+.043,(bottom+spring)/2),
            (strip,.004,(spring-bottom)*.86),"verre_reflet")
    profile = [(x-width/2,bottom),(x-width/2,spring)]
    profile += [(x+xx,zz) for xx,zz in pointed_outline(width,spring,rise)[1:]]
    profile += [(x+width/2,bottom)]
    for thickness, offset, material in ((.018,-.019,"pierre_taille"),(.010,.007,"pierre_patinee")):
        for a,b in zip(profile,profile[1:]):
            beam((a[0],face+offset,a[1]),(b[0],face+offset,b[1]),thickness,material,width=.026)
    box((x,face-.013,bottom-.013),(width+.056,.063,.026),"pierre_taille")
    if tracery and not door:
        beam((x,face+.020,bottom),(x,face+.020,spring+rise*.61),.011,"pierre_taille",width=.020)
        for side in (-1,1):
            beam((x+side*width*.24,face+.020,bottom),(x+side*width*.24,face+.020,spring),.008,"pierre_taille",width=.015)
            beam((x+side*width*.24,face+.019,spring),(x,face+.019,spring+rise*.60),.009,"pierre_taille",width=.016)
        # Tiny circular foil in the upper point remains real geometry.
        ring(x,face+.016,spring+rise*.53,width*.125,.006)


def gothic_wall(x,face,z0,top,width,opening,bottom,spring,rise,door=False):
    """A perforated stone panel with a real recessed pointed opening."""
    for side in (-1,1):
        box((x+side*(width+opening)/4,face+.055,(z0+top)/2),
            ((width-opening)/2,.11,top-z0),"calcaire")
    if bottom>z0:
        box((x,face+.055,(z0+bottom)/2),(opening,.11,bottom-z0),"calcaire")
    arch=pointed_outline(opening,spring,rise)
    vertices,faces=[],[]
    for xx,zz in arch:
        vertices += [(x+xx,face,zz),(x+xx,face,top),
            (x+xx,face+.11,zz),(x+xx,face+.11,top)]
    for index in range(len(arch)-1):
        a,b=index*4,(index+1)*4
        faces += [(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)]
    poly(vertices,faces,"calcaire")
    gothic_window(x,face,bottom,opening,spring,rise,tracery=not door,door=door)


def ring(x,face,z,radius,thickness=.009):
    points=[(x+radius*math.cos(i*math.tau/16),face,z+radius*math.sin(i*math.tau/16)) for i in range(17)]
    for a,b in zip(points,points[1:]):
        beam(a,b,thickness,"pierre_taille",width=thickness*1.5)


def rose(x,face,z,radius):
    vertices=[(x+radius*math.cos(i*math.tau/20),face+.030,z+radius*math.sin(i*math.tau/20)) for i in range(20)]
    poly(vertices,[tuple(range(20))],"verre")
    ring(x,face,z,radius,.023)
    ring(x,face-.007,z,radius*.84,.009)
    ring(x,face-.008,z,radius*.32,.010)
    for i in range(12):
        angle=i*math.tau/12
        beam((x+radius*.32*math.cos(angle),face-.01,z+radius*.32*math.sin(angle)),
            (x+radius*.88*math.cos(angle),face-.01,z+radius*.88*math.sin(angle)),.012,"pierre_taille",width=.017)


def roof(x,y,bottom,width,depth,rise,axis="Y"):
    if axis=="X":
        before=len(PARTS)
        roof(0,0,bottom,depth,width,rise)
        transform_new(before,x,y,math.pi/2)
        return
    vertices=[(x-width/2,y-depth/2,bottom),(x+width/2,y-depth/2,bottom),
        (x,y-depth/2,bottom+rise),(x-width/2,y+depth/2,bottom),
        (x+width/2,y+depth/2,bottom),(x,y+depth/2,bottom+rise)]
    poly(vertices,[(0,2,5,3),(1,4,5,2),(0,3,4,1)],"ardoise")
    poly(vertices,[(0,1,2),(3,5,4)],"pierre_taille")
    for yy in (y-depth/2,y+depth/2):
        beam((x-width/2,yy,bottom),(x,yy,bottom+rise),.027,"pierre_taille",width=.027)
        beam((x,yy,bottom+rise),(x+width/2,yy,bottom),.027,"pierre_taille",width=.027)
    beam((x,y-depth/2,bottom+rise+.009),(x,y+depth/2,bottom+rise+.009),.018,"zinc")


def pinnacle(x,y,bottom,height=.38,width=.08):
    cylinder((x,y,bottom+height*.29),width*.36,height*.58,"pierre_taille",8)
    cylinder((x,y,bottom+height*.67),width*.52,height*.18,"pierre_taille",8,radius_top=width*.20)
    cylinder((x,y,bottom+height*.90),width*.20,height*.28,"pierre_taille",8,radius_top=0)
    for side in (-1,1):
        cylinder((x+side*width*.35,y,bottom+height*.63),width*.18,height*.09,"pierre_taille",5,radius_top=0)


def stone_bands(x,y,width,depth,levels):
    for z in levels:
        box((x,y,z),(width+.028,depth+.028,.028),"pierre_taille")
        for side in (-1,1):
            box((x+side*(width/2+.002),y,z-.025),(.022,depth+.026,.016),"pierre_patinee")


def tower(x,y,width,height,spire_height):
    # Tall slim tower body, two vertically paired lancets on each face.
    for angle in (0,math.pi/2,math.pi,math.pi*1.5):
        before=len(PARTS)
        for low,top,bottom,spring,rise in (
            (.05,.79,.20,.61,.12),(.79,1.42,.91,1.20,.13),
            (1.42,height,1.52,height-.21,.145)):
            if top<bottom+.20:
                continue
            for side in (-1,1):
                gothic_wall(side*width*.24,-width/2,low,top,width/2,width*.23,bottom,spring,rise)
        transform_new(before,x,y,angle)
    stone_bands(x,y,width,width,[.12,.79,1.42,height-.025])
    for sx in (-1,1):
        for sy in (-1,1):
            box((x+sx*(width/2-.013),y+sy*(width/2-.013),height/2),(.038,.038,height),"pierre_taille")
            pinnacle(x+sx*width*.51,y+sy*width*.51,height-.009,.38,.080)
    # Faceted roof taper is a long, narrow Gothic spire, not a wide cone.
    cylinder((x,y,height+.025),width*.65,.085,"pierre_taille",8,radius_top=width*.49)
    cylinder((x,y,height+spire_height/2+.057),width*.49,spire_height,"ardoise",8,radius_top=.006)
    for index in range(8):
        angle=index*math.tau/8
        beam((x+width*.49*math.cos(angle),y+width*.49*math.sin(angle),height+.057),
            (x+.006*math.cos(angle),y+.006*math.sin(angle),height+spire_height+.057),.009,"zinc")
    beam((x,y,height+spire_height),(x,y,height+spire_height+.17),.007,"fer")
    beam((x-.035,y,height+spire_height+.125),(x+.035,y,height+spire_height+.125),.007,"fer")


def flying_buttress(side,y):
    outside=side*.76
    box((outside,y,.50),(.105,.14,1.00),"pierre_taille")
    box((outside,y,.11),(.16,.18,.17),"pierre_patinee")
    box((outside,y,.66),(.136,.166,.026),"pierre_taille")
    pinnacle(outside,y,1.02,.42,.105)
    # Two bowed, solid stone ribs leave the daylight arch beneath open.
    for offset in (0,.23):
        curve=[(side*.355,1.45-offset),(side*.43,1.36-offset),
            (side*.51,1.24-offset),(side*.60,1.16-offset),(side*.69,1.13-offset),
            (outside,1.12-offset)]
        vertices=[]
        for x,z in curve:
            vertices += [(x,y-.030,z),(x,y+.030,z),(x,y-.030,z-.044),(x,y+.030,z-.044)]
        faces=[]
        for i in range(len(curve)-1):
            a,b=i*4,(i+1)*4
            faces += [(a,a+1,b+1,b),(a+2,b+2,b+3,a+3),
                (a,a+2,b+2,b),(a+1,b+1,b+3,a+3)]
        faces += [(0,2,3,1),tuple(range(len(vertices)-4,len(vertices)))]
        poly(vertices,faces,"pierre_taille")


def reprofile_upper_geometry(obj, slope, hinge=2.03):
    """Shorten the upper monument while retaining its packed UV/material atlas.

    Bisect crossing faces first. Moving their upper corners alone would also
    compress the interpolated texture and visible geometry below the roof.
    This opt-in candidate must be verified in Blender before asset acceptance.
    """
    if not .25 <= slope < 1:
        raise ValueError("Upper profile slope must be at least .25 and below 1")
    if obj.get("cathedrale_upper_profile") is not None:
        raise RuntimeError("Do not apply the cathedral upper profile twice")
    data = bmesh.new()
    data.from_mesh(obj.data)
    uv = data.loops.layers.uv.active
    if uv is None:
        data.free()
        raise RuntimeError("The existing packed cathedral source must have UVs")
    before_bounds = tuple((min(v.co[a] for v in data.verts),
        max(v.co[a] for v in data.verts)) for a in (0, 1))
    # Below-plane corners, including their existing UVs, remain exact. New
    # corners on the cut plane receive the original face's interpolated UV.
    lower_corners = {(tuple(loop.vert.co), tuple(loop[uv].uv))
        for face in data.faces for loop in face.loops if loop.vert.co.z < hinge}
    bmesh.ops.bisect_plane(data,
        geom=[*data.verts, *data.edges, *data.faces], dist=.0000001,
        plane_co=(0, 0, hinge), plane_no=(0, 0, 1),
        clear_inner=False, clear_outer=False)
    for vertex in data.verts:
        if vertex.co.z > hinge:
            vertex.co.z = hinge + (vertex.co.z - hinge) * slope
    retained_corners = {(tuple(loop.vert.co), tuple(loop[uv].uv))
        for face in data.faces for loop in face.loops if loop.vert.co.z < hinge}
    if not lower_corners.issubset(retained_corners):
        data.free()
        raise RuntimeError("Upper profile changed existing lower geometry or UV")
    after_bounds = tuple((min(v.co[a] for v in data.verts),
        max(v.co[a] for v in data.verts)) for a in (0, 1))
    if before_bounds != after_bounds:
        data.free()
        raise RuntimeError("Upper profile changed the cathedral footprint")
    data.normal_update()
    data.to_mesh(obj.data)
    data.free()
    obj.data.update()
    obj["cathedrale_upper_profile"] = slope
    obj["cathedrale_upper_hinge"] = hinge


def cathedral():
    global CURRENT
    CURRENT="cathedrale_paris"
    # Authored footprint follows the reference silhouette: low broad crossing,
    # slender nave, narrow unequal western spires and a third crossing lantern.
    box((0,.05,.020),(1.79,2.61,.04),"pierre_patinee")
    nave_width=.72
    bays=[-.56,-.20,.16,.52,.88]
    for side in (-1,1):
        for y in bays:
            before=len(PARTS)
            gothic_wall(0,0,.055,1.50,.36,.17,.91,1.30,.15)
            transform_new(before,side*nave_width/2,y,side*math.pi/2)
        for z in (.14,.83,1.48):
            box((side*(nave_width/2+.008),.16,z),(.050,1.94,.037),"pierre_taille")
        # Lower aisle is individually perforated too.
        for y in bays:
            before=len(PARTS)
            gothic_wall(0,0,.052,.78,.36,.17,.18,.52,.18)
            transform_new(before,side*.62,y,side*math.pi/2)
        roof(side*.51,.16,.81,.30,1.93,.09)
        for y in [-.74,-.38,-.02,.34,.70,1.06]:
            flying_buttress(side,y)
    roof(0,.16,1.515,.79,1.94,.49)
    # West facade: pointed portals, sculpture gallery, rose and stepped gable.
    face=-.93
    for x in (-.25,0,.25):
        gothic_wall(x,face,.04,.81,.25,.172,.072,.46,.26,door=True)
    box((0,face+.055,1.10),(.73,.11,.58),"calcaire")
    rose(0,face-.027,1.10,.183)
    for z in (.82,1.36):
        box((0,face-.014,z),(.82,.09,.040),"pierre_taille")
    for x in (-.30,-.20,-.10,0,.10,.20,.30):
        cylinder((x,face-.058,.875),.010,.080,"pierre_taille",6)
    vertices=[(-.40,face-.018,1.395),(.40,face-.018,1.395),(0,face-.018,1.93),
        (-.40,face+.080,1.395),(.40,face+.080,1.395),(0,face+.080,1.93)]
    poly(vertices,[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],"calcaire")
    gothic_window(0,face-.023,1.43,.18,1.61,.18)
    for side in (-1,1):
        beam((side*.41,face-.034,1.39),(0,face-.034,1.96),.031,"pierre_taille")
        pinnacle(side*.41,face+.01,1.36,.46,.074)
    pinnacle(0,face+.018,1.95,.33,.07)
    tower(-.51,-.78,.295,2.75,.92)
    tower(.51,-.78,.295,2.38,.83)
    # Lower transept spreads in front of the central lantern in the aerial view.
    for side in (-1,1):
        # Each end has a double-height recessed lancet beneath a stone gable.
        before=len(PARTS)
        gothic_wall(0,0,.04,1.14,.56,.285,.09,.70,.33,door=True)
        transform_new(before,side*.90,.35,side*math.pi/2)
        for sy in (-1,1):
            for xx in (.49,.68,.84):
                before=len(PARTS)
                gothic_wall(0,0,.04,1.08,.18,.10,.18,.84,.12)
                transform_new(before,side*xx,.35+sy*.28,0 if sy<0 else math.pi)
        for z in (.14,.47,1.06):
            box((side*.63,.35,z),(.63,.60,.035),"pierre_taille")
        roof(side*.63,.35,1.15,.62,.56,.30,axis="X")
        for sy in (-1,1):
            pinnacle(side*.91,.35+sy*.30,1.08,.51,.08)
    # Octagonal crossing lantern and its third, fine spire.
    cylinder((0,.35,1.95),.112,.22,"pierre_taille",8)
    for i in range(8):
        angle=i*math.tau/8
        beam((.109*math.cos(angle),.35+.109*math.sin(angle),1.85),
            (.109*math.cos(angle),.35+.109*math.sin(angle),2.13),.016,"pierre_taille")
    cylinder((0,.35,2.40),.125,.57,"ardoise",8,radius_top=.006)
    beam((0,.35,2.69),(0,.35,2.86),.007,"fer")
    beam((-.03,.35,2.81),(.03,.35,2.81),.007,"fer")
    # Faceted apse with five radiating, individually glazed chapels.
    for i in range(7):
        angle=math.pi*i/6
        before=len(PARTS)
        gothic_wall(0,0,.04,1.35,.195,.11,.58,1.11,.14)
        transform_new(before,.35*math.cos(angle),1.06+.35*math.sin(angle),angle+math.pi/2)
    cylinder((0,1.10,1.39),.37,.095,"pierre_taille",14)
    cylinder((0,1.10,1.66),.39,.45,"ardoise",14,radius_top=.04)
    for i in range(5):
        angle=math.pi*i/4
        x,y=.47*math.cos(angle),1.05+.46*math.sin(angle)
        cylinder((x,y,.355),.135,.62,"calcaire",8)
        cylinder((x,y,.75),.153,.20,"ardoise",8,radius_top=.03)
        before=len(PARTS)
        gothic_window(0,0,.18,.090,.44,.15)
        transform_new(before,x+.137*math.cos(angle),y+.137*math.sin(angle),angle+math.pi/2)
        pinnacle(x+.10*math.cos(angle),y+.10*math.sin(angle),.67,.29,.063)
    # Sculptural bases and corner columns remain visible in the inspection view.
    for x in (-.67,.67):
        for y in (-.93,-.59):
            box((x,y,.22),(.084,.072,.44),"pierre_taille")
            pinnacle(x,y,.44,.28,.065)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=PARTS[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=CURRENT+"_mesh"
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    minimum=[min(v.co[a] for v in obj.data.vertices) for a in range(3)]
    maximum=[max(v.co[a] for v in obj.data.vertices) for a in range(3)]
    offset=Vector(((minimum[0]+maximum[0])/2,(minimum[1]+maximum[1])/2,minimum[2]))
    for v in obj.data.vertices:
        v.co-=offset
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(68),island_margin=.002)
    bpy.ops.object.mode_set(mode="OBJECT")
    MODELS.append(obj)
    obj.data.calc_loop_triangles()
    print("CATHEDRALE_GEOMETRY",len(PARTS),len(obj.data.loop_triangles),flush=True)


if options.lod_only:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/"cathedrale.blend"))
    MODELS=[obj for obj in bpy.data.objects if obj.type=="MESH" and
        obj.name.endswith("_mesh") and not obj.name.endswith("_distant_mesh")]
else:
    cathedral()

if options.upper_profile != 1.0:
    if not options.lod_only:
        raise RuntimeError("Use --lod-only to retain the current packed atlas and UVs")
    for obj in MODELS:
        reprofile_upper_geometry(obj, options.upper_profile)


def dimensions(obj):
    obj.data.calc_loop_triangles()
    minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    return {"width":round(maximum[0]-minimum[0],5),"depth":round(maximum[1]-minimum[1],5),
        "height":round(maximum[2]-minimum[2],5),"min":[minimum[0],minimum[2],-maximum[1]],
        "max":[maximum[0],maximum[2],-minimum[1]],"triangles":len(obj.data.loop_triangles)}


def export_distance_geometry(models):
    metadata = {}
    clones = []
    for high in models:
        name = high.parent.name
        original = dimensions(high)
        metadata[name] = original
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
        # Thousands of tiny, disconnected iron/stone frame segments cannot all
        # collapse to zero triangles. Remove these inspection-only ornaments
        # deliberately, while retaining the window planes, shafts, roof masses,
        # buttresses, pinnacles and every extreme point of the silhouette.
        data=bmesh.new()
        data.from_mesh(low.data)
        remaining=set(data.verts)
        remove=[]
        detail_components=0
        limits_min=[min(v.co[axis] for v in data.verts) for axis in range(3)]
        limits_max=[max(v.co[axis] for v in data.verts) for axis in range(3)]
        while remaining:
            first=remaining.pop()
            component=[first]
            pending=[first]
            while pending:
                current=pending.pop()
                for edge in current.link_edges:
                    other=edge.other_vert(current)
                    if other in remaining:
                        remaining.remove(other)
                        pending.append(other)
                        component.append(other)
            lower=[min(v.co[axis] for v in component) for axis in range(3)]
            upper=[max(v.co[axis] for v in component) for axis in range(3)]
            spans=sorted(upper[axis]-lower[axis] for axis in range(3))
            at_limit=any(abs(lower[axis]-limits_min[axis])<.0001 or
                abs(upper[axis]-limits_max[axis])<.0001 for axis in range(3))
            if (not at_limit and spans[0]<=.028 and spans[1]<=.050 and
                spans[0]*spans[1]<=.001 and spans[2]<.95):
                remove.extend(component)
                detail_components+=1
        bmesh.ops.delete(data,geom=remove,context="VERTS")
        data.to_mesh(low.data)
        data.free()
        low.data.update()
        modifier = low.modifiers.new("Silhouette gothique en vue nationale", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = .20
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        low.data.update()
        measured = dimensions(low)
        errors = [abs(measured[edge][axis]-original[edge][axis]) /
            max(original["max"][axis]-original["min"][axis],.001)
            for edge in ("min","max") for axis in range(3)]
        if max(errors) > .02:
            raise RuntimeError("Cathedral distance silhouette changed excessively")
        before_min = [measured["min"][0],-measured["max"][2],measured["min"][1]]
        before_max = [measured["max"][0],-measured["min"][2],measured["max"][1]]
        after_min = [original["min"][0],-original["max"][2],original["min"][1]]
        after_max = [original["max"][0],-original["min"][2],original["max"][1]]
        for vertex in low.data.vertices:
            for axis in range(3):
                t=(vertex.co[axis]-before_min[axis])/(before_max[axis]-before_min[axis])
                vertex.co[axis]=after_min[axis]+t*(after_max[axis]-after_min[axis])
            if not all(math.isfinite(value) for value in vertex.co):
                raise RuntimeError("Invalid cathedral distance vertex")
        low.data.update()
        for loop in low.data.uv_layers.active.data:
            if not all(math.isfinite(value) and -.00001<=value<=1.00001 for value in loop.uv):
                raise RuntimeError("Invalid cathedral distance UV")
        if list(low.data.materials) != list(high.data.materials):
            raise RuntimeError("Cathedral distance material is not shared")
        result=dimensions(low)
        result.update(lodOf=name,lodRatio=round(result["triangles"]/original["triangles"],6),
            decimationRatio=.20,omittedInspectionComponents=detail_components,
            decimationExtentError=round(max(errors),6))
        if result["triangles"]/original["triangles"]>.14:
            raise RuntimeError("Cathedral distance geometry exceeds the 14 percent triangle budget")
        metadata[root.name]=result
        clones.append(low)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [*models,*clones]:
        obj.parent.location=(0,0,0)
        obj.select_set(True)
        obj.parent.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/"cathedrale.glb"),export_format="GLB",
        use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,
        export_normals=True,export_materials="EXPORT",export_cameras=False,export_lights=False)
    # Source PNGs are authoritative even when .blend retains an older packed
    # albedo. Synchronize only the final image after both full and LOD exports.
    slate_spec = importlib.util.spec_from_file_location("slate_albedo", SOURCE / "slate_albedo.py")
    slate_module = importlib.util.module_from_spec(slate_spec)
    slate_spec.loader.exec_module(slate_module)
    slate_module.sync_glb_albedo(OUTPUT / "cathedrale.glb", SOURCE / "cathedrale-atlas.png")
    # The exporter omits zero-area triangles left by collapse. Record the actual
    # indexed runtime triangles as well as the source count when they differ.
    binary=(OUTPUT/"cathedrale.glb").read_bytes()
    json_length=struct.unpack_from("<I",binary,12)[0]
    exported=json.loads(binary[20:20+json_length])
    for name,entry in metadata.items():
        node=next(node for node in exported["nodes"] if node.get("name")==name)
        pending=list(node.get("children",[]))
        triangles=0
        while pending:
            child=exported["nodes"][pending.pop()]
            pending.extend(child.get("children",[]))
            if "mesh" in child:
                for primitive in exported["meshes"][child["mesh"]]["primitives"]:
                    assert primitive.get("mode",4)==4
                    triangles+=exported["accessors"][primitive["indices"]]["count"]//3
        if triangles != entry["triangles"]:
            entry["sourceTriangles"]=entry["triangles"]
            entry["triangles"]=triangles
    for name,entry in metadata.items():
        if "lodOf" in entry:
            entry["lodRatio"]=round(entry["triangles"]/metadata[entry["lodOf"]]["triangles"],6)
    (OUTPUT/"cathedrale.json").write_text(json.dumps({"version":2,
        "axes":"GLTF Y-up; footprint centred at ground", "front":"+Z",
        "distanceGeometry":"Named _distant model; high-detail geometry retained",
        "models":metadata},ensure_ascii=False,indent=2)+"\n")
    for obj in clones:
        obj.hide_render=True
    print("CATHEDRALE_LODS",json.dumps(metadata),flush=True)


scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.cycles.device = "CPU"
scene.render.bake.margin = 1
scene.render.bake.use_clear = False
scene.world.color = (.12,.12,.12)
metadata = {obj.name.removesuffix("_mesh"):dimensions(obj) for obj in MODELS}

if not options.shape_preview and not options.lod_only:
    # Pack every model once, in one UV object. Separate their physical positions
    # while baking so neighbours from the authoring kit cannot cast phantom AO.
    copies = []
    bpy.ops.object.select_all(action="DESELECT")
    for index,obj in enumerate(MODELS):
        obj.location = (index*6,0,0)
        face_id = obj.data.attributes.new("cathedrale_model","INT","FACE")
        for item in face_id.data:
            item.value=index
        loop_id = obj.data.attributes.new("cathedrale_loop","INT","CORNER")
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
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True,margin_method="FRACTION",margin=.0008)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv=bake_object.data.uv_layers.active
    ids=bake_object.data.attributes["cathedrale_model"]
    loops=bake_object.data.attributes["cathedrale_loop"]
    uv_area=0
    for face in bake_object.data.polygons:
        target=MODELS[ids.data[face.index].value].data.uv_layers.active
        for loop in face.loop_indices:
            target.data[loops.data[loop].value].uv=uv.data[loop].uv
        ring_uv=[uv.data[loop].uv for loop in face.loop_indices]
        uv_area+=abs(sum(a.x*b.y-b.x*a.y for a,b in zip(ring_uv,ring_uv[1:]+ring_uv[:1])))/2
    if uv_area>1.001:
        raise RuntimeError("Cathédrale atlas islands overlap")
    if uv_area<.30:
        raise RuntimeError("Cathedral atlas uses too little area for the detailed windows")
    print("CATHEDRALE_UV_AREA",round(uv_area,5),flush=True)

    maps={}
    for kind,size,background in (("COLOR",2048,(.43,.37,.28,1)),
        ("NORMAL",1024,(.5,.5,1,1)),("ROUGHNESS",1024,(.9,.9,.9,1)),
        ("METALLIC",1024,(0,0,0,1)),("AO",1024,(1,1,1,1))):
        path=SOURCE/("cathedrale-atlas.png" if kind=="COLOR" else "cathedrale-"+kind.lower()+".png")
        if options.skip_bake and path.exists():
            baked=bpy.data.images.load(str(path),check_existing=False)
            baked.colorspace_settings.name="sRGB" if kind=="COLOR" else "Non-Color"
        else:
            baked=bpy.data.images.new("Cathédrale "+kind,width=size,height=size,alpha=False)
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
            print("CATHEDRALE_BAKE",kind,flush=True)
            bpy.ops.object.bake(type="EMIT" if kind in {"COLOR","METALLIC","AO"} else kind)
            baked.filepath_raw=str(path)
            baked.file_format="PNG"
            baked.save()
        maps[kind]=baked
    bpy.data.objects.remove(bake_object,do_unlink=True)
    for obj in MODELS:
        obj.hide_render=False
        obj.data.attributes.remove(obj.data.attributes["cathedrale_model"])
        obj.data.attributes.remove(obj.data.attributes["cathedrale_loop"])
    material=bpy.data.materials.new("Cathédrale atlas pierre ardoise fer verre")
    material.use_nodes=True
    shader=material.node_tree.nodes.get("Principled BSDF")
    texture=material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image=maps["COLOR"]
    material.node_tree.links.new(texture.outputs[0],shader.inputs["Base Color"])
    # Explicit glTF ORM channels: occlusion R, roughness G, metallic B.
    # Their UVs and resolution are identical, so one texture suffices at runtime.
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
    orm=bpy.data.images.new("Cathédrale ORM",width=1024,height=1024,alpha=False)
    orm.colorspace_settings.name="Non-Color"
    orm.pixels.foreach_set(occlusion)
    orm.filepath_raw=str(SOURCE/"cathedrale-orm.png")
    orm.file_format="PNG"
    orm.save()
    maps["ORM"]=orm
    texture=material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image=orm
    separate=material.node_tree.nodes.new("ShaderNodeSeparateRGB")
    material.node_tree.links.new(texture.outputs[0],separate.inputs[0])
    material.node_tree.links.new(separate.outputs["G"],shader.inputs["Roughness"])
    material.node_tree.links.new(separate.outputs["B"],shader.inputs["Metallic"])
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
    material.node_tree.links.new(separate.outputs["R"],settings_node.inputs["Occlusion"])
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
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"cathedrale.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in MODELS:
        obj.parent.location=(0,0,0)
        obj.select_set(True)
        obj.parent.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/"cathedrale.glb"),export_format="GLB",
        use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,
        export_normals=True,export_materials="EXPORT",export_cameras=False,export_lights=False)
    (OUTPUT/"cathedrale.json").write_text(json.dumps({"version":1,"axes":"GLTF Y-up; footprint centred at ground",
        "front":"+Z","models":metadata},ensure_ascii=False,indent=2)+"\n")
    export_distance_geometry(MODELS)

elif options.lod_only:
    export_distance_geometry(MODELS)

# Final opt-in geometry profile follows both LOD export and the slate atlas sync.
if options.facade_span != 1.0:
    span_spec = importlib.util.spec_from_file_location("cathedral_facade_span", SOURCE / "cathedral_facade_span.py")
    span_module = importlib.util.module_from_spec(span_spec)
    span_spec.loader.exec_module(span_module)
    report = span_module.stretch_facade(OUTPUT/"cathedrale.glb", OUTPUT/"cathedrale.json", options.facade_span)
    metadata = json.loads((OUTPUT/"cathedrale.json").read_text())["models"]
    print("CATHEDRALE_FACADE_SPAN", json.dumps(report), flush=True)

if options.spire_width != 1.0:
    spire_spec = importlib.util.spec_from_file_location("cathedral_spire_profile", SOURCE / "cathedral_spire_profile.py")
    spire_module = importlib.util.module_from_spec(spire_spec)
    spire_spec.loader.exec_module(spire_module)
    report = spire_module.slim_spires(OUTPUT/"cathedrale.glb", OUTPUT/"cathedrale.json", options.spire_width)
    metadata = json.loads((OUTPUT/"cathedrale.json").read_text())["models"]
    print("CATHEDRALE_SPIRE_PROFILE", json.dumps(report), flush=True)

if not options.no_preview:
    for index,obj in enumerate(MODELS):
        location = (0,0,0)
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
    bpy.ops.object.camera_add(location=(5,-8,5))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,1.60))-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type="ORTHO"
    camera.data.ortho_scale=5.4
    scene.camera=camera
    scene.view_settings.view_transform="AgX"
    scene.render.resolution_x=1200
    scene.render.resolution_y=1100
    scene.render.resolution_percentage=100
    scene.cycles.samples=24
    scene.render.filepath=str(EVIDENCE/("cathedrale-source-preview.png" if options.shape_preview else "cathedrale-atlas-preview.png"))
    bpy.ops.render.render(write_still=True)
print("CATHEDRALE_KIT",json.dumps(metadata),flush=True)
