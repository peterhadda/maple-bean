# Agent B: Environment log

Owner of: `Content/MapleBean/{Environment,Materials,Textures,Plants,Props,Furniture,Lighting}`, `Scripts/lookdev.py`,
`Scripts/make_textures.py`, `Scripts/env_*`, `SourceArt/{Textures,Plants,Props}`, and the art and lighting actors in L_Cafe.

## Pipeline (all idempotent, re-run in this order)

| Step | Command | Output |
|---|---|---|
| Leaf atlas | `python Scripts/env_leaf_textures.py` | `SourceArt/Plants/Textures/T_MB_FoliageAtlas_{D,N}.png` |
| Print textures | `python Scripts/env_print_textures.py` | chalk menu, sandwich board, art prints, room signs |
| Plant library | `Scripts/env_blender.sh Scripts/env_bl_plants.py [--preview]` | `SourceArt/Plants/SM_MB_*.fbx` (8 plants) |
| Props | `Scripts/env_blender.sh Scripts/env_bl_props.py` / `env_bl_props2.py` | `SourceArt/Props/SM_MB_*.fbx` |
| Room shells | `Scripts/env_blender.sh Scripts/env_bl_rooms.py` | `SourceArt/Props/SM_MB_Room_*.fbx` |
| UE plants | `Scripts/ue_run.sh environment cmd Scripts/env_plants.py` | `/Game/MapleBean/Plants`, swaps the plants in L_Cafe |
| UE dressing | `Scripts/ue_run.sh environment cmd Scripts/env_dress.py` | `/Game/MapleBean/Props`, `/Environment/Rooms`, places `MB_Env_*` |
| UE lighting | `Scripts/ue_run.sh environment cmd Scripts/env_lighting.py` | lights set to Movable, window rect lights, grade |
| Inspect | `Scripts/ue_run.sh environment cmd Scripts/env_dump.py` | `Saved/env_dump.json` (every actor, bounds, mats) |

`env_blender.sh` is a Blender lock (it waits for `Saved/blender.lock` and for any other `blender.exe`).
Shared helpers: `env_common.py` (UE), `env_bl_lib.py` and `env_bl_shapes.py` (Blender).

## Rules I follow in L_Cafe
- New actors are labelled `MB_Plant_*`, `MB_Env_*`, `MB_EnvWindow_*`, `MB_EnvLamp_*`, `MB_EnvStreet_*`. Each script
  deletes only its own prefix. `env_common.PROTECTED` skips `MB_Nav*` and `MB_PlayerStart`.
- Original café pieces are never deleted. They are hidden (invisible, no collision) and moved to the `Art/Replaced` folder.
- `lookdev.py` cleanup now only matches its lighting labels (`MB_Sun`, `MB_Sky*`, `MB_Fog`, `MB_Lamp_`, `MB_Grade`).
  Before this change it destroyed every `MB_*` actor, gameplay ones included.
- Indoor plants and props have no collision (the Gameplay `MB_Nav*` blockers cover layout.json obstacles).
  Trees have trunk capsules (UCX). The Quiet Nooks room shell has floor and wall box collision.

## Log

### 2026-09-23: plants (milestone 1)
- Cause of the "Preview" watermark: stationary lights draw "Preview" into unbuilt shadows. All lights are now
  Movable (`env_lighting.py`, and `lookdev.py` spawns them Movable). The stray 2 m default `Cube` at the origin is hidden.
- Leaf atlas painted with PIL: fiddle-leaf, monstera (splits and holes), banded snake-plant blade, variegated pothos,
  succulent, and two twig cards for trees. It has alpha, vein normals and per-leaf colour jitter.
- Blender plant library (tris): FiddleLeafFig 3.1k, Monstera 2.7k, SnakePlant 1.4k, PothosHanging 3.5k,
  PothosShelf 1.6k, Succulent 1.3k, TreeRound 3.8k, TreeTall 3.3k. Leaves are curved and cupped cards with vertex-colour
  variation. Tree canopies are clustered cards with spherical normals. Pots are terracotta or cream with soil.
- `M_MB_Foliage`: masked, two-sided, Two Sided Foliage shading (subsurface), atlas × vertex colour × tint, and a
  per-object hue drift hashed from actor position. It has instances for indoor plants and trees.
- Swap: 305 original leaf, frond, pot, soil, canopy and trunk parts hidden. 47 library plants placed at the same pots
  and trunks (every layout.json `plant` station keeps a plant). Additions: hanging pothos at the front windows,
  study and games windows and the bar; trailing pothos on the wall shelves and bookcases; succulents on café tables,
  sills, counter and side table.
- LODs: `set_lods` reports success, but the meshes still have 1 LOD in commandlet runs (open item).

### Final pass summary (env-final: `mb_unreal_engine/Saved/QA/env-final/*.png`)
1. Plants: 8 procedural Blender plants on `M_MB_Foliage` replace the 305 faceted leaf, pot and canopy parts. 47 swapped in place, plus hanging, shelf and succulent extras.
2. Furniture and props (`env_dress.py`, 86 actors): rounded sofas and armchairs, espresso machine, grinder, pastry case, chalk menu, cups, laptops, notebooks, books, framed art, merch shelf and table.
3. New wings: Quiet Nooks (x 10..17.2, z 2.2..7, real doorway, collision) and West wing (restroom lobby, 2 restrooms, staff/storage behind closed doors). Exterior: benches, bike rack, 2 street lamps, sandwich board.
4. Lighting: all lights Movable (fixes the "Preview" shadow watermark), warm window rect lights, lamp lights in the nooks and west wing, and a grade eased toward neutral-warm. setup_gameplay.py was re-run before the final shot.
5. Open items: the FBX vertex colours import black, so MB_VC parts use a kraft material; LOD generation does not apply in commandlets; the wings are not in layout.json nav.
