"""Cozy, clean grade for L_Cafe (saved into MB_Grade): soft contrast, lifted warm shadows, gentle bloom and vignette.

Run: Scripts/ue_run.sh lead cmd Scripts/look_cozy.py   (idempotent; env_lighting.py may run before or after)
"""
import unreal

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
les.load_level("/Game/MapleBean/Maps/L_Cafe")

pp = next((a for a in eas.get_all_level_actors() if a.get_actor_label() == "MB_Grade"), None)
if not pp:
    unreal.log("[MapleBean] look_cozy: no MB_Grade (run lookdev.py first)")
else:
    s = pp.settings
    for k, v in (
        ("override_white_temp", True), ("white_temp", 5750.0),             # warm, not orange
        ("override_color_contrast", True), ("color_contrast", unreal.Vector4(0.93, 0.93, 0.93, 1.0)),
        ("override_color_saturation", True), ("color_saturation", unreal.Vector4(1.03, 1.02, 0.98, 1.0)),
        ("override_color_gamma_shadows", True), ("color_gamma_shadows", unreal.Vector4(1.05, 1.02, 0.98, 1.0)),
        ("override_color_gain_highlights", True), ("color_gain_highlights", unreal.Vector4(1.02, 1.0, 0.96, 1.0)),
        ("override_film_toe", True), ("film_toe", 0.62),                   # softer blacks
        ("override_film_shoulder", True), ("film_shoulder", 0.3),          # gentler highlight roll-off
        ("override_bloom_intensity", True), ("bloom_intensity", 0.55),
        ("override_bloom_threshold", True), ("bloom_threshold", 1.2),
        ("override_vignette_intensity", True), ("vignette_intensity", 0.32),
        ("override_ambient_occlusion_intensity", True), ("ambient_occlusion_intensity", 0.6),
        ("override_ambient_occlusion_radius", True), ("ambient_occlusion_radius", 70.0),
        ("override_scene_fringe_intensity", True), ("scene_fringe_intensity", 0.0),
    ):
        try:
            s.set_editor_property(k, v)
        except Exception as e:  # noqa: BLE001 - a renamed property shouldn't block the rest of the grade
            unreal.log_warning(f"[MapleBean] look_cozy: skip {k}: {e}")
    pp.set_editor_property("settings", s)
    les.save_current_level()
    unreal.log("[MapleBean] look_cozy: grade saved")
