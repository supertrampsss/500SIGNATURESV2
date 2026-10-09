"""Replace slate albedo islands only, retaining every other GLB buffer byte.

The semantic rings come from original source material assignments matched to the
current .blend polygon order and UVs. Color selection is never used as a mask.
No Blender bake, mesh export, material split or runtime shader change is involved.
"""
from __future__ import annotations
import argparse, copy, hashlib, io, json, struct
from pathlib import Path

SLATE_LINEAR = (.025, .045, .075)
PREVIOUS_LINEAR = {'architecture':(.10,.16,.235),'paris':(.065,.087,.105),'cathedrale':(.065,.087,.105)}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def glb_parts(data):
    magic,version,length=struct.unpack_from('<III',data)
    assert magic==0x46546c67 and version==2 and length==len(data)
    json_size,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    document=json.loads(data[20:20+json_size])
    bin_size,kind=struct.unpack_from('<II',data,20+json_size)
    assert kind==0x004e4942
    binary=data[28+json_size:28+json_size+bin_size]
    return document,binary

def view_bytes(document,binary,index):
    view=document['bufferViews'][index]
    offset=view.get('byteOffset',0)
    return binary[offset:offset+view['byteLength']]

def replace_glb_albedo(original,png):
    document,binary=glb_parts(original)
    before=copy.deepcopy(document)
    image_indices={document['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in document['materials']}
    assert len(image_indices)==1
    image_index=image_indices.pop()
    view_index=document['images'][image_index]['bufferView']
    view=document['bufferViews'][view_index]
    offset,length=view.get('byteOffset',0),view['byteLength']
    old_end=(offset+length+3)//4*4
    padded=png+b'\0'*((-len(png))%4)
    delta=len(padded)-(old_end-offset)
    output_binary=binary[:offset]+padded+binary[old_end:]
    for i,v in enumerate(document['bufferViews']):
        if i==view_index:
            v['byteLength']=len(png)
        elif v.get('byteOffset',0)>=old_end:
            v['byteOffset']+=delta
        else:
            assert v.get('byteOffset',0)+v['byteLength']<=offset,'A buffer overlaps the albedo image'
    document['buffers'][0]['byteLength']=before['buffers'][0]['byteLength']+delta
    serialized=json.dumps(document,ensure_ascii=False,separators=(',',':')).encode()
    serialized+=b' '*((-len(serialized))%4)
    result=struct.pack('<III',0x46546c67,2,28+len(serialized)+len(output_binary))+struct.pack('<II',len(serialized),0x4e4f534a)+serialized+struct.pack('<II',len(output_binary),0x004e4942)+output_binary
    after,binary_after=glb_parts(result)
    assert after==document
    changes=[]
    for i in range(len(document['bufferViews'])):
        old=view_bytes(before,binary,i);new=view_bytes(after,binary_after,i)
        if i==view_index:
            assert new==png
        else:
            assert old==new,f'Non-albedo buffer changed: {i}'
        changes.append({'bufferView':i,'kind':'albedo' if i==view_index else 'preserved','sha256Before':digest(old),'sha256After':digest(new),'equal':old==new})
    reconstructed=copy.deepcopy(after)
    reconstructed['buffers']=before['buffers']
    reconstructed['bufferViews']=before['bufferViews']
    assert reconstructed==before,'GLB metadata outside buffer offsets and albedo size changed'
    return result,{'albedoImage':image_index,'albedoBufferView':view_index,'allOtherBufferViewsByteIdentical':True,'accessorsMeshesNodesMaterialsTexturesSamplersUnchanged':True,'bufferViews':changes}

def masks(rings,size):
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    slate=Image.new('L',size);other=Image.new('L',size)
    slate_draw=ImageDraw.Draw(slate);other_draw=ImageDraw.Draw(other)
    w,h=size
    for ring in rings:
        xy=[(u*w,(1-v)*h) for u,v in ring['uv']]
        (slate_draw if ring['semantic']=='ardoise' else other_draw).polygon(xy,fill=255)
    slate_array=np.asarray(slate)>0
    other_array=np.asarray(other)>0
    interior=slate_array & ~other_array
    # One texel matches the original bake margin. Owned non-slate texels always
    # win at rasterized island edges, protecting stone, terracotta and glazing.
    expanded=np.asarray(Image.fromarray((interior*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)))>0
    selected=expanded & ~other_array
    return selected,interior,other_array

def sync_glb_albedo(glb_path, atlas_path):
    """Keep final exports tied to the source atlas, without exporting meshes again."""
    glb_path, atlas_path = Path(glb_path), Path(atlas_path)
    old = glb_path.read_bytes()
    result, proof = replace_glb_albedo(old, atlas_path.read_bytes())
    if result != old:
        glb_path.write_bytes(result)
    print("SLATE_ALBEDO_SYNC", glb_path.name,
          "other_buffer_views_preserved", len(proof["bufferViews"]) - 1,
          flush=True)
    return proof

def main():
    import numpy as np
    from PIL import Image
    parser=argparse.ArgumentParser()
    parser.add_argument('--input-root',type=Path,required=True)
    parser.add_argument('--output-root',type=Path,required=True)
    parser.add_argument('--semantics-root',type=Path,required=True)
    options=parser.parse_args()
    reports=[]
    for kit in PREVIOUS_LINEAR:
        semantics=json.loads((options.semantics_root/f'{kit}-uv-semantics.json').read_text())
        source_generator=options.input_root/'tools/mandats-assets'/f'{kit}.py'
        assert digest(source_generator.read_bytes())==semantics['sourceSha256'],'Semantic extraction source has changed; rerun extraction first'
        source_relative=Path('tools/mandats-assets')/f'{kit}-atlas.png'
        source_file=options.input_root/source_relative
        source=Image.open(source_file)
        assert source.mode=='RGB' and source_file.read_bytes()[24]==8
        original=np.array(source)
        selected,interior,protected=masks(semantics['rings'],source.size)
        assert selected.any() and not (selected & protected).any()
        edited=original.copy()
        encoded=original[selected].astype(np.float64)/255
        linear=np.where(encoded<=.04045,encoded/12.92,((encoded+.055)/1.055)**2.4)
        linear*=np.array(SLATE_LINEAR)/np.array(PREVIOUS_LINEAR[kit])
        corrected=np.where(linear<=.0031308,linear*12.92,1.055*np.maximum(linear,0)**(1/2.4)-.055)
        edited[selected]=np.clip(np.rint(corrected*255),0,255).astype(np.uint8)
        assert np.array_equal(edited[~selected],original[~selected])
        assert np.array_equal(edited[protected],original[protected])
        path=options.output_root/source_relative
        path.parent.mkdir(parents=True,exist_ok=True)
        Image.fromarray(edited).save(path,compress_level=6,exif=source.info.get('exif',b''),dpi=source.info.get('dpi',(72,72)))
        Image.fromarray((selected*255).astype(np.uint8)).save(options.semantics_root/f'{kit}-slate-mask.png')
        glb_relative=Path('site/public/mandats/models')/f'{kit}.glb'
        original_glb=(options.input_root/glb_relative).read_bytes()
        doc,bin_data=glb_parts(original_glb)
        albedo_index=doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
        embedded=Image.open(io.BytesIO(view_bytes(doc,bin_data,doc['images'][albedo_index]['bufferView'])))
        assert np.array_equal(np.array(embedded),original),'Source atlas differs from deployed albedo'
        result,proof=replace_glb_albedo(original_glb,path.read_bytes())
        glb_out=options.output_root/glb_relative
        glb_out.parent.mkdir(parents=True,exist_ok=True)
        glb_out.write_bytes(result)
        report={'kit':kit,'sourcePaletteLinearBefore':PREVIOUS_LINEAR[kit],'sourcePaletteLinearAfter':SLATE_LINEAR,'slateFaces':sum(r['semantic']=='ardoise' for r in semantics['rings']),'selectedPixels':int(selected.sum()),'protectedPixels':int(protected.sum()),'nonSlatePixelsUnchanged':True,'meanSlateSRGBBefore':original[interior].mean(axis=0).tolist(),'meanSlateSRGBAfter':edited[interior].mean(axis=0).tolist(),'glbSha256Before':digest(original_glb),'glbSha256After':digest(result),'proof':proof}
        reports.append(report)
        print(json.dumps({k:v for k,v in report.items() if k!='proof'}),flush=True)
    (options.semantics_root/'slate-audit.json').write_text(json.dumps({'method':'Original source material assignment + exact polygon correspondence to current authored UVs, linear palette replacement, only base-color GLB image bytes replaced','status':'PASS','kits':reports},indent=2)+'\n')
if __name__=='__main__':main()
