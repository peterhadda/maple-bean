"""Export the Unreal edition's procedural plants and key props to web GLB (assets/env/).

Run: "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python scripts/export-env-glb.py
Reads mb_unreal_engine/SourceArt/{Plants,Props}/SM_MB_*.fbx (Z up, metres, fronts face -Y) and writes
assets/env/plants.glb and assets/env/props.glb (Y up, fronts face +Z). Colours for untextured slots are
assigned at runtime by slot name (assets/env-art.js); only textured slots carry images here.
"""
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SRC = os.path.join(ROOT, "mb_unreal_engine", "SourceArt")
OUT = os.path.join(ROOT, "assets", "env")
PLANTS = ["FiddleLeafFig", "Monstera", "SnakePlant", "PothosHanging", "PothosShelf", "Succulent", "TreeRound", "TreeTall"]
PROPS = ["EspressoMachine", "Grinder", "PastryCase", "Sofa", "SofaLong", "Armchair", "CupSaucer", "BookStack",
         "Bench", "BikeRack", "StreetLamp", "SandwichBoard", "FloorLamp"]
TEXTURES = {  # slot -> (folder, file, max size)
    "MB_Foliage": ("Plants", "T_MB_FoliageAtlas_D.png", 1024),
    "MB_PrintSandwich": ("Props", "T_MB_SandwichBoard_D.png", 512),
    "MB_PrintMenu": ("Props", "T_MB_ChalkMenu_D.png", 1024),
    "MB_PrintArt": ("Props", "T_MB_ArtPrints_D.png", 512),
    "MB_PrintSigns": ("Props", "T_MB_Signs_D.png", 512),
}


def import_fbx(folder, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, folder, f"SM_MB_{name}.fbx"))
    new = [o for o in bpy.data.objects if o not in before]
    mesh = None
    for o in new:
        if o.type != "MESH" or o.name.startswith("UCX_"):
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            mesh = o
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mesh.location = (0, 0, 0)
    mesh.name = mesh.data.name = name
    d = mesh.dimensions
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    print(f"[ENV] {name}: {d.x:.2f} x {d.y:.2f} x {d.z:.2f} m, {tris} tris, "
          f"z {min(v.co.z for v in mesh.data.vertices):.3f}..{max(v.co.z for v in mesh.data.vertices):.3f}")
    return mesh


def dress_material(m):
    base = m.name.split(".")[0]
    m.name = base
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return
    for link in list(bsdf.inputs["Base Color"].links):
        nt.links.remove(link)
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    if base in TEXTURES:
        folder, file, size = TEXTURES[base]
        img = bpy.data.images.load(os.path.join(SRC, folder, "Textures", file), check_existing=True)
        if max(img.size) > size:
            img.scale(size, size * img.size[1] // img.size[0])
        img.file_format = "PNG"
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if base == "MB_Foliage":
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])


def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
              export_texcoords=True, export_normals=True, export_materials="EXPORT", export_cameras=False,
              export_lights=False, export_animations=False, export_image_format="AUTO")
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    print(f"[ENV] wrote {path}: {os.path.getsize(path) / 1024:.0f} KB")


bpy.ops.wm.read_factory_settings(use_empty=True)
os.makedirs(OUT, exist_ok=True)
plants = [import_fbx("Plants", n) for n in PLANTS]
props = [import_fbx("Props", n) for n in PROPS]
for m in bpy.data.materials:
    dress_material(m)
export(plants, os.path.join(OUT, "plants.glb"))
export(props, os.path.join(OUT, "props.glb"))
