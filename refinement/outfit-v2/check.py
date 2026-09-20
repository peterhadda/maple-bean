import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
root=Path('C:/Users/Aymen/Documents/ChatGPT/coffeshop');sys.path.insert(0,str(root/'tools'))
import refinement_outfit_v2 as outfit
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
reports=[];rigs=[]
for index,id in enumerate(['noah','jules']):
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(root/'refinement/backup-before-web-update'/f'{id}.glb'))
 objects=list(set(bpy.data.objects)-before);rig=next(o for o in objects if o.type=='ARMATURE')
 for o in objects:
  if o.type=='MESH' and o.data.shape_keys:
   for key in o.data.shape_keys.key_blocks[1:]:key.value=0
 for bone in rig.pose.bones:
  if bone.custom_shape:bone.custom_shape.hide_render=True
 report=outfit.apply(id,objects,rig)
 for o in objects:
  if o.type=='MESH' and o.vertex_groups:
   assert all(abs(sum(g.weight for g in v.groups)-1)<.001 for v in o.data.vertices if v.groups),o.name
 rig.location.x=index*.75-.375;rigs.append(rig);reports.append(report)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(1.3,-5,1.8));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.05;scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(1,-3,4));bpy.context.object.data.energy=500;bpy.context.object.data.size=4
scene.world.color=(.25,.25,.25)
scene.render.filepath=str(root/'refinement/outfit-v2/men-neutral.png');bpy.ops.render.render(write_still=True)
for pose in ['walk','seated']:
 for rig in rigs:
  for name,angle in [('thigh.L',.7 if pose=='walk' else -1.25),('thigh.R',-.7 if pose=='walk' else -1.25),('shin.L',.15 if pose=='walk' else 1.25),('shin.R',.35 if pose=='walk' else 1.25)]:
   bone=rig.pose.bones[name];bone.rotation_mode='XYZ';bone.rotation_euler.x=angle
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
 for o in bpy.context.scene.objects:
  if o.type=='MESH':
   ev=o.evaluated_get(deps);mesh=ev.to_mesh()
   assert all(math.isfinite(c) for v in mesh.vertices for c in v.co),o.name
   ev.to_mesh_clear()
 scene.render.filepath=str(root/f'refinement/outfit-v2/men-{pose}.png');bpy.ops.render.render(write_still=True)
(root/'refinement/outfit-v2/report.json').write_text(json.dumps({'changes':reports,'normalized_weights':True,'finite_poses':['walk','seated'],'prop_contact_checked':False},indent=2))
print('OUTFIT_V2',reports)
