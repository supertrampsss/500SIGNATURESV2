import bpy,json,math,bmesh,re
from pathlib import Path
from mathutils import Vector
import argparse,sys
parser=argparse.ArgumentParser()
parser.add_argument('--source-dir',type=Path,required=True)
parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
args.output_dir.mkdir(parents=True,exist_ok=True)
ROOT=args.source_dir;OUT=args.output_dir
bpy.ops.wm.read_factory_settings(use_empty=True)
modules={};source_counts={}
for name in ['Wall_Plaster_Door_Flat','Wall_Plaster_Window_Wide_Flat','Wall_Plaster_Straight','Corner_Exterior_Wood','Roof_RoundTiles_4x4','Roof_Front_Brick4','Door_1_Flat','Window_Wide_Flat1','Prop_Chimney','Floor_Brick']:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/(name+'.gltf')));bpy.context.view_layer.update()
 objs=[o for o in set(bpy.data.objects)-before if o.type=='MESH'];assert len(objs)==1,name
 o=objs[0];o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity();o.hide_render=True;o.hide_set(True);modules[name]=o;o.data.calc_loop_triangles();source_counts[name]=len(o.data.loop_triangles)
parts=[]
def part(name,location,angle=0):
 o=modules[name].copy();o.data=modules[name].data.copy();bpy.context.collection.objects.link(o);o.hide_render=False;o.hide_set(False);o.location=location;o.rotation_euler.z=angle;parts.append(o);return o
for x in [-1,1]:
 part('Wall_Plaster_Door_Flat' if x==-1 else 'Wall_Plaster_Window_Wide_Flat',(x,-2,0))
 part('Wall_Plaster_Window_Wide_Flat',(x,2,0),math.pi)
 if x==1:part('Window_Wide_Flat1',(x,-2,0))
 part('Window_Wide_Flat1',(x,2,0),math.pi)
 for y in [-1,1]:
  if x==-1:
   part('Wall_Plaster_Window_Wide_Flat',(-2,y,0),-math.pi/2);part('Window_Wide_Flat1',(-2,y,0),-math.pi/2)
  else:
   part('Wall_Plaster_Window_Wide_Flat',(2,y,0),math.pi/2);part('Window_Wide_Flat1',(2,y,0),math.pi/2)
part('Door_1_Flat',(-1.5,-2.08,0))
for x,y,angle in [(-2,-2,0),(2,-2,math.pi/2),(2,2,math.pi),(-2,2,-math.pi/2)]:part('Corner_Exterior_Wood',(x,y,0),angle)
part('Roof_RoundTiles_4x4',(0,0,3))
for y,angle in [(-2,0),(2,math.pi)]:part('Roof_Front_Brick4',(0,y,3),angle)
part('Prop_Chimney',(.9,.4,4.2))
part('Floor_Brick',(0,0,0))
for image in bpy.data.images:
 if image.source=='FILE' and max(image.size)>256:image.scale(256,256)
for o in bpy.data.objects:o.select_set(o in parts)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();house=bpy.context.object;house.name='library_house_master';house.data=house.data.copy()
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# These six equivalence groups were verified against the actual v2 glTF PBR graphs.
original_slots=list(house.data.materials);canonical={};slots=[];mapping=[]
for mat in original_slots:
 key=re.sub(r'\.\d{3}$','',mat.name)
 assert key in ['MI_WoodTrim','MI_Plaster','MI_RockTrim','MI_Brick','MI_WindowGlass','MI_RoundTiles']
 if key not in canonical:canonical[key]=len(slots);slots.append(mat)
 mapping.append(canonical[key])
faces=[mapping[p.material_index] for p in house.data.polygons];house.data.materials.clear()
for mat in slots:house.data.materials.append(mat)
for p,i in zip(house.data.polygons,faces):p.material_index=i
full_mesh=house.data.copy();house.hide_render=True;house.hide_set(True);records=[];variants=[]
target_low=[-.4650000035762787,-.5339999794960022,0];target_high=[.4650000035762787,.4449999928474426,1.0169999599456787]
for name,budget in [('maison_alsace_01',1500),('maison_alsace_01_distant',350)]:
 obj=house.copy();obj.data=full_mesh.copy();obj.name=name;bpy.context.collection.objects.link(obj);obj.hide_render=False;obj.hide_set(False);bpy.context.view_layer.objects.active=obj
 obj.data.calc_loop_triangles();before=len(obj.data.loop_triangles)
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
 dec=obj.modifiers.new('Miniature LoD','DECIMATE');dec.ratio=budget/before;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
 obj.data.calc_loop_triangles();count=len(obj.data.loop_triangles);print(json.dumps({'name':name,'sourceTriangles':before,'triangles':count,'budget':budget}),flush=True)
 if count>budget+4:raise RuntimeError('House budget exceeded')
 low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)];high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
 for v in obj.data.vertices:
  for i in range(3):v.co[i]=target_low[i]+(v.co[i]-low[i])/(high[i]-low[i])*(target_high[i]-target_low[i])
  assert all(math.isfinite(c) for c in v.co)
 obj.data.update();records.append({'name':name,'sourceTriangles':before,'triangles':count,'materials':len(obj.data.materials),'BlenderBounds':[target_low,target_high]});variants.append(obj)
 obj.hide_render=name.endswith('distant')
house=variants[0]
for o in bpy.data.objects:o.select_set(o in variants)
bpy.context.view_layer.objects.active=house
bpy.ops.export_scene.gltf(filepath=str(OUT/'library-house-miniature.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=85)
report={'status':'candidate-not-integrated','source':'Quaternius Medieval Village MegaKit standard 2025 CC0','variants':records,'texturePixels':256,'materialEquivalence':'Six groups verified from actual v2 glTF material graphs, including image and sampler references.','limits':['Actual game appearance and physical footing not yet validated.','Original browser timing gates not exercised by this asset study.']}
(OUT/'library-house-miniature-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
# Studio-only ground and lighting, excluded from the asset.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));floor=bpy.context.object
mat=bpy.data.materials.new('Studio ground');mat.diffuse_color=(.28,.32,.20,1);floor.data.materials.append(mat)
world=bpy.data.worlds.new('Studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.28,.34,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;bpy.context.scene.world=world
bpy.ops.object.light_add(type='AREA',location=(-6,-9,14));light=bpy.context.object;light.data.energy=2000;light.data.size=7;light.rotation_euler=(Vector((0,0,3))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-5,3));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.7;cam.rotation_euler=(Vector((0,0,.45))-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'library-house-miniature-front.png');bpy.ops.render.render(write_still=True)
cam.location=(-3,5,3);cam.rotation_euler=(Vector((0,0,.45))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/'library-house-miniature-back.png');bpy.ops.render.render(write_still=True)
