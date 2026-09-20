"""Assemble current game assets and bounded reference refinements in a new Blender file."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;sys.path.insert(0,str(ROOT/'tools'))
import refinement_face as face, refinement_body as body, refinement_hands as hands
OUT=ROOT/'refinement';OUT.mkdir(exist_ok=True)

def visible_character_objects(objects, rig):
    # glTF importer creates an unparented, two-metre Icosphere for bone display.
    # Keep it in its hidden helper collection; moving it into the cast exposes it
    # in renders and inflates character bounds from ~1.7m to ~2.7m.
    custom_shapes={p.custom_shape for p in rig.pose.bones if p.custom_shape}
    for o in custom_shapes:
        o.hide_render=True
        o.hide_set(True)
    return [o for o in objects if o not in custom_shapes]

def place_character(objects, rig, character_id, index):
    rig.scale=(1,1,1);rig.location=(0,0,0)
    bpy.context.view_layer.update()
    coords=[o.matrix_world@Vector(v) for o in visible_character_objects(objects,rig)
            if o.type=='MESH' for v in o.bound_box]
    zmin=min(v.z for v in coords);zmax=max(v.z for v in coords)
    assert 1.4 < zmax-zmin < 2.1, (character_id,zmin,zmax)
    factor=body.HEIGHTS[character_id]/(zmax-zmin)
    rig.scale*=factor;rig.location=(index*.70-1.4,.4,-zmin*factor+.005)
    return factor

if '--repair-scale' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'MapleBeanRefined.blend'))
    reports=json.loads((OUT/'report.json').read_text())
    for i,character_id in enumerate(['maya','claire','noah','mara','jules']):
        objects=[o for o in bpy.context.scene.objects if o.get('cast_id')==character_id]
        rig=next(o for o in objects if o.type=='ARMATURE')
        factor=place_character(objects,rig,character_id,i)
        next(r for r in reports if r.get('id')==character_id)['height_scale']=factor
        print('CORRECTED_CAST_SCALE',character_id,factor)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'MapleBeanRefined.blend'))
    (OUT/'report.json').write_text(json.dumps(reports,indent=2))
    sys.exit(0)

bpy.ops.wm.open_mainfile(filepath=str(ROOT/'MapleBeanExpanded.blend'))
scene=bpy.context.scene;reports=[];cast=[]
for i,id in enumerate(['maya','claire','noah','mara','jules']):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets/characters/{id}.glb'))
    objects=list(set(bpy.data.objects)-before);rig=next(o for o in objects if o.type=='ARMATURE')
    objects=visible_character_objects(objects,rig)
    rig.name=id+' Rig'
    objects=face.apply(id,objects,rig)
    clothing=body.refine(id,objects,rig);hand=hands.apply(id,objects,rig)
    col=bpy.data.collections.new(id.title()+' · current cast');scene.collection.children.link(col)
    for o in objects:
        o['cast_id']=id
        for c in list(o.users_collection):c.objects.unlink(o)
        col.objects.link(o)
    # Standing together in the actual central cafe aisle for direct scale comparison.
    factor=place_character(objects,rig,id,i)
    cast.append(rig)
    reports.append({'id':id,'clothing':clothing,'hands':hand,'height_scale':factor})
# Existing detailed runtime foliage, never the obsolete inflated leaves.
import refinement_plants
refinement_plants.apply()
import refinement_environment
reports.append({'environment':refinement_environment.apply()})
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
# Full cafe view, including the existing extensions.
cam=scene.camera;cam.location=(28,-34,29);cam.rotation_euler=(Vector((2,2,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=37
scene['reference_status']='Work in progress: preserve current runtime assets; see refinement/report.json for limitations.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'MapleBeanRefined.blend'))
(OUT/'report.json').write_text(json.dumps(reports,indent=2))
scene.render.filepath=str(OUT/'cafe-refined.png');bpy.ops.render.render(write_still=True)
# Cast portrait remains inside actual cafe, not a studio substitute.
cam.location=(0,-5.8,1.25);cam.rotation_euler=(Vector((0,.4,.95))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=4.1
scene.render.resolution_x=1500;scene.render.resolution_y=950
scene.render.filepath=str(OUT/'cast-in-cafe.png');bpy.ops.render.render(write_still=True)

