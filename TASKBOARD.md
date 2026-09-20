# Maple Bean — Phase 2 Expansion Task Board

Shared board for the six Phase 2 agents. **Every card is one line** so parallel edits stay small:

```
- [STATUS] A<agent>-<nn> · what changed / what to do · files · evidence (screenshot/test path)
```

STATUS is one of: `TODO` · `IN PROGRESS` · `READY FOR QA` · `FAILED QA` · `APPROVED`

Rules
- Only edit **your own cards** (your agent prefix). QA (A6) is the only agent that moves cards to `APPROVED` or `FAILED QA`, and appends `— QA: <reason>` to the card.
- A6 files bugs it finds in someone else's area as `A6-Bnn` cards under **that owner's** section with `[FAILED QA]`, naming the owner. The owner fixes it and flips it to `READY FOR QA`.
- Use the Edit tool for single-line changes to this file; re-read before editing (other agents write here too).
- Small, testable changes. Inspect → plan → implement → run → screenshot/test → READY FOR QA.

## Ownership (do not edit files you do not own; ask via a card instead)

| Agent | Owns (write access) | Shared hook points |
|---|---|---|
| A1 Characters | `assets/characters/**`, `assets/character-kit/**`, `characters.js`, `tools/author_characters.py`, `tools/*_hair.py`, `tools/noah_garments.py`, `navigation.js`, `cafe-life.js` (NPC movement/avoidance), `systems/crowd.js` (new) | app.js: player↔people blocking + NPC update loop (§ "regulars", movement block) |
| A2 Environment | `MapleBeanExpanded.blend`, `assets/cafe.glb`, `assets/cafe-ambient.glb`, `assets/visual-world.js`, `tools/build_cafe.py`, `tools/build_wings.py`, `tools/bake_cafe_ao.py`, new `tools/env_*.py`, `systems/lighting.js` (new) | app.js: renderer/lights block (lines ~40–56) and `$('lighting').onchange`. `assets/layout.json` positions are a **gameplay contract**: A2 may add obstacles/props but must not move stations/seats without an A6-approved card |
| A3 Interaction | `activities.js`, `study.js`, `focus.js`, `music.js`, `game-scenes.js`, `games/**`, `world.js`, `effects.js`, `interactions.js`, `systems/music-*.js`, `systems/camera-director.js` (new) | app.js: ordering, study/focus, games, talk/hangout, emotes, input sections; `index.html`/`style.css` for focus/music/game HUD |
| A4 Creator | `systems/creator*.js` (new), creator markup/CSS blocks in `index.html` / `style.css` (clearly delimited `<!-- creator -->` / `/* creator */` blocks) | app.js: one entry hook (open creator before entering / from profile). Needs A1 to expose any new appearance params in `runtime.js` via a card |
| A5 Economy | `economy.js`, `shop.js`, `relationships.js`, `save.js`, `systems/state.js` (new), `systems/rewards.js` (new) | app.js: saved-state block (lines ~58–72), `grant()`, `updateHUD()`, reward call sites (coordinate with A3 via cards) |
| A6 QA | `qa/**`, `tests/**` (new test files), `TASKBOARD.md` statuses | May fix trivial one-liners anywhere **only after** posting the card and if the owner is not mid-edit; otherwise route to owner |

Coordinator (main session) owns `server.mjs`, `package.json`, `README.md`, `.claude/launch.json`. New browser modules go in **`systems/`** (already served; no server restart needed). Server code changes need a restart: ask the coordinator via a card.

