"""Export review candidates from current game GLBs; never overwrite live assets.
blender -b --factory-startup --python-exit-code 1 --python tools/export_refined_characters.py
"""
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/'tools'))
import refinement_face as face
import refinement_body as body
import refinement_hands as hands
import refinement_outfit_v2 as outfit
OUT = ROOT/'refinement/characters'
OUT.mkdir(parents=True, exist_ok=True)
IDS = ['maya', 'claire', 'noah', 'mara', 'jules']


def consolidate(objects):
    skin = bpy.data.materials.get('Skin')
    for o in objects:
        if o.type == 'MESH' and any(m.name == 'Maple natural nails' for m in o.data.materials):
            o.data.materials.clear()
            o.data.materials.append(skin)
            uv = o.data.uv_layers.new(name='UVMap')
            for loop in uv.data:
                loop.uv = (.015,.015)


def descendants(rig):
    return [rig, *rig.children_recursive]


def export(character, suffix):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'refinement/backup-before-web-update/{character}{suffix}.glb'))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    objects = descendants(rig)
    # Some production files include a root-level Icosphere, unrelated to the cast.
    for o in list(bpy.context.scene.objects):
        if o not in objects:
            bpy.data.objects.remove(o, do_unlink=True)
    bones = [b.name for b in rig.data.bones]
    morphs = {o.name: [k.name for k in o.data.shape_keys.key_blocks]
              for o in objects if o.type == 'MESH' and o.data.shape_keys}
    original_hair = bpy.data.materials.get('Hair')
    objects = face.apply(character, objects, rig)
    # Runtime finds Hair by its exact material name, including brows/lashes.
    for o in objects:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            mat = slot.material
            if mat and mat.name.endswith(' reference hair'):
                source = mat.node_tree.nodes.get('Principled BSDF')
                target = original_hair.node_tree.nodes.get('Principled BSDF')
                for link in list(target.inputs['Base Color'].links):
                    original_hair.node_tree.links.remove(link)
                for prop in ['Base Color', 'Roughness', 'Specular IOR Level']:
                    target.inputs[prop].default_value = source.inputs[prop].default_value
                slot.material = original_hair
    body_report = body.refine(character, objects, rig)
    outfit.apply(character, objects, rig)
    hand_report = hands.apply(character, objects, rig)
    objects = descendants(rig)
    consolidate(objects)
    # Added hair/nails merge into their matching non-morph draw batches.
    for material in {m for o in objects if o.type == 'MESH' for m in o.data.materials}:
        batch = [o for o in objects if o.type == 'MESH' and not o.data.shape_keys
                 and len(o.data.materials) == 1 and o.data.materials[0] == material]
        if len(batch) < 2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch:
            o.select_set(True)
        bpy.context.view_layer.objects.active = batch[0]
        bpy.ops.object.join()
        batch[0].name = material.name+' geometry'
        if suffix and material == original_hair:
            mod = batch[0].modifiers.new('Distant hair budget', 'DECIMATE')
            mod.ratio = .35
            bpy.ops.object.modifier_apply(modifier=mod.name)
        objects = descendants(rig)
    total = sum(len(p.vertices)-2 for o in objects if o.type == 'MESH' for p in o.data.polygons)
    if total > 59000:
        hair = next(o for o in objects if o.type == 'MESH' and not o.data.shape_keys
                    and len(o.data.materials) == 1 and o.data.materials[0] == original_hair)
        count = sum(len(p.vertices)-2 for p in hair.data.polygons)
        bpy.context.view_layer.objects.active = hair
        mod = hair.modifiers.new('Preserve near character budget', 'DECIMATE')
        mod.ratio = max(.1,(count-(total-59000))/count)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    assert bones == [b.name for b in rig.data.bones]
    for name, keys in morphs.items():
        assert [k.name for k in bpy.data.objects[name].data.shape_keys.key_blocks] == keys
    bpy.context.view_layer.update()
    coords = [o.matrix_world@v.co for o in objects if o.type == 'MESH' for v in o.data.vertices]
    height = max(v.z for v in coords)-min(v.z for v in coords)
    assert 1.4 < height < 2.05, (character, height)
    assert all(math.isfinite(c) for v in coords for c in v)
    triangles = sum(len(p.vertices)-2 for o in objects if o.type == 'MESH' for p in o.data.polygons)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{character}{suffix}.glb'), export_format='GLB',
                             use_selection=True, export_animations=False, export_skins=True,
                             export_morph=True, export_extras=True, export_yup=True)
    report = dict(character=character, suffix=suffix, height=height, triangles=triangles,
                  bones=bones, morphs=morphs, body=body_report, hands=hand_report)
    if not suffix:
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{character}.blend'))
    return report


def lineup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for i, character in enumerate(IDS):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT/f'{character}.glb'))
        rig = next(o for o in bpy.context.selected_objects if o.type == 'ARMATURE')
        for o in set(bpy.data.objects)-before-set(descendants(rig)):
            bpy.data.objects.remove(o, do_unlink=True)
        rig.location.x = (i-2)*.7
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('Studio world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.19,.17,.14,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
    for pos, power, size in [((-3,-4,5),700,5),((4,-1,3),400,4)]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        lamp = bpy.context.object
        lamp.data.energy = power
        lamp.data.shape = 'DISK'
        lamp.data.size = size
        lamp.rotation_euler = (Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(0,-6,1.1))
    scene.camera = bpy.context.object
    scene.camera.rotation_euler = (Vector((0,0,.9))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.type = 'ORTHO'
    scene.camera.data.ortho_scale = 3.8
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 8
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(OUT/'lineup.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lineup.blend'))
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    if '--lineup-only' not in sys.argv:
        requested = [arg for arg in sys.argv[sys.argv.index('--')+1:] if arg in IDS] if '--' in sys.argv else IDS
        reports = json.loads((OUT/'report.json').read_text()) if (OUT/'report.json').exists() else []
        reports = [r for r in reports if r['character'] not in requested]
        reports.extend(export(id, suffix) for id in requested for suffix in ('', '-lod'))
        (OUT/'report.json').write_text(json.dumps(reports, indent=2))
    lineup()

