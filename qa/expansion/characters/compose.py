"""Side-by-side review sheets for the A1 character loop.
python qa/expansion/characters/compose.py pass1 [pass0]
Writes <pass>/compare-faces.png (reference row, optional previous pass row, this pass row)
and <pass>/compare-bodies.png from the cast-views.mjs captures.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REF = Image.open(HERE.parent.parent.parent / 'design-assets/reference/cast-and-cafe.jpg').convert('RGB')
IDS = ['maya', 'claire', 'noah', 'mara', 'jules']
FACE = {'maya': (14, 535, 124, 690), 'claire': (226, 535, 336, 690), 'noah': (435, 535, 545, 690), 'mara': (650, 535, 758, 690), 'jules': (860, 535, 970, 690)}
BODY = {'maya': (126, 535, 210, 795), 'claire': (336, 535, 418, 800), 'noah': (545, 535, 628, 690), 'mara': (758, 535, 840, 800), 'jules': (970, 535, 1050, 690)}


def fit(im, w, h):
    k = min(w / im.width, h / im.height); im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
    out = Image.new('RGB', (w, h), (243, 239, 231)); out.paste(im, ((w - im.width) // 2, (h - im.height) // 2)); return out


def sheet(rows, labels, w, h, path):
    out = Image.new('RGB', (w * len(IDS) + 90, h * len(rows)), (243, 239, 231)); d = ImageDraw.Draw(out)
    for r, (row, label) in enumerate(zip(rows, labels)):
        d.text((6, r * h + h // 2), label, fill=(60, 50, 40))
        for i, im in enumerate(row): out.paste(fit(im, w - 6, h - 6), (90 + i * w, r * h + 3))
    out.save(path); print('wrote', path)


def crop_face(p):
    im = Image.open(p).convert('RGB'); W, H = im.size; return im.crop((int(W * .22), int(H * .02), int(W * .78), int(H * .98)))


def crop_body(p):
    im = Image.open(p).convert('RGB'); W, H = im.size; return im.crop((int(W * .33), int(H * .08), int(W * .67), int(H * .95)))


passes = [HERE / a for a in sys.argv[1:]]
cur = passes[0]; prev = passes[1] if len(passes) > 1 else None
rows = [[REF.crop(FACE[i]) for i in IDS]]; labels = ['sheet']
if prev: rows.append([crop_face(prev / f'{i}-face.png') for i in IDS]); labels.append(prev.name)
rows.append([crop_face(cur / f'{i}-face.png') for i in IDS]); labels.append(cur.name)
if (cur / 'maya-face34.png').exists(): rows.append([crop_face(cur / f'{i}-face34.png') for i in IDS]); labels.append(cur.name + ' 3/4')
sheet(rows, labels, 300, 330, cur / 'compare-faces.png')
rows = [[REF.crop(BODY[i]) for i in IDS]]; labels = ['sheet']
if prev: rows.append([crop_body(prev / f'{i}-body.png') for i in IDS]); labels.append(prev.name)
rows.append([crop_body(cur / f'{i}-body.png') for i in IDS]); labels.append(cur.name)
sheet(rows, labels, 260, 520, cur / 'compare-bodies.png')
