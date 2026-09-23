"""Read-only probe of L_Cafe for gameplay QA: collision on the café meshes, nav actors, player start.

Run: Scripts/ue_run.sh movement-qa cmd Scripts/qa_probe_level.py
Prints [Probe] lines only; never saves.
"""
import unreal

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
les.load_level("/Game/MapleBean/Maps/L_Cafe")

counts = {"meshes": 0, "no_collision_mesh": 0, "collision_disabled": 0}
floorish = []
examples = []
for a in eas.get_all_level_actors():
    label = a.get_actor_label()
    cls = a.get_class().get_name()
    if cls in ("NavMeshBoundsVolume", "RecastNavMesh", "PlayerStart", "NavigationData"):
        extra = ""
        if cls == "RecastNavMesh":
            extra = f" runtime_generation={a.get_editor_property('runtime_generation')}"
        unreal.log(f"[Probe] {cls} {label} at {a.get_actor_location()}{extra}")
    for c in a.get_components_by_class(unreal.StaticMeshComponent):
        sm = c.static_mesh
        if not sm:
            continue
        counts["meshes"] += 1
        body = sm.get_editor_property("body_setup")
        has_simple = False
        trace = "?"
        if body:
            agg = body.get_editor_property("agg_geom")
            has_simple = any(len(agg.get_editor_property(k)) for k in ("box_elems", "sphere_elems", "sphyl_elems", "convex_elems"))
            trace = str(body.get_editor_property("collision_trace_flag"))
        enabled = str(c.get_collision_enabled())
        if "NO_COLLISION" in enabled.upper():
            counts["collision_disabled"] += 1
        if not has_simple and "USE_COMPLEX_AS_SIMPLE" not in trace.upper():
            counts["no_collision_mesh"] += 1
        name = sm.get_name().lower()
        if "floor" in name or "floor" in label.lower():
            floorish.append(f"{label}:{sm.get_name()} simple={has_simple} trace={trace} coll={enabled}")
        if len(examples) < 12:
            examples.append(f"{label}:{sm.get_name()} simple={has_simple} trace={trace} coll={enabled}")

unreal.log(f"[Probe] counts {counts}")
for f in floorish[:10]:
    unreal.log(f"[Probe] floor {f}")
for e in examples:
    unreal.log(f"[Probe] mesh {e}")
