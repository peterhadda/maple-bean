# Maple Bean visual upgrade

The playable application remains at http://localhost:4321. Reload the page to load the new assets. Claire retains her original honey-blonde hair colour, long waves, blue eyes and outfit.

## Implementation

- Warm afternoon lighting with less ambient washout, softer filtered shadows, shared subtle wood/fabric/plaster maps and furniture contact shadows.
- Curved leaves replace both generations of capsule-shaped plants. Lounge shelves, framed artwork, desk foliage, an open laptop and a gently animated hearth add detail without moving furniture or changing collision paths.
- An interior ceiling appears while walking. Overhead beams stay out of the walking camera; obstructing shell pieces fade along the player sightline. Floor plan uses an angled miniature view and fewer labels.
- Mobile layout has larger navigation targets, a compact HUD and four held-pointer walking buttons. Existing floor-tap navigation remains available.
- Production characters use a local copy of the existing character kit in `assets/character-kit/`, including GPU deformation. Studio retains full geometry resolution; the game uses fewer samples on head, hair and clothing surfaces.
- Noah follows the newly supplied character sheet, superseding the conflicting older Phase 2 concept. He shares the cast's face construction and animation, with tousled brown hair, an olive jacket, cream hood, charcoal trousers, cargo pockets and a backpack. His clothing details are batched by material and animation region. He has a café conversation, a studio entry and a preference for study seats.
- Existing Phase 2 prototype files are preserved. Browser additions are in code; the original `.blend` and exported café GLB are preserved.

## Review and verification

`qa/visual-upgrade/` contains actual browser screenshots: baseline, first pass, second pass and final review. These are renders from the application, not generated reference art. Fixed camera views pause the simulation for reproducible inspection. Mobile screenshots test browser layout at 390 × 844; they are not physical-device performance measurements.

Run `node qa/visual-upgrade.mjs final` with the local server running. This captures the café, lounge, coffee bar, study area, floor plan, Maya, Claire, Noah and mobile layouts; it also checks Noah's conversation and GPU character integration. Run `node --test tests/*.test.mjs` for gameplay and deformation checks.

The final regression run passed all 25 tests, including three residents completing their café routines without sharing reserved seats, and GPU/CPU deformation equivalence for the study pose. The overview measured 898,302 triangles and 328 draw calls with five characters; the baseline measured 950,616 triangles and 230 draw calls with four. The extra environmental detail increases draws, while reduced game mesh sampling lowers geometry cost. These are scene measurements, not a frame-rate guarantee.

## Remaining distance from the references

This is not a 99% visual match. The supplied images have substantially more elaborate sculpted assets and rendered lighting than the existing browser models.

- **Faces and hair:** `assets/character-kit/generator.js`, particularly `headBase`, `faceDisplace`, `buildHeadGeometry`, the eye surfaces and hair ribbons. Achieving the reference cheeks, eyelids, lips and continuous layered locks needs authored topology and carefully fitted morph targets. Claire's hair must remain blonde during that work.
- **Noah's clothing:** `assets/character-kit/noah-outfit.js`. The current layered outfit is procedural. A closer reference match needs a sculpted hood opening, draped jacket shoulders, sewn pocket flaps, fabric folds and fitted backpack straps. Keep his cream/olive/charcoal palette and shared cast scale.
- **Environment:** `MapleBeanExpanded.blend` / `assets/cafe.glb`, especially chair backs, sofa cushions, fireplace surround, tree canopies and coffee equipment. Reference-level shaping needs authored upholstery seams, tufting, more varied plant branching and detailed café props. Preserve the positions in `assets/layout.json` when exporting.
- **Lighting:** the browser uses real-time direct light, environment fill and lightweight contact shadows. It has no baked indirect light or authored ambient-occlusion atlas. An export with a second UV set and baked soft indirect light would improve the room's depth without expensive mobile post-processing.
- **Animation:** this is a procedural pose system, not a full skeletal performance rig. It supports existing walking, sitting, blinking, breathing, waving and sipping, plus a subtle study pose. Detailed fingers typing, phone use and conversational facial performances still require dedicated poses/morphs and hand contact targets.
- The runtime additions are not yet mirrored into the Blender source. Their layout and materials are specified in `assets/visual-world.js` for a subsequent source-asset export.
