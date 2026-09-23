"""Furniture + café props for Maple Bean (Blender, headless). Fronts face -Y (Unreal +Y), origin at floor/base centre.

Run: Scripts/env_blender.sh Scripts/env_bl_props.py [--preview]
Writes SourceArt/Props/SM_MB_<Name>.fbx. Slots: MB_Upholstery, MB_Pillow, MB_Wood, MB_DarkWood, MB_Steel, MB_Brass,
MB_Paint, MB_Black, MB_Glass, MB_Ceramic, MB_Coffee, MB_VC (vertex colour), MB_Screen, MB_PrintMenu,
MB_PrintSandwich, MB_PrintArt, MB_PrintSigns.
"""
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import env_bl_lib as L  # noqa: E402
from env_bl_shapes import cyl, join, lathe, plane, rbox, sphere, srgb, tube  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "SourceArt", "Props")
rnd = random.Random(12)


# ---------------------------------------------------------------- seating
def sofa(length, seats, depth=0.92):
    P, legs = [], 0.11
    P.append(rbox((length - 0.12, depth - 0.1, 0.2), (0, 0, legs + 0.1), "MB_Upholstery", 0.05, 3))
    for s in (-1, 1):
        P.append(rbox((0.22, depth, 0.5), (s * (length / 2 - 0.11), 0, legs + 0.25), "MB_Upholstery", 0.09, 4, cuts=2))
        for sy in (-1, 1):
            P.append(cyl(0.022, 0.028, legs, (s * (length / 2 - 0.12), sy * (depth / 2 - 0.1), 0), "MB_DarkWood", 10))
    P.append(rbox((length - 0.3, 0.2, 0.5), (0, depth / 2 - 0.1, legs + 0.2 + 0.25), "MB_Upholstery", 0.08, 3))
    inner = length - 0.44
    w = inner / seats
    for i in range(seats):
        x = -inner / 2 + w * (i + 0.5)
        P.append(rbox((w - 0.012, depth - 0.3, 0.14), (x, -0.07, legs + 0.2 + 0.07), "MB_Upholstery", 0.05, 3,
                      puff=0.025, cuts=3))
        P.append(rbox((w - 0.02, 0.44, 0.17), (x, depth / 2 - 0.26, legs + 0.34 + 0.23), "MB_Upholstery", 0.06, 3,
                      puff=0.035, cuts=3, rot=(80, 0, 0)))
    for s in (-1, 1):
        P.append(rbox((0.42, 0.42, 0.13), (s * (inner / 2 - 0.2), depth / 2 - 0.4, legs + 0.52), "MB_Pillow", 0.06,
                      3, puff=0.05, cuts=3, rot=(72, s * 12, s * 8)))
    return P


def armchair():
    P, legs, w, d = [], 0.12, 0.92, 0.86
    P.append(rbox((w - 0.1, d - 0.1, 0.2), (0, 0, legs + 0.1), "MB_Upholstery", 0.05, 3))
    for s in (-1, 1):
        P.append(rbox((0.2, d, 0.46), (s * (w / 2 - 0.1), 0, legs + 0.23), "MB_Upholstery", 0.09, 4, cuts=2))
        for sy in (-1, 1):
            P.append(cyl(0.02, 0.026, legs, (s * (w / 2 - 0.1), sy * (d / 2 - 0.1), 0), "MB_DarkWood", 10))
    P.append(rbox((w - 0.1, 0.2, 0.58), (0, d / 2 - 0.1, legs + 0.2 + 0.29), "MB_Upholstery", 0.1, 4, cuts=2))
    P.append(rbox((w - 0.42, d - 0.3, 0.14), (0, -0.07, legs + 0.27), "MB_Upholstery", 0.05, 3, puff=0.03, cuts=3))
    P.append(rbox((w - 0.44, 0.46, 0.16), (0, d / 2 - 0.25, legs + 0.57), "MB_Upholstery", 0.06, 3, puff=0.04,
                  cuts=3, rot=(78, 0, 0)))
    P.append(rbox((0.38, 0.38, 0.12), (0.05, d / 2 - 0.36, legs + 0.5), "MB_Pillow", 0.05, 3, puff=0.05, cuts=3,
                  rot=(70, 10, 6)))
    return P


