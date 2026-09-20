import bpy, json
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=bpy.path.abspath('//qa/expansion/face/source/maya.glb'))
for ob in bpy.data.objects:
 if ob.type=='MESH':
  print('FACE_INSPECT', json.dumps({'name':ob.name,'vertices':len(ob.data.vertices),'materials':[m.name for m in ob.data.materials],'bounds':[[min(v.co[k] for v in ob.data.vertices),max(v.co[k] for v in ob.data.vertices)] for k in range(3)],'keys':[k.name for k in ob.data.shape_keys.key_blocks] if ob.data.shape_keys else [],'groups':[g.name for g in ob.vertex_groups]}))
