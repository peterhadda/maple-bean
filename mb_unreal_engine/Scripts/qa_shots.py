"""Render QA screenshots of L_Cafe to Saved/QA/<tag>/.

Run headless: UnrealEditor-Cmd.exe MapleBeanUE.uproject -run=pythonscript -script=Scripts/qa_shots.py -AllowCommandletRendering
(tag via the MB_TAG environment variable; MB_CHAR_VARIANT picks /Game/MapleBean/Characters/<Name>/<variant>,
default "Current", e.g. "V2")
"""
import json
import os
import unreal

TAG = os.environ.get("MB_TAG", "shots")
VARIANT = os.environ.get("MB_CHAR_VARIANT", "Current") or "Current"
OUT = os.path.join(unreal.Paths.project_saved_dir(), "QA", TAG)
os.makedirs(OUT, exist_ok=True)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
_world = unreal.EditorLevelLibrary.get_editor_world()
if not _world or _world.get_name() != "L_Cafe":  # re-loading would drop the actors placed by an earlier pass
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level("/Game/MapleBean/Maps/L_Cafe")


def ensure(cls, label, loc=unreal.Vector(0, 0, 0), rot=unreal.Rotator(0, 0, 0)):
    for a in eas.get_all_level_actors():
        if a.get_actor_label() == label:
            return a
    a = eas.spawn_actor_from_class(cls, loc, rot)
    a.set_actor_label(label)
    return a


# Preview lighting only if lookdev.py hasn't lit the level yet. Python Rotator order is (roll, pitch, yaw).
labels = {a.get_actor_label() for a in eas.get_all_level_actors()}
if "MB_Sun" not in labels:
    sun = ensure(unreal.DirectionalLight, "QA_Sun", rot=unreal.Rotator(0, -40, -115))
    sun.light_component.set_intensity(8.0)
    ensure(unreal.SkyAtmosphere, "QA_Sky")
    ensure(unreal.SkyLight, "QA_SkyLight").light_component.set_editor_property("real_time_capture", True)

meshes = [a for a in eas.get_all_level_actors() if isinstance(a, unreal.StaticMeshActor)]
# Floor height = top of the oak planks.
floor_z = max((a.get_actor_bounds(False)[0].z + a.get_actor_bounds(False)[1].z
               for a in meshes if a.get_actor_label().startswith("Individual oak floorboard")), default=0.0)
unreal.log(f"[MapleBean] {len(meshes)} meshes, floor z {floor_z:.1f}")


def W(x, z, h=0.0):
    """Layout metres (as in assets/layout.json) -> world cm; same mapping as MBLayoutSubsystem::ToWorld."""
    return unreal.Vector(x * 100.0, z * 100.0, floor_z + h * 100.0)


# The cast in a line by the counter (layout x -4.0 .. -1.2, z -2.0; clear of the white block at x ~ -0.5), facing the "characters" camera (+Y).
CAST = ["Maya", "Claire", "Noah", "Mara", "Jules"]
placed = []
for name in CAST:
    found = unreal.EditorAssetLibrary.list_assets(f"/Game/MapleBean/Characters/{name}/{VARIANT}", recursive=True)
    mesh = next((a for a in (unreal.load_asset(p.split(".")[0]) for p in found) if isinstance(a, unreal.SkeletalMesh)), None)
    label = f"QA_{name}"
    if not mesh:
        for a in eas.get_all_level_actors():  # a character missing in this variant must not linger from a previous run
            if a.get_actor_label() == label:
                eas.destroy_actor(a)
        continue
    placed.append((name, mesh))
x0, step = -4.0, 2.8 / max(1, len(CAST) - 1)
for i, (name, mesh) in enumerate(placed):
    at = W(x0 + step * CAST.index(name), -2.0)
    act = ensure(unreal.SkeletalMeshActor, f"QA_{name}", at)
    act.set_actor_location(at, False, False)
    comp = act.skeletal_mesh_component
    if comp.get_skinned_asset() != mesh:
        comp.set_skinned_asset_and_update(mesh)
    # Scene captures don't drive texture streaming; ask for full-res mips explicitly.
    comp.set_editor_property("force_mip_streaming", True)
    comp.prestream_textures(30.0, True)
unreal.log(f"[MapleBean] variant {VARIANT}: placed {[n for n, _ in placed]}")

