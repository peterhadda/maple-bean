"""Room shells for the wings missing from the floor plan (Blender, headless). Authored in WORLD centimetres.

Run: Scripts/env_blender.sh Scripts/env_bl_rooms.py
Writes SourceArt/Props/SM_MB_Room_<Name>.fbx; env_rooms.py places each one at the world origin.
Unreal flips Y on FBX import, so every Blender y here is -Y(world). Slots: MB_Plaster, MB_Wainscot, MB_Dado,
MB_Floor, MB_Tile, MB_Foundation. Walls are 380 cm tall like the café's.
  QuietNooks: x 1000..1720, y 220..700 (front-right, beside the study). Rebuilds the main room's east wall
              (x = 1000, y -35..700) with a doorway at y 360..500.
  WestWing:   x -1500..-1000, y -650..250: restroom lobby + 2 restrooms (y < -110) and staff/storage (y > -110).
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import env_bl_lib as L  # noqa: E402
from env_bl_shapes import join, rbox  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "SourceArt", "Props")
H, T = 380.0, 24.0


def box(x0, x1, y0, y1, z0, z1, mat, bevel=0.0):
    """World-cm AABB -> part (metres, Y flipped)."""
    return rbox(((x1 - x0) / 100, (y1 - y0) / 100, (z1 - z0) / 100),
                ((x0 + x1) / 200, -(y0 + y1) / 200, (z0 + z1) / 200), mat, bevel / 100, 1)


def wall(axis, c, a0, a1, openings=(), z0=0.0, z1=H, t=T, mat="MB_Plaster"):
    """Wall along `axis` ('x' or 'y') at cross coordinate c from a0 to a1; openings = [(b0, b1, zb, zt)]."""
    P, cuts = [], sorted(openings)
    pos = a0
    for b0, b1, zb, zt in cuts:
        if b0 > pos:
            P.append(_seg(axis, c, pos, b0, z0, z1, t, mat))
        if zb > z0:
            P.append(_seg(axis, c, b0, b1, z0, zb, t, mat))
        if zt < z1:
            P.append(_seg(axis, c, b0, b1, zt, z1, t, mat))
        pos = b1
    if pos < a1:
        P.append(_seg(axis, c, pos, a1, z0, z1, t, mat))
    return P


def _seg(axis, c, a0, a1, z0, z1, t, mat):
    return box(a0, a1, c - t / 2, c + t / 2, z0, z1, mat) if axis == "x" else box(c - t / 2, c + t / 2, a0, a1, z0, z1, mat)


def dressing(axis, c, a0, a1, openings=(), side=1, tile=False):
    """Green (or tiled) wainscot + oak dado rail on one face of a wall; side = +1/-1 along the cross axis."""
    off = side * (T / 2 + 4)
    P = wall(axis, c + off, a0, a1, [(b0, b1, 0, 400) for b0, b1, *_ in openings], 0, 116, 8,
             "MB_Tile" if tile else "MB_Wainscot")
    P += wall(axis, c + side * (T / 2 + 7), a0, a1, [(b0, b1, 0, 400) for b0, b1, *_ in openings], 114, 122, 14,
              "MB_Dado")
    return P


def casing(axis, c, b0, b1, top, depth=T + 12):
    """Oak door casing around an opening (both faces at once: depth spans the wall)."""
    P = [_seg(axis, c, b0 - 8, b0, 0, top + 8, depth, "MB_Dado"), _seg(axis, c, b1, b1 + 8, 0, top + 8, depth, "MB_Dado"),
         _seg(axis, c, b0 - 8, b1 + 8, top, top + 10, depth, "MB_Dado")]
    return P


def slab(x0, x1, y0, y1, mat):
    return [box(x0, x1, y0, y1, -2, 0, mat), box(x0 - 20, x1 + 20, y0 - 20, y1 + 20, -32, -2, "MB_Foundation")]


def quiet_nooks():
    P = slab(1012, 1708, 232, 688, "MB_Floor")
    door = [(360, 500, 0, 260)]
    P += wall("y", 1000, -35, 700, door)                                   # rebuilt main-room east wall
    P += dressing("y", 1000, -35, 688, door, side=-1)                      # main-room face
    P += dressing("y", 1000, 232, 688, door, side=1)                       # nook face
    P += casing("y", 1000, 360, 500, 260)
    P += wall("y", 1720, 208, 712)                                         # east
    P += dressing("y", 1720, 232, 688, side=-1)
    wins = [(1150, 1350, 90, 300), (1450, 1650, 90, 300)]
    P += wall("x", 700, 988, 1732, wins)                                   # front, two windows
    P += dressing("x", 700, 1012, 1708, [(b0, b1) for b0, b1, *_ in wins], side=-1)
    for b0, b1, zb, zt in wins:
        P.append(box(b0 - 4, b1 + 4, 680, 720, zb - 6, zb, "MB_Dado"))
        P.append(box((b0 + b1) / 2 - 3, (b0 + b1) / 2 + 3, 696, 704, zb, zt, "MB_Dado"))
        P.append(box(b0, b1, 696, 704, (zb + zt) / 2 + 30, (zb + zt) / 2 + 36, "MB_Dado"))
    cols = [(1012, 1708, 232, 688, 1), (988, 1012, -35, 360, 1), (988, 1012, 500, 700, 1), (1708, 1732, 208, 712, 1),
            (988, 1732, 688, 712, 1)]
    colliders = [((a + b) / 200, -(c + d) / 200, 1.9 if i else -0.01, (b - a) / 100, (d - c) / 100, 3.8 if i else 0.02)
                 for i, (a, b, c, d, _) in enumerate(cols)]
    return P, colliders


def west_wing():
    P = slab(-1488, -1012, -638, -110, "MB_Tile") + [box(-1488, -1012, -110, 238, -2, 0, "MB_Floor"),
                                                   box(-1508, -992, -90, 258, -32, -2, "MB_Foundation")]
    P += wall("y", -1500, -662, 262)                                       # west (outer)
    P += wall("x", -650, -1512, -988)                                      # north
    P += wall("x", 250, -1512, -988, [(-1400, -1150, 100, 290)])           # south, staff-room window
    P += wall("x", -110, -1500, -1012, t=12)                               # restrooms | staff
    doors = [(-600, -500, 0, 215), (-330, -230, 0, 215)]
    P += wall("y", -1150, -650, -110, doors, t=12)                         # lobby | restrooms
    P += wall("x", -380, -1500, -1150, t=12)                               # restroom A | B
    for y0, y1 in ((-638, -386), (-374, -116)):
        P += dressing("y", -1500, y0, y1, side=1, tile=True)
    P += dressing("y", -1150, -638, -116, [(d0, d1) for d0, d1, *_ in doors], side=1, tile=True)
    for d0, d1, _, top in doors:
        P += casing("y", -1150, d0, d1, top, depth=24)
    P += dressing("y", -1500, -104, 238, side=1)                           # staff room wainscot
    return P, []


ROOMS = {"QuietNooks": quiet_nooks, "WestWing": west_wing}

if __name__ == "__main__":
    L.clear()
    for name, fn in ROOMS.items():
        parts, colliders = fn()
        ob = join(parts, f"SM_MB_Room_{name}")
        L.export_fbx(ob, os.path.join(OUT, f"SM_MB_Room_{name}.fbx"), colliders)
        bpy.data.objects.remove(ob, do_unlink=True)
