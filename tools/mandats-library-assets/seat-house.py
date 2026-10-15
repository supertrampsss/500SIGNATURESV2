import json,struct,math,hashlib
from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--directory',type=Path,required=True)
args=parser.parse_args()
ROOT=args.directory;source=ROOT/'library-house-miniature.glb';raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);binary=bytearray(raw[28+n:]);changes=[]
def accessor(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];assert a['componentType']==5126 and a['type']=='VEC3';return a,v,v.get('byteOffset',0)+a.get('byteOffset',0),v.get('byteStride',12)
for node in j['nodes']:
 if node['name']!='maison_alsace_01_distant':continue
 mesh=j['meshes'][node['mesh']];positions=[p['attributes']['POSITION'] for p in mesh['primitives']];normals=[p['attributes']['NORMAL'] for p in mesh['primitives']];all_pos=[]
 for i in positions:
  a,v,start,step=accessor(i);all_pos.extend(struct.unpack_from('<fff',binary,start+k*step) for k in range(a['count']))
 low=[min(p[i] for p in all_pos) for i in range(3)];high=[max(p[i] for p in all_pos) for i in range(3)];target_low=[-.4650000035762787,0,-.4449999928474426];target_high=[.4650000035762787,1.0169999599456787,.5339999794960022];scale=[(target_high[i]-target_low[i])/(high[i]-low[i]) for i in range(3)]
 for i in positions:
  a,v,start,step=accessor(i);points=[]
  for k in range(a['count']):
   pos=struct.unpack_from('<fff',binary,start+k*step);new=[target_low[c]+(pos[c]-low[c])*scale[c] for c in range(3)];assert all(math.isfinite(x) for x in new);struct.pack_into('<fff',binary,start+k*step,*new);points.append(struct.unpack_from('<fff',binary,start+k*step))
  a['min']=[min(p[c] for p in points) for c in range(3)];a['max']=[max(p[c] for p in points) for c in range(3)]
 for i in normals:
  a,v,start,step=accessor(i)
  for k in range(a['count']):
   norm=struct.unpack_from('<fff',binary,start+k*step);new=[norm[c]/scale[c] for c in range(3)];length=math.sqrt(sum(c*c for c in new));assert length>0;struct.pack_into('<fff',binary,start+k*step,*[c/length for c in new])
 changes.append({'name':node['name'],'actualExportBoundsBefore':[low,high],'targetGLTFBounds':[target_low,target_high],'positiveAffineScale':scale,'normalTransform':'Inverse diagonal scale, renormalized.','topologyAndUVUnchanged':True})
assert len(changes)==1
header=json.dumps(j,separators=(',',':')).encode();header+=b' '*((-len(header))%4);output=struct.pack('<III',0x46546c67,2,28+len(header)+len(binary))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary
p=ROOT/'library-house-miniature-seated.glb';p.write_bytes(output);receipt={'status':'candidate-not-integrated','sourceSha256':hashlib.sha256(raw).hexdigest(),'outputSha256':hashlib.sha256(output).hexdigest(),'bytes':len(output),'changes':changes,'limits':['This fixes exported local bounds only. Actual terrain contacts and original browser gates remain unvalidated.']};(ROOT/'house-export-seating.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)
