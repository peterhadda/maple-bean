"""Characters (Agent A): import the five rigs and give them the M_MB_Character_* materials. Idempotent.

Run: Scripts/ue_run.sh characters cmd Scripts/characters_materials.py
Env: MB_CHAR_NAMES=maya,claire   limit the characters (default: all five)
     MB_CHAR_VARIANT=V2          also/only process SourceArt/Characters/<name>_v2.glb -> /Characters/<Name>/V2
     MB_CHAR_REIMPORT=1|V2       re-import meshes that already exist (all, or only the listed variants)

Replaces lookdev.apply_characters(): the Interchange glTF materials don't render on this machine, so every slot
gets an MI_MBC_<name>_<slot> instance of a Shared master, fed the glb's own embedded textures.
Source glbs in assets/ are read only; extracted PNGs go to SourceArt/Characters/<name>[_v2]/.
"""
import json
import os
import struct
import sys

import unreal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import characters_shaders as shaders  # noqa: E402

PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO = os.path.abspath(os.path.join(PROJECT, ".."))
CHAR = "/Game/MapleBean/Characters"
NAMES = [n for n in os.environ.get("MB_CHAR_NAMES", "maya,claire,noah,mara,jules").split(",") if n]
VARIANTS = [v for v in os.environ.get("MB_CHAR_VARIANT", "Current").split(",") if v]
REIMPORT = os.environ.get("MB_CHAR_REIMPORT", "")  # "1" = all variants, or e.g. "V2"
MEL = unreal.MaterialEditingLibrary
at = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary
im = unreal.InterchangeManager.get_interchange_manager_scripted()

# Per-character hair look (highlight colour/strength, variation range) and denim strength.
HAIR = {  # HighlightColor multiplies the hair's own albedo inside the band
    "maya": dict(HighlightColor=(1.35, 1.2, 1.05), HighlightStrength=0.9),
    "claire": dict(HighlightColor=(1.2, 1.15, 1.0), HighlightStrength=0.6),
    "noah": dict(HighlightColor=(1.4, 1.25, 1.1), HighlightStrength=0.9),
    "mara": dict(HighlightColor=(1.5, 1.3, 1.2), HighlightStrength=1.0),
    "jules": dict(HighlightColor=(1.35, 1.2, 1.05), HighlightStrength=0.9),
}
# Hair colour targets (mood board): tint multiplier on the painted/flat hair colour.
HAIR_TINT = {"maya": (0.72, 0.68, 0.66), "noah": (0.7, 0.68, 0.68), "mara": (0.4, 0.42, 0.48),
             "jules": (0.72, 0.9, 1.1), "claire": (1.0, 0.9, 0.68)}
SKIN_TINT = {"mara": (0.98, 0.95, 0.93), "noah": (1.0, 0.97, 0.95)}  # keep deeper tones from going orange


def log(msg):
    unreal.log(f"[MapleBean] characters: {msg}")


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


# ---------------------------------------------------------------- glb helpers (copied from lookdev.py)
def read_glb(path):
    with open(path, "rb") as f:
        f.seek(12)
        length, _ = struct.unpack("<II", f.read(8))
        return json.loads(f.read(length))


def extract_glb_images(path, out_dir):
    """Write every embedded image of a .glb to out_dir/T_<index>_<name>.png and return the file paths."""
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
    return files, doc


def normal_images(doc):
    return {doc["textures"][m["normalTexture"]["index"]]["source"] for m in doc["materials"] if "normalTexture" in m}


def import_textures(glb, src_dir, dest):
    """Plain AssetImportTask for each embedded image (the Interchange texture copies never build here)."""
    files, doc = extract_glb_images(glb, src_dir)
    normals = normal_images(doc)
    out = []
    for i, fp in enumerate(files):
        task = unreal.AssetImportTask()
        task.filename = fp
        task.destination_path = dest
        task.automated = True
        task.replace_existing = True
        task.save = True
        at.import_asset_tasks([task])
        tex = unreal.load_asset(f"{dest}/{os.path.splitext(os.path.basename(fp))[0]}")
        if tex and i in normals:  # glTF normals are OpenGL (+Y); UE wants DirectX
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
            tex.set_editor_property("srgb", False)
            tex.set_editor_property("flip_green_channel", True)
            eal.save_loaded_asset(tex)
        out.append(tex)
    return out, doc


# ---------------------------------------------------------------- import
def find_mesh(root):
    for p in eal.list_assets(root, recursive=True, include_folder=False):
        a = unreal.load_asset(p)
        if isinstance(a, unreal.SkeletalMesh):
            return a
    return None


def import_character(name, glb, dest, variant):
    again = REIMPORT == "1" or variant in REIMPORT.split(",")
    if not again and eal.does_directory_exist(dest) and find_mesh(dest):
        return find_mesh(dest)
    p = unreal.ImportAssetParameters()
    p.is_automated = True
    p.replace_existing = True
    ok = im.import_asset(dest, unreal.InterchangeManager.create_source_data(glb), p)
    log(f"import {os.path.basename(glb)} -> {dest}: {ok}")
    return find_mesh(dest)


