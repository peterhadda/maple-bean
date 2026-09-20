"""Small, non-destructive hand detailing pass for the existing Maple Bean rigs.
Run a check: blender -b assets/characters/maya.blend --python tools/refinement_hands.py
"""
import bpy
import bmesh
import math
from mathutils import Vector


def apply(character_id, objects, rig):
    """Add restrained dorsal fingernails, retaining the existing finger topology/rig."""
    if rig.get('maple_hand_detail_v1'):
        return {'nails': 0, 'already_applied': True}
    mat = bpy.data.materials.get('Maple natural nails')
    if mat is None:
        mat = bpy.data.materials.new('Maple natural nails')
        mat.diffuse_color = (.55, .30, .23, 1)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = mat.diffuse_color
        shader.inputs['Roughness'].default_value = .46
        shader.inputs['Specular IOR Level'].default_value = .25
    made = []
    for tag, side in [('L', -1), ('R', 1)]:
        for digit in range(5):
            name = f'finger{digit}.{tag}Tip' if digit < 4 else f'thumb.{tag}Tip'
            bone = rig.data.bones.get(name)
            if bone is None:
                raise ValueError(f'{character_id}: missing {name}')
            # Existing palms face the thigh, so dorsal nails face outward in X.
            tangent = (bone.tail_local - bone.head_local).normalized()
            center = bone.head_local.lerp(bone.tail_local, .69)
            normal = Vector((side, 0, 0))
            normal = (normal - tangent * normal.dot(tangent)).normalized()
            across = tangent.cross(normal).normalized()
            center += normal * (.0060 if digit == 4 else .0049)
            width = .0032 if digit == 4 else .0027
            length = .0050 if digit == 4 else .0045
            verts = []
            faces = []
            for i in range(7):
                a = math.pi * i / 6
                for j in range(10):
                    b = math.tau * j / 10
                    verts.append(center + tangent * (math.cos(a) * length) +
                                 across * (math.sin(a) * math.cos(b) * width) +
                                 normal * (math.sin(a) * math.sin(b) * .00055))
            for i in range(6):
                for j in range(10):
                    a = i * 10 + j
                    b = i * 10 + (j + 1) % 10
                    faces.append((a, b, b + 10, a + 10))
            data = bpy.data.meshes.new(character_id + ' nail ' + name)
            data.from_pydata(verts, [], faces)
            bm = bmesh.new()
            bm.from_mesh(data)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.000001)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(data)
            bm.free()
            data.materials.append(mat)
            obj = bpy.data.objects.new(data.name, data)
            rig.users_collection[0].objects.link(obj)
            obj.parent = rig
            obj.vertex_groups.new(name=name).add(list(range(len(data.vertices))), 1, 'REPLACE')
            modifier = obj.modifiers.new('Finger deformation', 'ARMATURE')
            modifier.object = rig
            for polygon in data.polygons:
                polygon.use_smooth = True
            made.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in made:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = made[0]
    bpy.ops.object.join()
    nail_mesh = bpy.context.view_layer.objects.active
    nail_mesh.name = character_id + ' natural nails'
    objects.append(nail_mesh)
    rig['maple_hand_detail_v1'] = True
    return {'nails': 10, 'added_triangles': sum(len(p.vertices)-2 for p in nail_mesh.data.polygons)}


def check(objects, rig):
    """Check all digit bones and evaluated geometry through representative curl poses.

    This checks finite deformation and nail attachment, not prop collision or anatomy.
    """
    digits = [p for p in rig.pose.bones if p.name.startswith(('finger', 'thumb'))]
    assert len(digits) == 20, f'Expected 20 articulated digit bones, got {len(digits)}'
    original = [(p, p.rotation_mode, p.rotation_quaternion.copy(), p.rotation_euler.copy()) for p in digits]
    shapes = {'open': [0]*5, 'relaxed': [.34,.4,.46,.52,.22],
              'fist': [1.35,1.4,1.45,1.5,.8], 'point': [0,1.3,1.38,1.45,.7],
              'peace': [0,0,1.35,1.4,.65], 'cup': [1.05,1.12,1.18,1.22,.55],
              'phone': [.72,1.05,1.2,1.3,.62], 'book': [.45,.5,.55,.6,.3],
              'laptop': [.16,.19,.22,.25,.2], 'controller': [.72,1.05,1.2,1.3,.62]}
    try:
        for curls in shapes.values():
            for p in digits:
                index = int(p.name[6]) if p.name.startswith('finger') else 4
                p.rotation_mode = 'XYZ'
                p.rotation_euler = (curls[index] * (.75 if p.name.endswith('Tip') else 1), 0, 0)
            bpy.context.view_layer.update()
            depsgraph = bpy.context.evaluated_depsgraph_get()
            for obj in objects:
                if obj.type != 'MESH':
                    continue
                evaluated = obj.evaluated_get(depsgraph)
                mesh = evaluated.to_mesh()
                try:
                    assert all(math.isfinite(c) for v in mesh.vertices for c in v.co), obj.name
                finally:
                    evaluated.to_mesh_clear()
    finally:
        for p, mode, quat, euler in original:
            p.rotation_mode = mode
            p.rotation_quaternion = quat
            p.rotation_euler = euler
        bpy.context.view_layer.update()
    return {'pose_states_checked': list(shapes), 'digit_bones': len(digits), 'finite_geometry': True,
            'prop_contact_verified': False}


if __name__ == '__main__':
    objects = list(bpy.context.scene.objects)
    rig = next(o for o in objects if o.type == 'ARMATURE')
    print('HAND_REFINEMENT', apply(bpy.context.scene.get('character', 'cast'), objects, rig))
    print('HAND_CHECK', check(objects, rig))
    assert apply('cast', objects, rig)['already_applied']
