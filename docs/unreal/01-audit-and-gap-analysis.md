# Maple Bean → Unreal Engine 5: audit and gap analysis

Status: steps 1–6 of the UE5 upgrade brief (inspection, asset audit, reference study, gap analysis).
No files in the existing web game were modified. Date: 2026-09-22.

## 0. Reference roles (source of truth)

| Image | File / content | Role |
|---|---|---|
| 1 | Mood board: 5-character hero shot, café interior, character cards, floor plan | **TARGET** |
| 2 | `docs/images/characters.png` — Blender lineup of the 5 current characters | **CURRENT** |
| 3 | Isometric illustrated floor plan ("Where focus meets good company") | **TARGET** (environment) |
| 4 | Four in-game UI mock-ups ("Walk as Maya", Golden afternoon) | **TARGET** (camera/UI framing) |
| 5–7 | Character sheets: Noah, Claire, Maya | **TARGET** (per-character detail) |
| — | `docs/images/cafe-overview.png` — actual browser render of the café | **CURRENT** (environment) |

The brief describes 4 images; 7 were supplied. The mapping above assumes images 3–7 are additional targets.
**Conflict to resolve:** image 7 (Maya sheet) shows near-black hair, a cream henley and mid-blue denim, while image 1 and
the current model have a brown bun, white top and light-blue trousers. The brief's "Preserve" list follows image 1 / current.

## 1. Machine constraints (decisive for every UE5 choice)

| Item | Value | Consequence |
|---|---|---|
| CPU | i5-1135G7 (4C/8T laptop) | Shader compiles and light builds will be slow (first project open: tens of minutes) |
| GPU | **Intel Iris Xe (integrated, shared memory)** | No hardware ray tracing. Lumen works only in software mode, and it's expensive. Nanite is supported on DX12 SM6 but has little benefit at this scene size |
| RAM | 15.7 GB | Editor + Blender at once is tight; avoid 4K texture sets |
| Disk free | 107 GB | Sufficient |
| Engine | UE 5.6 installed at `C:\Program Files\Epic Games\UE_5.6` | OK |
| Blender | 5.2 | OK for conversion and export scripts |

Implication: "Epic" scalability and Lumen-driven GI cannot be the *playable* path on this machine.
The playable default must be **Medium: baked/static indirect light (GPU Lightmass is unavailable without RT — use CPU Lightmass) +
a small number of dynamic lights + SSAO**. Lumen is an optional High/Epic tier for machines with a discrete GPU.
Screenshots for visual QA can be rendered offline at higher settings (HighResShot / Movie Render Queue), but they must be labelled as offline renders.

## 2. Existing Unreal project

`mb_unreal_engine/` already exists (UE 5.6, git-ignored). `Content/` holds only empty `Collections/` and `Developers/` folders.
Its config enables `r.RayTracing=True` and SM6, which this GPU cannot use. Recommendation: leave it untouched and create
`MapleBeanUE/` as the brief specifies, with renderer settings suited to the hardware.

## 3. Asset audit and classification

### Characters — `assets/characters/`

| Asset | Facts | Class |
|---|---|---|
| `maya/claire/noah/mara/jules.glb` | Skinned; **41-bone** custom rig (root, hips, spine, chest, neck, head, eyes, jaw, arms, 4 fingers + thumb with tips, legs); **30 morph targets** incl. smile, happy, curious, surprised, focused, laughing, listening, wink, blink L/R; ~56k tris; 5–7 materials (Skin, Hair, Eyes, Wardrobe, Accessories); 6 textures | **CONVERT → UPGRADE** — import as Skeletal Mesh; keep the rig so existing poses and morphs carry over; remodel head, hair and clothing on top |
| `*-lod.glb` | Low-poly game LODs | **CONVERT** (LOD1/LOD2) |
| `*.blend` (2–8 MB each) | Blender sources of the above | **REUSE** as the upgrade source |
| `source/*-before.glb` | Pre-rig, 48 separate meshes, ~136k tris, 2 morphs | Reference only |
| `refinement/backup-before-web-update/` | Older backups | Ignore |
| `assets/character-kit/*.js` (generator, body-pose, skinning, styles, noah-outfit, runtime) | Procedural geometry and pose system that produced the GLBs | **REPLACE** at runtime (UE uses animation assets), **REUSE** as spec (proportions, palettes, per-character styles) |

