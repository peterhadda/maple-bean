"""Blender preview renders of a character (no Unreal lock needed).

Run: blender -b <file.blend|file.glb> --python Scripts/characters_blender_preview.py -- <out_prefix> [label]
Writes <out_prefix>_full.png (front full body) and <out_prefix>_face.png (3/4 head close-up).
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "//preview"
LABEL = argv[1] if len(argv) > 1 else ""

if bpy.data.filepath == "" and bpy.context.scene.objects == 0:
    pass
src = bpy.data.filepath
if src.endswith(".glb"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

scn = bpy.context.scene
for o in list(scn.objects):
    if o.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(o)

meshes = [o for o in scn.objects if o.type == "MESH" and o.visible_get()]
dg = bpy.context.evaluated_depsgraph_get()
zs = [(o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box]
top = max(zs)
head = next((o for o in meshes if "Expression Skin" in o.name or o.name == "Face"), None)
hz = max((o.matrix_world @ Vector(c)).z for c in head.bound_box) - 0.17 if head else top - 0.2

world = bpy.data.worlds.new("preview") if not scn.world else scn.world
scn.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.62, 0.55, 0.48, 1)
bg.inputs[1].default_value = 0.9


def light(name, kind, energy, rot, color):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if kind == "SUN":
        d.angle = math.radians(8)
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = [math.radians(a) for a in rot]
    scn.collection.objects.link(o)


light("key", "SUN", 3.2, (55, 0, -35), (1.0, 0.88, 0.74))
light("rim", "SUN", 2.0, (70, 0, 150), (0.8, 0.88, 1.0))

cam_d = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_d)
scn.collection.objects.link(cam)
scn.camera = cam

scn.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE_NEXT"
scn.render.film_transparent = False
scn.view_settings.view_transform = "AgX"
try:
    scn.eevee.taa_render_samples = 16
except AttributeError:
    pass


def shoot(path, loc, target, lens, w, h):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam_d.lens = lens
    scn.render.resolution_x, scn.render.resolution_y = w, h
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"[Preview] wrote {path}")


shoot(f"{OUT}_full.png", (0.0, -3.1, top * 0.55), (0, 0, top * 0.5), 50, 640, 960)
shoot(f"{OUT}_face.png", (-0.42, -1.05, hz + 0.02), (0, 0, hz - 0.02), 70, 800, 800)
# Front close-up from slightly above: shows the crown / parting (scalp-gap check).
shoot(f"{OUT}_front.png", (0.0, -1.0, hz + 0.16), (0, 0, hz + 0.04), 70, 800, 800)
