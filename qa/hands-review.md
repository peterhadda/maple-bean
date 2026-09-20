# Hands refinement review

Reference: supplied Photo 2 character sheet, hands row; Photo 4 coffee-cup pose. The hands are soft stylized forms with short natural nails, tapered fingertips and clear thumb opposition. The small reference resolution does not define exact nail beds or knuckle loops.

Implemented `tools/refinement_hands.py`: `apply(character_id, objects, rig)` adds ten restrained dorsal nail shells weighted to the existing distal finger/thumb bones. All ten share one mesh/material, adding 1,000 triangles per cast member. Existing digit proportions, wrist weights, cup placement and rig bone names remain unchanged. Original assets are never saved by the module.

Verification: all five original character blends passed ten representative curl states (open, relaxed, fist, point, peace, cup, phone, book, laptop, controller) with 20 existing digit bones and finite evaluated geometry. Maya also passed after joining the nail shells into one mesh and passed repeated-application idempotency. These are deformation sanity checks, not visual contact certification. Existing runtime hand suite passed 5/5: sipping rim proximity, degenerate hand bases, wrist pose transitions, open finger-root overlap and typing clearance.

Remaining discrepancies: palms/fingers remain separate intersecting mesh islands, only two bones per digit, with no dedicated anatomical knuckle/thenar topology. Reference-level fist silhouette, pinch contact, and interactions with actual Blender cups/phones/books/controllers remain unverified. No claim of complete production-ready hand deformation. Integrated render QA must inspect nail seating and their color under the cafe lights.

Source audit: `author_characters.py` reuses `cz` as a temporary finger-tip center before constructing the thumb; the existing Maya blend has correct thumb anchors, so this pass does not change them. If rebuilding from that source, use a separate temporary variable and revalidate thumb anchors.
