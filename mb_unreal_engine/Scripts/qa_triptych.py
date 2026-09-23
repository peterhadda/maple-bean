"""Side-by-side QA boards: web build (current) | Unreal | target, one PNG per shot.

Plain Python + Pillow (not an Unreal script):
    python Scripts/qa_triptych.py <tag> [ue_dir]
ue_dir defaults to mb_unreal_engine/Saved/QA/<tag>. Output: docs/unreal/qa/<tag>/ (the raw UE shots are copied too).
"""
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
REPO = os.path.dirname(PROJ)
DOCS = os.path.join(REPO, "docs")

WEB = {"characters": "images/characters.png"}
TARGET = {"characters": "unreal/targets/target-characters-moodboard.png"}
for shot in ("overview", "entrance_to_bar", "coffee_bar", "study_room"):
    WEB[shot] = "images/cafe-overview.png"
    TARGET[shot] = "unreal/targets/target-environment-floorplan.png"

H = 540  # panel height
LABEL = 34


def font(size):
    for name in ("segoeui.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def panel(path, title):
    img = Image.open(path).convert("RGB") if path and os.path.isfile(path) else Image.new("RGB", (H * 16 // 9, H), (40, 40, 40))
    img = img.resize((max(1, round(img.width * H / img.height)), H), Image.LANCZOS)
    out = Image.new("RGB", (img.width, H + LABEL), (24, 22, 20))
    out.paste(img, (0, LABEL))
    ImageDraw.Draw(out).text((12, 5), title, fill=(240, 230, 215), font=font(20))
    return out


def board(shot, ue_png, out_png):
    panels = [panel(os.path.join(DOCS, WEB.get(shot, "")), "Web build (current)"),
              panel(ue_png, f"Unreal: {shot}"),
              panel(os.path.join(DOCS, TARGET.get(shot, "")), "Target")]
    gap = 8
    w = sum(p.width for p in panels) + gap * (len(panels) - 1)
    out = Image.new("RGB", (w, H + LABEL), (12, 12, 12))
    x = 0
    for p in panels:
        out.paste(p, (x, 0))
        x += p.width + gap
    out.save(out_png)


def main():
    tag = sys.argv[1]
    ue_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(PROJ, "Saved", "QA", tag)
    dst = os.path.join(DOCS, "unreal", "qa", tag)
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(ue_dir)):
        if not f.lower().endswith(".png"):
            continue
        shot = os.path.splitext(f)[0]
        shutil.copy2(os.path.join(ue_dir, f), os.path.join(dst, f))
        board(shot, os.path.join(ue_dir, f), os.path.join(dst, f"{shot}_triptych.png"))
        print(os.path.join(dst, f"{shot}_triptych.png"))


if __name__ == "__main__":
    main()