Rig gap versus UE needs: no twist bones, no clavicles, no spine subdivision, no IK bones, no facial bones beyond jaw and eyes.
Retargeting to the UE5 Manny skeleton through an **IK Rig + IK Retargeter** makes the whole UE animation library usable
(walk, sit, idle, talk). Recommendation: **RERIG** onto a Manny-compatible skeleton in Blender and keep the 30 morphs as the facial layer.

### Environment

| Asset | Facts | Class |
|---|---|---|
| `MapleBeanExpanded.blend` (19.6 MB, root) | Master café source | **CONVERT** (source of truth for layout) |
| `assets/cafe.glb` | 1,551 separate meshes, 268k tris, 25 flat materials, **0 textures** | **CONVERT → UPGRADE**: import for blockout and positions, then replace hero props with detailed meshes |
| `assets/cafe-ambient.glb` | 924 meshes, 189k tris, 21 materials | **CONVERT** (plants and decoration pass) |
| `refinement/MapleBeanRefined.blend`, `runtime_plants.json` (5.8 MB) | Refined variant plus plant instance data | **CONVERT** plants to foliage instances |
| `assets/visual-world.js` | Runtime-only props (shelves, art, laptop, hearth) not yet in Blender | **CONVERT** manually (spec) |
| `assets/layout.json` | 20×14 m shell (406 m² total), 74 obstacles, **43 stations** (coffee 1, seat 10, study 9, game 6, read 3, talk 3, plant 11) with approach points, facing angles and seat heights; 2 rooms (Study, Games & Garden); 2 doors | **REUSE DIRECTLY** → UE DataTable `DT_Stations`; drives Smart Objects and interaction points |
| Materials (`Bean · honey oak`, `forest green`, `sage upholstery`, `terracotta`, `linen`, `aged brass`, `warm plaster`, `limestone`, `Oak plank 0–6`…) | Named palette, flat colours | **RETEXTURE** as UE material instances of ~8 master materials (the names become the MI names) |

### Gameplay and code

| Area | Files | Class |
|---|---|---|
| Station/seat reservation, NPC routines | `cafe-life.js`, `npc-brain.js`, `navigation.js`, `interactions.js`, `activities.js` | **REPLACE** with UE (Smart Objects + State Tree / Behavior Tree + NavMesh); logic reused as spec |
| Procedural animation | `animation.js`, `assets/character-kit/body-pose.js`, `pose.js` | **REPLACE** with Anim Blueprint + montages |
| Study/focus, economy, shop, relationships, save, social, messenger | `study.js`, `focus.js`, `economy.js`, `shop.js`, `relationships.js`, `save.js`, `social.js` | Out of scope for the visual slice; later **CONVERT** to C++/Blueprint subsystems |
| Mini-games | `games/*.js` (chess, darts, cards, memory, snake, xo) | Later; could stay web via a browser widget |
| Tests | `tests/*.mjs` (25 passing per VISUAL-UPGRADE.md) | Keep for the web build |

### Design references

`design-assets/reference/`, `design-assets/characters/`, `design-assets/scenes/`, `design-assets/canva/` (89 PNG files) plus the 7 supplied images.
**REUSE DIRECTLY** as QA comparison targets.

## 4. Visual gap analysis (CURRENT → TARGET), in the brief's priority order

