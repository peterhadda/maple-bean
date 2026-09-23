"""Hair recipes for characters_blender_v2.py (Blender). Operates on the rig's 'Hair geometry' mesh.

Tools: inflate (thicker ribbons), clump noise (breaks the helmet into locks), long-hair volume + S-waves +
length, extra clump layers (rotated/scaled copies with their own wave phase, face zone cut away), bun growth
and messy bun loops, face-framing strand copies. New layers take weights by Data Transfer from the original hair.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector, noise


def log(msg):
    print(f"[V2] hair: {msg}")


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def verts(obj):
    return obj.data.vertices


# All displacements are functions of position only, so coincident verts (split normals / ribbon seams)
# move together and nothing tears open.
CENTER = [Vector((0.0, -0.01, 1.52))]


def outward(p, c):
    d = p - c
    if d.z < 0:
        d.z *= 0.35  # below the crown: mostly sideways, not downward
    return d.normalized() if d.length > 1e-6 else Vector((0, 0, 1))


def inflate(obj, amount, where=None):
    c = CENTER[0]
    for v in verts(obj):
        if where is None or where(v.co):
            v.co += outward(v.co, c) * amount


def clump_noise(obj, amp, freq=(28.0, 28.0, 6.0), seed=0.0, where=None):
    """Vector noise stretched along Z: neighbouring locks drift apart sideways, strands stay long."""
    c = CENTER[0]
    for v in verts(obj):
        if where is None or where(v.co):
            p = v.co
            n = noise.noise_vector(Vector((p.x * freq[0] + seed, p.y * freq[1] - seed, p.z * freq[2])))
            o = outward(p, c)
            v.co += Vector((n.x, n.y, n.z * 0.3)) * amp + o * (n.x * 0.5 * amp)


def horiz_dir(p, c, front_damp=0.55):
    d = Vector((p.x - c.x, p.y - c.y, 0.0))
    if d.y < 0:
        d.y *= front_damp  # don't push hair in front of the shoulders toward the face/camera as hard
    return d.normalized() if d.length > 1e-6 else Vector((0, 1, 0))


def long_hair(obj, c, z_start, vol, amp, wave_len, phase=0.0, z_len=None, length_k=1.0, where=None):
    """Below z_start: push outward (volume), add S-waves along the fall, then stretch the ends downward."""
    for v in verts(obj):
        p = v.co.copy()
        if where is not None and not where(p):
            continue
        if z_len is not None and p.z < z_len:
            p.z = z_len - (z_len - p.z) * length_k
        if p.z < z_start:
            fall = z_start - p.z
            t = smooth(fall / 0.2)
            d = horiz_dir(p, c)
            tang = Vector((-d.y, d.x, 0.0))
            ang = math.atan2(p.y - c.y, p.x - c.x)
            s = math.sin(2 * math.pi * fall / wave_len + phase + ang * 3.0)
            k = math.cos(2 * math.pi * fall / (wave_len * 1.3) + phase * 1.7 + ang * 2.0)
            p += d * (vol * t + amp * t * s) + tang * (amp * 0.6 * t * k)
        v.co = p


def transfer_weights(dst, src):
    """Vertex-group weights from the untouched original hair (nearest face, interpolated)."""
    linked = src.name not in bpy.context.scene.collection.objects
    if linked:
        bpy.context.scene.collection.objects.link(src)
    m = dst.modifiers.new("WeightsFromOriginal", "DATA_TRANSFER")
    m.object = src
    m.use_vert_data = True
    m.data_types_verts = {"VGROUP_WEIGHTS"}
    m.vert_mapping = "POLYINTERP_NEAREST"
    m.layers_vgroup_select_src = "ALL"
    m.layers_vgroup_select_dst = "NAME"
    bpy.context.view_layer.objects.active = dst
    bpy.ops.object.modifier_move_to_index(modifier=m.name, index=0)
    bpy.ops.object.modifier_apply(modifier=m.name)
    if linked:
        bpy.context.scene.collection.objects.unlink(src)


def duplicate(obj, keep=None, index=None):
    """Copy of obj (own mesh) linked next to it; verts where keep(co) is False (or not in index) are deleted."""
    new = obj.copy()
    new.data = obj.data.copy()
    for col in obj.users_collection:
        col.objects.link(new)
    if keep is not None or index is not None:
        bm = bmesh.new()
        bm.from_mesh(new.data)
        drop = [v for v in bm.verts if (keep is not None and not keep(v.co)) or (index is not None and v.index not in index)]
        bmesh.ops.delete(bm, geom=drop, context="VERTS")
        bm.to_mesh(new.data)
        bm.free()
    return new


def transform(obj, pivot, scale=1.0, rot_z=0.0, rot_axis=None, rot=0.0, offset=(0, 0, 0)):
    m = Matrix.Rotation(math.radians(rot_z), 3, "Z")
    if rot_axis is not None:
        m = Matrix.Rotation(math.radians(rot), 3, Vector(rot_axis).normalized()) @ m
    off = Vector(offset)
    for v in verts(obj):
        v.co = pivot + m @ ((v.co - pivot) * scale) + off


def join(into, parts, src):
    for p in parts:
        transfer_weights(p, src)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    into.select_set(True)
    bpy.context.view_layer.objects.active = into
    bpy.ops.object.join()
    into.data.update()


def islands(obj):
    """Connected ribbons of the hair mesh: list of (index set, min z, max z, centroid)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            x = stack.pop()
            comp.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen:
                    seen.add(y.index)
                    stack.append(y)
        zs = [x.co.z for x in comp]
        cen = sum((x.co for x in comp), Vector()) / len(comp)
        out.append(({x.index for x in comp}, min(zs), max(zs), cen))
    bm.free()
    return out


