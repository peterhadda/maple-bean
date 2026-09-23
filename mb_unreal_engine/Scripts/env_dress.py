"""Furniture, props, new wings and exterior dressing for L_Cafe (idempotent: replaces every MB_Env_* actor).

Run: Scripts/ue_run.sh environment cmd Scripts/env_dress.py
Needs SourceArt/Props from env_bl_props.py, env_bl_props2.py, env_bl_rooms.py (+ env_print_textures.py).
World cm (X = layout x*100, Y = layout z*100). Yaw 0 = prop front faces +Y; -90 faces +X; 90 faces -X; 180 faces -Y.
Nothing here touches the Gameplay folder (MB_Nav*, MB_PlayerStart).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
import env_props  # noqa: E402
from env_common import clear_prefix, eas, hide, les, log, place  # noqa: E402

PLANTS = "/Game/MapleBean/Plants/Meshes"
PAL = "/Game/MapleBean/Materials/Instances"

# Original café pieces replaced by the new furniture (labels, matched exactly or as <label>_NNN).
REPLACED = ["Sofa_upholstered_base", "Sofa_generous_back", "Sofa_rounded_arm", "Sofa_cushion", "Linen_throw_pillow",
            "Armchair_arm", "Armchair_back", "Armchair_cushion", "Armchair_seat", "Espresso_machine", "Machine_front",
            "Portafilter", "Cup_ready_for_espresso", "Pastry_display_base", "Display_canopy", "Display_rear",
            "Maple_bun", "Backboard", "Menu_heading", "Menu_coffee", "Menu_tea", "Menu_bun", "Menu_welcome",
            # east wall of the main room, rebuilt with a doorway by SM_MB_Room_QuietNooks
            "Wing_plaster_wall_003", "Green_wainscot_002", "Oak_dado_002", "Panel_moulding_014", "Panel_moulding_015"]

# (mesh, (x, y, z), yaw, scale, upholstery override)
LOUNGE = [
    ("SofaLong", (670, -552, 0), 0, 1.0, "sage_upholstery"),
    ("Sofa", (-680, 258, 0), 0, 1.0, "cinnamon_velvet"),
    ("Armchair", (1114, 142, 0), -153, 1.0, "cinnamon_velvet"),
    ("Armchair", (1626, 142, 0), 153, 1.0, "cinnamon_velvet"),
]
BAR = [
    ("EspressoMachine", (-706, -492, 106), 0, 1.0), ("Grinder", (-640, -478, 106), -10, 1.0),
    ("PastryCase", (-190, -482, 105), 0, 1.0), ("MenuBoard", (-340, -684, 221), 0, 1.0),
    ("CupSaucer", (-430, -452, 105), 20, 1.0), ("CupSaucer", (-470, -458, 105), -30, 1.0),
    ("CupSaucer", (-560, -520, 105), 0, 1.0),
]
DESKS = [
    ("Laptop", (1300, -218, 77), 180, 1.0), ("Laptop", (1430, -172, 77), 0, 1.0),
    ("Notebook", (1440, -222, 77), 165, 1.0), ("Notebook", (1290, -170, 77), 10, 1.0),
    ("BookStack", (1185, -568, 76.5), 15, 1.0), ("BookStack", (1545, -568, 76.5), -10, 1.0),
    ("Laptop", (470, 228, 85), 0, 1.0), ("Notebook", (330, 234, 85), -8, 1.0), ("BookStack", (560, 170, 85), 30, 1.0),
    ("CupSaucer", (1370, -250, 77), 0, 1.0), ("CupSaucer", (1380, 150, 60), 0, 1.0),
]
ART = [
    ("ArtMaple", (-985, 370, 292), -90, 1.0), ("ArtCup", (985, -400, 262), 90, 1.0),
    ("ArtFronds", (780, -686, 190), 0, 1.0), ("ArtHills", (1707, 0, 185), 90, 1.0),
    ("ArtHills", (-200, -686, 300), 0, 0.8), ("ArtFronds", (-500, -686, 300), 0, 0.8),
]
MERCH = [
    ("MerchShelf", (-968, 630, 0), -90, 1.0), ("MerchTable", (-862, 600, 0), -90, 1.0),
    ("SignMerch", (-985, 630, 225), -90, 0.8),
]
DOORS = [  # the west wing was removed at the user's request (2026-09-23); only the nooks sign remains
    ("SignQuiet", (974, 430, 290), 90, 0.8),
]
ROOMS = [("Room_QuietNooks", (0, 0, 0), 0, 1.0)]
NOOKS = [
    ("RugNook", (1186, 560, 0), 90, 1.0), ("RugNook", (1560, 560, 0), 90, 1.0),
    ("Armchair", (1100, 570, 0), -90, 1.0, "sage_upholstery"), ("Armchair", (1272, 570, 0), 90, 1.0, "sage_upholstery"),
    ("Armchair", (1474, 570, 0), -90, 1.0, "cinnamon_velvet"), ("Armchair", (1646, 570, 0), 90, 1.0, "cinnamon_velvet"),
    ("SideTable", (1186, 570, 0), 0, 1.0), ("SideTable", (1560, 570, 0), 40, 1.0),
    ("FloorLamp", (1060, 660, 0), 0, 1.0), ("FloorLamp", (1676, 660, 0), 0, 1.0), ("FloorLamp", (1200, 280, 0), 0, 1.0),
    ("HalfWallPlanter", (1373, 560, 0), 0, 1.0),
    ("ArtMaple", (1707, 470, 185), 90, 1.0), ("ArtFronds", (1014, 600, 185), -90, 1.0),
    ("ArtCup", (1360, 234, 185), 180, 1.0), ("BookStack", (1180, 575, 59.5), 20, 1.0),
]
WEST = []  # west wing removed
EXTERIOR = [
    ("Bench", (-450, 900, 0), 0, 1.0), ("Bench", (450, 900, 0), 0, 1.0), ("BikeRack", (860, 905, 0), 0, 1.0),
    ("StreetLamp", (-1060, 900, 0), 0, 1.0), ("StreetLamp", (1060, 900, 0), 0, 1.0),
    ("SandwichBoard", (-250, 870, 0), 18, 1.0),
]
PLANT_EXTRAS = [  # (plant, (x, y, z), yaw, scale)
    ("Monstera", (-190, 770, 0), 30, 0.9), ("FiddleLeafFig", (190, 770, 0), 120, 0.9),
    ("FiddleLeafFig", (1045, 285, 0), 60, 1.0), ("Monstera", (1670, 290, 0), 200, 1.0),
    ("SnakePlant", (1373, 500, 100), 0, 0.8), ("SnakePlant", (1373, 620, 100), 90, 0.75),
    ("PothosShelf", (1373, 560, 100), -90, 0.9),
    ("PothosShelf", (-968, 630, 160), 0, 0.9), ("Succulent", (-840, 640, 79), 0, 1.3),
    ("PothosHanging", (1186, 640, 345), 0, 1.0), ("PothosHanging", (1560, 640, 350), 90, 1.0),
]
LAMP_LIGHTS = [(1060, 660, 150), (1676, 660, 150), (1200, 280, 150)]  # nook floor lamps


def replaced(label):
    for r in REPLACED:
        if label == r or (label.startswith(r + "_") and label[len(r) + 1:].isdigit()):
            return True
    return False


def run():
    meshes, _ = env_props.build()
    removed = clear_prefix("MB_Env_")
    clear_prefix("MB_EnvLamp_")
    n = 0
    groups = [("Art/Furniture", LOUNGE + NOOKS), ("Art/CoffeeBar", BAR), ("Art/Props", DESKS + ART + MERCH),
              ("Art/Rooms", ROOMS + DOORS + WEST), ("Art/Exterior", EXTERIOR)]
    for folder, items in groups:
        for item in items:
            name, (x, y, z), yaw, scale = item[:4]
            mesh = meshes.get(name)
            if not mesh:
                log(f"missing mesh {name}")
                continue
            a = place(mesh, f"MB_Env_{name}_{n:03d}", unreal.Vector(x, y, z), yaw, scale, folder,
                      collide=name.startswith("Room_"))
            if len(item) > 4:  # per-actor upholstery colour
                mi = unreal.load_asset(f"{PAL}/MI_MB_{item[4]}")
                for i, sm in enumerate(mesh.static_materials):
                    if "upholstery" in str(sm.material_slot_name).lower():
                        a.static_mesh_component.set_material(i, mi)
            n += 1
    for name, (x, y, z), yaw, scale in PLANT_EXTRAS:
        mesh = unreal.load_asset(f"{PLANTS}/SM_MB_{name}")
        if mesh:
            place(mesh, f"MB_Env_Plant_{name}_{n:03d}", unreal.Vector(x, y, z), yaw, scale, "Art/Plants", collide=False)
            n += 1
    for i, (x, y, z) in enumerate(LAMP_LIGHTS):
        a = eas.spawn_actor_from_class(unreal.PointLight, unreal.Vector(x, y, z), unreal.Rotator(0, 0, 0))
        a.set_actor_label(f"MB_EnvLamp_{i:02d}")
        a.set_folder_path("Lighting")
        c = a.point_light_component
        c.set_mobility(unreal.ComponentMobility.MOVABLE)
        c.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
        c.set_intensity(30.0)
        c.set_attenuation_radius(380.0)
        c.set_editor_property("use_temperature", True)
        c.set_editor_property("temperature", 2900.0)
        c.set_cast_shadows(False)
    hidden = 0
    for a in eas.get_all_level_actors():
        if isinstance(a, unreal.StaticMeshActor) and replaced(a.get_actor_label()):
            hide(a)
            hidden += 1
    log(f"dress: removed {removed} old MB_Env_*, placed {n}, hid {hidden} original pieces")


les.load_level("/Game/MapleBean/Maps/L_Cafe")
run()
les.save_current_level()
log("env_dress done")
