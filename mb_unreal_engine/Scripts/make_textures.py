"""Generate the tileable textures Starter Content lacks (fabric weave, soft plaster).

Run: python Scripts/make_textures.py   (writes SourceArt/Textures/*.png; lookdev.py imports them)
Plain numpy so it's reproducible and needs no downloads.
"""
import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "SourceArt", "Textures")
N = 1024
rng = np.random.default_rng(7)


def tile_noise(scale, octaves=4):
    """Tileable value noise in [0, 1] (bilinear upsampling of wrapped random grids)."""
    acc = np.zeros((N, N))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cells = scale * 2 ** o
        grid = rng.random((cells, cells))
        grid = np.pad(grid, ((0, 1), (0, 1)), mode="wrap")
        t = np.linspace(0, cells, N, endpoint=False)
        i = t.astype(int)
        f = t - i
        f = f * f * (3 - 2 * f)
        a = grid[i][:, i] * (1 - f)[None, :] + grid[i][:, i + 1] * f[None, :]
        b = grid[i + 1][:, i] * (1 - f)[None, :] + grid[i + 1][:, i + 1] * f[None, :]
        acc += amp * (a * (1 - f)[:, None] + b * f[:, None])
        total += amp
        amp *= 0.5
    return acc / total


def height_to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.dstack([-dx, -dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def save(name, arr):
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(arr).save(os.path.join(OUT, name))
    print("wrote", name)


# Fabric: plain weave (over/under threads) with slub variation, 64 threads per tile.
y, x = np.mgrid[0:N, 0:N] / N * 64 * 2 * np.pi
warp = (np.sin(x) * 0.5 + 0.5) ** 0.6
weft = (np.sin(y) * 0.5 + 0.5) ** 0.6
checker = (np.sin(x / 2) * np.sin(y / 2)) > 0
weave = np.where(checker, warp * 0.8 + weft * 0.2, weft * 0.8 + warp * 0.2)
slub = tile_noise(8, 3)
fabric_h = weave * 0.85 + slub * 0.15
save("T_MB_Fabric_N.png", height_to_normal(fabric_h, 2.2))
fabric_d = np.clip(0.62 + (fabric_h - 0.5) * 0.35 + (slub - 0.5) * 0.12, 0, 1)
save("T_MB_Fabric_D.png", (np.dstack([fabric_d] * 3) * 255).astype(np.uint8))

# Plaster: soft trowel undulation + fine grain.
plaster_h = tile_noise(4, 5) * 0.8 + tile_noise(64, 2) * 0.2
save("T_MB_Plaster_N.png", height_to_normal(plaster_h, 3.0))
plaster_d = np.clip(0.8 + (plaster_h - 0.5) * 0.18, 0, 1)
save("T_MB_Plaster_D.png", (np.dstack([plaster_d] * 3) * 255).astype(np.uint8))
