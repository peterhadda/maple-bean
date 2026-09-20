# Maple Bean refinement art review

Status: preservation/refinement checkpoint, not a finished reference match or game-ready certification.

Directly viewed reference Photos 2 and 3, `refinement/before.png`, `refinement/current-glb-lineup.png`, and `qa/body-claire-current.png`. Integrated café and cast renders are pending at this first review.

## Preservation gate

The original Blender café preview has broad primitive leaves and faceted tree crowns. This is a stale baseline, not the accepted plant detail. Preserve the detailed runtime foliage through `refinement_plants.py`; never use the stale preview as authority to rebuild plants from scratch. Script/report assertions of preservation still require visual review of the final render.

## Corrections assigned

1. Face/hair: the original imported lineup has simultaneous closed/blink/expression shapes deforming eyes and mouths. Neutralizing shape values is required before judging anatomy. Claire's neutral render confirms readable blue eyes. Mara's long dark waves and Jules's loose chestnut hair are identity requirements, not optional variation.
2. Body/clothing: Claire's cardigan is fitted and off-shoulder instead of the reference's loose blue layer. Mara's apron is incompatible with the reference crop top/open jacket/cargo silhouette. Noah needs a closed hoodie instead of an open jacket. Jules needs the reference sweatshirt and headphones. Recoloring does not resolve these modeling gaps.
3. Environment: the stale baseline's sparse café, simple coffee equipment, and empty shelves are substantially less detailed than Photo 3. Preserve existing room layout while restoring approved assets. Match dense shelf greenery, warm timber surfaces, articulated furniture, and the coffee bar's equipment/display hierarchy in subsequent model passes.
4. Hands: nails alone do not demonstrate finger deformation. Inspect open, fist, point, peace, cup, phone, book, laptop and controller poses with actual props; palm contact and thumb opposition must be visible. No pose is certified by this review without rendered evidence.
5. Shared scale: inspect planted feet, seat contact, knee clearance and hand-to-prop contact inside the café. Numerical character-height metadata is not an interaction test. Hair-tip height differs from anatomical stature, especially Maya's bun.

## Acceptance limits

Current evidence does not demonstrate front/three-quarter/side/back comparisons for all five characters, seated cloth deformation, dynamic long-hair collision, the complete hand interaction set, export performance budgets, or visual parity with the reference sheets. These are substantial remaining tasks and must not be called minor polish.

## Integrated café render: first pass

Viewed `refinement/cafe-refined.png` directly. Detailed leafy exterior tree crowns and individual indoor leaf silhouettes are restored relative to the stale `before.png` faceted crowns and swollen leaves. This is the correct preservation direction; keep those assets.

Shared-scale gate fails visually: the five standing characters appear roughly tabletop height beside existing café furniture. Assign to integration/body and environment together: measure world-space table height and chair seat height, reconcile existing scene units with character root scaling, then render again. Do not alter mesh bind coordinates to compensate. A white faceted object in front of the group also needs inspection for a leftover placeholder or misplaced fixture.

Warm sunlight and wood grain improve surface reading, but room density, coffee bar equipment, shelf greenery, furniture articulation and signage remain far below Photo 3. Lighting still reads broad and fairly flat compared with the reference's layered warm pools and rich shadow contrast. This first integrated render is not accepted as a finished match.
