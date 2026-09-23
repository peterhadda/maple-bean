"""Paint the printed/lettered textures for props: chalk menu, sandwich board, art prints, room signs.

Run: python Scripts/env_print_textures.py  ->  SourceArt/Props/Textures/*.png
UV conventions (Blender v-up) live in env_bl_props.py; images here are drawn top-down as usual.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "SourceArt", "Props", "Textures")
FONTS = "C:/Windows/Fonts"
rnd = random.Random(4)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def chalk_ground(w, h):
    """Slate green-black board with chalk smudges."""
    img = Image.new("RGB", (w, h), (34, 40, 36))
    d = ImageDraw.Draw(img)
    for _ in range(int(w * h / 900)):
        x, y = rnd.randrange(w), rnd.randrange(h)
        r = rnd.randint(8, 60)
        c = rnd.randint(38, 52)
        d.ellipse((x - r, y - r // 2, x + r, y + r // 2), fill=(c, c + 6, c + 2))
    return img.filter(ImageFilter.GaussianBlur(10))


def chalk_text(img, xy, text, f, fill=(236, 232, 220), anchor="la"):
    """Text with a grainy chalk edge (draw, then knock out random pixels)."""
    layer = Image.new("L", img.size, 0)
    ImageDraw.Draw(layer).text(xy, text, font=f, fill=255, anchor=anchor)
    px = layer.load()
    bbox = layer.getbbox()
    if bbox:
        for _ in range((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) // 5):
            x, y = rnd.randrange(bbox[0], bbox[2]), rnd.randrange(bbox[1], bbox[3])
            px[x, y] = int(px[x, y] * rnd.uniform(0.3, 0.8))
    img.paste(Image.new("RGB", img.size, fill), (0, 0), layer)


def leaf_doodle(d, cx, cy, s, col, width=5):
    pts = [(cx + s * math.sin(t / 20 * math.pi) * 0.45 * (1 if i < 21 else -1), cy - s * (t / 20))
           for i, t in enumerate(list(range(21)) + list(range(20, -1, -1)))]
    d.line(pts, fill=col, width=width, joint="curve")
    d.line([(cx, cy + s * 0.15), (cx, cy - s)], fill=col, width=width)


def menu():
    w, h = 2048, 1024
    img = chalk_ground(w, h)
    d = ImageDraw.Draw(img)
    chalk_text(img, (w // 2, 70), "Maple Bean", font("segoeprb.ttf", 120), anchor="ma")
    chalk_text(img, (w // 2, 232), "~ brewed slowly, shared warmly ~", font("Inkfree.ttf", 44), (214, 190, 140), "ma")
    cols = [("COFFEE", [("Espresso", "3.00"), ("Cortado", "3.75"), ("Flat White", "4.25"), ("Maple Latte", "4.80"),
                        ("Pour Over", "4.50"), ("Cold Brew", "4.25")]),
            ("TEA & MORE", [("Forest Tea", "3.00"), ("Chai Latte", "4.25"), ("Matcha", "4.75"),
                            ("Hot Cocoa", "3.75"), ("Lemonade", "3.50")]),
            ("BAKERY", [("Maple Bun", "5.00"), ("Croissant", "3.50"), ("Blueberry Muffin", "3.75"),
                        ("Choc Chip Cookie", "2.50"), ("Banana Bread", "3.75")])]
    item_f, price_f, head_f = font("segoepr.ttf", 46), font("segoeprb.ttf", 46), font("segoeprb.ttf", 64)
    colours = [(240, 200, 120), (170, 214, 160), (238, 160, 130)]
    for i, (head, items) in enumerate(cols):
        x0 = 90 + i * 660
        chalk_text(img, (x0, 300), head, head_f, colours[i])
        d.line([(x0, 385), (x0 + 520, 382)], fill=colours[i], width=4)
        for j, (name, price) in enumerate(items):
            y = 420 + j * 92
            chalk_text(img, (x0, y), name, item_f)
            chalk_text(img, (x0 + 560, y), price, price_f, (240, 225, 190), "ra")
    for x, y, s in ((140, 150, 90), (1900, 160, 90), (1010, 960, 60)):
        leaf_doodle(d, x, y, s, (170, 214, 160))
    d.rectangle((24, 24, w - 24, h - 24), outline=(200, 196, 186), width=5)
    return img


def sandwich():
    w, h = 512, 1024
    img = chalk_ground(w, h)
    d = ImageDraw.Draw(img)
    chalk_text(img, (w // 2, 70), "Come in,", font("segoeprb.ttf", 70), anchor="ma")
    chalk_text(img, (w // 2, 160), "slow down.", font("segoeprb.ttf", 70), (240, 200, 120), "ma")
    d.ellipse((150, 380, 362, 500), outline=(236, 232, 220), width=8)  # cup
    d.arc((340, 405, 420, 475), -90, 90, fill=(236, 232, 220), width=8)
    for k in range(3):
        d.line([(210 + k * 45, 365), (225 + k * 45, 325), (205 + k * 45, 285)], fill=(214, 190, 140), width=6)
    chalk_text(img, (w // 2, 540), "Maple Latte", font("segoepr.ttf", 58), anchor="ma")
    chalk_text(img, (w // 2, 615), "4.80", font("segoeprb.ttf", 64), (240, 200, 120), "ma")
    chalk_text(img, (w // 2, 720), "free wifi", font("Inkfree.ttf", 52), (170, 214, 160), "ma")
    chalk_text(img, (w // 2, 800), "study room", font("Inkfree.ttf", 52), (170, 214, 160), "ma")
    chalk_text(img, (w // 2, 880), "board games", font("Inkfree.ttf", 52), (170, 214, 160), "ma")
    return img


def prints():
    """2x2 atlas of 512 prints: maple leaf, coffee line art, botanical, sunset hills."""
    img = Image.new("RGB", (1024, 1024), (240, 232, 214))
    d = ImageDraw.Draw(img)
    # A: maple leaf on terracotta
    d.rectangle((0, 0, 511, 511), fill=(184, 98, 64))
    leaf = [(256, 70), (290, 170), (380, 130), (350, 230), (450, 250), (340, 320), (360, 390), (270, 350),
            (262, 450), (250, 450), (242, 350), (152, 390), (172, 320), (62, 250), (162, 230), (132, 130), (222, 170)]
    d.polygon(leaf, fill=(246, 226, 196))
    d.line([(256, 120), (256, 450)], fill=(184, 98, 64), width=6)
    # B: coffee cup line art on cream
    d.rectangle((512, 0, 1023, 511), fill=(244, 236, 220))
    d.rounded_rectangle((640, 210, 860, 400), 40, outline=(60, 50, 44), width=10)
    d.arc((830, 250, 920, 350), -90, 90, fill=(60, 50, 44), width=10)
    d.ellipse((600, 400, 900, 450), outline=(60, 50, 44), width=10)
    for k in range(3):
        d.line([(700 + k * 50, 180), (715 + k * 50, 130), (695 + k * 50, 80)], fill=(184, 98, 64), width=8)
    # C: botanical fronds on sage
    d.rectangle((0, 512, 511, 1023), fill=(150, 170, 140))
    for k in range(5):
        x = 90 + k * 85
        d.line([(x, 980), (x + 20, 600)], fill=(52, 80, 56), width=6)
        for j in range(8):
            y = 950 - j * 45
            d.ellipse((x - 45, y - 14, x + 5, y + 10), fill=(62, 96, 66))
            d.ellipse((x + 5, y - 30, x + 55, y - 6), fill=(72, 108, 72))
    # D: layered hills at sunset
    d.rectangle((512, 512, 1023, 1023), fill=(244, 206, 150))
    d.ellipse((700, 600, 830, 730), fill=(236, 150, 90))
    for k, col in enumerate(((196, 120, 80), (132, 110, 80), (70, 92, 70))):
        y = 760 + k * 70
        d.polygon([(512, 1023), (512, y)] + [(512 + i * 32, y - 40 * math.sin(i / 3 + k)) for i in range(17)]
                  + [(1023, 1023)], fill=col)
    return img


def signs():
    """1024x512: four 1024x128 plaques (green on cream / cream on green)."""
    img = Image.new("RGB", (1024, 512), (246, 238, 222))
    d = ImageDraw.Draw(img)
    f = font("georgiab.ttf", 72)
    for i, (text, dark) in enumerate((("RESTROOMS", True), ("STAFF ONLY", False), ("MERCH", True),
                                      ("QUIET NOOKS", False))):
        y0 = i * 128
        bg, fg = ((40, 74, 56), (246, 238, 222)) if dark else ((246, 238, 222), (40, 74, 56))
        d.rectangle((0, y0, 1023, y0 + 127), fill=bg)
        d.rectangle((10, y0 + 10, 1013, y0 + 117), outline=fg, width=4)
        d.text((512, y0 + 64), text, font=f, fill=fg, anchor="mm")
    return img


os.makedirs(OUT, exist_ok=True)
for name, fn in (("T_MB_ChalkMenu_D", menu), ("T_MB_SandwichBoard_D", sandwich), ("T_MB_ArtPrints_D", prints),
                 ("T_MB_Signs_D", signs)):
    fn().save(os.path.join(OUT, f"{name}.png"))
    print("wrote", name)
