"""Scalp cap + parting/hairline fixes for characters_blender_v2.py (Blender). Stops pink scalp showing through gaps.

1. Parting: front-crown hair verts are drawn toward the midline and slightly outward, so the two sides of
   the part overlap instead of leaving a see-through slit.
2. Hairline: the lower edge of the front hair (above the brows) is pulled down a few millimetres.
3. Scalp cap: the head skin under the hair (a ray along the normal hits hair within 6 cm, plus the whole
   crown above the forehead and the back of the skull, where gaps let rays through), grown one ring
   (forehead/sides only, never the brows or face), is copied, inflated to sit between skin and hair
   (≤ 2 mm, never through the hair), given the Hair material and UVs of the nearest hair face (the local
   hair colour), and keeps the head weights. Any gap in the hair now shows hair colour, not skin.
"""
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def log(msg):
    print(f"[V2] scalp: {msg}")


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def close_parting(hair, c):
    """Front crown: pull verts toward x = 0 (up to 35%) and 2 mm outward; the part closes, sides overlap."""
    moved = 0
    for v in hair.data.vertices:
        p = v.co
        if p.z < c.z + 0.04 or p.y > c.y + 0.03 or abs(p.x) > 0.06:
            continue
        w = smooth((p.z - (c.z + 0.04)) / 0.05) * smooth((0.06 - abs(p.x)) / 0.03) * smooth((c.y + 0.03 - p.y) / 0.04)
        p.x *= 1.0 - 0.35 * w
        out = (p - c).normalized()
        v.co = p + out * (0.002 * w)
        moved += w > 0.05
    log(f"parting: {moved} verts closed")


def lower_hairline(hair, c, brow_top):
    """Front hair above the brows: move down by up to 4 mm, fading out 5 cm higher."""
    for v in hair.data.vertices:
        p = v.co
        if p.y < c.y - 0.05 and brow_top + 0.012 < p.z < brow_top + 0.07:
            w = smooth((brow_top + 0.07 - p.z) / 0.05)
            p.z -= 0.004 * w


def radial(p, c):
    """Outward direction from the skull centre (mesh normals of the head are not reliable after the field)."""
    return (p - Vector((0.0, c.y + 0.01, c.z - 0.01))).normalized()


def _bvh(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    tree = BVHTree.FromBMesh(bm)
    return tree, bm


def relax_border(bm, face, spike_passes=3, iters=8):
    """Kill the stair-step: drop border 'spike' faces, then slide border verts toward the mean of their border
    neighbours (a curve-shortening relax) and snap them back onto the head surface."""
    for _ in range(spike_passes):
        spikes = [f for f in bm.faces if sum(1 for e in f.edges if e.is_boundary) >= 2]
        if not spikes:
            break
        bmesh.ops.delete(bm, geom=spikes, context="FACES_ONLY")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    tree, fbm = _bvh(face)  # face mesh is at identity world matrix, like the cap
    for _ in range(iters):
        border = [v for v in bm.verts if v.is_boundary]
        new = {}
        for v in border:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                new[v] = v.co * 0.5 + (nb[0].co + nb[1].co) * 0.25
        for v, co in new.items():
            hit = tree.find_nearest(co)
            v.co = hit[0] if hit[0] is not None else co
    fbm.free()


def scalp_material(hair_mat):
    """'Hair scalp' = copy of the hair material; Unreal gives this slot a darker root-shadow tint."""
    m = bpy.data.materials.get("Hair scalp") or hair_mat.copy()
    m.name = "Hair scalp"
    return m


def build_cap(face, hair, c, brow_top):
    tree, hbm = _bvh(hair)
    hbm.faces.ensure_lookup_table()
    uv_h = hbm.loops.layers.uv.active
    mw = face.matrix_world
    me = face.data
    if me.shape_keys:  # the head field was written to the shape keys; mesh verts still hold the old basis
        for v, kb in zip(me.vertices, me.shape_keys.reference_key.data):
            v.co = kb.co
        me.update()
    under, gap = set(), {}
    for v in me.vertices:
        p = mw @ v.co
        n = radial(p, c)
        if p.y < c.y - 0.05 and p.z < brow_top + 0.01:
            continue  # face front below the forehead: never capped
        hit = tree.ray_cast(p - n * 0.0005, n, 0.06)
        forehead = p.y < c.y - 0.05 and p.z < brow_top + 0.07
        if hit[0] is not None and forehead and hit[3] > 0.012:
            continue  # a bang hanging in front of the forehead is not a scalp: keep the skin there
        if hit[0] is not None:
            under.add(v.index)
            gap[v.index] = hit[3]
        elif p.z > c.z + 0.105 or (p.y > c.y + 0.005 and p.z > c.z - 0.03):
            under.add(v.index)  # crown / parting / back of the skull: capped even where the hair has a gap
    # Grow one ring over the forehead/sides (pulls the hairline down a little); never onto brows/face.
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    for _ in range(1):
        grow = set()
        for i in under:
            for e in bm.verts[i].link_edges:
                j = e.other_vert(bm.verts[i]).index
                q = mw @ bm.verts[j].co
                if j not in under and not (q.y < c.y - 0.05 and q.z < brow_top + 0.03):
                    grow.add(j)
        under |= grow
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in under], context="VERTS")
    relax_border(bm, face)
    edge = {v.index for v in bm.verts if v.is_boundary}
    cap_me = bpy.data.meshes.new(f"{face.data.name} scalp cap")
    bm.to_mesh(cap_me)
    bm.free()
    cap_me.validate(clean_customdata=False)

    cap = face.copy()
    cap.data = cap_me
    cap.name = "Scalp cap geometry"
    for col in face.users_collection:
        col.objects.link(cap)
    # to_mesh keeps vertex groups (deform layer) but not the original index order: recover by position.
    src_pos = {tuple(round(x, 6) for x in v.co): v.index for v in me.vertices}
    mwi = mw.inverted()
    cap_me.materials.clear()
    cap_me.materials.append(scalp_material(hair.data.materials[0]))
    uv = cap_me.uv_layers.active or cap_me.uv_layers.new(name="UVMap")
    offsets = []
    for v in cap_me.vertices:
        oi = src_pos.get(tuple(round(x, 6) for x in v.co))
        n = radial(mw @ v.co, c)
        d = gap.get(oi, 0.004)
        amt = 0.0003 if v.index in edge else min(0.002, d * 0.5)
        offsets.append(n * amt)
    for v, o in zip(cap_me.vertices, offsets):
        v.co += o
    # Hair colour: each loop takes the UV of the nearest hair face's first loop.
    for poly in cap_me.polygons:
        centre = mw @ poly.center
        _, _, fi, _ = tree.find_nearest(centre)
        huv = hbm.faces[fi].loops[0][uv_h].uv.copy() if fi is not None and uv_h else Vector((0.5, 0.5))
        for li in poly.loop_indices:
            uv.data[li].uv = huv
    hbm.free()
    if cap.data.shape_keys:
        cap.shape_key_clear()
    del mwi
    # Vertex-group names live on the mesh in Blender 4+/5, so the new mesh lost them: the head skin is 100% 'head'.
    cap.vertex_groups.clear()
    cap.vertex_groups.new(name="head").add(list(range(len(cap_me.vertices))), 1.0, "REPLACE")
    log(f"cap: {len(cap_me.vertices)} verts ({len(edge)} edge) under hair of {len(me.vertices)} head verts")
    return cap


def build(face, hair, c, brow_top):
    close_parting(hair, c)
    lower_hairline(hair, c, brow_top)
    hair.data.update()
    return build_cap(face, hair, c, brow_top)