shots = {
    # Same framing idea as docs/images/cafe-overview.png: high, from the front-left corner.
    "overview": (W(-17.0, 24.0, 21.0), W(2.5, -2.0)),
    "entrance_to_bar": (W(0.0, 6.0, 1.65), W(-3.4, -4.6, 1.0)),
    "coffee_bar": (W(-0.8, -0.6, 1.5), W(-3.4, -4.8, 1.0)),
    "study_room": (W(16.7, 1.7, 2.3), W(12.0, -4.0, 0.6)),
    "characters": (W(-2.6, 1.9, 1.3), W(-2.6, -2.0, 0.9)),  # pulled back to frame all five
}
# Time of day (MB_TIME=day|night), mirroring the web build's lighting presets (systems/lighting.js):
# night ~ "Cozy evening": dim cool moonlight, dark sky, warmer and brighter lamps. Applied in memory only.
if os.environ.get("MB_TIME", "day") == "night":
    for a in eas.get_all_level_actors():
        if isinstance(a, unreal.DirectionalLight):
            lc = a.light_component
            lc.set_intensity(0.35)
            lc.set_editor_property("use_temperature", True)
            lc.set_editor_property("temperature", 9500.0)
            a.set_actor_rotation(unreal.Rotator(0, -32, 60), False)  # (roll, pitch, yaw): high moon
        elif isinstance(a, unreal.SkyLight):
            a.light_component.set_intensity(0.12)
        elif isinstance(a, unreal.ExponentialHeightFog):
            a.component.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.02, 0.03, 0.06, 1))
        elif isinstance(a, unreal.PointLight):
            c = a.point_light_component
            c.set_intensity(c.intensity * 1.6)
        elif isinstance(a, unreal.PostProcessVolume) and a.get_actor_label() == "MB_Grade":
            st = a.settings
            st.set_editor_property("override_auto_exposure_bias", True)
            st.set_editor_property("auto_exposure_bias", st.auto_exposure_bias + 1.2)
            st.set_editor_property("override_white_temp", True)
            st.set_editor_property("white_temp", 5200.0)
            a.set_editor_property("settings", st)
    unreal.log("[MapleBean] night lighting applied")

# Synchronous capture: SceneCapture2D -> render target -> PNG. No ticks, so nothing can quit early.
# Rendered at 2x (MB_SUPERSAMPLE) and downsampled by ue_run.sh for clean, anti-aliased edges.
SS = max(1, int(os.environ.get("MB_SUPERSAMPLE", "2")))
world = unreal.EditorLevelLibrary.get_editor_world()
rt = unreal.RenderingLibrary.create_render_target2d(world, 1600 * SS, 900 * SS, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
cap_actor = ensure(unreal.SceneCapture2D, "QA_Capture")
cap = cap_actor.capture_component2d
cap.set_editor_property("texture_target", rt)
cap.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_TONE_CURVE_HDR)
cap.set_editor_property("capture_every_frame", False)
cap.set_editor_property("fov_angle", 55.0)

# Extra cameras maintained by the Environment agent: Scripts/env_cameras.json,
# {name: [[eye_x, eye_y, eye_z], [target_x, target_y, target_z]]} in world cm. Bad entries are skipped, never fatal.
_cams = os.path.join(os.path.dirname(os.path.abspath(__file__)), "env_cameras.json")
if os.path.exists(_cams):
    try:
        with open(_cams, encoding="utf8") as f:
            extra = json.load(f)
        for name, spec in (extra.items() if isinstance(extra, dict) else []):
            try:
                eye, target = (unreal.Vector(*[float(v) for v in p]) for p in spec)
                if name in shots or not str(name).replace("_", "").replace("-", "").isalnum():
                    raise ValueError("duplicate or unsafe name")
                shots[str(name)] = (eye, target)
            except Exception as e:  # noqa: BLE001
                unreal.log_warning(f"[MapleBean] env_cameras.json: skipping {name!r}: {e}")
        unreal.log(f"[MapleBean] env_cameras.json: {len(shots)} shots total")
    except Exception as e:  # noqa: BLE001 - a broken JSON must not fail the shot
        unreal.log_warning(f"[MapleBean] env_cameras.json unreadable: {e}")

for name, (eye, target) in shots.items():
    rot = unreal.MathLibrary.find_look_at_rotation(eye, target)
    cap_actor.set_actor_location_and_rotation(eye, rot, False, False)
    for _ in range(3):  # a few passes so exposure/shadows settle
        cap.capture_scene()
    unreal.RenderingLibrary.export_render_target(world, rt, OUT, f"{name}.png")
    unreal.log(f"[MapleBean] saved {name}.png")
unreal.log(f"[MapleBean] shots in {OUT}")
