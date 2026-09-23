"""Procedural plant library for Maple Bean (Blender, headless).

Run: Scripts/env_blender.sh Scripts/env_bl_plants.py [--preview]
Writes SourceArt/Plants/SM_MB_<Name>.fbx (metres -> cm, Z up, origin at the pot base; hanging plants at the hook).
Material slots: MB_Foliage (atlas from env_leaf_textures.py), MB_Terracotta, MB_Cream, MB_Soil, MB_Bark, MB_Cord.
--preview also renders SourceArt/Plants/preview_plants.png (EEVEE lineup) for a quick look without Unreal.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import env_bl_lib as L  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "SourceArt", "Plants")
GOLDEN = math.pi * (3 - math.sqrt(5))


def bezier(p0, p1, p2, n):
    p0, p1, p2 = Vector(p0), Vector(p1), Vector(p2)
    return [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2 for t in (i / n for i in range(n + 1))]


def fiddle_leaf_fig():
    g, rnd = L.Geo(), random.Random(3)
    sz = L.pot(g, "terracotta", 0.2, 0.42, seed=1)
    trunk = [Vector((0.035 * math.sin(z * 2.4), 0.02 * math.sin(z * 1.7), z)) for z in
             [sz - 0.03 + i * (1.5 - sz) / 14 for i in range(15)]]
    L.tube(g, trunk, 0.024, 0.011, 7, mat="MB_Bark", region=None)
    br1 = bezier(trunk[7], trunk[7] + Vector((0.12, 0.05, 0.2)), trunk[7] + Vector((0.3, 0.12, 0.42)), 6)
    br2 = bezier(trunk[9], trunk[9] + Vector((-0.1, -0.08, 0.18)), trunk[9] + Vector((-0.26, -0.16, 0.4)), 6)
    for b in (br1, br2):
        L.tube(g, b, 0.012, 0.007, 5, mat="MB_Bark", region=None)
    paths = [(trunk[5:], 26), (br1[2:], 8), (br2[2:], 8)]
    k = 0
    for path, count in paths:
        for i in range(count):
            t = i / max(count - 1, 1)
            p = path[min(int(t * (len(path) - 1)), len(path) - 1)]
            k += 1
            yaw = k * GOLDEN + rnd.uniform(-0.2, 0.2)
            size = (0.42 - 0.12 * t) * rnd.uniform(0.9, 1.1)
            o = p + Vector((math.cos(yaw), math.sin(yaw), 0.02)) * 0.015
            L.leaf(g, "fiddle", o, yaw, rnd.uniform(0.45, 0.8) + 0.4 * t, size, size * 0.52, droop=0.9 - 0.3 * t,
                   fold=0.3, twist=rnd.uniform(-0.3, 0.3), col=L.leaf_colour(rnd, 0.8 + 0.2 * t), wave=0.015)
    return g


def monstera():
    g, rnd = L.Geo(), random.Random(5)
    sz = L.pot(g, "cream", 0.24, 0.36, seed=2)
    for i in range(12):
        yaw = i * GOLDEN + rnd.uniform(-0.15, 0.15)
        d = Vector((math.cos(yaw), math.sin(yaw), 0))
        h, reach = rnd.uniform(0.35, 0.8), rnd.uniform(0.18, 0.5)
        base = d * 0.03 + Vector((0, 0, sz))
        pts = bezier(base, base + d * reach * 0.15 + Vector((0, 0, h)), base + d * reach + Vector((0, 0, h * 0.8)), 8)
        L.tube(g, pts, 0.011, 0.007, 6)
        size = rnd.uniform(0.34, 0.5)
        L.leaf(g, "monstera", pts[-1], yaw, rnd.uniform(0.15, 0.55), size, size, droop=1.0, fold=0.15, nx=6, ny=8,
               twist=rnd.uniform(-0.25, 0.25), col=L.leaf_colour(rnd, 0.75 + 0.25 * h / 0.8))
    return g


def snake_plant():
    g, rnd = L.Geo(), random.Random(7)
    sz = L.pot(g, "cream", 0.16, 0.3, seed=3)
    for i in range(14):
        yaw = i * GOLDEN
        r = 0.02 + 0.07 * math.sqrt(i / 14)
        o = Vector((math.cos(yaw) * r, math.sin(yaw) * r, sz - 0.01))
        ln = rnd.uniform(0.45, 0.85) * (1.1 - 0.4 * i / 14)
        L.leaf(g, "snake", o, yaw, rnd.uniform(1.3, 1.5), ln, ln * 0.13, droop=rnd.uniform(0.0, 0.25), fold=0.6,
               twist=rnd.uniform(-0.6, 0.6), nx=3, ny=12, col=L.leaf_colour(rnd, 0.9))
    return g


def vine(g, rnd, start, yaw, length, spread=0.12):
    """A trailing vine that climbs over the rim and hangs, with pothos leaves along it."""
    d = Vector((math.cos(yaw), math.sin(yaw), 0))
    pts = [Vector(start), Vector(start) + d * 0.06 + Vector((0, 0, 0.05)), Vector(start) + d * spread]
    n = max(int(length / 0.06), 3)
    for i in range(1, n + 1):
        t = i / n
        sway = Vector((-d.y, d.x, 0)) * math.sin(t * 5 + yaw) * 0.04
        pts.append(Vector(start) + d * (spread + 0.08 * t) + sway - Vector((0, 0, length * t)))
    L.tube(g, pts, 0.004, 0.003, 4)
    for i, p in enumerate(pts[1:], 1):
        side = 1 if i % 2 else -1
        ly = yaw + side * rnd.uniform(0.5, 1.2)
        size = rnd.uniform(0.08, 0.12) * (1 - 0.3 * i / len(pts))
        L.leaf(g, "pothos", p, ly, rnd.uniform(-0.2, 0.4), size, size, droop=1.1, fold=0.3, nx=2, ny=3,
               col=L.leaf_colour(rnd, 0.85))


def pothos_crown(g, rnd, sz, r, count):
    for i in range(count):
        yaw = i * GOLDEN
        o = Vector((math.cos(yaw) * r * 0.5, math.sin(yaw) * r * 0.5, sz))
        size = rnd.uniform(0.07, 0.1)
        L.leaf(g, "pothos", o, yaw, rnd.uniform(0.6, 1.0), size, size, droop=1.2, fold=0.3, nx=2, ny=3,
               col=L.leaf_colour(rnd, 0.9))


def pothos_hanging():
    g, rnd = L.Geo(), random.Random(9)
    drop, h, r = 0.55, 0.17, 0.16
    g.off = Vector((0, 0, -drop - h))
    sz = L.pot(g, "terracotta", r, h, soil_drop=0.03, seed=4)
    g.off = Vector((0, 0, 0))
    top = -drop - h + h
    for i in range(3):
        a = i * 2 * math.pi / 3
        L.tube(g, [Vector((math.cos(a) * r, math.sin(a) * r, top)), Vector((0, 0, 0))], 0.004, 0.004, 4,
               mat="MB_Cord", region=None)
    L.tube(g, [Vector((0, 0, 0)), Vector((0, 0, 0.12))], 0.006, 0.006, 4, mat="MB_Cord", region=None)
    soil = -drop - h + sz
    for i in range(11):
        yaw = i * 2 * math.pi / 11 + rnd.uniform(-0.2, 0.2)
        vine(g, rnd, Vector((math.cos(yaw) * r * 0.7, math.sin(yaw) * r * 0.7, soil)), yaw, rnd.uniform(0.3, 1.0))
    pothos_crown(g, rnd, soil, r, 12)
    return g


def pothos_shelf():
    g, rnd = L.Geo(), random.Random(13)
    r = 0.1
    sz = L.pot(g, "cream", r, 0.13, soil_drop=0.02, seed=5)
    for i in range(7):
        yaw = -0.9 + 1.8 * i / 6 + rnd.uniform(-0.1, 0.1)  # trails toward +X (the room side)
        vine(g, rnd, Vector((math.cos(yaw) * r * 0.7, math.sin(yaw) * r * 0.7, sz)), yaw, rnd.uniform(0.25, 0.75),
             spread=0.16)
    pothos_crown(g, rnd, sz, r, 9)
    return g


def succulent():
    g, rnd = L.Geo(), random.Random(17)
    sz = L.pot(g, "cream", 0.075, 0.085, soil_drop=0.012, segs=16, seed=6)
    for cx, cy, s in ((0.0, 0.0, 1.0), (0.035, -0.03, 0.6)):
        for ring, (count, ln, pitch) in enumerate(((5, 0.028, 1.2), (7, 0.042, 0.8), (9, 0.052, 0.35))):
            for i in range(count):
                yaw = i * 2 * math.pi / count + ring * 0.4
                L.leaf(g, "succulent", Vector((cx, cy, sz)), yaw, pitch, ln * s, ln * s * 0.7, droop=-0.3, fold=0.9,
                       nx=3, ny=4, col=L.leaf_colour(rnd, 0.9 + 0.1 * ring))
    return g


def card(g, region, centre, n, size, col, cluster, radius):
    """Bent square leaf card facing `n`, with normals blended toward the canopy sphere."""
    m = g.slot("MB_Foliage")
    n = n.normalized()
    t = n.cross(Vector((0.3, 0.2, 1)).normalized()).normalized()
    t.rotate(__import__("mathutils").Quaternion(n, random.uniform(0, 2 * math.pi)))
    b = n.cross(t)
    pts, uvs, nrms = [], [], []
    for i in range(3):
        row, urow, nrow = [], [], []
        for j in range(3):
            s, q = j - 1, i - 1
            p = centre + t * s * size / 2 + b * q * size / 2 - n * 0.12 * size * (s * s + q * q)
            row.append(p)
            urow.append(L.reg_uv(region, j / 2, i / 2))
            nrow.append(((p - cluster) / radius * 0.75 + n * 0.25).normalized())
        pts.append(row)
        uvs.append(urow)
        nrms.append(nrow)
    g.grid(pts, uvs, col, m, nrms)


def tree(seed, region, trunk_h, clusters, cards_per, height_scale, lean):
    g, rnd = L.Geo(), random.Random(seed)
    random.seed(seed)
    trunk = [Vector((lean * (z / trunk_h) ** 2, 0.0, z)) for z in [i * trunk_h / 10 for i in range(11)]]
    L.tube(g, [Vector((0, 0, -0.05))] + trunk, 0.16, 0.07, 9, mat="MB_Bark", region=None)
    top = trunk[-1]
    ends = []
    for i, (yaw, up, out, r) in enumerate(clusters):
        d = Vector((math.cos(yaw), math.sin(yaw), 0))
        start = trunk[rnd.randint(7, 10)]
        end = top + d * out + Vector((0, 0, up * height_scale))
        mid = start + (end - start) * 0.5 + Vector((0, 0, 0.15))
        L.tube(g, bezier(start, mid, end, 6), 0.075, 0.025, 6, mat="MB_Bark", region=None)
        ends.append((end, r))
    for c, r in ends:
        for k in range(cards_per):
            dvec = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1) * 0.8 + 0.25)).normalized()
            depth = rnd.uniform(0.45, 1.0)
            p = c + Vector((dvec.x * r, dvec.y * r, dvec.z * r * 0.85)) * depth
            shade = 0.5 + 0.4 * depth + 0.15 * max(dvec.z, 0)
            card(g, region, p, dvec + Vector((rnd.uniform(-.4, .4), rnd.uniform(-.4, .4), rnd.uniform(-.2, .4))),
                 rnd.uniform(0.75, 1.05), L.leaf_colour(rnd, min(shade, 1.0), 0.14), c, r)
    return g


def tree_round():
    cl = [(0.0, 0.6, 1.0, 1.15), (2.1, 0.8, 1.1, 1.1), (4.2, 0.5, 1.0, 1.15), (1.0, 1.5, 0.4, 1.2),
          (3.2, 1.4, 0.55, 1.1), (5.3, 1.2, 0.7, 1.05), (0, 2.2, 0.0, 1.0)]
    return tree(21, "treeA", 1.8, cl, 56, 1.0, 0.12)


def tree_tall():
    cl = [(0.5, 0.5, 0.7, 0.95), (2.6, 0.7, 0.75, 0.95), (4.7, 0.6, 0.7, 0.95), (1.6, 1.6, 0.45, 0.95),
          (3.8, 1.8, 0.4, 0.9), (0, 2.7, 0.1, 0.85)]
    return tree(23, "treeB", 2.0, cl, 56, 1.0, -0.1)


PLANTS = {"FiddleLeafFig": fiddle_leaf_fig, "Monstera": monstera, "SnakePlant": snake_plant,
          "PothosHanging": pothos_hanging, "PothosShelf": pothos_shelf, "Succulent": succulent,
          "TreeRound": tree_round, "TreeTall": tree_tall}
COLLIDERS = {"FiddleLeafFig": [(0.2, 0, 1.0)], "Monstera": [(0.26, 0, 0.5)], "SnakePlant": [(0.16, 0, 0.5)],
             "TreeRound": [(0.2, 0, 2.0)], "TreeTall": [(0.2, 0, 2.0)]}


def preview(objs, path):
    """EEVEE lineup with approximate materials (atlas + alpha, flat colours), for a sanity check only."""
    atlas = bpy.data.images.load(os.path.join(OUT, "Textures", "T_MB_FoliageAtlas_D.png"))
    cols = {"MB_Terracotta": (0.55, 0.22, 0.12), "MB_Cream": (0.8, 0.74, 0.62), "MB_Soil": (0.08, 0.05, 0.03),
            "MB_Bark": (0.2, 0.13, 0.08), "MB_Cord": (0.6, 0.5, 0.35)}
    for m in bpy.data.materials:
        m.use_nodes = True
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        if m.name == "MB_Foliage":
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = atlas
            vc = nt.nodes.new("ShaderNodeVertexColor")
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
            mul.inputs[0].default_value = 1.0
            nt.links.new(tex.outputs["Color"], mul.inputs[6])
            nt.links.new(vc.outputs["Color"], mul.inputs[7])
            nt.links.new(mul.outputs[2], bsdf.inputs["Base Color"])
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        else:
            bsdf.inputs["Base Color"].default_value = (*cols.get(m.name, (0.5, 0.5, 0.5)), 1)
    x = 0.0
    for ob in objs:
        w = max(ob.dimensions.x, ob.dimensions.y)
        ob.location = (x + w / 2, 0, 1.8 if "Hanging" in ob.name else (0.9 if "Shelf" in ob.name else 0))
        x += w + 0.3
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in [e.identifier for e in
                                                          bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x, sc.render.resolution_y = 1800, 800
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.78, 0.74, 1)
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = x + 0.4
    cam.location = (x / 2, -12, 2.2 + 0.1 * x)
    cam.rotation_euler = (math.radians(85), 0, 0)
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"[MB] preview -> {path}")


L.clear()
os.makedirs(OUT, exist_ok=True)
built, total = [], {}
for name, fn in PLANTS.items():
    ob = fn().build(f"SM_MB_{name}")
    total[name] = L.export_fbx(ob, os.path.join(OUT, f"SM_MB_{name}.fbx"), COLLIDERS.get(name, ()))
    built.append(ob)
print(f"[MB] plants: {total}")
if "--preview" in sys.argv:  # small plants only (trees dwarf them); --preview-trees for the trees
    trees = "--preview-trees" in sys.argv
    for ob in built:
        ob.hide_render = ("Tree" in ob.name) != trees
    preview([ob for ob in built if not ob.hide_render], os.path.join(OUT, "preview_%s.png" % ("trees" if trees else "plants")))
