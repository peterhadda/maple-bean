"""Save the accepted runtime character as a new editable Blender source.
Does not overwrite original .blend or production .glb assets. Run after all body
and face patches have been accepted. The saved head pose matches runtime .90;
the roundtrip GLB is exported first in bind pose so the runtime scale isn't doubled.
"""
import bpy, sys, json, math, re
from mathutils import Euler, Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HEAD_SCALE=float(re.search(r'export const HEAD_SCALE=([.\d]+);',(ROOT/'assets/characters/runtime.js').read_text()).group(1))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['maya','claire','mara','jules','noah']
out=ROOT/'qa/expansion/characters/blender-roundtrip';out.mkdir(parents=True,exist_ok=True)
for name in args:
 if name not in ['maya','claire','mara','jules','noah']:raise ValueError(name)
 bpy.ops.wm.read_factory_settings(use_empty=True)
 source=ROOT/f'assets/characters/{name}.glb'
 bpy.ops.import_scene.gltf(filepath=str(source),import_pack_images=True)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
 if not meshes or not rigs:raise RuntimeError('Missing editable mesh/rig')
 bpy.ops.file.pack_all()
 bpy.ops.export_scene.gltf(filepath=str(out/f'{name}.glb'),export_format='GLB',export_animations=False,export_skins=True,export_morph=True,export_morph_normal=True,export_all_vertex_colors=True,export_yup=True,export_apply=False)
 for rig in rigs:
  head=rig.pose.bones.get('head')
  if head:head.scale=(HEAD_SCALE,HEAD_SCALE,HEAD_SCALE)
  rig.show_in_front=True
 bpy.context.scene['maple_bean_source_glb']=str(source.relative_to(ROOT))
 bpy.context.scene['runtime_head_scale']=HEAD_SCALE
 bpy.context.scene['export_note']=f'Head pose scale {HEAD_SCALE} is a viewport preview of runtime HEAD_SCALE. Reset pose transforms before exporting for current runtime, which applies this scale itself.'
 bpy.context.scene['gaze_note']='Runtime pivots each eyeball around its actual weighted geometry centre; authored bone rest positions are retained for compatibility.'
 bpy.context.scene['source_note']='Editable continuation of original cast; approved body/face/material/morph changes imported without rebuilding character identity. Original .blend preserved.'
 bpy.context.scene.unit_settings.system='METRIC'
 for area in bpy.context.screen.areas if bpy.context.screen else []:
  if area.type=='VIEW_3D':
   area.spaces.active.shading.type='MATERIAL'
   area.spaces.active.region_3d.view_distance=2.5
   area.spaces.active.region_3d.view_location=Vector((0,0,.9))
   area.spaces.active.region_3d.view_rotation=Euler((math.pi/2,0,0)).to_quaternion()
   area.spaces.active.region_3d.view_perspective='ORTHO'
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/characters/{name}_phase2.blend'),compress=True)
 report={'character':name,'meshes':len(meshes),'armatures':len(rigs),'bones':sum(len(r.data.bones) for r in rigs),'morphs':sorted({k.name for o in meshes if o.data.shape_keys for k in o.data.shape_keys.key_blocks}),'materials':sorted({m.name for o in meshes for m in o.data.materials if m}),'headPreviewScale':HEAD_SCALE}
 (out/f'{name}.json').write_text(json.dumps(report,indent=2))
 print('PHASE2_SOURCE',json.dumps(report))
