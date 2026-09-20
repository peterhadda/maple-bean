# Maple Bean face / hair reference review

Compared supplied Photos 2 and 4 with existing `qa/characters/pass15/lineup.png` and `maya-close-front.png`.

- Maya: recognizable updo and expressive brown eyes already exist. Reference has less spherical cranium, finer flyaways, softer layered fringe, and more sculpted lip volume. Preserve facial morphs; do not blindly enlarge eyes further.
- Claire: blonde long waves and blue eyes are identity anchors. Existing crown and primary waves can be reused; silhouette still appears narrow/repetitive in the previous render.
- Mara: existing bun is a major mismatch. Supplied sheets consistently show long black/dark espresso waves and a central/small-offset part. `refinement_face.apply` replaces non-expression hair using existing continuous-wave authoring, widens the shoulder-length wave silhouette, preserves brows/lashes/morphs, and binds to the current head bone.
- Noah: preserve tousled dark fringe. Current clothing and wide neck influence perceived head proportion; review after body refinement.
- Jules: reference shows fair warm skin and brown loose curls. Previous lineup has substantially darker skin and short tight hair. The helper replaces the explicitly authored tapered crop with the existing tousled Noah construction, giving Jules a wider/higher chestnut crown. It also regenerates the existing shared face/body skin texture with a warm peach base, preserving the authoring helper's UV/detail layout. Visual fidelity still needs integrated review.

All hair roughness is adjusted to .52 with restrained specular strength to reduce plastic appearance. New Mara hair stays in the existing mesh coordinate space and must be included in subsequent full-character scaling. Long hair is rigidly head-weighted like the existing cast: shoulder collision during large head turns remains a known limitation, requiring a hair chain/collision pass for unrestricted animation.

Current Blender render `qa/body-claire-refined.png` exposed a saved-pose defect: the source `.blend` has every expression, wink, and both blinks at value 1 simultaneously. Runtime resets these each frame. The helper now neutralizes all non-Basis keys, preserving their geometry. This addresses the severely distorted closed lids and mouth without destructive remodeling. Current game GLBs also contain later export patches, so integrated scenes should prefer current game assets over stale editable files when preserving the latest appearance.

Validation: `blender --background --python-exit-code 1 --python tools/refinement_face.py` checks preservation of expression keys and finite replacement geometry without saving source assets. Final integrated front/three-quarter/side/back renders must be reviewed separately; this document does not claim those have passed.

Reviewed newer `qa/body-claire-current.png`: neutral face now has blue irises and normal mouth; catastrophic expression overlap is resolved. Remaining reference gaps are protruding outer eye corners, angular cheek/chin transition, repetitive thick hair waves, and exposed shoulders above cardigan sleeves. Blue cardigan/cream shirt palette is closer. This is an improvement checkpoint, not final reference fidelity.
