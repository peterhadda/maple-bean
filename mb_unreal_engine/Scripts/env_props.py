"""Prop/furniture/room assets: import the Blender FBX library and give every slot a material.

Imported by env_dress.py (which places things); not run on its own.
Masters made here (in /Game/MapleBean/Props/Materials): M_MB_VertexColor, M_MB_Print, M_MB_Glass.
Everything else is an instance of lookdev's M_MB_Surface, reusing the café palette instances where one exists.
"""
import glob
import os

import unreal
from env_common import (MEL, PROJECT, SC, MB_TEX, at, eal, lin, log, import_texture, import_fbx, surface_mi,
                        assign_slots)

PROPS = "/Game/MapleBean/Props"
MATS = f"{PROPS}/Materials"
PAL = "/Game/MapleBean/Materials/Instances"
SRC = os.path.join(PROJECT, "SourceArt", "Props")
ROOM_DIR = "/Game/MapleBean/Environment/Rooms"


def _param(m, cls, name, default, x, y):
    n = MEL.create_material_expression(m, cls, x, y)
    n.set_editor_property("parameter_name", name)
    n.set_editor_property("default_value", default)
    return n


def _master(name, setup):
    path = f"{MATS}/{name}"
    if eal.does_asset_exist(path):
        return unreal.load_asset(path)
    m = at.create_asset(name, MATS, unreal.Material, unreal.MaterialFactoryNew())
    setup(m)
    MEL.recompile_material(m)
    eal.save_loaded_asset(m)
    log(f"{name} built")
    return m


def _vc(m):
    vc = MEL.create_material_expression(m, unreal.MaterialExpressionVertexColor, -600, 0)
    tint = _param(m, unreal.MaterialExpressionVectorParameter, "Tint", unreal.LinearColor(1, 1, 1, 1), -600, -200)
    mul = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -300, -100)
    MEL.connect_material_expressions(vc, "RGB", mul, "A")
    MEL.connect_material_expressions(tint, "", mul, "B")
    MEL.connect_material_property(mul, "", unreal.MaterialProperty.MP_BASE_COLOR)
    rough = _param(m, unreal.MaterialExpressionScalarParameter, "Roughness", 0.7, -300, 150)
    MEL.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)