# ---------------------------------------------------------------- material instances
def kind_of(slot):
    s = norm(slot)
    if "skin" in s:
        return "skin"
    if "hair" in s:
        return "hair"
    if "eye" in s:
        return "eye"
    return "cloth"


def instance(folder, name, parent):
    path = f"{folder}/{name}"
    mi = unreal.load_asset(path) if eal.does_asset_exist(path) else at.create_asset(
        name, folder, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, parent)
    return mi


def set_params(mi, scalars=None, vectors=None, textures=None):
    for k, v in (scalars or {}).items():
        MEL.set_material_instance_scalar_parameter_value(mi, k, float(v))
    for k, v in (vectors or {}).items():
        MEL.set_material_instance_vector_parameter_value(mi, k, unreal.LinearColor(v[0], v[1], v[2], 1))
    for k, v in (textures or {}).items():
        if v:
            MEL.set_material_instance_texture_parameter_value(mi, k, v)


def slot_params(name, kind, src, doc, textures):
    pbr = src.get("pbrMetallicRoughness", {}) if src else {}
    c = pbr.get("baseColorFactor", [1, 1, 1, 1])
    tex = {}
    if "baseColorTexture" in pbr:
        tex["BaseTexture"] = textures[doc["textures"][pbr["baseColorTexture"]["index"]]["source"]]
    else:  # flat-colour slot: the tint carries the colour
        tex["BaseTexture"] = unreal.load_asset(shaders.WHITE)
    if src and "normalTexture" in src and kind in ("hair", "cloth"):
        tex["NormalTexture"] = textures[doc["textures"][src["normalTexture"]["index"]]["source"]]
    sc, vec = {}, {"Tint": c[:3]}
    if kind == "skin":
        vec["Tint"] = [a * b for a, b in zip(c[:3], SKIN_TINT.get(name, (1, 1, 1)))]
    elif kind == "hair":
        if "scalp" in norm(src.get("name", "") if src else ""):
            vec["Tint"] = [x * 0.6 for x in c[:3]]  # scalp cap: root shadow under the hair
        vec["Tint"] = [a * b for a, b in zip(vec["Tint"], HAIR_TINT.get(name, (1, 1, 1)))]
        h = HAIR.get(name, {})
        vec["HighlightColor"] = h.get("HighlightColor", (1.3, 1.2, 1.05))
        sc.update({k: v for k, v in h.items() if k != "HighlightColor"})
        sc.update(VariationLow=0.82, VariationHigh=1.08)  # overrides older, wider instance values
        sc["NormalStrength"] = 0.45
    elif kind == "cloth":
        metal = pbr.get("metallicFactor", 0.0)
        sc.update(Roughness=pbr.get("roughnessFactor", 0.85), Metallic=metal, NormalStrength=0.6)
        if metal > 0.3:  # accessories: jewellery, buttons, headphone metal
            sc.update(Sheen=0.0, Specular=0.5, DenimAmount=0.0)
    return sc, vec, tex


def apply(name, variant, glb, masters):
    root = f"{CHAR}/{name.capitalize()}/{variant}"
    mesh = find_mesh(root)
    if not mesh:
        log(f"{name}/{variant}: no skeletal mesh under {root}")
        return
    suffix = "" if variant == "Current" else f"_{variant.lower()}"
    textures, doc = import_textures(glb, os.path.join(PROJECT, "SourceArt", "Characters", name + suffix),
                                    f"{CHAR}/{name.capitalize()}/Textures{suffix.upper()}")
    by_name = {norm(m["name"]): m for m in doc["materials"]}
    folder = f"{CHAR}/{name.capitalize()}/Materials{suffix.upper()}"
    mats = list(mesh.materials)
    counts = {}
    for i, sm in enumerate(mats):
        slot = str(sm.material_slot_name)
        src = by_name.get(norm(slot)) or next((m for k, m in by_name.items() if k in norm(slot)), None)
        kind = kind_of(slot)
        mi = instance(folder, f"MI_MBC_{name}{suffix}_{norm(slot)[:32]}", masters[kind])
        sc, vec, tex = slot_params(name, kind, src, doc, textures)
        set_params(mi, sc, vec, tex)
        MEL.update_material_instance(mi)
        eal.save_loaded_asset(mi)
        sm.material_interface = mi
        mats[i] = sm
        counts[kind] = counts.get(kind, 0) + 1
    mesh.set_editor_property("materials", mats)
    eal.save_loaded_asset(mesh, False)
    log(f"{name}/{variant}: {len(mats)} slots {counts}")


def glb_for(name, variant):
    if variant == "Current":
        return os.path.join(REPO, "assets", "characters", f"{name}.glb")
    return os.path.join(PROJECT, "SourceArt", "Characters", f"{name}_{variant.lower()}.glb")


def main():
    masters = shaders.build_all()
    for variant in VARIANTS:
        for name in NAMES:
            glb = glb_for(name, variant)
            if not os.path.exists(glb):
                log(f"{name}/{variant}: missing {glb}")
                continue
            import_character(name, glb, f"{CHAR}/{name.capitalize()}/{variant}", variant)
            apply(name, variant, glb, masters)
    log("done")


main()
