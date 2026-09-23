"""Paint the foliage atlas (leaf shapes with alpha, veins, colour variation) for the plant library.

Run: python Scripts/env_leaf_textures.py  ->  SourceArt/Plants/Textures/T_MB_FoliageAtlas_{D,N}.png
Coordinates are "v up" (Blender UV convention); the image is flipped on save. ATLAS in env_bl_plants.py
must match the REGIONS below (pixels, x0, y0, x1, y1 on a 2048 square).
"""
import math
import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "SourceArt", "Plants", "Textures")
S = 2048
REGIONS = {
    "fiddle": (0, 0, 512, 1024), "monstera": (512, 0, 1536, 1024), "snake": (1536, 0, 1792, 1024),
    "pothos": (1792, 0, 2048, 256), "succulent": (1792, 256, 2048, 512), "stem": (1792, 512, 2048, 768),
    "round": (1792, 768, 2048, 1024), "treeA": (0, 1024, 1024, 2048), "treeB": (1024, 1024, 2048, 2048),
}
rng = np.random.default_rng(11)
rgb = np.zeros((S, S, 3))
alpha = np.zeros((S, S))
height = np.zeros((S, S))


def noise(h, w, cells, octaves=3):
    acc = np.zeros((h, w))
    amp = 1.0
    for o in range(octaves):
        c = cells * 2 ** o
        g = rng.random((c + 2, c + 2))
        yy = np.linspace(0, c, h)
        xx = np.linspace(0, c, w)
        yi, xi = yy.astype(int), xx.astype(int)
        fy, fx = (yy - yi)[:, None], (xx - xi)[None, :]
        a = g[yi][:, xi] * (1 - fx) + g[yi][:, xi + 1] * fx
        b = g[yi + 1][:, xi] * (1 - fx) + g[yi + 1][:, xi + 1] * fx
        acc += amp * (a * (1 - fy) + b * fy)
        amp *= 0.5
    return acc / 1.75


def grid(region):
    x0, y0, x1, y1 = region
    h, w = y1 - y0, x1 - x0
    v, u = np.mgrid[0:h, 0:w]
    return (u + 0.5) / w, (v + 0.5) / h, (slice(y0, y1), slice(x0, x1))


def put(sl, col, a, hgt):
    m = a > alpha[sl]
    for c in range(3):
        rgb[sl][..., c] = np.where(m, col[..., c], rgb[sl][..., c])
    height[sl] = np.where(m, hgt, height[sl])
    alpha[sl] = np.maximum(alpha[sl], a)


def leaf_colour(u, v, dark, light, cells=6):
    """Green body: lighter along the midrib, darker toward the edge, mottled."""
    n = noise(u.shape[0], u.shape[1], cells)
    mid = np.exp(-((u - 0.5) / 0.12) ** 2)
    t = np.clip(0.35 + 0.35 * mid + (n - 0.5) * 0.5 + 0.15 * v, 0, 1)[..., None]
    return np.array(dark) * (1 - t) + np.array(light) * t, n


def veins(u, v, count, slope, width=0.012):
    """Midrib + lateral veins running outward/upward from the midrib. Returns 0..1 vein mask."""
    d = np.abs(u - 0.5)
    mid = np.clip(1 - d / 0.012, 0, 1)
    lat = np.abs(((v - slope * d) * count) % 1.0 - 0.5) * 2  # 0 on a vein line
    lat = np.clip(1 - (1 - lat) / (width * count * 2), 0, 1)
    lat = (1 - lat) * np.clip(d / 0.03, 0, 1)
    return np.maximum(mid, lat * 0.7)


def shade(sl, u, v, shape, dark, light, vein_n, vein_slope, vein_col=(0.62, 0.72, 0.36), edge_col=None):
    col, n = leaf_colour(u, v, dark, light)
    vm = veins(u, v, vein_n, vein_slope)[..., None]
    col = col * (1 - vm * 0.55) + np.array(vein_col) * vm * 0.55
    if edge_col is not None:
        e = np.clip(1 - shape / 0.05, 0, 1)[..., None]
        col = col * (1 - e) + np.array(edge_col) * e
    a = np.clip(shape * 60, 0, 1)
    put(sl, col, a, 0.6 + 0.3 * np.clip(shape * 8, 0, 1) - vm[..., 0] * 0.35 + n * 0.1)


