"""Import verified game art into a COPY; preserve original scene objects hidden."""
import bpy, hashlib, json, re
from pathlib import Path

root = Path(__file__).resolve().parents[3]
source = root / 'MapleBeanExpanded.blend'
output = root / 'MapleBeanPhase2.blend'
art = root / 'qa/expansion/ambiance-current/source'
assert Path(bpy.data.filepath).resolve() == source.resolve(), 'Open the existing source first'
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
manifest = json.loads((art / 'manifest.json').read_text())
canonical = lambda name: re.sub(r'[^a-z0-9]', '', name.lower())
originals = list(bpy.data.objects)
by_name = {canonical(o.name): o for o in originals}
replace = set(map(canonical, manifest['hideMatchingOriginal']))

bpy.ops.import_scene.gltf(filepath=str(art / 'verified-environment.glb'))
imported = [o for o in bpy.data.objects if o not in originals]
collection = bpy.data.collections.new('Phase 2 - verified cafe art')
bpy.context.scene.collection.children.link(collection)
for obj in imported:
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    collection.objects.link(obj)
    if obj.get('cutawayCeiling'):
        obj.hide_render = True
        obj.hide_set(True)
    obj['phase2_verified_runtime'] = True

hidden = []
for key in replace:
    obj = by_name.get(key)
    if obj and obj.type not in {'LIGHT', 'CAMERA'}:
        obj.hide_render = True
        obj.hide_set(True)
        obj['phase2_preserved_original'] = True
        hidden.append(obj.name)

# glTF stores the shared color maps; reconnect the runtime's subtle bump usage.
for mat in {m for o in imported if o.type == 'MESH' for m in o.data.materials if m}:
    scale = mat.get('sourceBumpScale')
    if not scale or not mat.use_nodes:
        continue
    nodes = mat.node_tree.nodes
    principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    image = next((n for n in nodes if n.type == 'TEX_IMAGE'), None)
    if principled and image:
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Distance'].default_value = scale
        mat.node_tree.links.new(image.outputs['Color'], bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'], principled.inputs['Normal'])

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene['phase2_source'] = source.name
scene['phase2_runtime_manifest'] = 'qa/expansion/ambiance-current/source/manifest.json'
scene['phase2_sync_note'] = 'Verified runtime geometry/materials; original objects retained hidden; gameplay layout unchanged'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(output))
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash, 'Original source changed'
report = {
    'original_sha256': source_hash, 'output': str(output),
    'original_objects': len(originals), 'imported_objects': len(imported),
    'hidden_originals': len(hidden), 'unmatched_source_names': sorted(replace-set(by_name)),
    'images_packed': sum(bool(image.packed_file) for image in bpy.data.images),
    'lights': [{'name': o.name, 'type': o.data.type, 'energy': o.data.energy,
                'location': list(o.location)} for o in originals if o.type == 'LIGHT'],
}
(art / 'sync-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
