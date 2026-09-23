"""Exterior, room-fixture, merch and quiet-nook props (Blender, headless). Same conventions as env_bl_props.py.

Run: Scripts/env_blender.sh Scripts/env_bl_props2.py [-- Name ...]
Extra slots: MB_Porcelain, MB_Mirror, MB_Iron, MB_LampGlass (emissive), MB_Shade (lit fabric), MB_Paint.
"""
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import env_bl_lib as L  # noqa: E402
from env_bl_props import BOOK_COLS, book_row, cup  # noqa: E402
from env_bl_shapes import cyl, join, lathe, rbox, sphere, srgb, tube  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "SourceArt", "Props")
rnd = random.Random(31)


# ---------------------------------------------------------------- exterior
def bench():
    P = []
    for s in (-1, 1):  # cast-iron ends
        x = s * 0.7
        P.append(rbox((0.05, 0.5, 0.06), (x, -0.02, 0.03), "MB_Iron", 0.01))
        P.append(tube([(x, -0.22, 0.03), (x, -0.2, 0.25), (x, -0.22, 0.44)], 0.022, "MB_Iron", 8))
        P.append(tube([(x, 0.2, 0.03), (x, 0.18, 0.44), (x, 0.24, 0.88)], 0.022, "MB_Iron", 8))
        P.append(tube([(x, -0.24, 0.44), (x, 0.0, 0.46), (x, 0.2, 0.44)], 0.02, "MB_Iron", 8))
        P.append(tube([(x, -0.26, 0.44), (x, -0.25, 0.62), (x, -0.1, 0.66), (x, 0.1, 0.64)], 0.018, "MB_Iron", 8))
    for i in range(5):
        P.append(rbox((1.56, 0.075, 0.035), (0, -0.2 + i * 0.09, 0.47), "MB_Wood", 0.01))
    for i in range(3):
        P.append(rbox((1.56, 0.03, 0.085), (0, 0.21 + i * 0.01, 0.6 + i * 0.11), "MB_Wood", 0.01, rot=(-12, 0, 0)))
    return P


def bike_rack():
    P = [rbox((2.0, 0.08, 0.03), (0, 0, 0.015), "MB_Iron", 0.008)]
    for i in range(4):
        x = -0.75 + i * 0.5
        pts = [(x - 0.2, 0, 0.0)] + [(x + 0.2 * math.cos(a), 0, 0.62 + 0.2 * math.sin(a))
                                    for a in [math.pi - k * math.pi / 8 for k in range(9)]] + [(x + 0.2, 0, 0.0)]
        P.append(tube(pts, 0.025, "MB_Iron", 8))
    return P


def street_lamp():
    P = [cyl(0.16, 0.12, 0.35, (0, 0, 0), "MB_Iron", 12), cyl(0.07, 0.055, 2.9, (0, 0, 0.35), "MB_Iron", 10),
         cyl(0.09, 0.09, 0.08, (0, 0, 1.2), "MB_Iron", 12), cyl(0.07, 0.1, 0.1, (0, 0, 3.2), "MB_Iron", 10),
         cyl(0.1, 0.16, 0.06, (0, 0, 3.3), "MB_Iron", 4, rot=(0, 0, 45), smooth=False),
         cyl(0.16, 0.2, 0.42, (0, 0, 3.36), "MB_LampGlass", 4, rot=(0, 0, 45), smooth=False),
         cyl(0.22, 0.04, 0.2, (0, 0, 3.78), "MB_Iron", 4, rot=(0, 0, 45), smooth=False),
         sphere(0.05, (0, 0, 4.0), mat="MB_Iron")]
    for k in range(4):
        a = math.radians(45 + 90 * k)
        P.append(tube([(0.16 * math.cos(a), 0.16 * math.sin(a), 3.36), (0.2 * math.cos(a), 0.2 * math.sin(a), 3.78)],
                      0.012, "MB_Iron", 6))
    return P


def planter_box():
    return [rbox((1.2, 0.4, 0.45), (0, 0, 0.225), "MB_Wood", 0.02), rbox((1.14, 0.34, 0.02), (0, 0, 0.43), "MB_Soil", 0)]


# ---------------------------------------------------------------- restrooms / staff
def toilet():
    P = [lathe([(0, 0), (0.14, 0), (0.15, 0.05), (0.13, 0.3), (0.19, 0.36), (0.2, 0.4), (0.17, 0.4), (0.12, 0.32),
                (0, 0.3)], (0, -0.08, 0), "MB_Porcelain", 20)]
    P[0].scale = (1, 1.3, 1)
    bpy.context.view_layer.update()
    P[0].data.transform(P[0].matrix_basis)
    P[0].matrix_basis.identity()
    P.append(rbox((0.42, 0.18, 0.36), (0, 0.2, 0.55), "MB_Porcelain", 0.03))
    P.append(rbox((0.44, 0.2, 0.03), (0, 0.2, 0.745), "MB_Porcelain", 0.012))
    P.append(rbox((0.38, 0.48, 0.025), (0, -0.1, 0.415), "MB_Wood", 0.02))
    P.append(cyl(0.012, 0.012, 0.04, (0.14, 0.12, 0.66), "MB_Steel", 8, rot=(90, 0, 0)))
    return P


