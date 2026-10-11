import bpy,json
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath='/workspace/mandats-iteration38/library-house-atlas.blend')
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=16
scene.render.bake.margin=8
for name,pixels in [('maison_alsace_01',512),('maison_alsace_01_distant',128)]:
    obj=bpy.data.objects[name]
    for other in bpy.data.objects:
        other.hide_render=other!=obj
        other.select_set(other==obj)
    bpy.context.view_layer.objects.active=obj
    target=bpy.data.images.new(name+'-isolated-ao',width=pixels,height=pixels,alpha=False)
    target.colorspace_settings.name='Non-Color'
    graph=obj.data.materials[0].node_tree
    node=graph.nodes.new('ShaderNodeTexImage');node.image=target;graph.nodes.active=node
    bpy.ops.object.bake(type='AO')
    target.filepath_raw='/workspace/mandats-iteration38/'+name+'-isolated-ao.png'
    target.file_format='PNG';target.save()
    print(json.dumps({'name':name,'meanAO':sum(list(target.pixels)[0::4])/(pixels*pixels)}),flush=True)
