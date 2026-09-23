"""Dump every L_Cafe actor (label, class, folder, transform, bounds, mesh, materials) to Saved/env_dump.json.

Run: Scripts/ue_run.sh environment cmd Scripts/env_dump.py      (read-only; does not save the level)
Used by the environment agent to find plant parts, text meshes and free floor space.
"""
import json
import os

import unreal

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level("/Game/MapleBean/Maps/L_Cafe")
out = []
for a in eas.get_all_level_actors():
    o, e = a.get_actor_bounds(False)
    r = a.get_actor_rotation()
    s = a.get_actor_scale3d()
    rec = {"label": a.get_actor_label(), "cls": a.get_class().get_name(), "folder": str(a.get_folder_path()),
           "loc": [round(v, 1) for v in (a.get_actor_location().x, a.get_actor_location().y, a.get_actor_location().z)],
           "rot": [round(r.roll, 1), round(r.pitch, 1), round(r.yaw, 1)], "scale": [round(s.x, 3), round(s.y, 3), round(s.z, 3)],
           "o": [round(o.x, 1), round(o.y, 1), round(o.z, 1)], "e": [round(e.x, 1), round(e.y, 1), round(e.z, 1)],
           "hidden": a.is_hidden_ed()}
    if isinstance(a, unreal.StaticMeshActor):
        c = a.static_mesh_component
        m = c.static_mesh
        rec["mesh"] = m.get_path_name() if m else None
        rec["mats"] = [mi.get_name() if mi else None for mi in c.get_materials()]
        if m:
            rec["tris"] = m.get_num_triangles(0)
    out.append(rec)
path = os.path.join(unreal.Paths.project_saved_dir(), "env_dump.json")
with open(path, "w", encoding="utf8") as f:
    json.dump(out, f, indent=0)
unreal.log(f"[MapleBean] dumped {len(out)} actors to {path}")
