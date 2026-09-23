# Agent C: Movement & QA log

Owner of `mb_unreal_engine/Source/**`, `Config/**`, the `.uproject`, `Scripts/{setup_gameplay,setup_animation,qa_*}.py`,
`Scripts/ue_run.sh`, `FinishSetup.cmd`, the `Gameplay` folder in L_Cafe (`MB_Nav*`, `MB_PlayerStart`), and `docs/unreal/qa/**`.

## Wrapper (`Scripts/ue_run.sh <owner> <mode>`, one UE/UBT process at a time)

| mode | what |
|---|---|
| `cmd <script.py>` | headless commandlet (unchanged) |
| `shot <tag>` | full-editor render on the C++-free copy → `Saved/QA/<tag>`; env `MB_CHAR_VARIANT=Current\|V2` |
| `edpy <script.py>` | Python in a Slate editor session with `-nullrhi`, quits when done (for the IK retarget batch, which crashes in commandlets) |
| `build` | UBT editor target |
| `test [filter] [window]` | automation tests (default `MapleBean`), log `Saved/Logs/MBTest.log`, report `Saved/Automation/<filter>` |
| `raw <cmd…>` | anything else under the lock |

Triptychs: `python Scripts/qa_triptych.py <tag>` → `docs/unreal/qa/<tag>/<shot>_triptych.png` (web | UE | target).

## 2026-09-23

### Build
- The first FinishSetup UAC run was approved, but the VS installer exited with code 87: `setup.exe` rejects `--wait`. I fixed the script (`start /wait`, it waits for setup.exe, takes `ue.lock` for its build, logs to `Saved/Logs/FinishSetup_build.log`) and relaunched it. The user approved, and the .NET 4.8.1 SDK and MSVC 14.38 installed.
- The editor target builds (pinned to `-CompilerVersion=14.44.35207` while 14.38 was still downloading): **Result: Succeeded**.
- `.uproject` now has the `MapleBeanUE` Runtime module; `GlobalDefaultGameMode=/Script/MapleBeanUE.MBGameMode` is enabled.

### Gameplay setup (L_Cafe, folder `Gameplay`)
- Probe: the 1552 imported café mesh components have **no collision** (no simple shapes, not complex-as-simple), so the imported meshes give the NavMesh and the capsule nothing to stand on.
- `setup_gameplay.py` ports the web walkability rules (navigation.js `isWalkable`): invisible floor slabs for the main room, entrance, both wings and door rects, plus 74 invisible `MB_NavBlock_*` boxes for the layout obstacles, `MB_NavBounds` and `MB_PlayerStart`. The NavMesh is generated at runtime (`RuntimeGeneration=Dynamic`), so no baked nav data is needed.
- C++: `bCanWalkOffLedges=false` (WASD can't leave the floor); the seat sidle now sweeps against pawns only, so a chair's own blocker doesn't stop the sit (web `peopleStepClear`); regulars are spawn-deferred so `PersonId` is set before `ApplyLook` (previously every regular wore Maya's mesh); the player pawn no longer spawns a stray AIController.

### Animation
- Source clips are copied unchanged from the engine's TP_ThirdPerson resources to `/Game/Characters/Mannequins` (MM_Idle, MF_Unarmed_Walk/Jog, SKM_Manny_Simple, SK_Mannequin).
- `setup_animation.py`: `IK_Manny` (auto definition), `IK_MapleBean` (retarget root `hips`; Spine, Neck, Head, arms, legs and finger chains named like the mannequin's), `RTG_Manny_to_MapleBean` (default op stack, fuzzy chain map, target auto-aligned), and `A_<Name>_Idle/Walk` per character (every character has its own skeleton). Jules, Mara and Noah had no `_Skeleton` package when this ran, so they are skipped until re-run.
- `UMBAnimInstance` (C++): a custom proxy blends Idle and Walk by the measured ground speed (walk play rate scales with speed; the sidle counts as walking) and adds a procedural sit on `SitAlpha`: pelvis dropped to the seat, thighs forward, shins down, feet kept flat, hands on the lap. `ABP_MapleBean` is a template Anim Blueprint whose parent is this class. `ApplyLook` assigns it, or the native class if the blueprint is missing.
