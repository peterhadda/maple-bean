"""Lighting polish on top of lookdev.py's rig (idempotent; only touches the Lighting folder + MB_Env* lights).

Run: Scripts/ue_run.sh environment cmd Scripts/env_lighting.py
- Every light movable: nothing is baked, and stationary lights print "Preview" into unbuilt shadows.
- Warm window light: soft rect lights just inside the shopfront and wing windows, plus the street lamp glow.
- Grade: warm but less orange than the first slice (white balance nudged up, saturation eased).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
from env_common import clear_prefix, eas, les, log  # noqa: E402

LIGHT_TYPES = (unreal.Light, unreal.SkyLight, unreal.SkyAtmosphere, unreal.ExponentialHeightFog)
# (x, y, z, yaw, width, height, intensity cd): rect lights facing into the room from each window.
WINDOWS = [(-730, 660, 200, -90, 360, 200, 18.0), (-330, 660, 200, -90, 360, 200, 18.0),
           (330, 660, 200, -90, 360, 200, 18.0), (730, 660, 200, -90, 360, 200, 18.0),
           (1200, -600, 210, 90, 160, 200, 10.0), (1510, -600, 210, 90, 160, 200, 10.0),
           (1340, 190, 210, -90, 200, 200, 10.0), (1250, 660, 195, -90, 200, 200, 10.0),
           (1550, 660, 195, -90, 200, 200, 10.0)]
STREET_LAMPS = [(-1080, 900, 355), (1080, 900, 355)]


def movable_all():
    n = 0
    for a in eas.get_all_level_actors():
        if isinstance(a, LIGHT_TYPES) and a.root_component:
            a.root_component.set_mobility(unreal.ComponentMobility.MOVABLE)
            n += 1
    return n


def window_lights():
    clear_prefix("MB_EnvWindow_")
    clear_prefix("MB_EnvStreet_")
    for i, (x, y, z, yaw, w, h, cd) in enumerate(WINDOWS):
        a = eas.spawn_actor_from_class(unreal.RectLight, unreal.Vector(x, y, z), unreal.Rotator(0, 0, yaw))
        a.set_actor_label(f"MB_EnvWindow_{i:02d}")
        a.set_folder_path("Lighting/Windows")
        c = a.rect_light_component
        c.set_mobility(unreal.ComponentMobility.MOVABLE)
        c.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
        c.set_intensity(cd)
        c.set_editor_property("source_width", w)
        c.set_editor_property("source_height", h)
        c.set_attenuation_radius(650.0)
        c.set_editor_property("use_temperature", True)
        c.set_editor_property("temperature", 4600.0)
        c.set_editor_property("barn_door_angle", 70.0)
        c.set_cast_shadows(False)
    for i, (x, y, z) in enumerate(STREET_LAMPS):
        a = eas.spawn_actor_from_class(unreal.PointLight, unreal.Vector(x, y, z), unreal.Rotator(0, 0, 0))
        a.set_actor_label(f"MB_EnvStreet_{i:02d}")
        a.set_folder_path("Lighting/Exterior")
        c = a.point_light_component
        c.set_mobility(unreal.ComponentMobility.MOVABLE)
        c.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
        c.set_intensity(40.0)
        c.set_attenuation_radius(600.0)
        c.set_editor_property("use_temperature", True)
        c.set_editor_property("temperature", 2800.0)
        c.set_cast_shadows(False)


def grade():
    pp = next((a for a in eas.get_all_level_actors() if a.get_actor_label() == "MB_Grade"), None)
    if not pp:
        log("no MB_Grade (run lookdev.py first)")
        return
    s = pp.settings
    for k, v in (("override_white_temp", True), ("white_temp", 6200.0),
                 ("override_color_saturation", True), ("color_saturation", unreal.Vector4(1.0, 1.0, 0.97, 1.0)),
                 ("override_color_gain", True), ("color_gain", unreal.Vector4(1.0, 0.99, 0.97, 1.0))):
        s.set_editor_property(k, v)
    pp.set_editor_property("settings", s)


les.load_level("/Game/MapleBean/Maps/L_Cafe")
log(f"{movable_all()} lights set movable")
window_lights()
grade()
les.save_current_level()
log("env_lighting done")