def _print(m):
    tex = MEL.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -700, 0)
    tex.set_editor_property("parameter_name", "Print")
    tex.set_editor_property("texture", unreal.load_asset(f"{MB_TEX}/T_MB_Plaster_D"))
    tint = _param(m, unreal.MaterialExpressionVectorParameter, "Tint", unreal.LinearColor(1, 1, 1, 1), -700, -200)
    mul = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -400, -100)
    MEL.connect_material_expressions(tex, "RGB", mul, "A")
    MEL.connect_material_expressions(tint, "", mul, "B")
    MEL.connect_material_property(mul, "", unreal.MaterialProperty.MP_BASE_COLOR)
    glow = _param(m, unreal.MaterialExpressionScalarParameter, "Emissive", 0.0, -400, 100)
    em = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -200, 100)
    MEL.connect_material_expressions(mul, "", em, "A")
    MEL.connect_material_expressions(glow, "", em, "B")
    MEL.connect_material_property(em, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.connect_material_property(_param(m, unreal.MaterialExpressionScalarParameter, "Roughness", 0.85, -200, 250),
                                  "", unreal.MaterialProperty.MP_ROUGHNESS)


def _glass(m):
    m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    m.set_editor_property("translucency_lighting_mode", unreal.TranslucencyLightingMode.TLM_SURFACE)
    m.set_editor_property("two_sided", True)
    tint = _param(m, unreal.MaterialExpressionVectorParameter, "Tint", unreal.LinearColor(0.8, 0.85, 0.82, 1), -400, -100)
    MEL.connect_material_property(tint, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(_param(m, unreal.MaterialExpressionScalarParameter, "Opacity", 0.18, -400, 100), "",
                                  unreal.MaterialProperty.MP_OPACITY)
    MEL.connect_material_property(_param(m, unreal.MaterialExpressionScalarParameter, "Roughness", 0.05, -400, 200), "",
                                  unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(_param(m, unreal.MaterialExpressionScalarParameter, "Specular", 0.9, -400, 300), "",
                                  unreal.MaterialProperty.MP_SPECULAR)


def _inst(parent, name, vectors=None, scalars=None, textures=None):
    path = f"{MATS}/{name}"
    mi = unreal.load_asset(path) if eal.does_asset_exist(path) else at.create_asset(
        name, MATS, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, parent)
    for k, v in (vectors or {}).items():
        MEL.set_material_instance_vector_parameter_value(mi, k, v)
    for k, v in (scalars or {}).items():
        MEL.set_material_instance_scalar_parameter_value(mi, k, v)
    for k, v in (textures or {}).items():
        MEL.set_material_instance_texture_parameter_value(mi, k, v)
    MEL.update_material_instance(mi)
    eal.save_loaded_asset(mi)
    return mi


def build_materials():
    _master("M_MB_VertexColor", _vc)
    prm = _master("M_MB_Print", _print)
    gls = _master("M_MB_Glass", _glass)
    tex = {}
    for f in sorted(glob.glob(os.path.join(SRC, "Textures", "*.png"))):
        t = import_texture(f, f"{PROPS}/Textures")
        tex[os.path.splitext(os.path.basename(f))[0]] = t
    pal = lambda n: unreal.load_asset(f"{PAL}/MI_MB_{n}")  # noqa: E731
    plaster, fabric = (f"{MB_TEX}/T_MB_Plaster_D", f"{MB_TEX}/T_MB_Plaster_N"), (f"{MB_TEX}/T_MB_Fabric_D", f"{MB_TEX}/T_MB_Fabric_N")
    steel = (f"{SC}/T_Metal_Steel_D", f"{SC}/T_Metal_Steel_N")
    return {
        "Upholstery": pal("sage_upholstery"), "Pillow": pal("linen"), "Wood": pal("honey_oak"),
        "DarkWood": pal("espresso"), "Brass": pal("aged_brass"), "Paint": pal("forest_green"),
        "Coffee": surface_mi("MI_MB_CoffeeLiquid", MATS, lin(58, 34, 20), *plaster, detail=0.0, normal=0.0, rough=0.15),
        "Screen": pal("arcade_screen"), "Soil": unreal.load_asset("/Game/MapleBean/Plants/Materials/MI_MB_Soil"),
        "Ceramic": unreal.load_asset("/Game/MapleBean/Plants/Materials/MI_MB_PotCream"),
        "Steel": surface_mi("MI_MB_Steel", MATS, lin(190, 190, 194), *steel, uv=2.0, detail=0.3, normal=0.3, rough=0.28,
                            metal=1.0),
        "Black": surface_mi("MI_MB_BlackPlastic", MATS, lin(22, 22, 24), *plaster, detail=0.1, normal=0.1, rough=0.45),
        "Iron": surface_mi("MI_MB_Iron", MATS, lin(30, 32, 30), *steel, uv=2.0, detail=0.3, normal=0.4, rough=0.55,
                           metal=0.6),
        "Porcelain": surface_mi("MI_MB_Porcelain", MATS, lin(236, 234, 228), *plaster, detail=0.05, normal=0.1, rough=0.15),
        "Mirror": surface_mi("MI_MB_Mirror", MATS, lin(230, 232, 235), *plaster, detail=0.0, normal=0.0, rough=0.03,
                             metal=1.0),
        "LampGlass": surface_mi("MI_MB_LampGlass", MATS, lin(255, 214, 150), *plaster, detail=0.0, normal=0.0,
                                rough=0.3, emissive=8.0),
        "Shade": surface_mi("MI_MB_LampShade", MATS, lin(240, 222, 190), *fabric, uv=6.0, detail=0.3, normal=0.4,
                            rough=0.9, emissive=1.2),
        "Rug": surface_mi("MI_MB_RugNook", MATS, lin(170, 96, 64), *fabric, uv=10.0, detail=0.4, normal=0.6, rough=0.95),
        "Tile": surface_mi("MI_MB_Tile", MATS, lin(222, 216, 204), f"{SC}/T_Concrete_Poured_D", f"{SC}/T_Concrete_Poured_N",
                           uv=3.0, detail=0.15, normal=0.3, rough=0.35),
        "Plaster": pal("warm_plaster"), "Wainscot": pal("forest_green"), "Dado": pal("honey_oak"),
        "Floor": pal("Oak_plank"), "Foundation": pal("espresso"),
        # FBX vertex colours do not survive the Interchange import here (they render black), so MB_VC parts get a
        # warm kraft/cream surface instead of M_MB_VertexColor (kept for later use).
        "VC": surface_mi("MI_MB_Kraft", MATS, lin(196, 160, 116), *fabric, uv=4.0, detail=0.3, normal=0.3, rough=0.8),
        "Glass": _inst(gls, "MI_MB_Glass"),
        "PrintMenu": _inst(prm, "MI_MB_PrintMenu", scalars={"Roughness": 0.9, "Emissive": 0.15},
                           textures={"Print": tex.get("T_MB_ChalkMenu_D")}),
        "PrintSandwich": _inst(prm, "MI_MB_PrintSandwich", scalars={"Roughness": 0.9},
                               textures={"Print": tex.get("T_MB_SandwichBoard_D")}),
        "PrintArt": _inst(prm, "MI_MB_PrintArt", scalars={"Roughness": 0.6}, textures={"Print": tex.get("T_MB_ArtPrints_D")}),
        "PrintSigns": _inst(prm, "MI_MB_PrintSigns", scalars={"Roughness": 0.5}, textures={"Print": tex.get("T_MB_Signs_D")}),
    }


def build(names=None):
    """Import SourceArt/Props/SM_MB_*.fbx (rooms go to Environment/Rooms). Returns {short name: mesh}."""
    mats = build_materials()
    meshes = {}
    for f in sorted(glob.glob(os.path.join(SRC, "SM_MB_*.fbx"))):
        short = os.path.splitext(os.path.basename(f))[0][6:]
        if names and short not in names:
            continue
        mesh = import_fbx(f, ROOM_DIR if short.startswith("Room_") else f"{PROPS}/Meshes")
        if not mesh:
            log(f"import failed: {short}")
            continue
        assign_slots(mesh, mats)
        eal.save_loaded_asset(mesh)
        meshes[short] = mesh
    log(f"props: {len(meshes)} meshes imported")
    return meshes, mats
