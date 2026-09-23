"""Geometry helpers for the Blender plant/prop builders (imported by env_bl_plants.py / env_bl_props.py).

Everything accumulates into a Geo (verts, faces, per-corner UVs/colours/normals, per-face material) and
becomes one Blender object with named material slots. Units are metres, Z up, origin at the base.
"""
import math
import random

import bpy
from mathutils import Matrix, Vector

ATLAS = 2048.0
REGIONS = {  # must match env_leaf_textures.py (pixels, v up)
    "fiddle": (0, 0, 512, 1024), "monstera": (512, 0, 1536, 1024), "snake": (1536, 0, 1792, 1024),
    "pothos": (1792, 0, 2048, 256), "succulent": (1792, 256, 2048, 512), "stem": (1792, 512, 2048, 768),
    "round": (1792, 768, 2048, 1024), "treeA": (0, 1024, 1024, 2048), "treeB": (1024, 1024, 2048, 2048),
}


def reg_uv(name, u, v):
    x0, y0, x1, y1 = REGIONS[name]
    pad = 2.0
    return ((x0 + pad + u * (x1 - x0 - 2 * pad)) / ATLAS, (y0 + pad + v * (y1 - y0 - 2 * pad)) / ATLAS)


class Geo:
    def __init__(self):
        self.verts, self.faces, self.uvs, self.cols, self.mats, self.nrms = [], [], [], [], [], []
        self.slots = []
        self.off = Vector((0, 0, 0))  # translation applied to everything added

    def slot(self, name):
        if name not in self.slots:
            self.slots.append(name)
        return self.slots.index(name)

    def add_face(self, idx, uvs, col, mat, nrms=None):
        self.faces.append(tuple(idx))
        self.uvs.append(uvs)
        self.cols.append(col)
        self.mats.append(mat)
        self.nrms.append(nrms)

    def grid(self, pts, uvs, col, mat, nrms=None):
        """pts/uvs[/nrms]: rows x cols nested lists -> quads."""
        rows, cols = len(pts), len(pts[0])
        base = len(self.verts)
        for r in pts:
            self.verts.extend(Vector(v) + self.off for v in r)
        for i in range(rows - 1):
            for j in range(cols - 1):
                a, b, c, d = (i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)
                idx = [base + p[0] * cols + p[1] for p in (a, b, c, d)]
                self.add_face(idx, [uvs[p[0]][p[1]] for p in (a, b, c, d)], col, mat,
                              [nrms[p[0]][p[1]] for p in (a, b, c, d)] if nrms else None)

    def build(self, name, smooth=True):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        uv = me.uv_layers.new(name="UVMap")
        col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        custom = []
        for p in me.polygons:
            p.material_index = self.mats[p.index]
            p.use_smooth = smooth
            for k, li in enumerate(p.loop_indices):
                uv.data[li].uv = self.uvs[p.index][k]
                col.data[li].color = self.cols[p.index]
        if any(n is not None for n in self.nrms):
            for p in me.polygons:
                for k in range(p.loop_total):
                    n = self.nrms[p.index]
                    custom.append(tuple(n[k]) if n else tuple(me.corner_normals[p.loop_start + k].vector))
        me.validate()
        if custom and len(custom) == len(me.loops):
            me.normals_split_custom_set(custom)
        for s in self.slots:
            me.materials.append(material(s))
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return m


