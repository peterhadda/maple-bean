import bpy, os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('qa/expansion/face/trial-boundary/maya.glb'))
for ob in bpy.data.objects:
 if ob.type=='MESH' and not ob.data.materials:ob.hide_render=True
 if ob.type=='MESH' and ob.data.shape_keys:
  for k in ob.data.shape_keys.key_blocks:k.value=1 if k.name in ['blink.L','blink.R'] else 0
bpy.ops.object.camera_add(location=(0,-.80,1.46));camera=bpy.context.object;camera.rotation_euler=(Vector((0,-.10,1.46))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=.42
scene=bpy.context.scene;scene.camera=camera
for location,power,size in [((-1,-2,3),160,3),((1,-1,1.6),50,2)]:
 bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1.4))-light.location).to_track_quat('-Z','Y').to_euler()
scene.world.color=(.28,.28,.28);scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=850;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.filepath=os.path.abspath('qa/expansion/face/trial-boundary/blender-closed.png');bpy.ops.render.render(write_still=True)
