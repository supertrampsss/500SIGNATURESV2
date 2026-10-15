import json,struct,copy,hashlib
from pathlib import Path
ROOT=Path('/workspace/mandats-verification/authored-3d/library-adaptation38')
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);off=20+n;assert struct.unpack_from('<I',b,off+4)[0]==0x004e4942
 return j,b[off+8:],hashlib.sha256(b).hexdigest()
base,binary,base_sha=read(Path('/workspace/500SIGNATURESV2/site/public/mandats/models/architecture.glb'))
new,added,new_sha=read(ROOT/'library-house-miniature.glb')
assert not new.get('extensionsUsed') and not new.get('skins') and not new.get('animations')
original=copy.deepcopy(base);offset=len(binary);assert offset%4==0
keys=['bufferViews','accessors','samplers','images','textures','materials','meshes','nodes'];delta={k:len(base.get(k,[])) for k in keys}
for v in new['bufferViews']:v['byteOffset']=v.get('byteOffset',0)+offset;assert v['buffer']==0
for a in new['accessors']:a['bufferView']+=delta['bufferViews']
for i in new['images']:i['bufferView']+=delta['bufferViews']
for t in new['textures']:t['source']+=delta['images'];t['sampler']+=delta['samplers']
def texture_indices(v):
 if isinstance(v,dict):
  for k,item in v.items():
   if k.endswith('Texture') and isinstance(item,dict):item['index']+=delta['textures']
   else:texture_indices(item)
 elif isinstance(v,list):
  for item in v:texture_indices(item)
texture_indices(new['materials'])
for m in new['meshes']:
 for primitive in m['primitives']:
  primitive['material']+=delta['materials'];primitive['indices']+=delta['accessors']
  primitive['attributes']={k:i+delta['accessors'] for k,i in primitive['attributes'].items()}
for node in new['nodes']:
 if 'mesh' in node:node['mesh']+=delta['meshes']
 if 'children' in node:node['children']=[i+delta['nodes'] for i in node['children']]
for k in keys:base.setdefault(k,[]).extend(new.get(k,[]))
replacement_names={n['name'] for n in new['nodes'] if n['name'] in ['maison_alsace_01','maison_alsace_01_distant']}
assert replacement_names=={'maison_alsace_01','maison_alsace_01_distant'}
previous={i for i,n in enumerate(original['nodes']) if n.get('name') in replacement_names}
assert len(previous)==2
base['scenes'][base.get('scene',0)]['nodes']=[i for i in base['scenes'][base.get('scene',0)]['nodes'] if i not in previous]+[i+delta['nodes'] for i in new['scenes'][new.get('scene',0)]['nodes']]
for k in keys:assert base[k][:delta[k]]==original.get(k,[])
base['buffers'][0]['byteLength']=len(binary)+len(added)
j=json.dumps(base,separators=(',',':')).encode();j+=b' '*((-len(j))%4);combined=binary+added;combined+=b'\0'*((-len(combined))%4)
b=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(combined))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(combined),0x004e4942)+combined
out=ROOT/'architecture-house-probe.glb';out.write_bytes(b)
r={'status':'experimental-model-override-not-production','baseSha256':base_sha,'candidateHouseSha256':new_sha,'composedSha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'preservedExistingJSONSections':keys,'preservedExistingBinaryPrefix':len(binary),'change':'Only maison_alsace_01 and its distant template are substituted; all other prefabs and binary data preserved.','limits':['Old unused house data remains in this experimental container.','No production source or asset modified.','No other house family, city layout, terrain or saved state changed.']}
(ROOT/'house-composition-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