# ------------------------------------------------------------------ primitives
def leaf(g, region, origin, yaw, pitch, length, width, droop=0.6, fold=0.25, twist=0.0, col=(1, 1, 1, 1),
         nx=4, ny=7, mat="MB_Foliage", wave=0.0):
    """A curved leaf card: midrib arcs from `pitch` down by `droop` radians, cupped by `fold`."""
    m = g.slot(mat)
    rot = Matrix.Rotation(yaw, 3, "Z")
    pts, uvs = [], []
    p = Vector((0, 0, 0))
    step = length / ny
    for i in range(ny + 1):
        t = i / ny
        a = pitch - droop * t * t
        d = Vector((math.cos(a), 0, math.sin(a)))
        n0 = Vector((-math.sin(a), 0, math.cos(a)))
        tw = twist * t
        side = Vector((0, math.cos(tw), 0)) + n0 * math.sin(tw)
        nrm = n0 * math.cos(tw) - Vector((0, 1, 0)) * math.sin(tw)
        row, urow = [], []
        for j in range(nx + 1):
            s = 1 - j / nx * 2  # +side -> -side so the face normal points out of the leaf's top
            off = side * s * width * 0.5 + nrm * (fold * width * 0.5 * (abs(s) * 0.5 + s * s * 0.5)
                                                   + wave * width * math.sin(t * 9 + s * 2))
            row.append(Vector(origin) + rot @ (p + off))
            urow.append(reg_uv(region, (s + 1) / 2, t))
        pts.append(row)
        uvs.append(urow)
        p = p + d * step
    g.grid(pts, uvs, col, m)
    return Vector(origin) + rot @ p


def tube(g, points, r0, r1, sides=6, col=(1, 1, 1, 1), mat="MB_Foliage", region="stem", uv_scale=None):
    """Tapered tube through `points` (parallel-transport frames). region=None -> metric UVs for tiled textures."""
    m = g.slot(mat)
    pts = [Vector(p) for p in points]
    n = len(pts)
    tan = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    ref = Vector((1, 0, 0)) if abs(tan[0].x) < 0.9 else Vector((0, 1, 0))
    u = tan[0].cross(ref).normalized()
    rings, uvs, nrms, total = [], [], [], 0.0
    for i in range(n):
        if i:
            total += (pts[i] - pts[i - 1]).length
            u = (u - tan[i] * u.dot(tan[i])).normalized()
        v = tan[i].cross(u)
        r = r0 + (r1 - r0) * i / (n - 1)
        ring, urow, nrow = [], [], []
        for k in range(sides + 1):
            a = 2 * math.pi * k / sides
            d = u * math.cos(a) + v * math.sin(a)
            ring.append(pts[i] + d * r)
            nrow.append(d)
            if region:
                urow.append(reg_uv(region, k / sides, (total * 3) % 1.0 if uv_scale is None else min(total / uv_scale, 1)))
            else:
                urow.append((k / sides * max(r0, 0.02) * 2 * math.pi * 4, total * 4))
        rings.append(ring)
        uvs.append(urow)
        nrms.append(nrow)
    g.grid(rings, uvs, col, m, nrms)


def lathe(g, profile, segs, mat, col=(1, 1, 1, 1), uv_rep=2.0):
    """Revolve [(radius, z), ...] (bottom to top, outside then inside) around Z."""
    m = g.slot(mat)
    pts, uvs = [], []
    run = 0.0
    for i, (r, z) in enumerate(profile):
        if i:
            run += math.hypot(r - profile[i - 1][0], z - profile[i - 1][1])
        pts.append([Vector((r * math.cos(2 * math.pi * k / segs), r * math.sin(2 * math.pi * k / segs), z))
                    for k in range(segs + 1)])
        uvs.append([(k / segs * uv_rep, run * 3) for k in range(segs + 1)])
    g.grid(pts, uvs, col, m)


def disc(g, r, z, segs, mat, col=(1, 1, 1, 1), bump=0.006, seed=0):
    """Soil: a slightly lumpy disc (3 rings)."""
    rnd = random.Random(seed)
    m = g.slot(mat)
    pts, uvs = [], []
    for ring in range(4):
        rr = r * ring / 3
        lump = [rnd.uniform(-bump, bump) if 0 < ring < 3 else (bump if ring == 0 else 0) for _ in range(segs)]
        lump.append(lump[0])
        pts.append([Vector((rr * math.cos(2 * math.pi * k / segs), rr * math.sin(2 * math.pi * k / segs), z + lump[k]))
                    for k in range(segs + 1)])
        uvs.append([(rr * math.cos(2 * math.pi * k / segs) * 3, rr * math.sin(2 * math.pi * k / segs) * 3)
                    for k in range(segs + 1)])
    g.grid(pts[::-1], uvs[::-1], col, m)


