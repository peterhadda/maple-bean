# Hand anatomy isolated trial

Current closeup versus supplied detailed character sheet: fingertips are too conical, distal palm shelf is angular, thumb base lacks anatomical webbing. Preserve original skin identities, existing finger lengths and rig.

`round-finger-pads.mjs <source> <output>` replaces existing .55 distal pad taper with .78 over the same last 11 mm. Exactly eight finger components per asset; palm, thumb, root surface, triangles, UVs and weights untouched. Applied to ten isolated assets in `finger-pad-trial/`. Current production assets are unchanged.

Validation: `node qa/expansion/characters/check-palm-coverage.mjs qa/expansion/characters/finger-pad-trial` returned 240 checks and zero failures. Visual acceptance remains pending. `finger-pad-views.mjs` checks open, peace, fist, book, arcade controls posture and sipping cup.

Blender authoring equivalent, after visual acceptance: existing `tools/author_characters.py` fingertip taper expression `.55+.45*smooth(...)` becomes `.78+.22*smooth(...)`. BODY owns that source and final editable source synchronization. Do not apply both authoring and binary correction to the same regenerated mesh.
