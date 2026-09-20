# Body and clothing reference review

Reference: Photo 2 full-body columns and Photo 4 ensemble; café scale from Photos 1 and 3. Existing meshes and all joint weights remain intact.

`tools/refinement_body.py` provides `refine(character_id, objects=None, rig=None)` for loaded Blender characters. It recolors complete connected wardrobe components: Claire blue cardigan, Jules cream sweatshirt/blue denim, Noah forest top/sand trousers, Mara charcoal outfit. Maya's white heart top and blue flared jeans stay unchanged. Complete components avoid jagged triangle boundaries discovered and corrected in the first render pass. Shoes, accessories and skin are excluded. Palette is sampled approximately by observation, not presented as exact image colorimetry.

Validation: Python region assertions pass; Blender 5.2.1 applied Claire materials successfully. Latest `assets/characters/claire.glb` was independently imported and tested: 1,081 triangles recolored, white camisole, trousers, skin and shoes retained. `body-claire-current-before.png` and `body-claire-current.png` are matched low-sample before/after renders of the current GLB with expression keys reset. The earlier `body-claire-refined.png` used the older blend and is superseded. No original blend or GLB was overwritten.

Observed remaining discrepancies requiring further modeling:

- Current Claire garment is fitted/off-shoulder; reference has loose, fuller blue cardigan over white top. Color improvement does not fix silhouette.
- Existing Mara apron silhouette conflicts with black crop top, open jacket and cargo pants. Recolor alone is not final wardrobe.
- Existing Noah open jacket conflicts with closed hoodie and printed chest typography; existing trousers lack reference cargo pockets.
- Jules reference headphones/backpack and loose sweatshirt need an accessory/silhouette pass.
- Reference bodies read taller and more natural than current shared stylized proportions. Do not apply uncoordinated bone coordinate changes: runtime pose solvers hardcode current bind-space joints.
- Initial Blender review exposed every imported expression/blink key active at once. Face specialist diagnosed it and supplies a neutral-key reset; review renders now use that reset.

Height metadata: Maya 1.65 m, Claire 1.64 m, Mara 1.66 m, Jules 1.76 m. Noah is inferred 1.78 m from printed 5 ft 10 and cast lineup because the sheet's 164 cm contradicts that label. Heights are metadata only; assembled-world root placement/scale must be checked against actual 0.45 m seating and 0.74 m tabletops, without altering local skin coordinates.

Not certified: final wardrobe topology, seated cloth deformation, all five character renders, prop contact, game export draw budget. Added wardrobe materials increase draw calls and should be atlas-baked after visual acceptance.
