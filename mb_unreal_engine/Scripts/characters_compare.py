"""Before/after contact sheets from the Blender previews (plain Python + Pillow, no Unreal, no Blender).

Run: python Scripts/characters_compare.py   -> SourceArt/Characters/preview/compare_<name>.png + compare_all.png
"""
import os

from PIL import Image, ImageDraw

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "SourceArt", "Characters", "preview")
NAMES = ("maya", "claire", "noah", "mara", "jules")


def load(name, v, kind, h):
    p = os.path.join(DIR, f"{name}_{v}_{kind}.png")
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert("RGB")
    return im.resize((round(im.width * h / im.height), h))


def sheet(name, h=520):
    tiles = [load(name, v, k, h) for k in ("full", "face") for v in ("v1", "v2")]
    if not all(tiles):
        return None
    out = Image.new("RGB", (sum(t.width for t in tiles) + 10 * 3, h + 30), (245, 240, 232))
    d, x = ImageDraw.Draw(out), 0
    for t, label in zip(tiles, ("v1 full", "v2 full", "v1 face", "v2 face")):
        out.paste(t, (x, 30))
        d.text((x + 8, 8), f"{name} {label}", fill=(40, 30, 20))
        x += t.width + 10
    out.save(os.path.join(DIR, f"compare_{name}.png"))
    return out


sheets = [s for s in (sheet(n) for n in NAMES) if s]
if sheets:
    w = max(s.width for s in sheets)
    allim = Image.new("RGB", (w, sum(s.height for s in sheets)), (245, 240, 232))
    y = 0
    for s in sheets:
        allim.paste(s, (0, y))
        y += s.height
    allim.save(os.path.join(DIR, "compare_all.png"))
    print(f"[Compare] {len(sheets)} sheets -> {DIR}")
