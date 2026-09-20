# A1 retained cast changes — 2026-09-19 (latest garment pass)

Delivered on the original Maya, Claire, Noah, Mara and Jules meshes:
- Existing authored cheek/lip/nose/eyelid texture refinement; original skin/hair/clothing identities retained.
- Coordinated eye-sphere and catchlight blink/wink morphs fix original white shards. Half/full blink evidence: `blink-baseline/` vs `blink-fixed/`; metadata-corrected `joint-check/` had no browser errors. Closed lid corner pinches remain.
- Forearm-to-hand skin-weight blend over y=.825→.785, matching the hands specialist's source patch.
- Buried sleeve-root correction: original tube starts inside chest at x=.05,y1.19 but was mostly weighted to upper arm. Only that hidden tail is anchored to chest. `sleeve-before/maya-wave.png` vs `garment-after/maya-wave.png` shows the underarm triangle removed; original shoulder silhouette/garment retained. Jules wave and neutral Maya also rendered.
- Noah's existing folded hood forward tips settle onto the shirt neckline; its open-front jacket remains. Compare `final-delivered/noah-blink-0.png` vs `garment-after/noah-blink-0.png`.

Current evidence is `garment-after/` (4 screenshots, browser errors=[]). A posed-vertex regression checks buried roots stay inside the torso during an arm raise. Five character asset checks plus garment and blink regressions pass. Both changed Blender authoring sources compile; Noah garment topology self-check passes.

Rejected experiments: hip taper, shoulder broadening, lower-orbital sculpt and broad shoulder weight blends were reverted. `sculpt-after/`, `final-check/`, `joint-final/` and earlier proportion notes are NOT current approvals. The new narrow buried-tail fix is distinct from those failed broad shoulder blends.

Reproduce CURRENT runtime assets from the preserved painted pre-sculpt GLBs (`sculpt-source/`):
1. `node qa/expansion/characters/fix-blink.mjs`
2. `node qa/expansion/characters/fix-wrist-weights.mjs`
3. `node qa/expansion/characters/fix-sleeve-root.mjs`
4. `node qa/expansion/characters/settle-hood.mjs`

Run this sequence once from its reset step; the skin-weight/hood patches are not standalone repeat operations. Original `.blend` files remain original editable sources. `tools/author_characters.py` now includes the buried-tail and wrist bindings; `tools/noah_garments.py` includes the hood-tip fit for future exports. Do not reapply the same corresponding runtime corrections to regenerated geometry that already contains them.

Remaining: oversized heads/eyes relative to supplied references, lower-eye shading and lid corner pinches, simplified hair, rectangular trouser yokes and general body shape. No95% resemblance or full character visual approval claimed.
## Latest accepted proportion and contact pass
- Runtime whole-head scale is .90 about y1.39. Face, hair, eyes and expressions move together; original cast identities remain. Current full-body evidence: `head-90/maya-stand.png` and `head-90/jules-wave.png`.
- Headphones and glasses use the same transform and scale. Their earlier forehead placement was corrected against actual eye geometry. `head-90/maya-headphones-glasses.png` plus attachment-check verifies unit rotations, .90 scales and frame-to-eye height difference .0063m. Sip contact remains visible in `head-90/maya-sip.png`.
- Parent corrected gaze pivot to each authored eyeball center, avoiding off-socket motion. Independent QA checks all five cast centers under extreme gaze.
- Local yoke ring normal averaging was tested and rejected: `yoke-after/` still shows the horizontal panel boundary. Assets restored byte-for-byte from `yoke-source/` (the accepted sleeve/hood/blink assets). The silhouette was never narrowed. This seam now needs matching hip/leg atlas edge colors and/or continuous surface authoring; normals alone do not fix it. `smooth-yoke.mjs` is an experiment, NOT part of reproduction.
- Remaining reference gaps: oversized rounded eyes, lid corner pinches, simplified hair and facial anatomy, and rectangular trouser yoke appearance. Head/body ratio is improved but characters are not at95% reference resemblance.

