"""Reference wardrobe colors, without changing bind coordinates or vertex weights.

Call refine(id, objects, rig) on a loaded character before assembling the cafe.
The existing wardrobe atlas and weave stay intact on untreated polygons.
"""
import math

HEIGHTS = {'maya': 1.65, 'claire': 1.64, 'mara': 1.66, 'jules': 1.76, 'noah': 1.78}


def region(character, x, y, z):
    # Blender Z-up, front faces -Y. Shoes and accessories keep source textures.
    if character == 'claire' and .93 < z < 1.32:
        if abs(x) > .09 or y > -.065:
            return 'Cardigan blue', '526e9b'
    if character == 'jules':
        if .92 < z < 1.32:
            return 'Sweatshirt cream', 'ded6c7'
        if .15 < z < .91:
            return 'Denim blue', '677a87'
    if character == 'noah':
        if .93 < z < 1.34:
            return 'Hoodie forest', '364336'
        if .15 < z < .925:
            return 'Cargo sand', 'a3937d'
    if character == 'mara' and .15 < z < 1.33:
        return 'Outfit charcoal', '28252a'
    return None


def refine(character_id, objects=None, rig=None):
    import bpy
    if character_id not in HEIGHTS:
        raise ValueError(character_id)
    objects = list(objects if objects is not None else bpy.context.scene.objects)
    materials = {}
    count = 0
    for obj in objects:
        if obj.type != 'MESH' or not any(m and m.name.startswith('Wardrobe') for m in obj.data.materials):
            continue
        if obj.get('maple_reference_wardrobe'):
            continue
        source_slots = {i for i, m in enumerate(obj.data.materials) if m and m.name.startswith('Wardrobe')}
        slots = {}
        parents = list(range(len(obj.data.vertices)))
        def root(i):
            while parents[i] != i:
                parents[i] = parents[parents[i]]
                i = parents[i]
            return i
        for edge in obj.data.edges:
            a, b = (root(i) for i in edge.vertices)
            parents[b] = a
        components = {}
        for v in obj.data.vertices:
            components.setdefault(root(v.index), []).append(v.co)
        selections = {}
        for key, points in components.items():
            center = sum(points, start=points[0]*0) / len(points)
            selections[key] = region(character_id, *center)
            if character_id == 'claire' and abs(center.x) < .09 and max(p.x for p in points)-min(p.x for p in points) < .27:
                selections[key] = None
        for poly in obj.data.polygons:
            if poly.material_index not in source_slots:
                continue
            selected = selections[root(poly.vertices[0])]
            if not selected:
                continue
            name, hex_color = selected
            if name not in materials:
                mat = bpy.data.materials.new(character_id + ' reference ' + name)
                mat.use_nodes = True
                shader = mat.node_tree.nodes.get('Principled BSDF')
                srgb = [int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4)]
                linear = [c / 12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb]
                shader.inputs['Base Color'].default_value = (*linear, 1)
                shader.inputs['Roughness'].default_value = .83
                shader.inputs['Sheen Weight'].default_value = .16
                shader.inputs['Specular IOR Level'].default_value = .25
                mat.diffuse_color = (*linear, 1)
                materials[name] = mat
            if name not in slots:
                slots[name] = len(obj.data.materials)
                obj.data.materials.append(materials[name])
            poly.material_index = slots[name]
            count += 1
        obj['maple_reference_wardrobe'] = True
    if rig:
        rig['reference_height_m'] = HEIGHTS[character_id]
        rig['reference_height_note'] = 'Noah height inferred from 5 ft 10 label; printed cm contradicts it' if character_id == 'noah' else 'Photo 2 height label'
    return {'character': character_id, 'recolored_polygons': count, 'height_m': HEIGHTS[character_id], 'bind_space_changed': False}


if __name__ == '__main__':
    assert region('claire', .17, -.03, 1.1)[1] == '526e9b'
    assert region('claire', 0, -.11, 1.1) is None
    assert region('maya', .17, 0, 1.1) is None
    assert region('noah', .08, 0, .5)[1] == 'a3937d'
    assert all(region(c, .08, 0, .06) is None for c in HEIGHTS)
    print('Wardrobe region checks passed')
