import json,struct,math,hashlib,io
from pathlib import Path
from PIL import Image
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--directory',type=Path,required=True)
parser.add_argument('--files',nargs='+',default=['library-boulder-v2.glb','library-house-miniature.glb','library-house-miniature-seated.glb'])
parser.add_argument('--report',default='library-glb-audit-seated.json')
parser.add_argument('--strict-house',action='store_true',help='Reject broken normals, LoD bounds, surface count or house budgets.')
args=parser.parse_args()
ROOT=args.directory
reports=[]
for name in args.files:
 b=(ROOT/name).read_bytes();magic,version,total=struct.unpack_from('<III',b);assert magic==0x46546c67 and version==2 and total==len(b)
 n,t=struct.unpack_from('<II',b,12);assert t==0x4e4f534a;j=json.loads(b[20:20+n]);off=20+n;n2,t2=struct.unpack_from('<II',b,off);assert t2==0x004e4942;binary=b[off+8:off+8+n2];assert off+8+n2==len(b)
 def values(index):
  a=j['accessors'][index];v=j['bufferViews'][a['bufferView']];f={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']];size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];step=v.get('byteStride',size*struct.calcsize(f));start=v.get('byteOffset',0)+a.get('byteOffset',0)
  out=[struct.unpack_from('<'+f*size,binary,start+i*step) for i in range(a['count'])];assert all(math.isfinite(c) for row in out for c in row);return out
 records=[]
 for mesh in j['meshes']:
  tris=0;degenerate=0;inverted=0;normal_max_error=0;mins=[math.inf]*3;maxs=[-math.inf]*3
  for p in mesh['primitives']:
   assert p.get('mode',4)==4;pos=values(p['attributes']['POSITION']);norm=values(p['attributes']['NORMAL']);uv=values(p['attributes']['TEXCOORD_0']);idx=[i[0] for i in values(p['indices'])];assert len(idx)%3==0 and max(idx)<len(pos) and len(pos)==len(norm)==len(uv)
   assert 0<=p['material']<len(j['materials'])
   normal_max_error=max(normal_max_error,max(abs(math.sqrt(sum(c*c for c in v))-1) for v in norm))
   for v in pos:
    for i in range(3):mins[i]=min(mins[i],v[i]);maxs[i]=max(maxs[i],v[i])
   for k in range(0,len(idx),3):
    a,b1,c=[pos[i] for i in idx[k:k+3]];u=[b1[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];area=sum(x*x for x in cross)
    if area<=1e-20:degenerate+=1
    mean=[sum(norm[i][axis] for i in idx[k:k+3]) for axis in range(3)]
    if sum(x*y for x,y in zip(cross,mean)) < -1e-12:inverted+=1
   tris+=len(idx)//3
  records.append({'mesh':mesh['name'],'triangles':tris,'primitives':len(mesh['primitives']),'bounds':[mins,maxs],'degenerateTrianglesThreshold1eMinus20':degenerate,'faceNormalDisagreements':inverted,'maximumNormalLengthError':normal_max_error})
 images=[]
 for im in j['images']:
  assert 'uri' not in im;v=j['bufferViews'][im['bufferView']];raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  with Image.open(io.BytesIO(raw)) as img:img.load();images.append({'name':im.get('name'),'format':img.format,'width':img.width,'height':img.height,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 if args.strict_house:
  assert len(records)==2 and len(images)==6 and len(b)<=512000, 'House export budget exceeded.'
  assert sorted(n['name'] for n in j['nodes'])==['maison_alsace_01','maison_alsace_01_distant']
  for record,budget in zip(records,[1500,750]):
   assert record['primitives']==1 and record['triangles']<=budget
   assert record['degenerateTrianglesThreshold1eMinus20']==record['faceNormalDisagreements']==0
   assert record['maximumNormalLengthError']<1e-4
   assert abs(record['bounds'][0][1])<1e-7, 'Exported house does not start on the floor.'
   assert all(abs(a-b1)<1e-6 for row,other in zip(record['bounds'],records[0]['bounds']) for a,b1 in zip(row,other)), 'LoD extents differ.'
  for material in j['materials']:
   assert material['normalTexture'].get('texCoord',0)==0
   assert material['pbrMetallicRoughness']['baseColorTexture'].get('texCoord',0)==0
   assert material['occlusionTexture']['index']==material['pbrMetallicRoughness']['metallicRoughnessTexture']['index']
 reports.append({'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'status':'strict-house-structure-passed-not-production-validation' if args.strict_house else 'structural-inspection-completed-not-production-validation','meshes':records,'images':images,'limits':['No claim of physical placement, GPU cadence, visual conformity or original timing-gate pass.','Face normal disagreements are recorded rather than hidden.']})
(ROOT/args.report).write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps([{'file':i['file'],'bytes':i['bytes'],'meshes':i['meshes'],'images':len(i['images'])} for i in reports],indent=2))