def fiddle():
    u, v, sl = grid(REGIONS["fiddle"])
    y = (v - 0.04) / 0.92
    wav = 0.012 * np.sin(y * 38)
    half = 0.46 * np.clip(np.sin(np.clip(y, 0, 1) * math.pi) ** 0.8 * (0.55 + 0.6 * y), 0, 1) + wav
    half = np.where((y > 0) & (y < 1), half, -1)
    shape = half - np.abs(u - 0.5)
    shade(sl, u, v, shape, (0.05, 0.16, 0.03), (0.16, 0.34, 0.07), 9, 1.2)


def monstera():
    u, v, sl = grid(REGIONS["monstera"])
    x, y = (u - 0.5) * 2, (v - 0.05) / 0.9  # heart: wide at 35%, notch at the stem
    half = 0.95 * np.sin(np.clip(y, 0, 1) * math.pi) ** 0.7 * (1.1 - 0.35 * y)
    half = np.where((y > 0) & (y < 1), half, -1)
    shape = (half - np.abs(x)) / 2
    shape = np.where((y < 0.12) & (np.abs(x) < 0.12 - y), -1, shape)  # sinus at the petiole
    ang = np.arctan2(y - 0.15, np.abs(x) + 1e-4)  # fenestrations: slits from the edge along the veins
    slit = np.abs(((ang / math.pi) * 9) % 1.0 - 0.5) < 0.1
    radial = np.hypot(np.abs(x), y - 0.15)
    shape = np.where(slit & (radial > 0.45) & (y > 0.15) & (y < 0.9), -1, shape)
    holes = (np.abs(((ang / math.pi) * 9 + 0.5) % 1.0 - 0.5) < 0.06) & (np.abs(radial - 0.3) < 0.05) & (y > 0.2)
    shape = np.where(holes, -1, shape)
    shade(sl, u, v, shape, (0.03, 0.13, 0.03), (0.10, 0.29, 0.06), 7, 0.9, vein_col=(0.2, 0.36, 0.1))


def snake():
    u, v, sl = grid(REGIONS["snake"])
    y = (v - 0.02) / 0.96
    half = 0.44 * np.clip(np.clip(1 - y, 0, 1) ** 0.5 * np.clip(y * 8, 0, 1) + 0.05, 0, 1) * (y < 1) * (y > 0)
    shape = half - np.abs(u - 0.5)
    n = noise(u.shape[0], u.shape[1], 5)
    band = np.sin(v * 70 + np.sin(u * 9) * 1.5 + n * 5) * 0.5 + 0.5
    col = np.array((0.05, 0.16, 0.06)) * (1 - band[..., None]) + np.array((0.25, 0.40, 0.16)) * band[..., None]
    margin = np.clip(1 - (shape - 0.0) / 0.06, 0, 1)[..., None]
    col = col * (1 - margin) + np.array((0.75, 0.68, 0.22)) * margin
    put(sl, col, np.clip(shape * 80, 0, 1), 0.7 + band * 0.1)


def pothos():
    u, v, sl = grid(REGIONS["pothos"])
    x, y = (u - 0.5) * 2, (v - 0.06) / 0.88
    half = 0.9 * np.sin(np.clip(y, 0, 1) * math.pi) ** 0.9 * (1.15 - 0.6 * y)
    shape = np.where((y > 0) & (y < 1), half - np.abs(x), -1) / 2
    shade(sl, u, v, shape, (0.06, 0.2, 0.04), (0.2, 0.42, 0.08), 5, 1.0)
    streak = noise(u.shape[0], u.shape[1], 4)
    m = ((streak > 0.62) & (alpha[sl] > 0.5))[..., None]
    rgb[sl] = np.where(m, rgb[sl] * 0.4 + np.array((0.78, 0.74, 0.35)) * 0.6, rgb[sl])