Environment facts
- Shared server: `http://127.0.0.1:4321` (coordinator's; do **not** kill or restart it). Every headless browser joins as a guest, so for clean screenshots run **your own private server**: `PORT=<your port> node server.mjs` (Bash, run_in_background) and pass `CAFE_URL=http://127.0.0.1:<port>/` to `qa/shoot.mjs` / `qa/qa-gameplay.mjs`. Ports: A1 4331 · A2 4332 · A3 4333 · A4 4334 · A5 4335 · A6 4336. Kill only your own server when done. `layout.json` now hot-reloads on the server.
- Visual QA: `node qa/shoot.mjs <outDir> <views.mjs> 1600 1000` (headless Chrome, real GPU via `--use-angle=d3d11`). Fixed review views: `qa/expansion/views.mjs`. Baseline shots: `qa/expansion/baseline/`.
- Gameplay E2E: `node qa/qa-gameplay.mjs <outDir>`. Unit tests: `node --test tests/*.test.mjs` (41 passing at start).
- Blender 5.2: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.
- Never `git stash` / `git checkout` files while the server runs (Windows locks `assets/cafe.glb`). Never commit.
- References: `design-assets/reference/cast-and-cafe.jpg` (cast sheet + café interior), `design-assets/reference/floor-plan.webp` (isometric floor-plan target).
- Pre-phase snapshot of every modified/untracked file: scratchpad `snapshot-pre-phase2/` (coordinator can restore).

---

## A1 · Characters (visual + in-world behaviour)
- [READY FOR QA] A1-01 · Compare each of maya/claire/noah/mara/jules to `design-assets/reference/cast-and-cafe.jpg`; list top 3–5 visual gaps per character in `qa/expansion/characters/GAPS.md` · qa/expansion/characters/GAPS.md · qa/expansion/characters/pass0/compare-faces.png, compare-bodies.png (Jules skin tone vs sheet flagged, not changed)
- [IN PROGRESS] A1-02 · Guests/regulars never overlap: separation/avoidance between all people (player, NPCs, remote guests) incl. NPC↔NPC · navigation.js, cafe-life.js, systems/crowd.js · —
- [TODO] A1-03 · Two players spawn on the same spot at the door. Server half DONE by coordinator (join now returns a staggered free spawn x/z). Client half: app.js still hard-codes `me = { x: 0, z: 8.3 }` — use `session.x/z` after join · app.js · —

## A2 · Environment
- [READY FOR QA] A2-01 · Reference comparison of café vs `cast-and-cafe.jpg` (top-right) and `floor-plan.webp`; top 5 gaps (1 flat lighting/evening, 2 sparse bar, 3 repetitive greenery + sphere trees, 4 boxy chairs/sofas, 5 plain windows/storefront) · qa/expansion/environment/GAPS.md · qa/expansion/environment/pass0/
- [IN PROGRESS] A2-02 · Visual loop: warm lighting module (`systems/lighting.js`), bar dressing, plant species + trees, curved chairs, steel-pane windows, storefront props, ceiling beams + hanging plants · systems/lighting.js, systems/env-dressing.js (new), assets/visual-world.js, app.js lights block · qa/expansion/environment/passN/

## A3 · Interaction + Animation
- [TODO] A3-01 · Audit every interaction (order, sit, study/focus, music, water, talk, hangout, study-together, games ×6, emotes, gifts) → `qa/expansion/interactions/AUDIT.md` · — · —

## A4 · Character Creator
- [IN PROGRESS] A4-01 · Inspect Figma creator frames + runtime appearance params; write creator plan `qa/expansion/creator/PLAN.md` · — · qa/expansion/creator/figma/
- [IN PROGRESS] A4-02 · **Heads-up A1:** A4 adds ONE delimited `// --- appearance API (A4)` block to `assets/characters/runtime.js` (module helper + 1 call inside createMaya + `...appearance` spread in its return). Adds setSkinTone / setEyeColor / setFace (borrow a cast face+lashes+eyes mesh) / setBlush / setLashes for `customizable` avatars only; rest of the file untouched. Tell me on this card if you'd rather own it · assets/characters/runtime.js · —

## A5 · Social + Economy + Progression
- [IN PROGRESS] A5-01 · Audit reward sources for farming exploits / duplicate grants; central tuning table · economy.js, systems/rewards.js · qa/expansion/economy/AUDIT.md

## A6 · QA / Simulation Guardian
- [TODO] A6-01 · Automated simulation checks (people overlap, seat double-occupancy, standing inside furniture, feet height, camera inside heads, stuck NPCs, sliding, reward duplication) → `qa/expansion/sim-guardian.mjs` · qa/** · —


## Continuation · 2026-09-19 (current coordinated pass)
**Historical cards above are superseded by the latest verified cards below; they are not current completion claims.** The saved board above records earlier work; these cards track this continuation. Four concurrent slots are available, so specialists rotate through the six roles. Root owns shared integration and this board; agents report cards instead of writing it concurrently.
- [APPROVED] A6-R01 · Ran baseline game: entry, ordering/handoff, sitting/standing, watering, chat, study choreography/timer/completion; no initial browser errors · qa/expansion/resume-gameplay · steps 1–16
- [APPROVED] A2-R01 · Replace exterior sphere clusters with folded leafy instanced crowns; add brass tray/ceramic cups from measured counter bounds · assets/visual-world.js · qa/expansion/env-after/overview.png, bar.png; 218 draw calls unchanged, ~585k triangles
- [READY FOR QA] A1-R01 · Swept furniture collision, actor separation, stalled-route detours; mutable world people references integrated · navigation.js, cafe-life.js, app.js · tests/navigation.test.mjs (4 passing)
- [IN PROGRESS] A1-R02 · Preserve all five cast identities and refine an existing visual gap; Jules/Mara originals retained · character assets · no 95% resemblance claim
- [APPROVED] A3-R01 · 25-minute focus preset, explicit Pause/Music/Leave, live Now Listening, volume and local audio error handling · study.js, music.js, app.js, index.html, style.css · social-focus runtime, creator-runtime music playback, music lifecycle checks
- [APPROVED] A3-R02 · Reachable spaced social approach; gifts and conversation require physical arrival · app.js, systems/social-approach.js · social-approach unit + social-focus runtime; Mara public side gap2.05m, cancelled remote gift pays nothing
- [IN PROGRESS] A4-R01 · Inspect saved Figma creator frames; implement live preview and persisted appearance using current avatar · systems/creator*.js · qa/expansion/creator/figma
- [READY FOR QA] A5-R01 · Stable completion IDs, finite reward validation, duplicate event protection; integrate migrated save/order/help/study/game lifecycle · economy.js, systems/rewards.js, app.js · 14 targeted checks pass; runtime integrated QA pending
- [TODO] A6-R02 · Integrated regression, creator persistence, focus/music runtime screenshots and mobile layout check · qa/expansion · pending


## Latest visual / gameplay review
- [APPROVED] A2-R02 · Brighter warm evening fill, open bookcase shells, study wall panels, notebook laptop screens, idle game boards and dartboard backing; games remain in north wing, study east · systems/lighting.js, assets/visual-world.js · qa/expansion/env-night-after; 236 draws, 612523 triangles, room checks pass
- [APPROVED] A3-R03 · Runtime verifies25min Focus pause/resume/cancel, Now Listening playback, social approach public side, no remote gift charge · qa/expansion/social-focus, creator-runtime · browser errors[]
- [READY FOR QA] A4-R02 · Creator connected to welcome/menu; authored bases, owned wardrobe, live preview rotation/zoom, name/appearance persistence · systems/creator.js, app.js · creator save/reload passes; true iris-color shader corrected after visual QA
- [FAILED QA] A1-R03 · Closeup dynamic blink shows exposed eyeball wedges; hoodie/joint gaps visible. Corrective mesh edits reverted to painted source while isolating baseline issue · character assets · qa/expansion/final-runtime/01-green-eyes.png; NO visual completion claim
- [IN PROGRESS] A1-R04 · Continue reference-guided face/body refinement only after baseline blink/joint defects are corrected · character agent owns GLBs/tools
- [APPROVED] HANDS-01 · Wrist quaternion transitions, knuckle connection, cup grip/sip, typing and dart aiming alignment; wrist-weight GLB patch preserves original geometry · assets/characters/body-pose.js, character assets · four hand checks; qa/expansion/hands/after; accepted-current final photos by A1 supersede shoulder-trial shots
- [READY FOR QA] A6-R03 · Stalled route cancellation, reserved NPC seats, separated spawns, cancelled-order refund/handoff guards, counter-slot choice, safe Mara camera and head clearance · activities.js, navigation.js, cafe-life.js, app.js · four focused Actor/navigation checks pass; integrated retest pending
- [APPROVED] A5-R02 · Creator/economy reload and order cancellation refund observed; final earlier suite49/49 · qa/expansion/final-tests.txt · rerun required after current hands/model fixes

## Final integrated QA evidence (2026-09-19)
- [APPROVED] A6-R04 · Real handoff cancellation via Escape during cup reach refunds once and grants no drink; settled customer-side Mara camera; headphone presence private unless opted in · qa/handoff-runtime.mjs · errors []; qa/expansion/final-runtime/03-mara-public-camera.png
- [APPROVED] A6-R05 · Snake at arcade launches and returns without leave rewards; XO seats both actors, hides idle board while active and restores it after exit · qa/expansion/games-return, qa/final-runtime.mjs · qa/expansion/final-runtime/02-xo-at-table.png; browser errors [] up to handoff (old goHome cancellation assertion was a test error, corrected to Escape)
- [APPROVED] A4-R03 · Creator Noah base/tone4/green selection, rotate/face/full zoom and Rowan name persist through reload; Mara/Jules scene instances unchanged · qa/creator-runtime.mjs · qa/expansion/creator-runtime; final blink/iris visual approval tracked separately A1-R03
- [APPROVED] A6-R06 · Frozen final assets: all54 tests pass; 480x900 café no horizontal overflow and creator bounds480px, stacked live preview usable; green iris visibly recolored · tests/**, qa/final-current.mjs · qa/expansion/final-tests.txt; qa/expansion/final-current (3shots), browser errors[]

## Delivered verification and remaining visual work
- [APPROVED] A1-R05 · Coordinated eyelid/eyeball blink removes white shards; accepted original painted geometry retained, wrist weights updated · character GLBs · A1 blink0.5/1 captures and six blink checks, latest54-test suite; A1-R03 blink failure superseded by this fix
- [TODO] A1-R06 · Small underarm sleeve-cap triangular flap remains in some posed views; rejected broad shoulder trials are not delivered. Further face/body resemblance refinement remains; no95% accuracy claim · original character geometry · A1 final report
- [APPROVED] A4-R04 · Current delivered green eye option visibly recolors iris; mobile creator stacks within480px and controls remain readable · qa/final-current.mjs · qa/expansion/final-current/03-green-eyes-current.png,02-mobile-creator.png; supersedes A4-R02 pending iris verification
- [APPROVED] A6-R07 · Current app modules parse, private4336 gameplay and coordinator4321 HTTP200; final full suite54/54, supported ambient music/privacy and all observed core activity loops pass · qa/expansion/final-tests.txt, qa/handoff-runtime.mjs · local prototype coverage, not production multiplayer certification
- [APPROVED] A1-R07 · Accepted-current Maya standing/wave, Jules wave, Noah open face rendered after reverting shoulder trials; incremental hand/blink fixes accepted, full proportions/seam visual target remains unapproved · qa/expansion/characters/final-delivered · maya-wave.png, maya-stand.png, jules-wave.png, noah-blink-0.png; errors[]; A1-R06 remains TODO


## Character continuation — second verified pass
- [APPROVED] CHAR-07 · Anchor buried sleeve root to chest; lower Noah hood tips to neckline without changing outfit identity · character agent assets/source · garment-after screenshots reviewed by root and QA; no browser errors
- [APPROVED] HANDS-02 · Bring sipping cup rim to lips instead of chin · body-pose.js · five hand checks, Maya/Jules side screenshots
- [APPROVED] MOVE-07 · Shared collision-safe chair transitions for player and ambient NPCs; blocked exits retreat and preserve occupied seat · activities.js, cafe-life.js, app.js · six collision checks pass; live min separation0.500389m; corrected blocked/clear exits qa/expansion/movement-current; errors[]; lowering interruption smooth; ambient blocked sidestep reroutes
- [APPROVED] MOVE-08 · Travel-driven walking cadence and planted-foot trajectory · runtime.js, pose.js, studio.js · foot drift test passes; runtime rig straight-travel .95/1.75m/s samples114+ planted frame pairs with drift<0.000001m; qa/expansion/movement-current/03-walk-player.png; walk-in-place studio preserved
- [APPROVED] CHAR-08 · Small coherent head-to-body proportion adjustment, preserve original faces and all head attachments · character agent runtime head-motion ownership · neck/blink/cup/attachment checks pass; final .90 retained


- [APPROVED] CHAR-08A · Retain .90 head proportion adjustment after .94/.90 comparison; correct glasses/headphone heights and scale, preserving expressions, neck joins and sip contact · runtime.js · head-90 five screenshots + attachment check, independent visual review
- [FAILED QA] CHAR-09 · Inspect and smooth existing trouser shell boundary; preserve flared legs and identity · character agent owns asset patch · local boundary-normal trial did not remove atlas colour boundary; reverted all ten GLBs to accepted snapshots. Matching atlas wash/continuous UV remains unfinished
- [APPROVED] CHAR-10 · Derive eye rotation pivots from final eye mesh centers, removing old rig-pivot offset after face shaping · runtime.js · all five cast pass extreme gaze head-relative center check (<1mm); sideways screenshot inspected; browser errors[]

- [APPROVED] FINAL-02 · Final complete suite64/64 after movement guard and NPC eligibility changes. Live blocked NPC release preserves ambient seat while clearing scripted reservation; extreme eye gaze all5cast stable; collision/gait captures inspected. This approves incremental changes, not95% reference fidelity or full Phase2 completion.


## Active goal — believable male bodies and café ambiance
- [IN PROGRESS] GOAL-BODY · Preserve original Noah/Jules identities while correcting relaxed torso/chest fit and oversized lower-leg flare; inspect front/side/wave/seated views against reference body proportions. Waist-only improvement accepted; broader chest trial rejected.
- [IN PROGRESS] GOAL-DENIM · Match separate hip/leg panel colour at seam and suppress atlas-border bleed. Root staged UV/vertex-colour patch; no production asset write until character geometry handoff.
- [IN PROGRESS] GOAL-AMBIANCE · Compare day/evening eye-level views and overview; improve focal warm light, readable night routes, timber finish and bar joinery without new shadow maps or collision changes. Baseline captured; lighting/visual-world specialist owns files.
- [APPROVED] GOAL-FIRE · App now uses the selected lighting preset's fireplace intensity with existing flicker, preserving preset lighting balance.
- [TODO] GOAL-QA · Independent current-state visual audit, movement/animation checks, draw-call comparison and final screenshots; goal remains active until both body and ambiance outcomes are verified.

## User screenshot corrections and cute coffee menu
- [FAILED QA] GOAL-BODY-WALK · User screenshots expose stepped hip silhouette during walking and protruding waistband; standing-only acceptance is insufficient. Character specialist tracing production hip/spine skinning and fixing seated hand geometry.
- [IN PROGRESS] MENU-COFFEE · User confirmed ordering dialog and in-world menu board. Menu specialist owns scoped order markup/CSS; environment specialist owns matching readable café board. Preserve six real choices, prices and handoff.
- [READY FOR QA] GOAL-DENIM-COLOR · Four male GLBs now share softer hip/leg wash via inset UVs and vertex colors. Front/seated color seam improved; separate motion deformation remains failed above.
- [APPROVED] CHECK-64 · Full 64-check suite passes after current cup and male asset changes; visual defects explicitly remain open despite passing checks.
- [IN PROGRESS] CHAR-REFERENCE-02 · User supplied detailed turnaround sheet at B3DF8ACB-A186-415E-8275-B5C6A534DB4F/1-Photo-1.jpg as current character target. Prioritize young-adult body proportions, natural connected hands, fitted clothing, softer eye/face anatomy; preserve original Jules/Mara identity per existing instruction. Printed sheet height labels are internally inconsistent, so use visible proportions rather than unverified numbers.

## Explicit agent ownership split
- BODY agent (characters): body proportions, hand geometry, clothing fit and rig deformation. Finishes and freezes GLBs before facial patch integration.
- FACE agent (qa, after coffee-menu verification): facial anatomy, eyes/lids and expressions using detailed turnaround sheet; independent script, no body edits. Shared GLB writes serialized with BODY.
- ENVIRONMENT agent (hands): café geometry/materials/lighting/menu board; no character edits.
- COORDINATOR: integration, independent visual review, regression checks, screenshots and task board. Menu code retains existing ordering flow.

## Reference-driven QA continuation
- [APPROVED] MENU-COFFEE · Desktop/390px mobile screenshots and live flow verify all six drinks, prices, help checkbox, charge and cancellation refund; no browser errors. qa/coffee-menu.mjs; qa/expansion/coffee-menu.
- [APPROVED] HIP-CONTINUITY · Current actual clothing vertices pass sampled gait seam checks for all five characters. Pre-fix snapshots fail all five with 74–78mm gaps; current near-seam samples remain below8mm. Walking screenshot no longer has zigzag hip edge. tests/hip-continuity.test.mjs.
- [APPROVED] ENV-LOUNGE · Softer cushions/arms, support feet, folded throw and ember hearth reviewed in actual café. Seat top .585 and original bounds preserved within1e-6; errors[]. Source copy MapleBeanPhase2.blend created, Blender render verification still pending.
- [FAILED QA] FACE-TRIAL-01 · Smaller eye trial exposed detached lash contours; production assets untouched. Face specialist correcting coherent socket/lash/morph behavior before delivery.
- [READY FOR QA] HAND-PALM-SHELF · Isolated trial removes visible open-hand root gaps; actual outer root coverage improves from50–62.5% to100%. Root closeup approved incremental connectivity correction; final integration/other poses and editable Blender source still pending.