# ---------------------------------------------------------------- coffee bar
def cup(x, y, z, scale=1.0, saucer=True, coffee=True):
    s = scale
    P = [lathe([(0, 0), (0.028 * s, 0), (0.034 * s, 0.01 * s), (0.042 * s, 0.06 * s), (0.044 * s, 0.07 * s),
                (0.04 * s, 0.07 * s), (0.036 * s, 0.012 * s), (0, 0.012 * s)], (x, y, z + (0.008 if saucer else 0)),
               "MB_Ceramic", 16)]
    ang = [math.radians(a) for a in range(-80, 81, 32)]
    P.append(tube([(x + (0.042 + 0.02 * math.cos(a)) * s, y, z + (0.045 + 0.02 * math.sin(a)) * s + 0.008) for a in ang],
                  0.005 * s, "MB_Ceramic", 6))
    if saucer:
        P.append(lathe([(0, 0), (0.05 * s, 0.0), (0.072 * s, 0.01 * s), (0.068 * s, 0.013 * s), (0, 0.008 * s)],
                       (x, y, z), "MB_Ceramic", 18))
    if coffee:
        P.append(cyl(0.039 * s, 0.039 * s, 0.002, (x, y, z + 0.06 * s), "MB_Coffee", 14))
    return P


def espresso_machine():
    P = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            P.append(cyl(0.02, 0.02, 0.03, (sx * 0.34, sy * 0.2, 0), "MB_Black", 8))
    P.append(rbox((0.78, 0.3, 0.12), (0, 0.1, 0.09), "MB_Steel", 0.02))              # base plinth
    P.append(rbox((0.7, 0.2, 0.035), (0, -0.14, 0.05), "MB_Steel", 0.008))           # drip tray
    for i in range(9):
        P.append(rbox((0.66, 0.008, 0.004), (0, -0.22 + i * 0.018, 0.07), "MB_Black", 0))
    P.append(rbox((0.8, 0.5, 0.2), (0, 0.0, 0.34), "MB_Paint", 0.03, 3))             # upper body
    for s in (-1, 1):
        P.append(rbox((0.07, 0.5, 0.4), (s * 0.365, 0, 0.23), "MB_Steel", 0.02))   # side columns
    P.append(rbox((0.74, 0.44, 0.02), (0, 0.02, 0.45), "MB_Steel", 0.006))           # cup tray
    for x0, x1, y0, y1 in ((-0.36, 0.36, -0.21, -0.21), (-0.36, 0.36, 0.23, 0.23), (-0.36, -0.36, -0.21, 0.23),
                           (0.36, 0.36, -0.21, 0.23)):
        P.append(tube([(x0, y0, 0.49), (x1, y1, 0.49)], 0.007, "MB_Steel", 6))
    for i in range(4):
        P += cup(-0.24 + i * 0.16, 0.05, 0.46, 0.9, saucer=False, coffee=False)
    P.append(rbox((0.66, 0.02, 0.12), (0, -0.25, 0.35), "MB_Brass", 0.006))          # front brass band
    for s in (-1, 1):
        x = s * 0.17
        P.append(cyl(0.05, 0.045, 0.07, (x, -0.2, 0.18), "MB_Steel", 16))           # group head
        P.append(cyl(0.045, 0.045, 0.035, (x, -0.2, 0.145), "MB_Steel", 16))        # portafilter basket
        P.append(tube([(x, -0.24, 0.16), (x, -0.36, 0.15), (x, -0.42, 0.14)], 0.014, "MB_DarkWood", 8))
        P.append(cyl(0.036, 0.036, 0.018, (x * 1.9, -0.26, 0.37), "MB_Brass", 18, rot=(90, 0, 0)))   # gauge rim
        P.append(cyl(0.03, 0.03, 0.02, (x * 1.9, -0.262, 0.37), "MB_Ceramic", 18, rot=(90, 0, 0)))  # gauge face
        P.append(tube([(s * 0.33, -0.2, 0.3), (s * 0.35, -0.26, 0.24), (s * 0.35, -0.27, 0.1)], 0.007, "MB_Steel", 6))
        P.append(cyl(0.012, 0.012, 0.02, (s * 0.07, -0.26, 0.4), "MB_Black", 10, rot=(90, 0, 0)))
        P += cup(x, -0.15, 0.07, 0.8, saucer=False, coffee=False)
    return P


def grinder():
    P = [rbox((0.18, 0.24, 0.05), (0, 0, 0.025), "MB_Black", 0.01),
         rbox((0.16, 0.2, 0.3), (0, 0.02, 0.2), "MB_Steel", 0.02),
         cyl(0.022, 0.02, 0.06, (0, -0.1, 0.16), "MB_Black", 10, rot=(60, 0, 0)),
         cyl(0.05, 0.09, 0.18, (0, 0.02, 0.35), "MB_Glass", 18),
         cyl(0.055, 0.075, 0.09, (0, 0.02, 0.355), "MB_Coffee", 14),
         cyl(0.092, 0.092, 0.02, (0, 0.02, 0.53), "MB_Black", 18),
         cyl(0.02, 0.02, 0.03, (0, 0.02, 0.55), "MB_Black", 10)]
    return P


