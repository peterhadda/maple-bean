# Dedicated hand refinement — 2026-09-19

Preserved the original five cast meshes, rigs, clothing and the prior typing clearance fix. Pose changes are in `assets/characters/body-pose.js`. The wrist-weight source correction is in `tools/author_characters.py`; the character owner applies the matching runtime GLB patch.

- Wrist orientation now blends with quaternion slerp. Independently blending finger and palm vectors collapsed near opposite directions during rest-to-wave/stretch transitions and could flip the wrist.
- Parallel palm/finger input directions now use a perpendicular fallback axis, including the previously invalid X-axis case.
- Finger roots now sit along the tapered palm edge instead of a flat row, closing visible gaps at the outer knuckles in open hands.
- Dart aiming wrist moved outward and slightly down/forward so the aiming hand no longer sits over the eye. Finger articulation, prop attachment and the existing throw remain intact.

`node --test tests/hand-natural.test.mjs tests/hand-pose.test.mjs`: 4 checks pass. New checks cover both hands, all five cast body variants, rest/wave/stretch/cup/sip/type/reach/aim/throw transitions, finite transforms, dart face clearance, parallel input bases, and finger-root overlap with the palm. Existing typing fingertip clearance passes unchanged.

Baseline: `before/` contains all five actual cast characters in seven poses; browser reported no errors. `after/` contains eight focused Maya/Jules wave, cup, sip and dart closeups; browser reported no errors. Dart face clearance visually verified. Final Maya wave rerender also reported no errors; visible outer finger-root gaps closed.

Persistent forearm-to-palm separation was traced to missing hand weights at the forearm cuff. Source now blends lower-arm weights into the hand over y=.785 to .825, coordinated with the character owner's matching GLB patch. Runtime asset application and wrist QA remain owned by that agent.

Limitations: this is an articulation correction, not a replacement hand mesh. Palms and fingers remain visibly stylized and somewhat bulky; no claim of anatomically realistic hands or 95% character reference fidelity. The retained coffee and typing grip still need finer mesh/contact tuning in a future asset pass.

## Second bounded pass: sip contact

Current-model closeups confirmed the tilted cup stopped below the mouth at the chin. Moved only the sip wrist target 0.03 units upward and 0.01 inward in `body-pose.js`, preserving the grip, prop, wave, dart and typing definitions. `sip-before/` and `sip-after/` contain Maya/Jules side closeups; both browser runs reported no errors. Reviewed both after images: the rim now reaches the lip region. The character owner's sleeve/eye asset work also landed between these captures; those visible changes are separate from this one-line pose adjustment.

Added a rim-to-authored-lip proximity check for both body rigs (less than 0.015 units; measured about 0.009/0.012). All five hand checks pass including existing typing clearance. This is approximate contact against the current authored facial landmarks, not dynamic mesh collision or hand anatomy replacement. Palms remain bulky and grip detail still limited by the existing geometry. No rest-pose churn was needed.

