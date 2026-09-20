"""Reference-led head refinement; run apply before whole-character body scaling.

Uses existing Maple Bean topology, expression keys and hair authoring tools.
Does not save or export: the integrating scene owns those operations.
"""
import math
import sys
from pathlib import Path


def apply(character, objects, rig):
    import bpy
    from mathutils import Matrix
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import author_characters as author
    from claire_hair import author_claire_hair

    objects = list(objects)
    # Source .blend saves every expression at 1; runtime overwrites these each frame.
    # Neutralize the saved pose before Blender previews or integrating the cast.
    for o in objects:
        if o.type == 'MESH' and o.data.shape_keys:
            for key in o.data.shape_keys.key_blocks:
                if key != o.data.shape_keys.reference_key:
                    key.value = 0
    if character == 'jules':
        # Both face and exposed body use Skin; preserve painted detail/UVs.
        author.COLORS['jules'] = ('e8b092', '60351f', 'brown')
        skin_materials = {m for o in objects if o.type == 'MESH' for m in o.data.materials
                          if m and m.name.split('.')[0] == 'Skin'}
        for skin in skin_materials:
            p = skin.node_tree.nodes.get('Principled BSDF')
            for link in p.inputs['Base Color'].links:
                if link.from_node.type == 'TEX_IMAGE':
                    link.from_node.image = author.face_texture('jules')
    hair_objects = [o for o in objects if o.type == 'MESH' and not o.data.shape_keys
                    and any(m and m.name.split('.')[0] == 'Hair' for m in o.data.materials)]
    assert hair_objects, f'{character}: expected existing Maple Bean hair mesh'
    material = hair_objects[0].data.materials[0]
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .52
    shader.inputs['Specular IOR Level'].default_value = .25
    added = []
    if character in ('mara', 'jules'):
        # Photo 2/4: Mara has long near-black waves, never Maya's coiled bun.
        material = material.copy()
        material.name = character.title()+' reference hair'
        shader = material.node_tree.nodes.get('Principled BSDF')
        for link in list(shader.inputs['Base Color'].links):
            material.node_tree.links.remove(link)
        shader.inputs['Base Color'].default_value = ((.024, .012, .011, 1) if character == 'mara'
                                                    else (.092, .036, .019, 1))
        def scalp(psi, el, extra=0):
            return ((.133+extra)*math.cos(el)*math.sin(psi),
                    1.485+(.166+extra)*math.sin(el),
                    (.119+extra)*math.cos(el)*math.cos(psi))
        if character == 'mara':
            added = author_claire_hair({'mesh': author.mesh, 'scalp': scalp, 'mat': material})
        else:
            from noah_hair import author_noah_hair
            added = author_noah_hair({'mesh': author.mesh, 'lock': author.lock,
                                     'scalp': scalp, 'mat': material})
        scale = 1.14 if character == 'mara' else 1.07
        transform = (Matrix.Translation((0, -.030, 1.465)) @
                     Matrix.Diagonal((scale, scale, scale, 1)) @
                     Matrix.Translation((0, 0, -1.465)) @
                     Matrix.Translation((0, 0, -.020)) @
                     Matrix.Diagonal((1.018 if character == 'mara' else 1.025, 1, 1, 1)))
        for o in added:
            o.name = o.name.replace('Claire', 'Mara').replace('Noah', 'Jules')
            # Broader irregular waves; retain crown and face clearance.
            for v in o.data.vertices:
                if character == 'mara':
                    depth = max(0, min(1, (1.45-v.co.z)/.32))
                    v.co.x *= 1+.11*depth
                    v.co.y += .006*depth*math.sin(v.co.z*35)
                else:
                    crown = max(0, min(1, (v.co.z-1.47)/.15))
                    v.co.x *= 1+.07*crown
                    v.co.z += .007*crown
            o.data.transform(transform)
            group = o.vertex_groups.new(name='head')
            group.add(list(range(len(o.data.vertices))), 1, 'REPLACE')
            o.parent = rig
            o.matrix_world = rig.matrix_world.copy()
            mod = o.modifiers.new('Shared character skeleton', 'ARMATURE')
            mod.object = rig
            o['reference'] = 'Photo 2 head turnaround; Photo 4 group portrait'
        # Preserve expression brow/lash objects, which share the original material.
        for o in hair_objects:
            objects.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
        objects.extend(added)
    for o in objects:
        if o.type == 'MESH' and o.data.shape_keys:
            assert 'Basis' in o.data.shape_keys.key_blocks, o.name
    return objects


def check(character='mara'):
    """Background Blender check, preserving source assets and writing nothing."""
    import bpy
    root = Path(__file__).resolve().parent.parent
    bpy.ops.wm.open_mainfile(filepath=str(root/f'assets/characters/{character}.blend'))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    before = {o.name: len(o.data.shape_keys.key_blocks) for o in bpy.context.scene.objects
              if o.type == 'MESH' and o.data.shape_keys}
    result = apply(character, list(bpy.context.scene.objects), rig)
    assert any(o.name.startswith(character.title()) for o in result)
    for name, count in before.items():
        assert len(bpy.data.objects[name].data.shape_keys.key_blocks) == count
        assert all(k.value == 0 for k in bpy.data.objects[name].data.shape_keys.key_blocks[1:])
    for o in result:
        if o.type == 'MESH':
            assert all(math.isfinite(c) for v in o.data.vertices for c in v.co)
    print('FACE_REFINEMENT_CHECK: preserved expressions; finite long-hair geometry; no writes')


if __name__ == '__main__':
    check()
    check('jules')
