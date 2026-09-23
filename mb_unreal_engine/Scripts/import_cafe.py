"""Import the current café blockout and the Maya/Claire rigs into MapleBeanUE.

Run: UnrealEditor-Cmd.exe MapleBeanUE.uproject -run=pythonscript -script=Scripts/import_cafe.py
Source files stay in the web project; nothing there is modified.
"""
import os
import unreal

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
im = unreal.InterchangeManager.get_interchange_manager_scripted()


def params():
    p = unreal.ImportAssetParameters()
    p.is_automated = True
    p.replace_existing = True
    return p


def import_assets(src, dest):
    ok = im.import_asset(dest, unreal.InterchangeManager.create_source_data(os.path.join(ROOT, src)), params())
    unreal.log(f"[MapleBean] assets {src} -> {dest}: {ok}")


# Characters: skeletal mesh + skeleton + 30 morph targets.
for name in ("maya", "claire"):
    import_assets(f"assets/characters/{name}.glb", f"/Game/MapleBean/Characters/{name.capitalize()}/Current")

# Café: import as a scene so all 1,551 pieces keep their layout positions.
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
les.new_level("/Game/MapleBean/Maps/L_Cafe")
ok = im.import_scene("/Game/MapleBean/Environment/Architecture/CurrentBlockout",
                     unreal.InterchangeManager.create_source_data(os.path.join(ROOT, "assets/cafe.glb")), params())
unreal.log(f"[MapleBean] scene cafe.glb: {ok}")
les.save_current_level()
unreal.EditorAssetLibrary.save_directory("/Game/MapleBean")
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
unreal.log(f"[MapleBean] level actors: {len(actors)}")