def pastry(kind, x, y, z):
    gold, dark, choc = srgb(214, 150, 70), srgb(160, 92, 40), srgb(92, 56, 34)
    if kind == "croissant":
        return [sphere(0.03 * (1.2 - abs(i - 2) * 0.22), (x + (i - 2) * 0.03, y + 0.012 * abs(i - 2) ** 1.5, z + 0.02),
                       (1.0, 1.3, 0.75), "MB_VC", gold if i % 2 else dark, 8, 5) for i in range(5)]
    if kind == "muffin":
        return [cyl(0.032, 0.04, 0.04, (x, y, z), "MB_VC", 10, col=srgb(236, 226, 206)),
                sphere(0.046, (x, y, z + 0.045), (1, 1, 0.65), "MB_VC", srgb(150, 96, 60), 10, 6)]
    if kind == "cookie":
        return [cyl(0.04, 0.04, 0.012, (x + i * 0.004, y, z + i * 0.012), "MB_VC", 12, col=srgb(196, 150, 96))
                for i in range(3)]
    if kind == "roll":
        return [cyl(0.045, 0.045, 0.035, (x, y, z), "MB_VC", 14, col=srgb(202, 140, 80)),
                cyl(0.04, 0.03, 0.006, (x, y, z + 0.035), "MB_VC", 14, col=srgb(246, 240, 226))]
    return [sphere(0.045, (x, y, z + 0.022), (1, 1, 0.55), "MB_VC", choc if kind == "choc" else gold, 10, 6)]


def pastry_case():
    w, d, h = 1.36, 0.66, 0.56
    P = [rbox((w, d, 0.1), (0, 0, 0.05), "MB_Wood", 0.01),
         rbox((w, 0.03, h - 0.1), (0, d / 2 - 0.015, 0.1 + (h - 0.1) / 2), "MB_Paint", 0.005),
         rbox((w + 0.02, d + 0.02, 0.03), (0, 0, h + 0.015), "MB_Wood", 0.008)]
    for s in (-1, 1):
        P.append(rbox((0.012, d, h - 0.1), (s * (w / 2 - 0.006), 0, 0.1 + (h - 0.1) / 2), "MB_Glass", 0))
    P.append(rbox((w - 0.02, 0.01, 0.5), (0, -d / 2 + 0.1, 0.33), "MB_Glass", 0, rot=(-22, 0, 0)))
    P.append(rbox((w - 0.1, d - 0.2, 0.012), (0, 0.04, 0.32), "MB_Steel", 0.003))
    kinds = ["croissant", "muffin", "bun", "roll", "cookie", "choc"]
    for row, z in ((0, 0.1), (1, 0.326)):
        for i in range(6):
            k = kinds[(i + row * 3) % 6]
            for j in range(2):
                P += pastry(k, -w / 2 + 0.13 + i * 0.22, -0.08 + j * 0.13 + row * 0.03, z)
    return P


# ---------------------------------------------------------------- desks, books, walls
BOOK_COLS = [(64, 96, 72), (150, 70, 50), (212, 180, 120), (60, 72, 100), (180, 120, 60), (120, 40, 44),
             (236, 226, 200), (90, 110, 70), (40, 50, 60), (200, 150, 90)]


def book_row(count=14, lean_last=True):
    P, x = [], 0.0
    for i in range(count):
        t, hgt, dep = rnd.uniform(0.022, 0.05), rnd.uniform(0.19, 0.28), rnd.uniform(0.14, 0.19)
        col = srgb(*rnd.choice(BOOK_COLS))
        lean = (0, 14, 0) if (lean_last and i == count - 1) else (0, 0, 0)
        P.append(rbox((t, dep, hgt), (x + t / 2, 0, hgt / 2), "MB_VC", 0.003, 1, col=col, rot=lean))
        x += t + 0.002
    for p in P:
        p.data.transform(__import__("mathutils").Matrix.Translation((-x / 2, 0, 0)))
    return P


def book_stack():
    P, z = [], 0.0
    for i in range(4):
        t = rnd.uniform(0.025, 0.045)
        P.append(rbox((rnd.uniform(0.18, 0.24), rnd.uniform(0.13, 0.17), t), (rnd.uniform(-0.01, 0.01), 0, z + t / 2),
                      "MB_VC", 0.003, 1, col=srgb(*rnd.choice(BOOK_COLS)), rot=(0, 0, rnd.uniform(-8, 8))))
        z += t
    return P