def succulent():
    u, v, sl = grid(REGIONS["succulent"])
    y = (v - 0.05) / 0.9
    half = 0.42 * np.sin(np.clip(y, 0, 1) * math.pi * 0.85 + 0.25) * (y < 1) * (y > 0)
    shape = half - np.abs(u - 0.5)
    t = np.clip(y, 0, 1)[..., None]
    col = np.array((0.28, 0.42, 0.33)) * (1 - t) + np.array((0.45, 0.55, 0.42)) * t
    tip = np.clip((y - 0.8) / 0.2, 0, 1)[..., None]
    col = col * (1 - tip * 0.6) + np.array((0.6, 0.3, 0.28)) * tip * 0.6
    put(sl, col, np.clip(shape * 80, 0, 1), 0.8 - np.abs(u - 0.5))


def solid(name, colour):
    u, v, sl = grid(REGIONS[name])
    n = noise(u.shape[0], u.shape[1], 8)[..., None]
    put(sl, np.array(colour) * (0.85 + n * 0.3), np.ones_like(u), 0.5 + n[..., 0] * 0.1)


def round_leaf():
    u, v, sl = grid(REGIONS["round"])
    shape = 0.44 - np.hypot(u - 0.5, (v - 0.5) * 1.1)
    shade(sl, u, v, shape, (0.07, 0.2, 0.05), (0.22, 0.4, 0.1), 4, 0.8)


def tree(name, dark, light, seed_leaves):
    """A twig card: 14-18 small leaves fanned around a stem, drawn into the card."""
    x0, y0, x1, y1 = REGIONS[name]
    w = x1 - x0
    v, u = np.mgrid[0:w, 0:w]
    u, v = (u + 0.5) / w, (v + 0.5) / w
    sl = (slice(y0, y1), slice(x0, x1))
    twig = (np.abs(u - 0.5 - 0.04 * np.sin(v * 5)) < 0.008) & (v < 0.9)
    put(sl, np.zeros(u.shape + (3,)) + np.array((0.22, 0.15, 0.08)), twig.astype(float), np.full(u.shape, 0.5))
    for i in range(seed_leaves):
        t = 0.1 + 0.8 * i / seed_leaves
        side = 1 if i % 2 else -1
        ang = math.radians(90 - side * (35 + rng.random() * 30))
        cx, cy = 0.5 + 0.04 * math.sin(t * 5), t
        L = 0.2 + rng.random() * 0.09
        ex, ey = cx + math.cos(ang) * side * L * 0.55 * side, cy + math.sin(ang) * L * 0.55
        ca, sa = math.cos(ang), math.sin(ang)
        lx = (u - ex) * ca + (v - ey) * sa  # along leaf
        ly = -(u - ex) * sa + (v - ey) * ca
        s = 1 - (lx / (L / 2)) ** 2 - (ly / (L * 0.2)) ** 2
        k = rng.random()
        col = np.array(dark) * (1 - k) + np.array(light) * k
        col = col * (0.85 + 0.3 * np.clip(0.5 + lx / L, 0, 1))[..., None] * np.ones(u.shape + (3,))
        vm = np.clip(1 - np.abs(ly) / 0.003, 0, 1)[..., None]
        col = col * (1 - vm * 0.4) + np.array((0.5, 0.6, 0.3)) * vm * 0.4
        put(sl, col, np.clip(s * 20, 0, 1), 0.5 + np.clip(s, 0, 1) * 0.4)


fiddle(); monstera(); snake(); pothos(); succulent(); round_leaf()
solid("stem", (0.18, 0.27, 0.08))
tree("treeA", (0.06, 0.18, 0.04), (0.2, 0.36, 0.08), 16)
tree("treeB", (0.14, 0.24, 0.05), (0.36, 0.42, 0.1), 18)

# Dilate colour into the transparent gutter so mips don't fringe dark.
fill = rgb[alpha > 0.5].mean(axis=0)
rgb = np.nan_to_num(np.where(alpha[..., None] > 0.02, rgb, fill))
srgb = np.clip(rgb, 0, 1) ** (1 / 2.2)
img = np.dstack([srgb, alpha]) * 255
os.makedirs(OUT, exist_ok=True)
Image.fromarray(img.astype(np.uint8)[::-1], "RGBA").save(os.path.join(OUT, "T_MB_FoliageAtlas_D.png"))
dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 3.0
dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 3.0
n = np.dstack([-dx, -dy, np.ones_like(height)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)[::-1]).save(os.path.join(OUT, "T_MB_FoliageAtlas_N.png"))
print("wrote foliage atlas")
