import bpy
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'finger-pad-trial'/'maya.glb'))
for obj in bpy.context.scene.objects:
    if obj.type=='ARMATURE':
        obj.show_in_front=True
        obj.data.display_type='STICK'
bpy.context.scene['trial_status']='Isolated finger pad trial; visual acceptance pending; original rig preserved'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'finger-pad-trial'/'MayaHandTrial.blend'))
print('EDITABLE_HAND_TRIAL_SAVED')
