"""Shared helpers for the environment agent's Unreal scripts (env_*.py). Import after sys.path has Scripts/."""
import os

import unreal

PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MEL = unreal.MaterialEditingLibrary
at = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
sme = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
SC = "/Game/StarterContent/Textures"
MB_TEX = "/Game/MapleBean/Textures"
SURFACE = "/Game/MapleBean/Materials/M_MB_Surface"
PROTECTED = ("MB_Nav", "MB_PlayerStart")  # gameplay actors: never touch


def log(msg):
    unreal.log(f"[MapleBean] {msg}")


def lin(r, g, b):
    """sRGB 0-255 -> linear colour."""
    f = lambda c: (c / 255.0) ** 2.2  # noqa: E731
    return unreal.LinearColor(f(r), f(g), f(b), 1.0)


def import_texture(path, dest, normal=False):
    task = unreal.AssetImportTask()
    task.filename = path
    task.destination_path = dest
    task.automated = True
    task.replace_existing = True
    task.save = True
    at.import_asset_tasks([task])
    tex = unreal.load_asset(f"{dest}/{os.path.splitext(os.path.basename(path))[0]}")
    if normal:
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        tex.set_editor_property("srgb", False)
    eal.save_loaded_asset(tex)
    return tex


def import_fbx(path, dest):
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_materials", False)
    ui.set_editor_property("import_textures", False)
    ui.set_editor_property("import_as_skeletal", False)
    ui.set_editor_property("automated_import_should_detect_type", False)
    ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_STATIC_MESH)
    d = ui.static_mesh_import_data
    d.set_editor_property("combine_meshes", True)
    d.set_editor_property("auto_generate_collision", False)
    d.set_editor_property("generate_lightmap_u_vs", False)
    d.set_editor_property("vertex_color_import_option", unreal.VertexColorImportOption.REPLACE)
    d.set_editor_property("normal_import_method", unreal.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS)
    task = unreal.AssetImportTask()
    task.filename = path
    task.destination_path = dest
    task.automated = True
    task.replace_existing = True
    task.save = True
    task.options = ui
    at.import_asset_tasks([task])
    return unreal.load_asset(f"{dest}/{os.path.splitext(os.path.basename(path))[0]}")


def surface_mi(name, folder, tint, detail_tex, normal_tex, uv=1.0, detail=0.4, normal=0.5, rough=0.8, metal=0.0,
               emissive=0.0):
    """A material instance of M_MB_Surface (the lookdev master)."""
    path = f"{folder}/{name}"
    mi = unreal.load_asset(path) if eal.does_asset_exist(path) else at.create_asset(
        name, folder, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, unreal.load_asset(SURFACE))
    MEL.set_material_instance_vector_parameter_value(mi, "Tint", tint)
    MEL.set_material_instance_texture_parameter_value(mi, "DetailTexture", unreal.load_asset(detail_tex))
    MEL.set_material_instance_texture_parameter_value(mi, "NormalTexture", unreal.load_asset(normal_tex))
    for p, v in (("UVScale", uv), ("DetailStrength", detail), ("NormalStrength", normal), ("Roughness", rough),
                 ("Metallic", metal), ("Emissive", emissive)):
        MEL.set_material_instance_scalar_parameter_value(mi, p, v)
    MEL.update_material_instance(mi)
    eal.save_loaded_asset(mi)
    return mi


def assign_slots(mesh, by_name, fallback=None):
    """Set materials by FBX slot name (substring match), e.g. {"Foliage": mi, "Terracotta": mi2}."""
    for i, sm in enumerate(mesh.static_materials):
        slot = str(sm.material_slot_name)
        exact = slot.lower().replace("mb_", "", 1)
        mi = by_name.get(next((k for k in by_name if k.lower() == exact), None)) or next(
            (m for key, m in by_name.items() if key.lower() in slot.lower()), fallback)
        if mi:
            mesh.set_material(i, mi)


def set_lods(mesh, steps=((1.0, 1.0), (0.5, 0.35), (0.25, 0.12))):
    opts = unreal.EditorScriptingMeshReductionOptions()
    opts.set_editor_property("auto_compute_lod_screen_size", False)
    opts.set_editor_property("reduction_settings", [
        unreal.EditorScriptingMeshReductionSettings(percent_triangles=p, screen_size=s) for p, s in steps])
    lib = sme or unreal.EditorStaticMeshLibrary  # the subsystem is missing in some commandlet runs
    try:
        lib.set_lods(mesh, opts)
    except Exception as e:  # noqa: BLE001 - LODs are a nice-to-have
        log(f"LOD generation skipped for {mesh.get_name()}: {e}")


def clear_prefix(prefix):
    n = 0
    for a in eas.get_all_level_actors():
        lab = a.get_actor_label()
        if lab.startswith(prefix) and not lab.startswith(PROTECTED):
            eas.destroy_actor(a)
            n += 1
    return n


def place(mesh, label, loc, yaw=0.0, scale=1.0, folder="Art", collide=True):
    # spawn_actor_from_object crashes in commandlets (it goes through viewport placement).
    a = eas.spawn_actor_from_class(unreal.StaticMeshActor, loc, unreal.Rotator(0.0, 0.0, yaw))
    a.static_mesh_component.set_static_mesh(mesh)
    a.set_actor_label(label)
    a.set_folder_path(folder)
    a.set_actor_scale3d(unreal.Vector(scale, scale, scale))
    if not collide:
        a.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    return a


def hide(actor, folder="Art/Replaced"):
    """Retire an original café piece reversibly: invisible, no collision, parked in a folder."""
    c = actor.static_mesh_component if isinstance(actor, unreal.StaticMeshActor) else actor.root_component
    c.set_visibility(False, True)
    c.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    actor.set_actor_hidden_in_game(True)
    actor.set_folder_path(folder)


def base_label(label):
    """'Broad_living_leaf_012' -> 'Broad_living_leaf'."""
    parts = label.split("_")
    while parts and parts[-1].isdigit():
        parts.pop()
    return "_".join(parts).replace(" ", "_")


def bounds(actor):
    o, e = actor.get_actor_bounds(False)
    return o, e
