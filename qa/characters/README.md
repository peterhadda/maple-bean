# Character rebuild — visual QA log

This is work in progress. The target artwork is still the quality benchmark; the current production assets are not accepted as final.

## Scope

Only characters, their asset loading, the existing character studio and character QA. The café/environment/lighting changes present before this rebuild are frozen. The ambient bake is not integrated. Claire stays blonde, blue-eyed and long-haired. Mara and Jules retain their existing game identities.

## Reproduction

- Author: Blender 5.2, `tools/author_characters.py` (optional character names after `--`).
- Editable sources and near/distant production GLBs: `assets/characters/`.
- Preserved pre-rebuild geometry: `assets/characters/source/*-before.glb`.
- Actual café screenshots: `node qa/characters.mjs <pass> [character]`, local game at port 4321.
- Fixed views per character: front/three-quarter/profile face; front/side/back full body. Café lighting is unchanged.
- Asset budget check: `node --test tests/character-assets.test.mjs`.
- Runtime/pose measurement harness exists; further movement work is deferred until appearance is satisfactory, per user instruction.

## Baseline — five largest gaps per character

| Character | Five visual priorities |
| --- | --- |
| Maya | Simple facial planes; eye/lid integration; tubular updo and strands; neck/shoulder transition; flat knit/heart presentation. |
| Claire | Segmented long-hair roots; rigid repeated locks; blue eye/lid presentation; elongated lower face; cardigan/strap and sleeve joins. |
| Mara | Eye seating; primitive bun masses; regular helmet-like hairline; indistinct facial balance; apron/shoulder joins. |
| Jules | Generic short-hair construction; eye/lid integration; triangular jaw and thick neck; skin-appropriate face coloration; shirt shoulder silhouette. |
| Noah | Generic cap-like hair; weak face/eye construction; broad neck/shoulders; disconnected hood and jacket fit; thick backpack straps. |

## Comparison rounds

- `baseline/`: all five × six views, plus cast lineup, with the previous production generator.
- `pass1/`: first Blender face/hair/body/rig integration. Rejected: protruding eyes, mouth/nose seam collapse, low hairline, floating locks, damaged garment simplification.
- `pass2/`: all thirty views repeated. Fixed source mesh welding, garment atlas colors, deeper eyeballs and face length. Remaining: central seam, bare cap/airborne hair roots, white outer-eye patches, long jaw, stiff hair.
- `pass3/`: all thirty views repeated. Closed the facial seam and rebuilt scalp-following primary/secondary hair masses. Independent review confirmed remaining eye corners, lower-face taper, rigid Claire hair roots, Noah quiff and garment fit.
- `pass4/`: Maya six views. Shorter face, diagonal fringe, eyelid coverage. Rejected mouth-edge fragments and long neck.
- `pass5/`: Maya six views. Detected a coordinate mismatch between the mesh and facial shape keys after repositioning; rejected immediately.
- `pass6/`: Maya six views. Fixed shape-key/mesh alignment, shortened visible neck, seated eyes and removed detached mouth fragments. Shown as an intermediate appearance checkpoint.
- `pass7/`: all thirty views repeated. Shared corrected face foundation, individual face proportions, coiled buns, initial Noah loose fringe and Claire continuous waves. Still below target: rigid short fringe on Claire, visible Noah hair roots, insufficient sculpted surface detail and garment fit.

## Next appearance corrections

1. Claire: replace short bangs with long swept face-framing locks and retain continuous crown-to-length waves.
2. Noah: bury clump roots, vary front curl lengths/direction, refine jacket/hood/shoulder surfaces.
3. Shared: stronger lip shaping, restrained hair/fabric surface detail, preserve important clothing texture resolution.
4. Recompare all faces/profiles/full bodies and cast cohesion before resuming movement polish.

## Measured technical checkpoint (before latest appearance changes)

Five near characters: 279,970 triangles and 35 material draws, versus 665,832 triangles and 260 draws for the previous generator at the same camera. Seven base draws per character; the held cup is an eighth draw. All characters have 41 joints and at most four normalized influences. Distant meshes are around 20,000 triangles. Atlas dimensions are at most 2K.

Software-rendered desktop/mobile browser checks are not physical-phone GPU performance measurements. Skeleton/morph instances are independent while geometry/materials are shared. Existing motion QA found sipping reach gaps; a reach correction is implemented but remains unverified after the newer face/shoulder edits. Do not call motion work complete.