def vanity():
    P = [rbox((0.8, 0.48, 0.8), (0, 0, 0.4), "MB_Wood", 0.01), rbox((0.84, 0.52, 0.04), (0, 0, 0.82), "MB_Porcelain", 0.01),
         lathe([(0.2, 0.0), (0.18, -0.12), (0.0, -0.13)], (0, -0.02, 0.845), "MB_Porcelain", 20),
         tube([(0, 0.18, 0.84), (0, 0.18, 1.02), (0, 0.06, 1.04), (0, 0.04, 0.99)], 0.013, "MB_Steel", 8),
         rbox((0.6, 0.03, 0.8), (0, 0.22, 1.55), "MB_Wood", 0.01), rbox((0.52, 0.01, 0.72), (0, 0.2, 1.55), "MB_Mirror", 0)]
    for s in (-1, 1):
        P.append(rbox((0.36, 0.01, 0.34), (s * 0.19, -0.245, 0.42), "MB_Paint", 0.006))
        P.append(cyl(0.008, 0.008, 0.02, (s * 0.04, -0.25, 0.58), "MB_Brass", 8, rot=(90, 0, 0)))
    P.append(cyl(0.04, 0.035, 0.12, (0.28, 0.1, 0.84), "MB_Ceramic", 12))
    return P


def door():
    """Closed door in an oak casing, front -Y, origin at the floor in the wall plane."""
    return [rbox((1.02, 0.06, 2.14), (0, 0, 1.07), "MB_Wood", 0.01), rbox((0.9, 0.05, 2.06), (0, -0.01, 1.03), "MB_Paint", 0.01),
            rbox((0.7, 0.012, 0.8), (0, -0.036, 1.45), "MB_Paint", 0.01), rbox((0.7, 0.012, 0.8), (0, -0.036, 0.52), "MB_Paint", 0.01),
            tube([(0.34, -0.05, 1.02), (0.34, -0.09, 1.02), (0.22, -0.09, 1.02)], 0.012, "MB_Brass", 8)]


def shelving():
    P = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            P.append(rbox((0.035, 0.035, 1.9), (sx * 0.58, sy * 0.2, 0.95), "MB_Steel", 0.004))
    for i in range(5):
        P.append(rbox((1.2, 0.45, 0.02), (0, 0, 0.1 + i * 0.44), "MB_Steel", 0.004))
    for i in range(4):
        z, x = 0.11 + i * 0.44, -0.5
        while x < 0.45:
            w, h = rnd.uniform(0.22, 0.34), rnd.uniform(0.18, 0.32)
            if rnd.random() < 0.8:
                P.append(rbox((w, rnd.uniform(0.3, 0.4), h), (x + w / 2, 0, z + h / 2), "MB_VC", 0.006,
                              col=srgb(*rnd.choice([(176, 136, 90), (190, 150, 100), (160, 120, 80), (220, 206, 180)]))))
            x += w + 0.03
    return P


def coffee_sacks():
    P = []
    for i, (x, y, z, r) in enumerate(((0, 0, 0, 0), (0.62, 0.05, 0, 8), (0.3, 0.02, 0.26, -5))):
        P.append(rbox((0.6, 0.42, 0.28), (x, y, z + 0.14), "MB_VC", 0.1, 3, puff=0.05, cuts=2, rot=(0, 0, r),
                      col=srgb(170, 140, 100)))
    return P


def lockers():
    P = []
    for i in range(3):
        P.append(rbox((0.4, 0.45, 1.8), (-0.41 + i * 0.41, 0, 0.9), "MB_Paint", 0.01))
        P.append(rbox((0.02, 0.01, 0.12), (-0.41 + i * 0.41 + 0.13, -0.23, 1.0), "MB_Steel", 0.003))
        for k in range(3):
            P.append(rbox((0.2, 0.01, 0.01), (-0.41 + i * 0.41, -0.23, 1.6 + k * 0.03), "MB_Black", 0))
    return P


