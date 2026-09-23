"""Make L_Cafe playable: walkable floor + obstacle colliders from layout.json, NavMesh bounds, a PlayerStart.

The imported café meshes carry no collision (1552 meshes, none with simple collision), so movement follows the
web build's own walkability rules (navigation.js isWalkable): the main room, the entrance doorway, the two wings and
their door rects are floor; every layout obstacle is a blocker. All helpers are invisible, live in the Gameplay
folder and are named MB_Nav*, so they never touch the Environment agent's content.

Run: Scripts/ue_run.sh movement-qa cmd Scripts/setup_gameplay.py
Idempotent. Positions use MBLayoutSubsystem::ToWorld (X = x*100, Y = z*100).
"""
import json
import os

import unreal

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
les.load_level("/Game/MapleBean/Maps/L_Cafe")

layout_path = os.path.join(unreal.Paths.project_content_dir(), "MapleBean", "Data", "layout.json")
with open(layout_path, encoding="utf8") as f:
    L = json.load(f)

removed = 0
for a in eas.get_all_level_actors():
    label = a.get_actor_label()
    if label.startswith("MB_Nav") or label == "MB_PlayerStart":
        eas.destroy_actor(a)
        removed += 1

# Floor height: top of the imported floorboards (median), so the slabs sit flush under the visible floor.
tops = []
for a in eas.get_all_level_actors():
    if "floorboard" in a.get_actor_label().lower():
        origin, extent = a.get_actor_bounds(False)
        tops.append(origin.z + extent.z)
tops.sort()
floor_z = tops[len(tops) // 2] if tops else 0.0
unreal.log(f"[MapleBean] floor z = {floor_z:.1f} cm from {len(tops)} floorboards; removed {removed} old helpers")

CUBE = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")  # 100 cm, pivot at the centre, simple box collision


def box(label, x0, x1, z0, z1, bottom, height):
    """Invisible collision box over layout rect [x0,x1] x [z0,z1] (metres), from bottom to bottom+height (cm)."""
    cx, cy = (x0 + x1) * 50.0, (z0 + z1) * 50.0
    # spawn_actor_from_object crashes in commandlets (no placement subsystem), so spawn the class and set the mesh.
    a = eas.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(cx, cy, bottom + height / 2.0))
    a.static_mesh_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    a.static_mesh_component.set_static_mesh(CUBE)
    a.set_actor_label(label)
    a.set_actor_scale3d(unreal.Vector(abs(x1 - x0), abs(z1 - z0), height / 100.0))
    a.set_folder_path("Gameplay")
    a.set_actor_hidden_in_game(True)
    c = a.static_mesh_component
    c.set_visibility(False)
    c.set_editor_property("cast_shadow", False)
    c.set_collision_profile_name("BlockAll")
    c.set_mobility(unreal.ComponentMobility.STATIC)
    return a


# Walkable floor: web keeps the body centre .35 m from walls; Recast erodes by the 24 cm agent radius,
# so shrink the room slabs by the remaining 11 cm. Doorways are not shrunk (they bridge the walls).
W, D, E = L["width"] / 2.0, L["depth"] / 2.0, L["entrance"]
s = 0.11
slabs = [("MB_NavFloor_Main", -W + s, W - s, -D + s, D - s),
         ("MB_NavFloor_Entrance", -E["halfWidth"], E["halfWidth"], D - 0.5, E["endZ"])]
for r in L.get("rooms", []):
    slabs.append((f"MB_NavFloor_{r['id']}", r["x0"] + s, r["x1"] - s, r["z0"] + s, r["z1"] - s))
for d in L.get("doors", []):
    slabs.append((f"MB_NavFloor_{d['id']}", d["x0"], d["x1"], d["z0"], d["z1"]))
for label, x0, x1, z0, z1 in slabs:
    box(label, x0, x1, z0, z1, floor_z - 10.0, 10.0)

# Furniture footprints (tables, counter, sofas, shelves...) block walking and carve the NavMesh.
for i, o in enumerate(L["obstacles"]):
    box(f"MB_NavBlock_{i:02d}", o["x"] - o["w"] / 2, o["x"] + o["w"] / 2, o["z"] - o["d"] / 2, o["z"] + o["d"] / 2, floor_z, 100.0)

# NavMesh bounds over the whole café + wings (x -11..18, z -15..10 m), floor to 3 m.
x0, x1, z0, z1 = -11.0, 18.0, -15.0, 10.0
nav = eas.spawn_actor_from_class(unreal.NavMeshBoundsVolume,
                                 unreal.Vector((x0 + x1) * 50.0, (z0 + z1) * 50.0, floor_z + 150.0))
nav.set_actor_label("MB_NavBounds")
nav.set_actor_scale3d(unreal.Vector((x1 - x0) * 100.0 / 200.0, (z1 - z0) * 100.0 / 200.0, 300.0 / 200.0))
nav.set_folder_path("Gameplay")

for a in eas.get_all_level_actors():
    if a.get_class().get_name() == "RecastNavMesh":
        a.set_editor_property("runtime_generation", unreal.RuntimeGenerationType.DYNAMIC)
        unreal.log(f"[MapleBean] {a.get_actor_label()} runtime generation -> Dynamic")

start = eas.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(0.0, 850.0, floor_z + 100.0),
                                   unreal.Rotator(0.0, 0.0, -90.0))  # (roll, pitch, yaw): face into the café (-Y)
start.set_actor_label("MB_PlayerStart")
start.set_folder_path("Gameplay")

les.save_current_level()
unreal.log(f"[MapleBean] gameplay: {len(slabs)} floor slabs, {len(L['obstacles'])} blockers, nav bounds, player start")
