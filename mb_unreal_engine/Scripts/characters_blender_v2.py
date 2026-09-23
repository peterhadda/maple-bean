"""Build SourceArt/Characters/<name>_v2.blend + <name>_v2.glb from assets/characters/<name>.blend (read only).

Run (one Blender at a time, no UE lock needed):
  blender -b assets/characters/<name>.blend --python mb_unreal_engine/Scripts/characters_blender_v2.py -- <name>

What it changes (all scripted, same 41-bone rig, same bone names, same 30 morph targets):
  1. Head: +6% about the chin/neck pivot, cranium slightly squashed and widened (rounder, larger head read).
  2. Face field (smooth Gaussian offsets): fuller cheeks and jaw, softer shorter chin, upper-lid shelf,
     smaller nose with a rounded upturned tip, fuller lips. Offsets are measured on the Basis shape and added
     to every shape key, so all morph deltas survive unchanged.
  3. Lashes: longer/denser read (scaled about each eye, pushed onto the new lid shelf).
  4. Hair: per-character recipe in characters_blender_hair.py (volume, waves, length, clump layers, bun),
     then characters_blender_scalp.py: closed parting, lower hairline, hair-coloured scalp cap.
  5. Bones head/eye/jaw moved by the same field so eyes still pivot at their centres.
  New hair layers get their skin weights by Data Transfer from the original hair (nearest face, interpolated).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import characters_blender_hair as hair  # noqa: E402
import characters_blender_scalp as scalp  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = argv[0] if argv else os.path.splitext(os.path.basename(bpy.data.filepath))[0]
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "SourceArt", "Characters"))
HEAD_GROUPS = ("head", "eye.L", "eye.R", "jaw")

PIVOT = Vector((0.0, -0.02, 1.31))   # chin / neck junction: the neck stays put
HEAD_SCALE = 1.06
SQUASH_Z0, SQUASH, WIDEN = 1.50, 0.94, 0.03


def log(msg):
    print(f"[V2] {msg}")


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def gauss(p, c, s):
    """Anisotropic Gaussian weight; s = (sx, sy, sz)."""
    d = ((p.x - c[0]) / s[0]) ** 2 + ((p.y - c[1]) / s[1]) ** 2 + ((p.z - c[2]) / s[2]) ** 2
    return math.exp(-0.5 * d)


# (centre, sigma, offset, mirror-x) -- measured on the shared base face (eye opening z 1.425-1.465 at x 0.052,
# brows z 1.485-1.507, nose tip y -0.175 z 1.388, mouth z 1.362, chin z 1.315). Offsets in metres.
FEATURES = [
    ((0.072, -0.105, 1.395), (0.026, 0.03, 0.03), (0.0045, -0.0045, 0.0), True),    # cheeks: fuller, rounder
    ((0.062, -0.075, 1.345), (0.022, 0.03, 0.022), (0.004, -0.0015, 0.0), True),    # jaw: softer, wider
    ((0.058, -0.146, 1.474), (0.024, 0.02, 0.006), (0.0, -0.003, -0.0005), True),   # upper-lid shelf
    ((0.0, -0.168, 1.393), (0.014, 0.02, 0.018), (0.0, 0.0045, 0.0), False),        # nose: smaller
    ((0.0, -0.176, 1.386), (0.0065, 0.01, 0.006), (0.0, -0.0018, 0.0012), False),   # nose tip: rounded, upturned
    ((0.0, -0.153, 1.362), (0.017, 0.012, 0.0065), (0.0, -0.0028, 0.0), False),     # lips: fuller
    ((0.0, -0.13, 1.318), (0.022, 0.03, 0.016), (0.0, 0.002, 0.004), False),        # chin: shorter, softer
]


def feature_offset(p):
    off = Vector((0, 0, 0))
    for c, s, o, mirror in FEATURES:
        sides = (1, -1) if mirror else (1,)
        for sx in sides:
            w = gauss(p, (c[0] * sx, c[1], c[2]), s)
            if w > 1e-4:
                off += Vector((o[0] * sx, o[1], o[2])) * w
    return off


def head_field(p):
    """Cranium squash/widen then uniform head scale about PIVOT (applied fully; blended by head weight)."""
    q = p.copy()
    if q.z > SQUASH_Z0:
        t = q.z - SQUASH_Z0
        q.z = SQUASH_Z0 + t * SQUASH
        k = 1 + WIDEN * smooth(t / 0.1)
        q.x *= k
        q.y = (q.y + 0.01) * (1 + WIDEN * 0.5 * smooth(t / 0.1)) - 0.01
    return PIVOT + (q - PIVOT) * HEAD_SCALE


def head_weight(obj, v):
    names = {g.index: g.name for g in obj.vertex_groups}
    return min(1.0, sum(g.weight for g in v.groups if names.get(g.group) in HEAD_GROUPS))


def deform_object(obj, features=True, extra=None):
    """Apply the head field to every shape key: offset = field(basis) - basis, added to each key's coords
    (so morph deltas are preserved exactly)."""
    me = obj.data
    mw, mwi = obj.matrix_world, obj.matrix_world.inverted()
    basis = [mw @ v.co for v in me.vertices]
    offsets = []
    for v, p in zip(me.vertices, basis):
        w = head_weight(obj, v)
        if w <= 0:
            offsets.append(None)
            continue
        q = p + (feature_offset(p) if features else Vector((0, 0, 0)))
        if extra:
            q = extra(q, p, v.index)
        q = head_field(q)
        offsets.append((q - p) * w)
    keys = me.shape_keys.key_blocks if me.shape_keys else None
    targets = [kb.data for kb in keys] if keys else [me.vertices]
    for data in targets:
        for i, off in enumerate(offsets):
            if off is not None:
                data[i].co = mwi @ ((mw @ data[i].co) + off)
    me.update()
    moved = sum(1 for o in offsets if o is not None)
    log(f"{obj.name}: {moved}/{len(offsets)} verts in head field, {len(targets)} shape layer(s)")


LASH_C = (0.0635, -0.148, 1.445)  # centre of each eye opening (lash line spans x 0.025-0.102, z 1.434-1.466)


def lash_indices(obj):
    """Lash ribbons = islands of 'Expression Hair' that stay below the brows (max z < 1.475)."""
    return set().union(*[i for i, _, zmax, _ in hair.islands(obj) if zmax < 1.475] or [set()])


def make_lash_extra(obj):
    """Scale whole lash ribbons ~1.12x about their eye opening (longer, denser read); brows are untouched."""
    idx = lash_indices(obj)
    log(f"lashes: {len(idx)} verts")

    def extra(q, p, i):
        if i not in idx:
            return q
        c = Vector((math.copysign(LASH_C[0], p.x), LASH_C[1], LASH_C[2]))
        d = p - c
        r = Vector((d.x * 1.1, d.y - 0.001, d.z * (1.2 if d.z > 0 else 1.05)))
        return q + (c + r - p)
    return extra


def update_bones(rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    mw, mwi = rig.matrix_world, rig.matrix_world.inverted()
    for name in HEAD_GROUPS:
        eb = rig.data.edit_bones.get(name)
        if not eb:
            continue
        roll = eb.roll
        head = head_field(mw @ eb.head)
        tail = head + (mw @ eb.tail - mw @ eb.head) * HEAD_SCALE if name != "head" else head_field(mw @ eb.tail)
        if name == "head":
            head = mw @ eb.head  # its head sits on the neck; keep the chain connected
        eb.head, eb.tail, eb.roll = mwi @ head, mwi @ tail, roll
    bpy.ops.object.mode_set(mode="OBJECT")
    log("bones head/eye/jaw moved with the field")


def bake_face_ao(face, occluders, rays=24, reach=0.035, strength=0.75):
    """Contact AO for the head skin (hairline, brows, eye sockets, nose, jaw) -> point colour 'AO' (exported as
    COLOR_0; the UE skin master multiplies it in). Hemisphere rays against head + hair + lashes + eyes + cap."""
    import bmesh
    from mathutils.bvhtree import BVHTree
    bm = bmesh.new()
    for o in occluders:
        tmp = bmesh.new()
        me = o.data
        tmp.from_mesh(me)
        if me.shape_keys:
            for v, kb in zip(tmp.verts, me.shape_keys.reference_key.data):
                v.co = kb.co
        tmp.transform(o.matrix_world)
        m = bpy.data.meshes.new("_occ")
        tmp.to_mesh(m)
        tmp.free()
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    dirs = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(rays):  # Fibonacci hemisphere around +Z, rotated per vertex
        z = 1 - (i + 0.5) / rays
        r = math.sqrt(1 - z * z)
        dirs.append(Vector((math.cos(golden * i) * r, math.sin(golden * i) * r, z)))
    me = face.data
    basis = me.shape_keys.reference_key.data if me.shape_keys else me.vertices
    me.update()
    attr = me.color_attributes.get("AO") or me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    for v, kb in zip(me.vertices, basis):
        p = face.matrix_world @ kb.co
        n = (face.matrix_world.to_3x3() @ v.normal).normalized()
        if n.dot(p - Vector((0, -0.02, 1.5))) < 0:
            n = -n  # head normals are unreliable after the field; force outward
        q = n.to_track_quat("Z", "Y")
        hit = 0.0
        for d in dirs:
            dd = q @ d
            h = tree.ray_cast(p + n * 0.0008, dd, reach)
            if h[0] is not None:
                hit += (1 - h[3] / reach) * d.z
        occ = min(1.0, 2.2 * hit / sum(d.z for d in dirs))
        a = 1 - strength * occ
        attr.data[v.index].color = (a, a * 0.97, a * 0.95, 1)  # slightly warm shadow
    me.color_attributes.active_color = attr
    log(f"AO baked on {face.name}")


def find(prefix):
    return next((o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith(prefix)), None)


def export(path_glb):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(filepath=path_glb, export_format="GLB", use_selection=False, export_skins=True,
                              export_morph=True, export_animations=False, export_apply=False,
                              export_yup=True, export_vertex_color="ACTIVE")
    log(f"wrote {path_glb}")


def load_source():
    """--from-glb: rebuild from assets/characters/<name>.glb (what Unreal imported) instead of the .blend.
    Needed for Noah: noah.blend is out of sync with noah.glb (older outfit, no eye morphs, all keys at 1.0)."""
    if "--from-glb" not in argv:
        return
    glb = os.path.abspath(os.path.join(OUT_DIR, "..", "..", "..", "assets", "characters", f"{NAME}.glb"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    log(f"source: {glb}")


def reset_shape_keys():
    for o in bpy.data.objects:
        if o.type == "MESH" and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = 0.0


def main():
    load_source()
    reset_shape_keys()
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    for o in bpy.data.objects:
        if o.type == "MESH" and o.parent == rig:
            name = o.name
            if name.startswith("Eyes"):
                deform_object(o, features=False)
            elif name.startswith("Expression Hair"):
                deform_object(o, extra=make_lash_extra(o))
            elif name.startswith("Hair"):
                src = o.copy()
                src.data = o.data.copy()  # untouched weight source for new layers
                deform_object(o)
                hair.build(NAME, o, src, head_field)
                bpy.data.objects.remove(src)
            else:
                deform_object(o)
    # Scalp cap + parting/hairline (after the hair layers exist, so the cap covers every gap).
    c = head_field(Vector((0.0, -0.01, 1.49)))
    brow_top = head_field(Vector((0.0, -0.15, 1.507))).z
    cap = scalp.build(find("Expression Skin"), find("Hair"), c, brow_top)
    bake_face_ao(find("Expression Skin"), [find("Expression Skin"), find("Hair"), find("Expression Hair"),
                                           find("Eyes"), cap])
    update_bones(rig)
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, f"{NAME}_v2.blend"), copy=True)
    log(f"saved {NAME}_v2.blend")
    export(os.path.join(OUT_DIR, f"{NAME}_v2.glb"))


main()
