"""Plant pass for L_Cafe: foliage material, plant library import, swap of the old faceted plants.

Run: Scripts/ue_run.sh environment cmd Scripts/env_plants.py
Needs SourceArt/Plants/*.fbx (Scripts/env_bl_plants.py) and the atlas (Scripts/env_leaf_textures.py).
Idempotent: re-imports meshes, rebuilds nothing it already has, replaces every MB_Plant_* actor.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
from env_common import (MEL, PROJECT, SC, MB_TEX, at, eal, eas, les, lin, log, import_texture, import_fbx,  # noqa: E402
                        surface_mi, assign_slots, set_lods, clear_prefix, place, hide, base_label)

PLANTS = "/Game/MapleBean/Plants"
SRC = os.path.join(PROJECT, "SourceArt", "Plants")
SPECIES = ("FiddleLeafFig", "Monstera", "SnakePlant", "PothosHanging", "PothosShelf", "Succulent", "TreeRound",
           "TreeTall")
# Original café pieces that made up the old plants (and the stray default cube at the origin).
OLD_PARTS = ("Broad_living_leaf", "Plant_frond", "Plant_pot", "Terracotta_plant_pot", "Potting_soil",
             "Hanging_planter", "Planter_cord", "Maple_Hollow_tree_canopy", "Garden_tree_trunk", "Vase_sprig",
             "Table_ceramic_vase", "Cube")


def scalar(m, name, default, x, y):
    n = MEL.create_material_expression(m, unreal.MaterialExpressionScalarParameter, x, y)
    n.set_editor_property("parameter_name", name)
    n.set_editor_property("default_value", default)
    return n


def vector(m, name, default, x, y):
    n = MEL.create_material_expression(m, unreal.MaterialExpressionVectorParameter, x, y)
    n.set_editor_property("parameter_name", name)
    n.set_editor_property("default_value", default)
    return n


def op(m, cls, a, b, x, y, a_out="", b_out=""):
    n = MEL.create_material_expression(m, cls, x, y)
    MEL.connect_material_expressions(a, a_out, n, "A")
    MEL.connect_material_expressions(b, b_out, n, "B")
    return n


def build_foliage_master(tex_d, tex_n):
    """Two-sided foliage: atlas * vertex colour * tint, per-object hue drift, masked, subsurface."""
    path = f"{PLANTS}/Materials/M_MB_Foliage"
    if eal.does_asset_exist(path):  # keep a finished graph (instances depend on it); rebuild a half-made one
        m = unreal.load_asset(path)
        if m.get_editor_property("shading_model") == unreal.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE:
            return m
        eal.delete_asset(path)
    m = at.create_asset("M_MB_Foliage", f"{PLANTS}/Materials", unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
    m.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE)
    m.set_editor_property("two_sided", True)
    m.set_editor_property("opacity_mask_clip_value", 0.4)
    m.set_editor_property("dithered_lod_transition", True)

    td = MEL.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -1200, -300)
    td.set_editor_property("parameter_name", "Atlas")
    td.set_editor_property("texture", tex_d)
    tn = MEL.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -1200, 300)
    tn.set_editor_property("parameter_name", "AtlasNormal")
    tn.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    tn.set_editor_property("texture", tex_n)
    vc = MEL.create_material_expression(m, unreal.MaterialExpressionVertexColor, -1200, -520)

    # Per-object hash from the actor position: frac(sin(dot(pos.xy, k)) * 43758.5) -> 0..1.
    pos = MEL.create_material_expression(m, unreal.MaterialExpressionObjectPositionWS, -1500, -800)
    mask = MEL.create_material_expression(m, unreal.MaterialExpressionComponentMask, -1350, -800)
    mask.set_editor_property("r", True)
    mask.set_editor_property("g", True)
    mask.set_editor_property("b", False)
    mask.set_editor_property("a", False)
    MEL.connect_material_expressions(pos, "", mask, "")
    k = MEL.create_material_expression(m, unreal.MaterialExpressionConstant2Vector, -1350, -700)
    k.set_editor_property("r", 0.0129898)
    k.set_editor_property("g", 0.0078233)
    dot = op(m, unreal.MaterialExpressionDotProduct, mask, k, -1200, -780)
    sin = MEL.create_material_expression(m, unreal.MaterialExpressionSine, -1050, -780)
    MEL.connect_material_expressions(dot, "", sin, "")
    big = MEL.create_material_expression(m, unreal.MaterialExpressionConstant, -1050, -700)
    big.set_editor_property("r", 43758.5)
    mul = op(m, unreal.MaterialExpressionMultiply, sin, big, -900, -760)
    frac = MEL.create_material_expression(m, unreal.MaterialExpressionFrac, -760, -760)
    MEL.connect_material_expressions(mul, "", frac, "")
    amt = scalar(m, "VariationAmount", 0.6, -760, -660)
    alpha = op(m, unreal.MaterialExpressionMultiply, frac, amt, -620, -720)
    white = MEL.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -620, -900)
    white.set_editor_property("constant", unreal.LinearColor(1, 1, 1, 1))
    var_col = vector(m, "TintVariation", unreal.LinearColor(1.15, 1.05, 0.55, 1), -620, -620)
    drift = MEL.create_material_expression(m, unreal.MaterialExpressionLinearInterpolate, -460, -760)
    MEL.connect_material_expressions(white, "", drift, "A")
    MEL.connect_material_expressions(var_col, "", drift, "B")
    MEL.connect_material_expressions(alpha, "", drift, "Alpha")

    tint = vector(m, "Tint", unreal.LinearColor(1, 1, 1, 1), -900, -520)
    c1 = op(m, unreal.MaterialExpressionMultiply, td, vc, -900, -380, "RGB", "RGB")
    c2 = op(m, unreal.MaterialExpressionMultiply, c1, tint, -700, -420)
    base = op(m, unreal.MaterialExpressionMultiply, c2, drift, -300, -480)
    MEL.connect_material_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)
    sss = op(m, unreal.MaterialExpressionMultiply, base,
             vector(m, "SubsurfaceTint", unreal.LinearColor(0.9, 1.0, 0.45, 1), -300, -300), -120, -340)
    MEL.connect_material_property(sss, "", unreal.MaterialProperty.MP_SUBSURFACE_COLOR)
    MEL.connect_material_property(td, "A", unreal.MaterialProperty.MP_OPACITY_MASK)

    flat = MEL.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -900, 200)
    flat.set_editor_property("constant", unreal.LinearColor(0, 0, 1, 1))
    nl = MEL.create_material_expression(m, unreal.MaterialExpressionLinearInterpolate, -600, 260)
    MEL.connect_material_expressions(flat, "", nl, "A")
    MEL.connect_material_expressions(tn, "RGB", nl, "B")
    MEL.connect_material_expressions(scalar(m, "NormalStrength", 0.5, -900, 420), "", nl, "Alpha")
    MEL.connect_material_property(nl, "", unreal.MaterialProperty.MP_NORMAL)
    MEL.connect_material_property(scalar(m, "Roughness", 0.62, -300, 520), "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(scalar(m, "Specular", 0.3, -300, 600), "", unreal.MaterialProperty.MP_SPECULAR)
    MEL.recompile_material(m)
    eal.save_loaded_asset(m)
    log("M_MB_Foliage built")
    return m


def foliage_mi(master, name, tint, variation):
    path = f"{PLANTS}/Materials/{name}"
    mi = unreal.load_asset(path) if eal.does_asset_exist(path) else at.create_asset(
        name, f"{PLANTS}/Materials", unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, master)
    MEL.set_material_instance_vector_parameter_value(mi, "Tint", tint)
    MEL.set_material_instance_scalar_parameter_value(mi, "VariationAmount", variation)
    MEL.update_material_instance(mi)
    eal.save_loaded_asset(mi)
    return mi


def build_assets():
    tex = f"{PLANTS}/Textures"
    td = import_texture(os.path.join(SRC, "Textures", "T_MB_FoliageAtlas_D.png"), tex)
    tn = import_texture(os.path.join(SRC, "Textures", "T_MB_FoliageAtlas_N.png"), tex, normal=True)
    master = build_foliage_master(td, tn)
    mat_dir = f"{PLANTS}/Materials"
    mats = {
        "Foliage": foliage_mi(master, "MI_MB_Foliage_Indoor", unreal.LinearColor(1.0, 1.0, 1.0, 1), 0.5),
        "Terracotta": unreal.load_asset("/Game/MapleBean/Materials/Instances/MI_MB_terracotta"),
        "Cream": surface_mi("MI_MB_PotCream", mat_dir, lin(226, 214, 192), f"{MB_TEX}/T_MB_Plaster_D",
                            f"{MB_TEX}/T_MB_Plaster_N", uv=2.0, detail=0.2, normal=0.3, rough=0.42),
        "Soil": surface_mi("MI_MB_Soil", mat_dir, lin(52, 36, 26), f"{SC}/T_Concrete_Poured_D",
                           f"{SC}/T_Concrete_Poured_N", uv=4.0, detail=0.9, normal=1.0, rough=0.95),
        "Bark": surface_mi("MI_MB_Bark", mat_dir, lin(110, 84, 62), f"{SC}/T_Wood_Walnut_D", f"{SC}/T_Wood_Walnut_N",
                           uv=1.0, detail=0.8, normal=0.9, rough=0.85),
        "Cord": surface_mi("MI_MB_Jute", mat_dir, lin(170, 140, 100), f"{MB_TEX}/T_MB_Fabric_D",
                           f"{MB_TEX}/T_MB_Fabric_N", uv=8.0, detail=0.4, normal=0.5, rough=0.9),
    }
    tree_mats = dict(mats, Foliage=foliage_mi(master, "MI_MB_Foliage_Tree", unreal.LinearColor(0.62, 0.72, 0.5, 1), 0.5))
    meshes = {}
    for sp in SPECIES:
        mesh = import_fbx(os.path.join(SRC, f"SM_MB_{sp}.fbx"), f"{PLANTS}/Meshes")
        if not mesh:
            log(f"import failed: {sp}")
            continue
        assign_slots(mesh, tree_mats if sp.startswith("Tree") else mats)
        set_lods(mesh, ((1.0, 1.0), (0.5, 0.3), (0.25, 0.1)) if sp.startswith("Tree") else
                 ((1.0, 1.0), (0.5, 0.25), (0.25, 0.08)))
        eal.save_loaded_asset(mesh)
        e = mesh.get_bounds().box_extent
        log(f"{sp}: {mesh.get_num_triangles(0)} tris, {mesh.get_num_lods()} LODs, extent {e.x:.0f}x{e.y:.0f}x{e.z:.0f} cm")
        meshes[sp] = mesh
    return meshes


# ---------------------------------------------------------------- level swap
# Old pot label -> species (None: a duplicate pot at the same spot). Chosen for silhouette variety per room.
POT_SPECIES = {
    "Plant_pot": None, "Terracotta_plant_pot_001": "FiddleLeafFig",          # lounge corner (-8.75, 1.25)
    "Plant_pot_002": None, "Terracotta_plant_pot_003": "Monstera",          # bar corner (-9, -5.9)
    "Plant_pot_001": "SnakePlant", "Plant_pot_003": "SnakePlant",
    "Terracotta_plant_pot": "FiddleLeafFig", "Terracotta_plant_pot_002": "Monstera",
    "Terracotta_plant_pot_004": "Monstera", "Terracotta_plant_pot_005": "FiddleLeafFig",
    "Terracotta_plant_pot_006": "SnakePlant", "Terracotta_plant_pot_007": "Monstera",
    "Terracotta_plant_pot_008": "SnakePlant", "Terracotta_plant_pot_009": "FiddleLeafFig",
    "Terracotta_plant_pot_010": "Monstera", "Terracotta_plant_pot_011": "FiddleLeafFig",
    "Terracotta_plant_pot_012": "SnakePlant", "Terracotta_plant_pot_013": "Monstera",
    "Terracotta_plant_pot_014": "FiddleLeafFig", "Terracotta_plant_pot_015": "SnakePlant",
    "Table_ceramic_vase": "Succulent", "Table_ceramic_vase_001": "Succulent",
}
LIB_POT_RADIUS = {"FiddleLeafFig": 20.0, "Monstera": 24.0, "SnakePlant": 16.0, "Succulent": 7.5}
# Trunks that now stand inside/against the new wings (env_rooms.py) move out onto the lawn.
TREE_MOVE = {"Garden_tree_trunk_001": unreal.Vector(-1780, -200, 120), "Garden_tree_trunk_003": unreal.Vector(1350, 1080, 120)}
# Extra dressing (world cm): hanging pothos at hooks, trailing pothos on shelves/bookcases, succulents.
EXTRA = [
    ("PothosHanging", (-830, 620, 345), 0), ("PothosHanging", (-430, 620, 350), 70),
    ("PothosHanging", (430, 620, 345), 140), ("PothosHanging", (830, 620, 350), 210),
    ("PothosHanging", (1200, -575, 345), 30), ("PothosHanging", (1510, -575, 350), 160),
    ("PothosHanging", (-40, -1180, 345), 90), ("PothosHanging", (-560, -330, 360), 250),
    ("PothosShelf", (-866, -644, 255), 90), ("PothosShelf", (188, -644, 255), 90),
    ("PothosShelf", (-950, 470, 228), 0), ("PothosShelf", (1690, -380, 230), 180),
    ("Succulent", (-700, 420, 82.5), 20), ("Succulent", (-310, 535, 82.5), 80), ("Succulent", (800, 535, 82.5), 140),
    ("Succulent", (-560, 690, 84), 0), ("Succulent", (560, 690, 84), 45), ("Succulent", (-555, -455, 105), 10),
    ("Succulent", (1370, 150, 60), 0),
]


def swap_level(meshes):
    removed = clear_prefix("MB_Plant_")
    actors = {a.get_actor_label(): a for a in eas.get_all_level_actors()}
    n = 0
    for label, sp in POT_SPECIES.items():
        a = actors.get(label)
        if not a or not sp or sp not in meshes:
            continue
        o, e = a.get_actor_bounds(False)
        scale = max(0.9, min(1.2, max(e.x, e.y) / LIB_POT_RADIUS[sp]))
        if sp == "Succulent":
            scale = 1.3
        yaw = float(sum(map(ord, label)) * 37 % 360)
        # Indoor plants sit on layout.json obstacles, which the Gameplay MB_Nav* blockers already cover.
        place(meshes[sp], f"MB_Plant_{sp}_{n:02d}", unreal.Vector(o.x, o.y, o.z - e.z), yaw, scale, "Art/Plants",
              collide=False)
        n += 1
    # Trees: one per old trunk, alternating the two species.
    trunks = sorted((a for lab, a in actors.items() if base_label(lab) == "Garden_tree_trunk"), key=lambda a: a.get_actor_label())
    for i, a in enumerate(trunks):
        o, e = a.get_actor_bounds(False)
        o = TREE_MOVE.get(a.get_actor_label(), o)
        sp = "TreeRound" if i % 2 == 0 else "TreeTall"
        place(meshes[sp], f"MB_Plant_{sp}_{n:02d}", unreal.Vector(o.x, o.y, o.z - e.z), i * 47.0, 1.0 + 0.08 * (i % 3),
              "Art/Plants")
        n += 1
    for sp, (x, y, z), yaw in EXTRA:
        if sp in meshes:
            place(meshes[sp], f"MB_Plant_{sp}_{n:02d}", unreal.Vector(x, y, z), yaw, 1.3 if sp == "Succulent" else 1.0,
                  "Art/Plants", collide=False)
            n += 1
    hidden = 0
    for lab, a in actors.items():
        if base_label(lab) in OLD_PARTS and isinstance(a, unreal.StaticMeshActor):
            hide(a)
            hidden += 1
    log(f"plants: removed {removed} old MB_Plant_*, placed {n}, hid {hidden} original plant parts")


les.load_level("/Game/MapleBean/Maps/L_Cafe")
m = build_assets()
swap_level(m)
les.save_current_level()
log("env_plants done")
