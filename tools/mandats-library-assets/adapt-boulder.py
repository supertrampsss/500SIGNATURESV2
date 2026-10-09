import bpy,json,math,bmesh
from pathlib import Path
import argparse,sys
parser=argparse.ArgumentParser()
parser.add_argument('--source-dir',type=Path,required=True)
parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
args.output_dir.mkdir(parents=True,exist_ok=True)
ROOT=args.source_dir
OUT=args.output_dir
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'boulder_01_1k.gltf'))
obj=next(o for o in bpy.data.objects if o.type=='MESH');obj.name='rock'
bpy.context.view_layer.objects.active=obj
obj.data.calc_loop_triangles();before=len(obj.data.loop_triangles)
vertices_before=len(obj.data.vertices)
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
welded_vertices=len(obj.data.vertices)
print(json.dumps({'verticesBefore':vertices_before,'verticesAfterWeld':welded_vertices,'trianglesBefore':before}),flush=True)
mod=obj.modifiers.new('Miniature boulder','DECIMATE');mod.ratio=900/before;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
obj.data.calc_loop_triangles();count=len(obj.data.loop_triangles)
print(json.dumps({'trianglesAfterDecimation':count}),flush=True)
if count>1100:raise RuntimeError('Boulder exceeds1100tri budget')
bounds=json.loads((Path(__file__).resolve().parents[2]/'tools/mandats-assets/vegetation-bounds.json').read_text())['rock']
low=[bounds['min'][0],-bounds['max'][2],bounds['min'][1]];high=[bounds['max'][0],-bounds['min'][2],bounds['max'][1]]
source_low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)];source_high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
for vertex in obj.data.vertices:
 for i in range(3):vertex.co[i]=low[i]+(vertex.co[i]-source_low[i])/(source_high[i]-source_low[i])*(high[i]-low[i])
 if not all(math.isfinite(c) for c in vertex.co):raise RuntimeError('Nonfinite boulder')
obj.data.update()
for image in bpy.data.images:
 if image.source=='FILE' and image.size[0]>512:image.scale(512,512)
for o in bpy.data.objects:o.select_set(o==obj)
bpy.ops.export_scene.gltf(filepath=str(OUT/'library-boulder-v2.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_normals=True,export_texcoords=True)
r={'source':'Poly Haven boulder_01 CC0','sourceTriangles':before,'verticesBefore':vertices_before,'verticesAfterWeld':welded_vertices,'triangles':count,'vertices':len(obj.data.vertices),'targetGLTFBounds':bounds,'status':'exported-not-integrated','limits':['Browser materials, footing and visual appearance not yet validated.','This model replaces a small decorative forest rock only; no Alpine landscape claim.']}
(OUT/'adapted-boulder-v2-report.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
