"""Materials + lighting pass for L_Cafe (plan step 2). Idempotent: re-running replaces what it made.

Run: UnrealEditor-Cmd.exe mb_unreal_engine.uproject -run=pythonscript -script=Scripts/lookdev.py
Uses Starter Content (copied into /Game/StarterContent) + SourceArt/Textures from make_textures.py.
"""
import json
import os
import struct

import unreal

PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAT_DIR = "/Game/MapleBean/Materials"
TEX_DIR = "/Game/MapleBean/Textures"
SC = "/Game/StarterContent/Textures"
MEL = unreal.MaterialEditingLibrary
at = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def log(msg):
    unreal.log(f"[MapleBean] {msg}")


# ---------------------------------------------------------------- textures
def import_textures():
    src = os.path.join(PROJECT, "SourceArt", "Textures")
    for f in sorted(os.listdir(src)):
        task = unreal.AssetImportTask()
        task.filename = os.path.join(src, f)
        task.destination_path = TEX_DIR
        task.automated = True
        task.replace_existing = True
        task.save = True
        at.import_asset_tasks([task])
        tex = unreal.load_asset(f"{TEX_DIR}/{os.path.splitext(f)[0]}")
        if f.endswith("_N.png"):
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
            tex.set_editor_property("srgb", False)
            eal.save_loaded_asset(tex)
    log("textures imported")


# ---------------------------------------------------------------- master material
def scalar(m, name, default, x, y):
    n = MEL.create_material_expression(m, unreal.MaterialExpressionScalarParameter, x, y)
    n.set_editor_property("parameter_name", name)
    n.set_editor_property("default_value", default)
    return n


