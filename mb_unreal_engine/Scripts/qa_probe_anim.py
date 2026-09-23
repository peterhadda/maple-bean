"""Read-only probe for the retarget setup: mannequin + Maple Bean rigs, and the IK Rig / Retargeter Python API.

Run: Scripts/ue_run.sh movement-qa cmd Scripts/qa_probe_anim.py
"""
import unreal


def log(msg):
    unreal.log(f"[Probe] {msg}")


for path in ["/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple", "/Game/MapleBean/Characters/Maya/Current/maya/SkeletalMeshes/maya",
             "/Game/Characters/Mannequins/Anims/Unarmed/MM_Idle", "/Game/Characters/Mannequins/Anims/Unarmed/Walk/MF_Unarmed_Walk_Fwd"]:
    a = unreal.load_asset(path)
    log(f"{path}: {a.get_class().get_name() if a else None}")
    if isinstance(a, unreal.AnimSequence):
        log(f"  length {a.get_play_length():.2f}s skeleton {a.get_editor_property('skeleton').get_name()}")

maya = unreal.load_asset("/Game/MapleBean/Characters/Maya/Current/maya/SkeletalMeshes/maya")
if maya:
    b = maya.get_bounds()
    log(f"maya bounds origin {b.origin} extent {b.box_extent}")
    skel = maya.get_editor_property("skeleton")
    names = [str(n) for n in unreal.SkeletalMeshEditorSubsystem.get_bone_names(maya)] if hasattr(unreal.SkeletalMeshEditorSubsystem, "get_bone_names") else []
    log(f"maya bones {names}")
    try:
        sms = unreal.get_editor_subsystem(unreal.SkeletalMeshEditorSubsystem)
        log(f"skel mesh subsystem: {[m for m in dir(sms) if not m.startswith('_')][:60]}")
    except Exception as e:  # noqa: BLE001
        log(f"subsystem err {e}")

for cls in ["IKRigController", "IKRetargeterController", "IKRetargetBatchOperation", "IKRigDefinitionFactory", "IKRetargetFactory",
            "AnimBlueprintFactory", "AutoMapChainType", "RetargetSourceOrTarget", "RetargetAutoAlignMethod"]:
    c = getattr(unreal, cls, None)
    log(f"{cls}: {[m for m in dir(c) if not m.startswith('_')] if c else 'MISSING'}")