1. **Architecture/proportions.** Current and target share the same layout: an L-shaped shell, a green awning front, the coffee bar at the back, a study room on the right and games at the back-right. The target adds walled **restrooms** and a **staff/storage** room, a merch corner and **quiet nooks** as a separate wing, a bike rack, benches and a street lamp outside. The current café has exposed ceiling beams and much emptier floor zones. *Gap: moderate.* Mostly adding rooms and density; the layout itself carries over.
2. **Character proportions.** Current: tall and slender, ~7.5 heads, tube limbs, a stiff A-pose, flat-shaded pants with no drape, identical shoes. Target: ~7–8 heads with a softer film-stylized look, a larger head-to-body ratio in hero shots, visible hands, layered clothing (cardigan off the shoulder, hoodie strings, cargo pockets). *Gap: large.*
3. **Faces.** Current faces are the biggest gap. They have painted-looking eyes on a flat mask, no lids or lashes read, a missing nose bridge and lips, and no cheek volume. Target: large glossy eyes with defined upper lids and lashes, sculpted brows, a small nose with a tip highlight, full lips, blush and freckles (Claire). *Gap: very large.* This needs sculpting; procedural displacement won't close it.
4. **Hair.** Current: solid helmets (the long hair is flat sheets). Target: clumped, layered locks with flyaways and anisotropic highlights. Maya: a messy bun plus face-framing strands. Claire: long, full, soft blonde waves. Mara: long, voluminous dark waves. Noah and Jules: tousled, chunky clumps. *Gap: very large.* This needs hair cards or sculpted clump meshes with an anisotropic hair material.
5. **Lighting.** Current: a single sun, flat ambient light, hard exterior shadows, no bounce light. Target: warm golden-hour window shafts, pendant pools of light, bounce light off wood, soft AO in corners, cool sky fill for contrast. *Gap: large but cheap to close* in UE with baked lighting.
6. **Materials.** Current: flat albedo, no texture maps at all. Target: oak grain, painted wainscot panels, fabric weave, leather, brass, ceramic, glass. *Gap: large but cheap to close* with ~8 master materials and tileable textures (Quixel/Fab megascans are free with UE).
7. **Furniture.** Current: primitive-built chairs, sofas and tables. Target: upholstered, tufted and turned-leg pieces, a proper espresso machine and pastry case. *Gap: large.* Needs asset sourcing (Fab/Quixel) or authoring.
8. **Density.** The target has roughly 5–10× the props: books, cups, laptops, hanging plants, framed art, rugs, lamps, chalk boards and bicycles. *Gap: large* but mechanical once a prop library exists.
9. **Animation.** Current: a procedural pose system with no skeletal clips. The target implies walk, sit, drink, type and read. *Gap: large.* Closed mostly by retargeting to UE's free animation library.
10. **Small details.** Signage, menu boards, decals and awning text. *Gap: small.*

Cheapest wins: lighting, materials and density (5–8). Hardest: faces and hair (3–4), which also dominate how the characters read.

## 5. Key risk: character art

Closing gaps 2–4 to roughly 80% of images 5–7 needs **authored sculpts**: face topology with lids and lips, hair clumps and cloth folds.
The previous passes (`VISUAL-UPGRADE.md`) already reached the limit of procedural generation. Options:

- **A. AI image-to-3D from the character sheets, then retopo and rig in Blender.** Fast to try. Output quality varies; faces often come out soft, and the meshes need cleanup and a rig fit. Adds a dependency on an external generation service.
- **B. Hand-sculpt in Blender**, driven by scripts where possible. This is the most controllable route but it is artist work; scripts cannot sculpt expressive faces well.
- **C. Buy or modify a stylized base character** from Fab (e.g. stylized character kits), then restyle it per character. Quick and good quality, but the characters drift further from the current ones.
- **D. Keep the current meshes**, improve the materials, lighting, shading and hair cards, and accept a smaller character jump.

**Decided (2026-09-22):** option **A**: AI image-to-3D from the character sheets, then retopo and rig to the existing skeleton in Blender.
Lighting: **baked by default, Lumen as an optional High/Epic tier**. Project: originally scaffolded as `MapleBeanUE/`, then **moved into `mb_unreal_engine/`** at the user's request (2026-09-23); its renderer settings were switched to DX11/SM5, no ray tracing, baked lighting.

## 6. Proposed vertical-slice plan (after decisions)

1. Create `MapleBeanUE/` (UE 5.6, DX12 SM6, **RT off**, Lumen as an optional tier) with the folder tree from the brief.
2. Import `cafe.glb` (glTF importer) as the blockout; generate `DT_Stations` from `layout.json`.
3. Build 8 master materials plus instances from the Bean palette; bake lighting (CPU Lightmass) for the main café, coffee bar, lounge and community table.
4. Import Maya and Claire as skeletal meshes and set up IK Rig retargeting to Manny; add an Anim BP with idle, walk, sit, drink and type.
5. Add the overview and interaction cameras, and click-to-study / click-to-coffee using Smart Objects.
6. Render the comparison triptych: current / UE / target, from matching camera angles.
