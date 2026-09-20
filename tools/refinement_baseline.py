import bpy,sys,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools'))
import refinement_face as face,refinement_body as body,refinement_hands as hands
out=ROOT/'refinement';out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
reports=[]
for i,id in enumerate(['maya','claire','noah','mara','jules']):
    old=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets/characters/{id}.glb'))
    objects=list(set(bpy.data.objects)-old);rig=next(o for o in objects if o.type=='ARMATURE')
    # Current game export, including post-authoring fixes, is the baseline.
    for o in objects:o['cast_id']=id
    rig.name=id+' Rig'
    for ob in objects:
        if ob.type=='MESH' and ob.data.shape_keys:
            for key in ob.data.shape_keys.key_blocks:key.value=0
    # Save current source-only scene for comparison prior to applying specialists.
    rig.location.x=i*.65-1.3
    reports.append({'id':id,'objects':len(objects)})
s=bpy.context.scene
ld=bpy.data.lights.new('Softbox','AREA');ld.energy=600;ld.shape='DISK';ld.size=5;o=bpy.data.objects.new('Softbox',ld);s.collection.objects.link(o);o.location=(1,-4,5);o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
cam=bpy.data.cameras.new('Lineup');co=bpy.data.objects.new('Lineup',cam);s.collection.objects.link(co);co.location=(0,-6,1.1);co.rotation_euler=(Vector((0,0,.9))-co.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=3.8;s.camera=co
s.render.engine='CYCLES';s.cycles.samples=16;s.render.resolution_x=1400;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.filepath=str(out/'current-glb-lineup.png');bpy.ops.render.render(write_still=True)

