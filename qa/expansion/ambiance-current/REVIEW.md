# Ambiance baseline — 2026-09-19

Compared the supplied Maple Bean café references with the current running game at day/evening, overview and player eye level. Preserving the floor plan, furniture/collisions, games/study separation, plants, books, and main branding.

Three largest actionable gaps in this pass:
1. Evening lighting remains broad and uniform; the reference gives warm focal pools to the bar/tables with quieter surroundings.
2. Counter and floor timber share similar matte response; the reference separates finished oak surfaces from softer flooring and fabric.
3. The bar front is mostly flat green faces; the reference has inset/fluted cabinetry and warm shelf details.

Baseline captures: `before/day-overview.png`, `before/day-eye.png`, `before/evening-overview.png`, `before/evening-eye.png`. Browser errors: none. Both overview views: 235 render calls / 611771 triangles; eye views: 80 calls / 624398 triangles. 22 lights total, one shadow-casting light. Render counters are one deterministic camera frame, not a frame-rate benchmark.

Root was informed that app.js overwrote the fireplace preset each animation frame and corrected it to use the active preset. Character work uses the shared GPU first; ambiance mutations await their paired captures.
## First pass, independently QA reviewed

Retuned existing pendant cones and bar accent position; evening ambient/fill reduced modestly while table pools, bar/bookcase accents and study wing remain readable. Added shallow green bar joinery and warm shelf insets in two material batches. Honey oak surfaces now have a more polished finish than floorboards, with a subtle shared bump map. No layout/collider/activity changes.

`after/` day/evening eye/overview browser errors: none. Render calls 237 overview / 82 eye (+2); triangles 612347 / 624974 (+576). Still 22 lights and one shadow-casting light. Browser check verified both timber finishes/bump, bar/shelf materials, finite opacities and unchanged shadow-light count. QA independently approved the visible incremental improvement and night path/study readability. No FPS claim.

User additionally requested a coffee/café upgrade; a second small pass now targets pastry display and coffee equipment/shelf canisters using existing counter footprints.
## Coffee bar and board pass

Added a second supported pastry tray with three crescent pastries inside the existing display. Rounded/lidded shelf canisters use original positions. Espresso machine gauges were hidden behind the original black fascia: moved the existing detailed fascia forward and added warming cups above. Replaced the two solid espresso receiving cylinders with open ceramic wall/rim geometry, visible coffee and handles.

The 3D menu now derives all six drink names, notes and prices directly from cafe-life.js, matching the order UI. Cream/pine/caramel style, prices explicitly Maple Coins; no invented pastry purchase option. The old separate text meshes were removed from rendering. Board texture is unlit to preserve text contrast under its accent light. Fixed six-item grid is checked by the browser probe and needs reflow if the actual menu grows.

Initial coffee before/after closeups returned no browser errors and menu assertions passed. Final receiving-cup/board contrast proof pending the shared GPU slot. No colliders, furniture positions, order handlers or game/study systems changed.

New reference inspected: layered round upholstery, framed window/bookcase depth, localized contact shade are the next largest gaps. Existing browser renderer retained; no offline Blender settings copied into runtime.

## Delivered coffee and lounge verification

Final coffee receiving cups have open rims/liquid and handles; the six-item board matches the shared menu. Final closeups and clean browser assertions are in `final/`. The lounge now has rounded upholstered seats/arms, supported wood feet, subtle tufting and a smoother draped throw. Exact original cushion bounds (including the .585 seat top) were preserved and all generated normals were finite. Same-view lounge capture changed 121 to 122 draws and 566932 to 572076 triangles; no additional game lights or shadow maps. QA independently approved the visible improvement. Evidence: `lounge-after/lounge-after.png` and `lounge-check.mjs`.

## Editable Blender copy

`MapleBeanPhase2.blend` contains verified runtime environment art in a named collection, with the original source objects preserved hidden. `MapleBeanExpanded.blend` remains unchanged (SHA256 c9d8d7f6f82aa8fa02fb7948055499e3560a79ddc46508a2cc09fe83b856ae43). The manifest matches 1551 original objects, imports 1319 objects and reports zero unmatched names. Source textures are packed. Seven instance batches were realized only for the editable offline copy; game instancing remains intact.

The source copy has a separate 17-light evening preview rig with original 12 lights hidden; they are not doubled. Blender watts require separate calibration from browser candela. Before/after source renders use identical preview camera, light settings, 960x720, 8 Cycles CPU samples, 4 threads and AgX exposure .5. The game keeps its independently verified 22-light/one-shadow-map rig. The copy uses a static alpha snapshot of the animated fireplace shader; runtime fire remains animated. Geometry and material batches are editable meshes, with original individual objects retained for further authoring. This is an incremental visual improvement, not a claim of reference-quality completion.