def pot(g, style, r_top, h, soil_drop=0.04, segs=20, seed=0):
    """Terracotta (tapered + rolled rim) or cream (rounded bowl) pot with soil. Returns soil height."""
    if style == "terracotta":
        rb = r_top * 0.72
        prof = [(0.0, 0.0), (rb, 0.0), (rb * 1.02, 0.01), (r_top * 0.95, h * 0.82), (r_top * 1.04, h * 0.84),
                (r_top * 1.06, h * 0.97), (r_top * 1.03, h), (r_top * 0.93, h), (r_top * 0.9, h * 0.9),
                (r_top * 0.86, h - soil_drop - 0.01)]
        mat = "MB_Terracotta"
    else:
        rb = r_top * 0.62
        prof = [(0.0, 0.0), (rb, 0.0), (rb + (r_top - rb) * 0.6, h * 0.12), (r_top * 0.97, h * 0.35),
                (r_top, h * 0.6), (r_top * 0.98, h * 0.95), (r_top * 0.95, h), (r_top * 0.9, h),
                (r_top * 0.88, h - soil_drop - 0.01)]
        mat = "MB_Cream"
    lathe(g, prof, segs, mat)
    sz = h - soil_drop
    disc(g, prof[-1][0] + 0.002, sz, segs, "MB_Soil", seed=seed)
    return sz


def leaf_colour(rnd, base=1.0, spread=0.18):
    """Per-leaf multiplier (linear): slight hue/value jitter, stored in the vertex colour."""
    v = base * (1 - spread / 2 + rnd.random() * spread)
    warm = rnd.uniform(-0.06, 0.06)
    return (min(v * (1 + warm), 1), min(v, 1), min(v * (1 - warm * 1.5), 1), 1.0)


def spherical_normals(ob, centres):
    """Point card normals away from the nearest canopy centre (soft, rounded canopy lighting)."""
    me = ob.data
    out = []
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            c = min(centres, key=lambda c: (Vector(c[0]) - co).length / c[1])
            n = (co - Vector(c[0])).normalized()
            out.append(tuple((n * 0.8 + p.normal * 0.2).normalized()))
    me.normals_split_custom_set(out)


def clear():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)


def collider(owner, idx, r, z0, z1, cx=0.0, cy=0.0, sides=8):
    """Convex prism named UCX_<owner>_NN: Unreal uses it as the mesh's simple collision."""
    verts = [(cx + r * math.cos(2 * math.pi * k / sides), cy + r * math.sin(2 * math.pi * k / sides), z)
             for z in (z0, z1) for k in range(sides)]
    faces = [tuple(range(sides))[::-1], tuple(range(sides, 2 * sides))]
    faces += [(k, (k + 1) % sides, sides + (k + 1) % sides, sides + k) for k in range(sides)]
    me = bpy.data.meshes.new(f"UCX_{owner}_{idx:02d}")
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box_collider(owner, idx, cx, cy, cz, sx, sy, sz):
    """Axis-aligned UCX box (centre, full size)."""
    verts = [(cx + dx * sx / 2, cy + dy * sy / 2, cz + dz * sz / 2) for dz in (-1, 1) for dy in (-1, 1) for dx in (-1, 1)]
    faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
    me = bpy.data.meshes.new(f"UCX_{owner}_{idx:02d}")
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def export_fbx(ob, path, colliders=()):
    """colliders: [(radius, z0, z1), ...] UCX prisms or [(cx, cy, cz, sx, sy, sz), ...] UCX boxes."""
    bpy.ops.object.select_all(action="DESELECT")
    extra = [box_collider(ob.name, i, *c) if len(c) == 6 else collider(ob.name, i, *c)
             for i, c in enumerate(colliders)]
    for o in [ob] + extra:
        o.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.fbx(filepath=path, use_selection=True, object_types={"MESH"}, apply_unit_scale=True,
                             apply_scale_options="FBX_SCALE_UNITS", mesh_smooth_type="FACE", add_leaf_bones=False,
                             colors_type="SRGB", use_mesh_modifiers=True, axis_forward="-Y", axis_up="Z")
    for o in extra:
        bpy.data.objects.remove(o, do_unlink=True)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"[MB] exported {ob.name}: {tris} tris -> {path}")
    return tris
