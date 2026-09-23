"""bmesh part builders for props/furniture/rooms (Blender). Metres, Z up, props face -Y (Unreal +Y after import).

Every part is its own object with one material slot and a white "Col" colour attribute (so joins never turn
parts black); `join()` merges them into one mesh whose slots Unreal maps by name.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


def _finish(bm, name, mat, loc, rot, col, uv_mode="box", uv_scale=1.0, smooth=True):
    if rot != (0, 0, 0):
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                         matrix=Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix())
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(loc))
    bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    if uv_mode == "box":
        for f in bm.faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for lp in f.loops:
                c = lp.vert.co
                lp[uv].uv = ((c.y, c.z) if ax == 0 else (c.x, c.z) if ax == 1 else (c.x, c.y))
                lp[uv].uv *= uv_scale
    for f in bm.faces:
        f.smooth = smooth
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ca = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    for d in ca.data:
        d.color = col
    m = bpy.data.materials.get(mat) or bpy.data.materials.new(mat)
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def rbox(size, loc=(0, 0, 0), mat="MB_Wood", bevel=0.01, seg=2, puff=0.0, rot=(0, 0, 0), col=(1, 1, 1, 1),
         cuts=0, name="part"):
    """Rounded box. puff > 0 bulges the +Z face (cushions); cuts subdivides first so the bulge is smooth."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    corner = [e for e in bm.edges]
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=corner, cuts=cuts, use_grid_fill=True)
        corner = [e for e in bm.edges if e.is_manifold and len(e.link_faces) == 2
                  and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0) > 0.5]
    if bevel > 0:
        b = min(bevel, min(size) * 0.49)
        bmesh.ops.bevel(bm, geom=corner + list({v for e in corner for v in e.verts}), offset=b, segments=seg,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    if puff:
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        for v in bm.verts:
            fx = max(0.0, 1 - (v.co.x / hx) ** 2)
            fy = max(0.0, 1 - (v.co.y / hy) ** 2)
            v.co.z += puff * fx * fy * (1 if v.co.z > 0 else -0.4) * min(1.0, abs(v.co.z) / hz * 1.5)
    return _finish(bm, name, mat, loc, rot, col)


def cyl(r1, r2, depth, loc=(0, 0, 0), mat="MB_Steel", seg=16, rot=(0, 0, 0), col=(1, 1, 1, 1), name="cyl",
        smooth=True):
    """Cone/cylinder standing on its base at loc (not centred)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, depth / 2))
    ob = _finish(bm, name, mat, loc, rot, col, smooth=smooth)
    return ob


def sphere(r, loc=(0, 0, 0), scale=(1, 1, 1), mat="MB_VC", col=(1, 1, 1, 1), seg=10, rings=6, rot=(0, 0, 0),
           name="sph"):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    return _finish(bm, name, mat, loc, rot, col)


def lathe(profile, loc=(0, 0, 0), mat="MB_Ceramic", seg=20, col=(1, 1, 1, 1), name="lathe"):
    """Revolve [(r, z), ...] around Z (open profile; start/end at r=0 to close)."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z))
                      for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            try:
                bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return _finish(bm, name, mat, loc, (0, 0, 0), col)


def tube(points, r, mat="MB_Steel", sides=8, col=(1, 1, 1, 1), name="tube"):
    """Constant-radius tube through world-space points."""
    bm = bmesh.new()
    pts = [Vector(p) for p in points]
    rings = []
    u = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if u is None:
            u = t.cross(Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))).normalized()
        u = (u - t * u.dot(t)).normalized()
        v = t.cross(u)
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * k / sides) + v * math.sin(2 * math.pi * k / sides)) * r)
                      for k in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    return _finish(bm, name, mat, (0, 0, 0), (0, 0, 0), col)


def plane(w, h, loc=(0, 0, 0), mat="MB_Print", uv=(0, 0, 1, 1), rot=(90, 0, 0), name="plane", two_faced=False):
    """A w x h card facing -Y by default (rot 90 about X), UV-mapped to the given rect (v up)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x * w / 2, y * h / 2, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    f.normal_update()
    lay = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = uv
    for lp, (a, b) in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        lp[lay].uv = (a, b)
    # +Z normal; rot 90 about X turns it to -Y (the prop's front).
    if two_faced:
        g = bmesh.ops.duplicate(bm, geom=[f])["geom"]
        bmesh.ops.reverse_faces(bm, faces=[e for e in g if isinstance(e, bmesh.types.BMFace)])
    return _finish(bm, name, mat, loc, rot, (1, 1, 1, 1), uv_mode=None, smooth=False)


def join(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def srgb(r, g, b):
    """0-255 sRGB -> colour-attribute tuple (BYTE_COLOR stores sRGB; Blender takes linear floats)."""
    f = lambda c: (c / 255.0) ** 2.2  # noqa: E731
    return (f(r), f(g), f(b), 1.0)


def mirror_x(parts_fn, *args):
    return [parts_fn(s, *args) for s in (-1, 1)]


def rot_z(ob, deg):
    ob.data.transform(Matrix.Rotation(math.radians(deg), 4, "Z"))
    return ob