def build_master():
    path = f"{MAT_DIR}/M_MB_Surface"
    if eal.does_asset_exist(path):  # instances depend on it; keep it (delete the asset to rebuild the graph)
        return unreal.load_asset(path)
    m = at.create_asset("M_MB_Surface", MAT_DIR, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property("two_sided", True)  # the café's flat panels are single-sided in glTF

    uv = MEL.create_material_expression(m, unreal.MaterialExpressionTextureCoordinate, -1400, 0)
    uv_scale = scalar(m, "UVScale", 1.0, -1400, 120)
    uv_mul = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -1200, 40)
    MEL.connect_material_expressions(uv, "", uv_mul, "A")
    MEL.connect_material_expressions(uv_scale, "", uv_mul, "B")

    tex_d = MEL.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -1000, -200)
    tex_d.set_editor_property("parameter_name", "DetailTexture")
    tex_d.set_editor_property("texture", unreal.load_asset(f"{TEX_DIR}/T_MB_Plaster_D"))
    MEL.connect_material_expressions(uv_mul, "", tex_d, "UVs")
    tex_n = MEL.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -1000, 300)
    tex_n.set_editor_property("parameter_name", "NormalTexture")
    tex_n.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    tex_n.set_editor_property("texture", unreal.load_asset(f"{TEX_DIR}/T_MB_Plaster_N"))
    MEL.connect_material_expressions(uv_mul, "", tex_n, "UVs")

    # Base colour = Tint * lerp(1, luminance(detail) * DetailGain, DetailStrength): keeps the palette, adds grain.
    tint = MEL.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -700, -400)
    tint.set_editor_property("parameter_name", "Tint")
    tint.set_editor_property("default_value", unreal.LinearColor(0.8, 0.8, 0.8, 1))
    desat = MEL.create_material_expression(m, unreal.MaterialExpressionDesaturation, -700, -200)
    MEL.connect_material_expressions(tex_d, "RGB", desat, "")
    gain = scalar(m, "DetailGain", 1.6, -700, -80)
    gained = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -520, -160)
    MEL.connect_material_expressions(desat, "", gained, "A")
    MEL.connect_material_expressions(gain, "", gained, "B")
    one = MEL.create_material_expression(m, unreal.MaterialExpressionConstant, -520, -260)
    one.set_editor_property("r", 1.0)
    strength = scalar(m, "DetailStrength", 0.5, -520, -40)
    detail = MEL.create_material_expression(m, unreal.MaterialExpressionLinearInterpolate, -340, -200)
    MEL.connect_material_expressions(one, "", detail, "A")
    MEL.connect_material_expressions(gained, "", detail, "B")
    MEL.connect_material_expressions(strength, "", detail, "Alpha")
    base = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -160, -300)
    MEL.connect_material_expressions(tint, "", base, "A")
    MEL.connect_material_expressions(detail, "", base, "B")
    MEL.connect_material_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    # Normal = lerp(flat, sampled, NormalStrength).
    flat = MEL.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -700, 250)
    flat.set_editor_property("constant", unreal.LinearColor(0, 0, 1, 1))
    nstr = scalar(m, "NormalStrength", 0.6, -700, 420)
    nlerp = MEL.create_material_expression(m, unreal.MaterialExpressionLinearInterpolate, -400, 300)
    MEL.connect_material_expressions(flat, "", nlerp, "A")
    MEL.connect_material_expressions(tex_n, "RGB", nlerp, "B")
    MEL.connect_material_expressions(nstr, "", nlerp, "Alpha")
    MEL.connect_material_property(nlerp, "", unreal.MaterialProperty.MP_NORMAL)

    MEL.connect_material_property(scalar(m, "Roughness", 0.7, -300, 520), "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(scalar(m, "Metallic", 0.0, -300, 600), "", unreal.MaterialProperty.MP_METALLIC)
    MEL.connect_material_property(scalar(m, "Specular", 0.5, -300, 680), "", unreal.MaterialProperty.MP_SPECULAR)

    emit = scalar(m, "Emissive", 0.0, -300, -520)
    emit_col = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -120, -520)
    MEL.connect_material_expressions(tint, "", emit_col, "A")
    MEL.connect_material_expressions(emit, "", emit_col, "B")
    MEL.connect_material_property(emit_col, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    MEL.recompile_material(m)
    eal.save_loaded_asset(m)
    log("M_MB_Surface built")
    return m


# ---------------------------------------------------------------- per-palette instances
WOOD = (f"{SC}/T_Wood_Oak_D", f"{SC}/T_Wood_Oak_N")
FLOOR = (f"{SC}/T_Wood_Floor_Walnut_D", f"{SC}/T_Wood_Floor_Walnut_N")
DARK = (f"{SC}/T_Wood_Walnut_D", f"{SC}/T_Wood_Walnut_N")
PAINT = (f"{SC}/T_Wood_Pine_D", f"{SC}/T_Wood_Pine_N")
FABRIC = (f"{TEX_DIR}/T_MB_Fabric_D", f"{TEX_DIR}/T_MB_Fabric_N")
PLASTER = (f"{TEX_DIR}/T_MB_Plaster_D", f"{TEX_DIR}/T_MB_Plaster_N")
CLAY = (f"{SC}/T_Concrete_Poured_D", f"{SC}/T_Concrete_Poured_N")
METAL = (f"{TEX_DIR}/T_MB_Plaster_D", f"{SC}/T_Metal_Steel_N")

# name fragment -> (textures, uv scale, detail, normal, roughness, metallic, emissive)
LOOKS = [
    ("honey oak", WOOD, 2.0, 0.7, 0.5, 0.45, 0.0, 0.0),
    ("Oak plank", FLOOR, 1.0, 0.8, 0.7, 0.4, 0.0, 0.0),
    ("espresso", DARK, 2.0, 0.6, 0.5, 0.4, 0.0, 0.0),
    ("forest green", PAINT, 2.0, 0.18, 0.35, 0.5, 0.0, 0.0),
    ("linen", FABRIC, 6.0, 0.35, 0.8, 0.9, 0.0, 0.0),
    ("sage upholstery", FABRIC, 6.0, 0.35, 0.8, 0.85, 0.0, 0.0),
    ("cinnamon velvet", FABRIC, 8.0, 0.3, 0.6, 0.8, 0.0, 0.0),
    ("games felt", FABRIC, 10.0, 0.3, 0.6, 0.95, 0.0, 0.0),
    ("aged brass", METAL, 3.0, 0.1, 0.25, 0.32, 0.9, 0.0),
    ("terracotta", CLAY, 2.0, 0.45, 0.5, 0.85, 0.0, 0.0),
    ("warm plaster", PLASTER, 1.0, 0.25, 0.5, 0.9, 0.0, 0.0),
    ("limestone", CLAY, 1.0, 0.3, 0.5, 0.8, 0.0, 0.0),
    ("chalk", PLASTER, 3.0, 0.4, 0.2, 0.95, 0.0, 0.0),
    ("foliage", PLASTER, 4.0, 0.15, 0.2, 0.55, 0.0, 0.0),
    ("warm light", PLASTER, 1.0, 0.0, 0.0, 0.5, 0.0, 12.0),
    ("arcade screen", PLASTER, 1.0, 0.0, 0.0, 0.2, 0.0, 4.0),
    ("lawn", CLAY, 12.0, 0.35, 0.35, 0.95, 0.0, 0.0),  # never matched by name; used for the 60 m ground plane
]
LAWN_TINT = unreal.LinearColor(0.07, 0.12, 0.05, 1)


def glb_palette():
    """Material name -> linear base colour, read straight from the source cafe.glb (exact palette)."""
    with open(os.path.join(PROJECT, "..", "assets", "cafe.glb"), "rb") as f:
        f.seek(12)
        length, _ = struct.unpack("<II", f.read(8))
        doc = json.loads(f.read(length))
    out = {}
    for m in doc.get("materials", []):
        c = m.get("pbrMetallicRoughness", {}).get("baseColorFactor", [0.8, 0.8, 0.8, 1])
        out[norm(m["name"])] = unreal.LinearColor(c[0], c[1], c[2], 1)
    return out


def norm(name):
    """Compare names the way Interchange rewrites them ('Bean · honey oak' -> 'Bean___honey_oak')."""
    return "".join(ch for ch in name.lower() if ch.isalnum())


PALETTE = {}


def look_for(name):
    for frag, *rest in LOOKS:
        if frag.lower() in name.lower():
            return frag, rest
    return None, None


def make_instance(master, src_mat, key, look):
    (d, n), uvs, det, nrm, rough, metal, emissive = look
    safe = key.replace(" ", "_")
    path = f"{MAT_DIR}/Instances/MI_MB_{safe}"
    mi = unreal.load_asset(path) if eal.does_asset_exist(path) else at.create_asset(
        f"MI_MB_{safe}", f"{MAT_DIR}/Instances", unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, master)
    # Keep the café's own palette (exact glTF base colour; planks share the mid oak shade).
    k = norm("Oak plank 3" if key == "Oak plank" else key)
    tint = LAWN_TINT if key == "lawn" else next((c for n, c in PALETTE.items() if k in n), unreal.LinearColor(0.8, 0.8, 0.8, 1))
    MEL.set_material_instance_vector_parameter_value(mi, "Tint", tint)
    MEL.set_material_instance_texture_parameter_value(mi, "DetailTexture", unreal.load_asset(d))
    MEL.set_material_instance_texture_parameter_value(mi, "NormalTexture", unreal.load_asset(n))
    for p, v in (("UVScale", uvs), ("DetailStrength", det), ("NormalStrength", nrm), ("Roughness", rough),
                 ("Metallic", metal), ("Emissive", emissive)):
        MEL.set_material_instance_scalar_parameter_value(mi, p, v)
    MEL.update_material_instance(mi)
    eal.save_loaded_asset(mi)
    return mi


def apply_materials(master):
    root = "/Game/MapleBean/Environment/Architecture/CurrentBlockout/cafe"
    made, swapped = {}, 0
    for p in eal.list_assets(f"{root}/StaticMeshes", recursive=True, include_folder=False):
        mesh = unreal.load_asset(p)
        if not isinstance(mesh, unreal.StaticMesh):
            continue
        changed = False
        for i, sm in enumerate(mesh.static_materials):
            src = sm.material_interface
            if not src:
                continue
            base = src.get_name()
            already = base.startswith("MI_MB_")  # re-run: refresh the instance in place
            key, look = look_for((base[6:] if already else base).replace("_", " "))
            if not key:
                continue
            ext = mesh.get_bounds().box_extent
            if max(ext.x, ext.y) > 1500:  # the ground plane shares "sage upholstery" with the sofas
                key, look = "lawn", next(r for f, *r in LOOKS if f == "lawn")
            if key not in made:
                made[key] = make_instance(master, src, key, look)
            if already and base == f"MI_MB_{key.replace(' ', '_')}":
                continue
            mesh.set_material(i, made[key])
            changed = True
            swapped += 1
        if changed:
            eal.save_loaded_asset(mesh, False)
    log(f"{len(made)} material instances, {swapped} slots swapped")


# ---------------------------------------------------------------- characters
def read_glb(path):
    with open(path, "rb") as f:
        f.seek(12)
        length, _ = struct.unpack("<II", f.read(8))
        return json.loads(f.read(length))


def extract_glb_images(path, out_dir):
    """Write every embedded image of a .glb to out_dir/<index>_<name>.png and return the file paths."""
    with open(path, "rb") as f:
        data = f.read()
    json_len = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    bin_off = 20 + json_len + 8  # skip the BIN chunk header
    os.makedirs(out_dir, exist_ok=True)
    files = []
    for i, img in enumerate(doc.get("images", [])):
        view = doc["bufferViews"][img["bufferView"]]
        start = bin_off + view.get("byteOffset", 0)
        safe = "".join(ch if ch.isalnum() else "_" for ch in img.get("name", "image"))
        fp = os.path.join(out_dir, f"T_{i:02d}_{safe}.png")
        with open(fp, "wb") as out:
            out.write(data[start:start + view["byteLength"]])
        files.append(fp)
    return files


def import_character_textures(name):
    """Import the glTF's images through the plain texture importer (the Interchange copies never build here)."""
    files = extract_glb_images(os.path.join(PROJECT, "..", "assets", "characters", f"{name}.glb"),
                               os.path.join(PROJECT, "SourceArt", "Characters", name))
    dest = f"/Game/MapleBean/Characters/{name.capitalize()}/Textures"
    out = []
    for fp in files:
        task = unreal.AssetImportTask()
        task.filename = fp
        task.destination_path = dest
        task.automated = True
        task.replace_existing = True
        task.save = True
        at.import_asset_tasks([task])
        out.append(unreal.load_asset(f"{dest}/{os.path.splitext(os.path.basename(fp))[0]}"))
    return out


def set_character_usage(m, save=True):
    """Skinned + morphing meshes render the default checker unless the material opts in to both."""
    m.set_editor_property("used_with_skeletal_mesh", True)
    m.set_editor_property("used_with_morph_targets", True)
    if save:
        MEL.recompile_material(m)
        eal.save_loaded_asset(m)


def build_character_master():
    path = f"{MAT_DIR}/M_MB_Character"
    if eal.does_asset_exist(path):
        m = unreal.load_asset(path)
        set_character_usage(m)
        return m
    m = at.create_asset("M_MB_Character", MAT_DIR, unreal.Material, unreal.MaterialFactoryNew())
    set_character_usage(m, save=False)
    m.set_editor_property("two_sided", True)  # hair ribbons and lashes are single sheets
    tex = MEL.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -700, -100)
    tex.set_editor_property("parameter_name", "BaseTexture")
    tex.set_editor_property("texture", unreal.load_asset(f"{TEX_DIR}/T_MB_Plaster_D"))
    tint = MEL.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -700, -300)
    tint.set_editor_property("parameter_name", "Tint")
    tint.set_editor_property("default_value", unreal.LinearColor(1, 1, 1, 1))
    mul = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -300, -200)
    MEL.connect_material_expressions(tex, "RGB", mul, "A")
    MEL.connect_material_expressions(tint, "", mul, "B")
    MEL.connect_material_property(mul, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(scalar(m, "Roughness", 0.6, -300, 100), "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(scalar(m, "Metallic", 0.0, -300, 200), "", unreal.MaterialProperty.MP_METALLIC)
    MEL.connect_material_property(scalar(m, "Specular", 0.4, -300, 300), "", unreal.MaterialProperty.MP_SPECULAR)
    MEL.recompile_material(m)
    eal.save_loaded_asset(m)
    log("M_MB_Character built")
    return m


def apply_characters(master):
    """Replace the importer's extension-heavy glTF materials with M_MB_Character, fed the same textures."""
    for name in ("maya", "claire", "noah", "mara", "jules"):
        root = f"/Game/MapleBean/Characters/{name.capitalize()}/Current/{name}"
        if not eal.does_directory_exist(root):
            continue
        doc = read_glb(os.path.join(PROJECT, "..", "assets", "characters", f"{name}.glb"))
        textures = import_character_textures(name)
        mesh = next((unreal.load_asset(p) for p in eal.list_assets(root, recursive=True)
                     if isinstance(unreal.load_asset(p), unreal.SkeletalMesh)), None)
        if not mesh:
            continue
        mats = list(mesh.materials)
        for i, sm in enumerate(mats):
            slot = str(sm.material_slot_name)
            src = next((m for m in doc["materials"] if m["name"] == slot), None)
            if not src:
                continue
            pbr = src.get("pbrMetallicRoughness", {})
            mi_path = f"{root}/Materials/MI_MB_{name}_{slot}"
            mi = unreal.load_asset(mi_path) if eal.does_asset_exist(mi_path) else at.create_asset(
                f"MI_MB_{name}_{slot}", f"{root}/Materials", unreal.MaterialInstanceConstant,
                unreal.MaterialInstanceConstantFactoryNew())
            MEL.set_material_instance_parent(mi, master)
            if "baseColorTexture" in pbr:
                img = doc["textures"][pbr["baseColorTexture"]["index"]]["source"]
                tex = textures[img]
                if tex:
                    MEL.set_material_instance_texture_parameter_value(mi, "BaseTexture", tex)
            c = pbr.get("baseColorFactor", [1, 1, 1, 1])
            MEL.set_material_instance_vector_parameter_value(mi, "Tint", unreal.LinearColor(c[0], c[1], c[2], 1))
            MEL.set_material_instance_scalar_parameter_value(mi, "Roughness", pbr.get("roughnessFactor", 0.6))
            MEL.set_material_instance_scalar_parameter_value(mi, "Metallic", pbr.get("metallicFactor", 0.0))
            MEL.update_material_instance(mi)
            eal.save_loaded_asset(mi)
            sm.material_interface = mi
            mats[i] = sm
        mesh.set_editor_property("materials", mats)
        eal.save_loaded_asset(mesh, False)
        log(f"{name}: {len(mats)} character materials")


# ---------------------------------------------------------------- lights & grade
def spawn(cls, label, loc=unreal.Vector(0, 0, 0), rot=unreal.Rotator(0, 0, 0)):
    a = eas.spawn_actor_from_class(cls, loc, rot)
    a.set_actor_label(label)
    a.set_folder_path("Lighting")
    # Movable: nothing is baked here, and stationary lights draw "Preview" text in unbuilt shadows.
    a.root_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    return a


def light_scene():
    for a in eas.get_all_level_actors():
        lab = a.get_actor_label()
        # Only the lighting rig this function spawns (other MB_* actors belong to gameplay / art passes).
        if lab.startswith(("MB_Sun", "MB_Sky", "MB_Fog", "MB_Lamp_", "MB_Grade", "QA_Sun", "QA_Sky")):
            eas.destroy_actor(a)

    # Warm late-afternoon sun from the entrance side, low enough to reach through the front windows.
    sun = spawn(unreal.DirectionalLight, "MB_Sun", rot=unreal.Rotator(0, -22, -115))  # roll, pitch, yaw
    lc = sun.light_component
    lc.set_intensity(7.5)
    lc.set_editor_property("use_temperature", True)
    lc.set_editor_property("temperature", 4300.0)
    lc.set_editor_property("atmosphere_sun_light", True)
    spawn(unreal.SkyAtmosphere, "MB_SkyAtmosphere")
    sky = spawn(unreal.SkyLight, "MB_SkyLight")
    sky.light_component.set_editor_property("real_time_capture", True)
    sky.light_component.set_intensity(1.2)
    fog = spawn(unreal.ExponentialHeightFog, "MB_Fog")
    fog.component.set_editor_property("fog_density", 0.004)

    # Real lights inside every lamp the café already has.
    lamps = {"Pendant warm diffuser": (60.0, 650.0, 2700.0, True),
             "Desk lamp glow": (14.0, 260.0, 3000.0, False),
             "Fireplace glowing hearth": (90.0, 700.0, 1900.0, True)}
    count = 0
    for a in eas.get_all_level_actors():
        lab = norm(a.get_actor_label())
        for key, (cd, radius, kelvin, shadows) in lamps.items():
            if lab.startswith(norm(key)):
                o, e = a.get_actor_bounds(False)
                pl = spawn(unreal.PointLight, f"MB_Lamp_{count:02d}", o - unreal.Vector(0, 0, e.z + 8))
                c = pl.point_light_component
                c.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
                c.set_intensity(cd)
                c.set_attenuation_radius(radius)
                c.set_editor_property("use_temperature", True)
                c.set_editor_property("temperature", kelvin)
                c.set_editor_property("source_radius", 6.0)
                c.set_cast_shadows(shadows)
                count += 1
    log(f"{count} lamp lights")

    pp = spawn(unreal.PostProcessVolume, "MB_Grade")
    pp.set_editor_property("unbound", True)
    s = pp.settings
    for k, v in (("override_auto_exposure_method", True), ("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL),
                 ("override_auto_exposure_bias", True), ("auto_exposure_bias", 11.5),
                 ("override_white_temp", True), ("white_temp", 5900.0),
                 ("override_bloom_intensity", True), ("bloom_intensity", 0.45),
                 ("override_ambient_occlusion_intensity", True), ("ambient_occlusion_intensity", 0.75),
                 ("override_ambient_occlusion_radius", True), ("ambient_occlusion_radius", 90.0),
                 ("override_vignette_intensity", True), ("vignette_intensity", 0.3),
                 ("override_color_saturation", True), ("color_saturation", unreal.Vector4(1.05, 1.03, 1.0, 1.0)),
                 ("override_color_contrast", True), ("color_contrast", unreal.Vector4(1.04, 1.04, 1.04, 1.0))):
        s.set_editor_property(k, v)
    pp.set_editor_property("settings", s)
    log("sun, sky, fog, grade placed")


PALETTE.update(glb_palette())
log(f"palette: {len(PALETTE)} colours from cafe.glb")
les.load_level("/Game/MapleBean/Maps/L_Cafe")
import_textures()
apply_materials(build_master())
# Characters are owned by Scripts/characters_materials.py (V2 materials); do not re-apply the old ones here.
light_scene()
les.save_current_level()
log("lookdev done")
