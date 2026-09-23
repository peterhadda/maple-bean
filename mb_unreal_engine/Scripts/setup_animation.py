"""Retarget the UE5 mannequin idle/walk onto every Maple Bean character, and create ABP_MapleBean.

Source clips are the engine's own template content (TP_ThirdPerson: MM_Idle, MF_Unarmed_Walk_Fwd), copied
unchanged to /Game/Characters/Mannequins so their internal references resolve.

  IK_Manny        auto-generated retarget definition for SKM_Manny_Simple
  IK_MapleBean    hand-built chains for the 41-bone Maple Bean rig (root, hips, spine, chest, neck, head,
                  upper/lower/hand, thigh/shin/foot, finger0-3, thumb) — names match the auto chains so they map
  RTG_Manny_to_MapleBean   default op stack, chains auto-mapped, target auto-aligned to the source pose
  /Game/MapleBean/Animations/<Name>/A_<Name>_Idle|Walk   one pair per character (each has its own skeleton)
  /Game/MapleBean/Animations/ABP_MapleBean   template Anim Blueprint, parent UMBAnimInstance (C++ builds the pose)

Run: Scripts/ue_run.sh movement-qa cmd Scripts/setup_animation.py      (idempotent; ABP step needs the C++ module)
"""
import unreal

at = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary
OUT = "/Game/MapleBean/Animations"
RIGS = f"{OUT}/Rigs"
MANNY = "/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple"
CLIPS = {"Idle": "/Game/Characters/Mannequins/Anims/Unarmed/MM_Idle",
         "Walk": "/Game/Characters/Mannequins/Anims/Unarmed/Walk/MF_Unarmed_Walk_Fwd"}
SRC, TGT = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET

# Chain name -> (start, end); names follow the mannequin's auto-generated chains so FUZZY mapping pairs them.
MB_CHAINS = {
    "Spine": ("spine", "chest"), "Neck": ("neck", "neck"), "Head": ("head", "head"),
    "LeftArm": ("upper_L", "hand_L"), "RightArm": ("upper_R", "hand_R"),
    "LeftLeg": ("thigh_L", "foot_L"), "RightLeg": ("thigh_R", "foot_R"),
    "LeftThumb": ("thumb_L", "thumb_L"), "RightThumb": ("thumb_R", "thumb_R"),
    "LeftIndex": ("finger0_L", "finger0_L"), "RightIndex": ("finger0_R", "finger0_R"),
    "LeftMiddle": ("finger1_L", "finger1_L"), "RightMiddle": ("finger1_R", "finger1_R"),
    "LeftRing": ("finger2_L", "finger2_L"), "RightRing": ("finger2_R", "finger2_R"),
    "LeftPinky": ("finger3_L", "finger3_L"), "RightPinky": ("finger3_R", "finger3_R"),
}


def log(msg):
    unreal.log(f"[MapleBean] anim: {msg}")


def fresh(name, folder, cls, factory):
    path = f"{folder}/{name}"
    if eal.does_asset_exist(path):
        eal.delete_asset(path)
    return at.create_asset(name, folder, cls, factory)


def characters():
    """Every imported Maple Bean character: /Game/MapleBean/Characters/<Name>/Current/<name>/SkeletalMeshes/<name>."""
    out = []
    for path in eal.list_assets("/Game/MapleBean/Characters", recursive=True, include_folder=False):
        if "/Current/" in path and "/SkeletalMeshes/" in path:
            a = unreal.load_asset(path.split(".")[0])
            if isinstance(a, unreal.SkeletalMesh):
                out.append((path.split("/Characters/")[1].split("/")[0], a))
    return out


manny = unreal.load_asset(MANNY)
people = characters()
log(f"characters: {[n for n, _ in people]}")

