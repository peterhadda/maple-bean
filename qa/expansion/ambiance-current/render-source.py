import bpy, math, json
from pathlib import Path
from mathutils import Vector
root = Path.cwd()
scene = bpy.context.scene
art = root/'qa/expansion/ambiance-current/source'
is_after = Path(bpy.data.filepath).name == 'MapleBeanPhase2.blend'
old_rig=bpy.data.collections.get('Phase 2 - evening preview lighting')
if old_rig:
    for obj in list(old_rig.objects): bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(old_rig)
for obj in scene.objects:
    if obj.type == 'LIGHT': obj.hide_render = True
rig = bpy.data.collections.new('Phase 2 - evening preview lighting')
scene.collection.children.link(rig)
def light(name, kind, xyz, energy, color, target=None, angle=.84):
    data=bpy.data.lights.new(name,kind); data.energy=energy; data.color=color
    obj=bpy.data.objects.new(name,data); rig.objects.link(obj)
    obj.location=(xyz[0],-xyz[2],xyz[1])
    if kind == 'POINT': data.shadow_soft_size=.18
    if kind == 'SPOT':
        data.spot_size=angle*2; data.spot_blend=.9; data.shadow_soft_size=.14
    if target:
        dest=Vector((target[0],-target[2],target[1]))
        obj.rotation_euler=(dest-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj
# Blender watts differ from Three.js candela. Preserve placement/cones and calibrate
# a separate editable source preview; never change game light settings here.
for i,(x,z) in enumerate([(-7,-3),(-3,-3),(2,-3),(7,-3),(-7,3),(-3,3),(2,3),(7,3)]):
    light('Evening pendant '+str(i),'SPOT',(x,2.7,z),220,(1,.65,.35),(x,0,z))
for i,(x,z) in enumerate([(11.8,-4.2),(15.2,-4.2),(13.6,-1.95),(1.2,-10.6),(4,-10.9)]):
    light('Evening wing '+str(i),'POINT',(x,2.76,z),90,(1,.68,.4))
light('Evening bar wash','SPOT',(-3.4,3,-4.3),240,(1,.72,.45),(-3.4,1.85,-6.6),.72)
light('Evening shelf wash','SPOT',(-7.6,3.4,3.8),170,(1,.72,.45),(-9.6,1.1,3.8),.75)
light('Evening hearth','POINT',(8.6,.65,-4),40,(1,.3,.08))
fill=light('Soft sky','AREA',(2,9,1),1450,(.77,.82,1),(2,0,-3)); fill.data.shape='DISK'; fill.data.size=18
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.2,.18,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
old_camera=bpy.data.objects.get('Phase 2 source comparison')
if old_camera: bpy.data.objects.remove(old_camera,do_unlink=True)
camdata=bpy.data.cameras.new('Phase 2 source comparison')
camera=bpy.data.objects.new('Phase 2 source comparison',camdata); scene.collection.objects.link(camera)
camera.location=(19,-24,20)
camera.rotation_euler=(Vector((2,2,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO'; camdata.ortho_scale=34; scene.camera=camera
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=8
scene.render.threads_mode='FIXED'; scene.render.threads=4
scene.cycles.use_denoising=True
scene.render.resolution_x=960; scene.render.resolution_y=720; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=.5
scene.render.filepath=str(art/('blender-after.png' if is_after else 'blender-before.png'))
if is_after:
    scene['phase2_source_lighting_note']='17-light editable evening preview calibrated in Blender watts; original 12 lights hidden, runtime rig unchanged'
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'MapleBeanPhase2.blend'))
bpy.ops.render.render(write_still=True)
print('SOURCE_RENDER_COMPLETE',scene.render.filepath)