# ---------------------------------------------------------------- merch + nooks
def merch_shelf():
    """Oak wall unit: 3 shelves of coffee bags, mugs and totes."""
    P = [rbox((1.1, 0.36, 0.04), (0, 0, 0.1 + i * 0.5), "MB_Wood", 0.008) for i in range(4)]
    for s in (-1, 1):
        P.append(rbox((0.04, 0.36, 1.9), (s * 0.53, 0, 0.95), "MB_Wood", 0.008))
    P.append(rbox((1.1, 0.02, 1.9), (0, 0.17, 0.95), "MB_Paint", 0.004))
    for i in range(4):  # coffee bags, kraft with a green band
        x = -0.38 + i * 0.25
        P.append(rbox((0.13, 0.08, 0.22), (x, -0.02, 0.23), "MB_VC", 0.02, col=srgb(186, 150, 104)))
        P.append(rbox((0.132, 0.082, 0.05), (x, -0.02, 0.24), "MB_VC", 0.005, col=srgb(40, 74, 56)))
    for i in range(5):  # mugs
        x = -0.4 + i * 0.2
        P.append(lathe([(0, 0), (0.04, 0), (0.042, 0.1), (0.038, 0.1), (0.036, 0.01), (0, 0.01)], (x, -0.03, 0.62),
                       "MB_VC", 14, col=srgb(*[(236, 226, 206), (40, 74, 56), (184, 98, 64)][i % 3])))
    for i in range(3):  # folded totes
        P.append(rbox((0.3, 0.24, 0.05), (-0.33 + i * 0.33, 0, 1.13 + 0.0), "MB_VC", 0.01, col=srgb(236, 226, 206)))
        P.append(rbox((0.3, 0.24, 0.05), (-0.33 + i * 0.33, 0, 1.18), "MB_VC", 0.01, col=srgb(214, 200, 170)))
    P += book_row(8)
    for p in P[-8:]:
        p.data.transform(__import__("mathutils").Matrix.Translation((0.2, -0.02, 1.62)))
    return P


def merch_table():
    P = [rbox((1.2, 0.6, 0.05), (0, 0, 0.74), "MB_Wood", 0.01)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            P.append(cyl(0.025, 0.02, 0.72, (sx * 0.54, sy * 0.24, 0), "MB_Wood", 8))
    for i in range(3):
        P.append(rbox((0.13, 0.08, 0.22), (-0.42 + i * 0.15, 0.08, 0.875), "MB_VC", 0.02, col=srgb(186, 150, 104)))
        P.append(rbox((0.132, 0.082, 0.05), (-0.42 + i * 0.15, 0.08, 0.885), "MB_VC", 0.005, col=srgb(40, 74, 56)))
    for i in range(4):
        P.append(lathe([(0, 0), (0.04, 0), (0.042, 0.1), (0.038, 0.1), (0.036, 0.01), (0, 0.01)],
                       (0.1 + (i % 2) * 0.12, -0.1 + (i // 2) * 0.14, 0.765), "MB_VC", 14,
                       col=srgb(*[(236, 226, 206), (184, 98, 64)][i % 2])))
    P.append(rbox((0.36, 0.3, 0.04), (0.42, 0.05, 0.785), "MB_VC", 0.01, col=srgb(236, 226, 206)))
    return P


def floor_lamp():
    return [cyl(0.16, 0.16, 0.03, (0, 0, 0), "MB_Brass", 18), cyl(0.014, 0.014, 1.45, (0, 0, 0.03), "MB_Brass", 8),
            lathe([(0.12, 0.0), (0.2, -0.28), (0.21, -0.29), (0.13, 0.0)], (0, 0, 1.72), "MB_Shade", 20)]


def side_table():
    return [cyl(0.3, 0.3, 0.035, (0, 0, 0.56), "MB_Wood", 24), cyl(0.04, 0.035, 0.53, (0, 0, 0.03), "MB_Wood", 10),
            cyl(0.22, 0.2, 0.03, (0, 0, 0), "MB_Wood", 18)] + cup(0.08, 0.02, 0.595)


def half_wall_planter():
    """Low oak divider with a trough on top (plants are placed separately)."""
    return [rbox((0.3, 1.8, 0.95), (0, 0, 0.475), "MB_Wood", 0.02), rbox((0.34, 1.84, 0.04), (0, 0, 0.97), "MB_Wood", 0.01),
            rbox((0.24, 1.7, 0.02), (0, 0, 0.995), "MB_Soil", 0)]


def rug(w, d):
    return [rbox((w, d, 0.012), (0, 0, 0.006), "MB_Rug", 0.004), rbox((w - 0.2, d - 0.2, 0.004), (0, 0, 0.014), "MB_Pillow", 0.002)]


PROPS = {
    "Bench": bench, "BikeRack": bike_rack, "StreetLamp": street_lamp, "PlanterBox": planter_box,
    "Toilet": toilet, "Vanity": vanity, "Door": door, "Shelving": shelving, "CoffeeSacks": coffee_sacks,
    "Lockers": lockers, "MerchShelf": merch_shelf, "MerchTable": merch_table, "FloorLamp": floor_lamp,
    "SideTable": side_table, "HalfWallPlanter": half_wall_planter, "RugNook": lambda: rug(2.0, 1.4),
}

if __name__ == "__main__":
    L.clear()
    os.makedirs(OUT, exist_ok=True)
    only = [a for a in sys.argv[sys.argv.index("--") + 1:] if not a.startswith("--")] if "--" in sys.argv else []
    for name, fn in PROPS.items():
        if only and name not in only:
            continue
        ob = join(fn(), f"SM_MB_{name}")
        L.export_fbx(ob, os.path.join(OUT, f"SM_MB_{name}.fbx"))
        bpy.data.objects.remove(ob, do_unlink=True)