# --- IK rigs
ik_manny = fresh("IK_Manny", RIGS, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
c = unreal.IKRigController.get_controller(ik_manny)
c.set_skeletal_mesh(manny)
c.apply_auto_generated_retarget_definition()
log(f"IK_Manny root {c.get_retarget_root()} chains {[str(x.chain_name) for x in c.get_retarget_chains()]}")
eal.save_loaded_asset(ik_manny)

ik_mb = fresh("IK_MapleBean", RIGS, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
c = unreal.IKRigController.get_controller(ik_mb)
c.set_skeletal_mesh(people[0][1])
c.set_retarget_root("hips")
for name, (start, end) in MB_CHAINS.items():
    c.add_retarget_chain(name, start, end, "")
log(f"IK_MapleBean root {c.get_retarget_root()} chains {[str(x.chain_name) for x in c.get_retarget_chains()]}")
eal.save_loaded_asset(ik_mb)

# --- retargeter
rtg = fresh("RTG_Manny_to_MapleBean", RIGS, unreal.IKRetargeter, unreal.IKRetargetFactory())
r = unreal.IKRetargeterController.get_controller(rtg)
r.set_ik_rig(SRC, ik_manny)
r.set_ik_rig(TGT, ik_mb)
r.set_preview_mesh(SRC, manny)
r.set_preview_mesh(TGT, people[0][1])
r.add_default_ops()
r.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)
for ch in ["LeftArm", "RightArm", "LeftLeg", "RightLeg", "Spine", "Head"]:
    log(f"map {ch} <- {r.get_source_chain(ch)}")
try:
    r.auto_align_all_bones(TGT)
    log("target auto-aligned to the source pose")
except Exception as e:  # noqa: BLE001 - alignment is a quality step, not required
    log(f"auto-align skipped: {e}")
log(f"ops: {[str(r.get_op_name(i)) for i in range(r.get_num_retarget_ops())]}")
eal.save_loaded_asset(rtg)

# --- retargeted clips, one pair per character
sources = [eal.find_asset_data(p) for p in CLIPS.values()]  # the batch op takes AssetData
for name, mesh in people:
    skel = mesh.get_editor_property("skeleton")
    if skel is None:
        log(f"{name}: skipped, mesh has no skeleton yet (import in progress?)")
        continue
    r.set_preview_mesh(TGT, mesh)
    folder = f"{OUT}/{name}"
    for clip in CLIPS:
        if eal.does_asset_exist(f"{folder}/A_{name}_{clip}"):
            eal.delete_asset(f"{folder}/A_{name}_{clip}")
    try:
        made = unreal.IKRetargetBatchOperation.duplicate_and_retarget(sources, manny, mesh, rtg, "", "", f"RT_{name}_", "", False)
    except Exception as e:  # noqa: BLE001 - one bad character must not stop the others
        log(f"{name}: retarget failed: {e}")
        made = []
    for data in made:
        src = str(data.package_name)
        clip = "Idle" if "MM_Idle" in src else "Walk" if "Walk_Fwd" in src else None
        if clip is None:
            continue
        dst = f"{folder}/A_{name}_{clip}"
        eal.rename_asset(src, dst)
        seq = unreal.load_asset(dst)
        seq.set_editor_property("enable_root_motion", False)
        eal.save_loaded_asset(seq)
        log(f"{dst} ({seq.get_play_length():.2f}s, skeleton {seq.get_editor_property('skeleton').get_name()})")
# Leftovers of a failed batch (duplicates land in /Game with the RT_ prefix).
for path in eal.list_assets("/Game", recursive=False, include_folder=False):
    if path.split("/")[-1].startswith("RT_"):
        eal.delete_asset(path.split(".")[0])
eal.save_loaded_asset(rtg)

# --- ABP_MapleBean: template Anim Blueprint whose parent (UMBAnimInstance) builds the pose in C++.
parent = unreal.load_class(None, "/Script/MapleBeanUE.MBAnimInstance")
if parent is None:
    log("MBAnimInstance not loaded (C++ module not built yet) - ABP_MapleBean skipped")
else:
    f = unreal.AnimBlueprintFactory()
    f.set_editor_property("parent_class", parent)
    try:
        f.set_editor_property("template", True)
    except Exception:  # noqa: BLE001 - older API: bind to Maya's skeleton instead
        f.set_editor_property("target_skeleton", people[0][1].get_editor_property("skeleton"))
    abp = fresh("ABP_MapleBean", OUT, unreal.AnimBlueprint, f)
    unreal.BlueprintEditorLibrary.compile_blueprint(abp)
    eal.save_loaded_asset(abp)
    log(f"ABP_MapleBean created (parent {parent.get_name()})")
