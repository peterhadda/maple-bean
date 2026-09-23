"""Read-only: count Gameplay helpers and nav actors in L_Cafe. Run: Scripts/ue_run.sh movement-qa cmd Scripts/qa_probe_nav.py"""
import collections
import unreal

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level("/Game/MapleBean/Maps/L_Cafe")
kinds = collections.Counter()
for a in eas.get_all_level_actors():
    lab = a.get_actor_label()
    cls = a.get_class().get_name()
    if lab.startswith("MB_Nav") or lab == "MB_PlayerStart" or "Nav" in cls or cls == "PlayerStart":
        kinds[f"{cls}:{lab.rstrip('0123456789_')}"] += 1
unreal.log(f"[Probe] {dict(kinds)}")