## Male casual-fit pass
`relax-male-torso.mjs` applies a bounded relaxed waist fit to original Jules and Noah only: +18% lateral scale at y=.99–1.06, smooth fades to zero below .89 and above1.18, and a lateral taper leaves outer arms alone. All adjacent Skin/Wardrobe/Accessories follow the same deformation; normals use its inverse-transpose Jacobian. UVs, triangles, weights, expressions, head, shoulders, hands, lower trousers and identities are retained. This is a fit adjustment, not a claim that Noah's later custom jacket had the original imported-body narrowing.

Reproduction step5: `node qa/expansion/characters/relax-male-torso.mjs`. It reads the accepted pre-fit snapshots in `male-fit-source/` and is repeat-safe. Original authoring meshes remain available; the patch is the reproducible fit source. Earlier broader upper-chest trial (`male-fit-after/`) was rejected; final evidence is `male-fit-final/` vs `male-fit-before/`, neutral/wave/seated for both men. Current source chest curvature and trouser-panel seam remain limitations.

## Male straight relaxed trouser / shirt profile pass
Step6: `node qa/expansion/characters/straight-male-fit.mjs` reads accepted waist-fit snapshots `male-straight-source/` and deforms only original Noah/Jules meshes. Chest front depth reduces by up to12% with smooth spatial falloff; no muscle shape invented. Lower pant legs become a straighter relaxed cut: hem radius reduces28%, excess rear hem depth37%, both fading to original upper leg at y=.65. Matching separate hem piping receives the exact same deformation; shoes, hip/crotch seam, rig and material identities remain unchanged. Normals follow the deformation Jacobian; original UVs/triangles/morphs/skin weights retained. LODs use identical functions.

Before evidence `male-straight-before/`. `male-straight-after/` was an incomplete component-selection trial; `male-straight-final/` predates the separate hem-piping correction and is NOT final approval. A post-piping screenshot is required, coordinated after ambiance changes. Parent owns subsequent denim join colour/UV correction; apply it only after this geometry stage.

Final current evidence is now `male-delivered/`: front/side/seated/walking/waving for Jules and Noah, plus evening Noah face. Both browser runs errors=[]; hem piping aligns with narrower straight legs, and parent's denim colour/UV border correction removes the obvious horizontal skirt-like panel cut. Final reproduction step7: `python qa/expansion/characters/blend-denim-join.py` (parent-authored patch). The nighttime face remains readable. Eight focused asset/blink/wave-root/typing checks passed before final colour patch; parent independently checked its colour patch assets.

## User-reported seated hands and walking hip defects
- Exported skinning had hard x=0 left/right thigh assignment and a hard y=.88 hips→spine switch. `fix-hip-continuity.mjs` restores a cross-centre thigh blend and continuous pelvis→spine fade; all five casts/high+LOD. Actual `hip-fixed/jules-walk.png` removes the sawtooth tear. Source binder mirrors the corrected weights.
- Each exported hand contained BOTH an obsolete procedural palm and the newer authored palm. `remove-duplicate-palms.mjs` removes exactly two obsolete palm triangle components per asset; originals remain in archived sources. Source importer hand-removal cutoff now includes the full obsolete palm. `tests/palm-assets.test.mjs` verifies exactly one rendered palm per side across all ten assets.
- `refine-hand-shapes.mjs` operates from the clean duplicate-free checkpoint: palm thickness .80, length .92, width1.05; last11mm of finger tips taper to55%radius. Original topology/rig/finger lengths maintained. Finger transforms seat roots4mm into palm; seated wrists rest lower/flatter on thighs. Peace hand-shape supported for existing pose rig.
- `fit-waistband.mjs` settles existing male pants/belt components only: top rim10%width/12%depth reduction fading below.94, shirt and legs preserved.
- Reproduction additions after step7 denim: step8 `fix-hip-continuity.mjs`, step9 `remove-duplicate-palms.mjs`, step10 `refine-hand-shapes.mjs`, step11 `fit-waistband.mjs`. These scripts read named immutable stage snapshots. Do not rerun earlier stages after new face work without rerunning later face integration last.
- Latest pose evidence: `hands-final/` (open/fist/peace/book/arcade-hand-pose/sip, Jules seated/walking). Arcade evidence is existing controls posture, not a new standalone controller prop. More anatomical palm webbing and connected finger topology remain a longer-term modeling gap; no95% claim.