def laptop():
    P = [rbox((0.32, 0.22, 0.014), (0, 0, 0.007), "MB_Steel", 0.004),
         rbox((0.28, 0.1, 0.002), (0, -0.02, 0.0145), "MB_Black", 0),
         rbox((0.32, 0.01, 0.21), (0, 0.11 + 0.02, 0.11), "MB_Steel", 0.004, rot=(-12, 0, 0)),
         plane(0.29, 0.18, (0, 0.123, 0.115), "MB_Screen", rot=(90 - 12, 0, 0))]
    return P


def notebook():
    return [rbox((0.15, 0.21, 0.012), (0, 0, 0.006), "MB_VC", 0.002, 1, col=srgb(64, 96, 72)),
            rbox((0.14, 0.2, 0.004), (0.004, 0, 0.013), "MB_VC", 0.001, 1, col=srgb(244, 238, 226)),
            cyl(0.004, 0.004, 0.14, (0.1, 0, 0.004), "MB_VC", 8, rot=(90, 0, 10), col=srgb(40, 40, 44))]


def framed(w, h, uv, frame_mat="MB_Wood"):
    t = 0.035
    P = [rbox((w, 0.03, t), (0, 0, h / 2 - t / 2), frame_mat, 0.006), rbox((w, 0.03, t), (0, 0, -h / 2 + t / 2), frame_mat, 0.006),
         rbox((t, 0.03, h), (-w / 2 + t / 2, 0, 0), frame_mat, 0.006), rbox((t, 0.03, h), (w / 2 - t / 2, 0, 0), frame_mat, 0.006),
         rbox((w - 2 * t, 0.01, h - 2 * t), (0, 0.005, 0), "MB_Ceramic", 0)]
    return P


def art(uv):
    return framed(0.62, 0.62, uv) + [plane(0.46, 0.46, (0, -0.002, 0), "MB_PrintArt", uv)]


def menu_board():
    w, h = 2.4, 1.2
    return framed(w + 0.12, h + 0.12, None, "MB_Wood") + [plane(w, h, (0, -0.002, 0), "MB_PrintMenu")]


def sandwich_board():
    P, w, hgt, lean = [], 0.56, 0.95, 12
    for s in (-1, 1):
        y = s * math.sin(math.radians(lean)) * hgt / 2
        rot = (s * lean, 0, 0)
        for dx in (-1, 1):
            P.append(rbox((0.035, 0.03, hgt), (dx * (w / 2 - 0.0175), y, hgt / 2 * math.cos(math.radians(lean))),
                          "MB_Wood", 0.006, rot=rot))
        P.append(rbox((w - 0.07, 0.015, hgt - 0.12), (0, y, hgt / 2 * math.cos(math.radians(lean)) + 0.02), "MB_Black",
                      0.002, rot=rot))
        ob = plane(w - 0.09, hgt - 0.16, (0, y + s * 0.009, hgt / 2 * math.cos(math.radians(lean)) + 0.02),
                   "MB_PrintSandwich", rot=(90 - lean, 0, 0) if s < 0 else (90 - lean, 0, 180))
        P.append(ob)
    return P


def sign(row):
    v0, v1 = 1 - (row + 1) / 4, 1 - row / 4
    return [rbox((0.92, 0.02, 0.14), (0, 0.012, 0), "MB_Wood", 0.004),
            plane(0.88, 0.11, (0, -0.0, 0), "MB_PrintSigns", (0, v0, 1, v1))]


PROPS = {
    "SofaLong": lambda: sofa(3.4, 3), "Sofa": lambda: sofa(2.8, 3), "Armchair": armchair,
    "EspressoMachine": espresso_machine, "Grinder": grinder, "PastryCase": pastry_case,
    "CupSaucer": lambda: cup(0, 0, 0), "BookRow": book_row, "BookStack": book_stack, "Laptop": laptop,
    "Notebook": notebook, "ArtMaple": lambda: art((0, 0.5, 0.5, 1)), "ArtCup": lambda: art((0.5, 0.5, 1, 1)),
    "ArtFronds": lambda: art((0, 0, 0.5, 0.5)), "ArtHills": lambda: art((0.5, 0, 1, 0.5)),
    "MenuBoard": menu_board, "SandwichBoard": sandwich_board,
    "SignRestrooms": lambda: sign(0), "SignStaff": lambda: sign(1), "SignMerch": lambda: sign(2),
    "SignQuiet": lambda: sign(3),
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