def in_front_of_face(c, cen):
    return abs(cen.x - c.x) < 0.09 and cen.y < c.y - 0.06 and c.z - 0.2 < cen.z < c.z + 0.12


def clear_face(obj, c):
    """Squeeze any hair hanging in front of the face out to the cheek line (tucked, eyes stay visible)."""
    for v in verts(obj):
        p = v.co
        if p.y < c.y - 0.075 and c.z - 0.16 < p.z < c.z + 0.07:
            ax, lim = abs(p.x - c.x), 0.09
            if ax < lim:
                p.x = c.x + math.copysign(lim - (lim - ax) * 0.2, p.x - c.x if ax > 1e-5 else 1.0)


def layer_transform(obj, c, scale, rot_z, fall0=0.04, span=0.18):
    """Scale/twist that fades in with the fall below the crown: the crown sits just inside the base shell
    (no z-fighting, no visible seams); the lengths swing out for volume."""
    for v in verts(obj):
        p = v.co
        t = smooth((c.z - fall0 - p.z) / span)
        sc = 0.975 + (scale - 0.975) * t
        m = Matrix.Rotation(math.radians(rot_z * t), 3, "Z")
        v.co = c + m @ ((p - c) * sc)


def add_layers(obj, src, c, specs, wave=None):
    keep = set()
    for idx, _, _, cen in islands(obj):
        if not in_front_of_face(c, cen):
            keep |= idx
    parts = []
    for scale, rot_z, phase, seed in specs:
        layer = duplicate(obj, index=keep)
        layer_transform(layer, c, scale, rot_z)
        if wave:
            long_hair(layer, c, phase=phase, **wave)
        clump_noise(layer, 0.004, seed=seed)
        parts.append(layer)
    return parts


