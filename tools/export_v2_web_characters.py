"""Export the V2 cast (mb_unreal_engine/SourceArt/Characters/<name>_v2.blend, read only) for the browser game.

  blender -b mb_unreal_engine/SourceArt/Characters/<name>_v2.blend --python tools/export_v2_web_characters.py -- <name>

Writes assets/characters/<name>.glb and <name>-lod.glb:
  near: Hair ribbons + Scalp cap decimated so the whole character fits NEAR_BUDGET triangles
        (tests/character-assets.test.mjs allows 60k); morphs untouched; dense morph accessors.
  lod:  face morphs dropped except on Eyes (blink stays), everything but Eyes decimated to LOD_BUDGET.
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = argv[0] if argv else os.path.basename(bpy.data.filepath).split("_v2")[0]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "assets", "characters")
NEAR_BUDGET, LOD_BUDGET = 58500, 20000
CAP_TRIS = 1800  # scalp cap is a smooth hidden shell: a coarse version reads the same under the hair


def log(msg):
    print(f"[V2-web] {msg}", flush=True)


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH" and o.parent and o.parent.type == "ARMATURE"]


def decimate(o, ratio):
    if ratio >= 1:
        return
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("Web budget", "DECIMATE")
    mod.ratio = max(0.02, ratio)
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)


def weld(o, dist=1e-5):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(o.data)
    bm.free()


def fix_eye_morphs(o, scale=1.06):
    """V2 blends made before the generator fix shifted every Eyes key by the basis offset, so blink deltas
    kept V1 size while the eyes grew 6% and the closed lid re-opened by 6%. Scale the deltas with the head."""
    if o.get("morph_deltas_scaled") or not o.data.shape_keys:
        return
    names = {g.index: g.name for g in o.vertex_groups}
    keys = o.data.shape_keys.key_blocks
    basis = keys[0].data
    for v in o.data.vertices:
        w = min(1.0, sum(g.weight for g in v.groups if names.get(g.group) in ("head", "eye.L", "eye.R", "jaw")))
        k = 1 + (scale - 1) * w
        for kb in keys[1:]:
            kb.data[v.index].co = basis[v.index].co + (kb.data[v.index].co - basis[v.index].co) * k
    log(f"{o.name}: eye morph deltas scaled with the head")


def export(path):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_skins=True,
                              export_morph=True, export_animations=False, export_apply=False, export_yup=True,
                              export_extras=True, export_vertex_color="ACTIVE", export_try_sparse_sk=False)
    log(f"wrote {path}: {sum(tris(o) for o in meshes())} triangles")


def main():
    for o in meshes():
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = 0.0
    for o in meshes():
        if o.name.startswith("Eyes"):
            fix_eye_morphs(o)
    hair = next(o for o in meshes() if o.name.startswith("Hair") and not o.data.shape_keys)
    cap = next((o for o in meshes() if o.name.startswith("Scalp")), None)
    if cap:
        weld(cap)
        decimate(cap, CAP_TRIS / max(1, tris(cap)))
    fixed = sum(tris(o) for o in meshes() if o is not hair)
    decimate(hair, (NEAR_BUDGET - fixed) / tris(hair))
    log("near: " + ", ".join(f"{o.name}={tris(o)}" for o in meshes()))
    export(os.path.join(OUT, f"{NAME}.glb"))

    for o in meshes():
        if o.data.shape_keys and not o.name.startswith("Eyes"):
            bpy.context.view_layer.objects.active = o
            o.shape_key_clear()
    eyes = sum(tris(o) for o in meshes() if o.data.shape_keys)
    movable = [o for o in meshes() if not o.data.shape_keys]
    ratio = max(0.12, (LOD_BUDGET - eyes) / sum(tris(o) for o in movable))
    for o in movable:
        decimate(o, ratio)
    log("lod: " + ", ".join(f"{o.name}={tris(o)}" for o in meshes()))
    export(os.path.join(OUT, f"{NAME}-lod.glb"))


main()
