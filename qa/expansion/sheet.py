"""Contact sheets for progress follow-ups.
  python qa/expansion/sheet.py grid  <out.png> <title> <img>...           labelled grid
  python qa/expansion/sheet.py pairs <out.png> <title> <before> <after>...  before/after rows
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
def font(size):
    for f in ['C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/segoeui.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()
BG, INK, MUTED = (244, 240, 232), (48, 76, 64), (126, 130, 114)
def thumb(path, w):
    im = Image.open(path).convert('RGB'); h = round(im.height * w / im.width); return im.resize((w, h), Image.LANCZOS)
def label(p): return os.path.splitext(os.path.basename(p))[0]
mode, out, title, files = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
pad, head, cap = 24, 70, 34
if mode == 'grid':
    cols, w = 3, 620
    thumbs = [thumb(f, w) for f in files]; th = max(t.height for t in thumbs); rows = -(-len(thumbs) // cols)
    sheet = Image.new('RGB', (pad + cols * (w + pad), head + rows * (th + cap + pad) + pad), BG); d = ImageDraw.Draw(sheet)
    d.text((pad, 20), title, fill=INK, font=font(30))
    for i, (t, f) in enumerate(zip(thumbs, files)):
        x, y = pad + (i % cols) * (w + pad), head + (i // cols) * (th + cap + pad)
        d.text((x, y + 4), label(f), fill=MUTED, font=font(18)); sheet.paste(t, (x, y + cap))
else:
    w = 760; pairs = list(zip(files[0::2], files[1::2]))
    rows = [(thumb(a, w), thumb(b, w), a, b) for a, b in pairs]; rh = [max(r[0].height, r[1].height) for r in rows]
    sheet = Image.new('RGB', (pad * 3 + w * 2, head + 30 + sum(h + cap + pad for h in rh) + pad), BG); d = ImageDraw.Draw(sheet)
    d.text((pad, 18), title, fill=INK, font=font(30)); d.text((pad, head), 'BEFORE', fill=MUTED, font=font(16)); d.text((pad * 2 + w, head), 'AFTER', fill=MUTED, font=font(16))
    y = head + 30
    for (a, b, fa, fb), h in zip(rows, rh):
        d.text((pad, y + 4), label(fa), fill=MUTED, font=font(18)); sheet.paste(a, (pad, y + cap)); sheet.paste(b, (pad * 2 + w, y + cap)); y += h + cap + pad
sheet.save(out, optimize=True); print(out, sheet.size)