# ---------------------------------------------------------------- recipes
def claire(obj, src, c):
    """Long, full, soft blonde waves past the chest."""
    inflate(obj, 0.003)
    clump_noise(obj, 0.003, seed=1.0)
    long_hair(obj, c, z_start=c.z - 0.06, vol=0.026, amp=0.011, wave_len=0.12, phase=0.0,
              z_len=c.z - 0.2, length_k=1.3)
    clear_face(obj, c)
    parts = add_layers(obj, src, c, ((1.045, 8.0, 1.4, 3.0), (1.025, -9.0, 2.7, 5.0), (1.0, 16.0, 4.1, 7.0)),
                       wave=dict(z_start=c.z - 0.1, vol=0.006, amp=0.009, wave_len=0.12))
    for p in parts:
        clear_face(p, c)
    join(obj, parts, src)


def maya(obj, src, c):
    """Messy bun (bigger, loose loops) + face-framing strands; fuller cap."""
    isl = islands(src)
    bun = [i for i in isl if i[1] > 1.6]
    strands = [i for i in isl if i[1] < 1.30]
    vs = verts(obj)
    bun_idx = set().union(*[i[0] for i in bun]) if bun else set()
    b = sum((vs[i].co for i in bun_idx), Vector()) / max(1, len(bun_idx))
    for i in bun_idx:
        vs[i].co = b + (vs[i].co - b) * 1.32
    log(f"bun: {len(bun)} ribbons around {tuple(round(x, 3) for x in b)}; {len(strands)} face strands")
    inflate(obj, 0.0025)
    clump_noise(obj, 0.002, seed=2.0)
    strand_idx = set().union(*[i[0] for i in strands]) if strands else set()
    for i in strand_idx:  # strands: longer, softly waved
        p = vs[i].co
        top = c.z - 0.02
        if p.z < top:
            fall = top - p.z
            p.z = top - fall * 1.2
            p.x += math.copysign(0.005, p.x) * math.sin(fall * 40.0)
    obj.data.update()
    parts = []
    for axis, ang, sc, off, seed in (((1, 0.3, 0), 34.0, 0.9, (0.014, 0.004, 0.004), 11.0),
                                     ((-0.4, 1, 0.2), -40.0, 0.84, (-0.016, -0.004, 0.01), 13.0),
                                     ((0.2, -0.5, 1), 65.0, 0.76, (0.0, 0.014, 0.016), 17.0)):
        loop = duplicate(obj, index=bun_idx)
        transform(loop, b, scale=sc, rot_axis=axis, rot=ang, offset=off)
        clump_noise(loop, 0.004, freq=(24, 24, 24), seed=seed)
        parts.append(loop)
    for dx, rz, seed in ((0.008, 6.0, 21.0), (-0.005, -5.0, 23.0)):  # extra loose face-framing strands
        s = duplicate(obj, index=strand_idx)
        for v in verts(s):
            v.co.x += math.copysign(dx, v.co.x)
        transform(s, c, rot_z=rz)
        clump_noise(s, 0.002, seed=seed)
        parts.append(s)
    join(obj, parts, src)


def generic(obj, src, c, long=False):
    inflate(obj, 0.003)
    clump_noise(obj, 0.003, seed=4.0)
    wave = dict(z_start=c.z - 0.08, vol=0.01, amp=0.01, wave_len=0.13) if long else None
    if long:
        clear_face(obj, c)
    parts = add_layers(obj, src, c, ((1.035, 6.0, 0.7, 41.0), (1.018, -7.0, 2.1, 43.0)), wave=wave)
    join(obj, parts, src)


RECIPES = {"claire": claire, "maya": maya,
           "mara": lambda o, s, c: generic(o, s, c, long=True),
           "noah": generic, "jules": generic}


def build(name, obj, src, head_field):
    c = head_field(Vector((0.0, -0.01, 1.49)))
    CENTER[0] = head_field(Vector((0.0, -0.01, 1.52)))
    before = len(obj.data.vertices)
    RECIPES.get(name, generic)(obj, src, c)
    log(f"{name}: {before} -> {len(obj.data.vertices)} verts")
