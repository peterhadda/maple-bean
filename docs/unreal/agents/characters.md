# Agent A: Characters, work log

Owner paths: `mb_unreal_engine/Content/MapleBean/Characters/**`, `mb_unreal_engine/SourceArt/Characters/**`,
`mb_unreal_engine/Scripts/characters_*.py`, and this file. Source files in `assets/` are read only.

## 2026-09-23

### 1. Import and materials (`Scripts/characters_materials.py` + `Scripts/characters_shaders.py`)

- Noah, Mara and Jules are imported with Interchange `import_asset` to `/Game/MapleBean/Characters/<Name>/Current`, the same way as Maya and Claire. All five now have a skeletal mesh with 41 bones and 30 morph targets.
- The character functions from `lookdev.py` (`read_glb`, `extract_glb_images`, texture import) were copied into `characters_materials.py`. Textures are imported with a plain `AssetImportTask`. Normal maps (`T_01_hair_sculpted_surface`, `T_05_cloth_sculpted_surface`) are now set to `TC_NORMALMAP`, sRGB off and **flip green**, because glTF normals are OpenGL-style.
- Every slot gets `MI_MBC_<name>_<slot>` in `/Characters/<Name>/Materials`. (V2 uses `Materials_V2`, `Textures_V2` and `MI_MBC_<name>_v2_<slot>`.) The Interchange glTF materials are never used.
- **The lead needs to act:** remove `apply_characters(build_character_master())` from `lookdev.py`. If it runs again, it puts the old `M_MB_Character` MIs back on the mesh slots and my materials are lost. `M_MB_Character` itself can stay; the characters no longer reference it.
- Run it with `Scripts/ue_run.sh characters cmd Scripts/characters_materials.py`. These environment variables change what it does:
  - `MB_CHAR_NAMES=maya,claire` limits the run to those characters.
  - `MB_CHAR_VARIANT=V2` processes the V2 meshes instead of Current.
  - `MB_CHAR_REIMPORT=1` imports the meshes again even if they already exist.

### 2. Material upgrade (masters in `/Game/MapleBean/Characters/Shared/Materials`)

Each master is rebuilt in place on every run: the graph is cleared and made again, so its instances keep their parent. Every master is two-sided and has `used_with_skeletal_mesh` and `used_with_morph_targets` set.

| Master | Used by | What it does |
|---|---|---|
| `M_MB_Character_Skin` | Skin slots | Default lit. The first version used the pre-integrated skin model, which rendered chalky white under the café sun (chars-v1, chars-v2), so it was replaced. The skin now gets a saturation lift (`Saturation` 1.18), which keeps the painted blush, a warm bias with a darker warm Fresnel tint (`WarmBias`, `WarmTint`, `WarmRim`), and `SkinGain` 0.9. Roughness 0.6, specular 0.3. |
| `M_MB_Character_Hair` | Hair, lashes, brows | Fake Kajiya-Kay highlights. The tangent is world-down projected onto the surface. It is shifted along the normal by stretched 3D noise, which gives two bands: a primary tight band (`HighlightColor`, `HighlightStrength`, `PrimaryExponent`) and a secondary albedo-tinted band. The bands **multiply the hair's own albedo** (`HighlightColor` is a multiplier, about 1.2–1.5). The first version added a fixed highlight colour, which washed dark hair out to light brown in chars-v2. The same noise also gives mild strand-to-strand colour variation (0.82–1.08). `KeyLightDir` is a parameter. Specular 0.3, roughness 0.6. |
| `M_MB_Character_Eye` | Eyes | Roughness 0.06, specular 0.75, `Brightness` 1.08. UE 5.6 Python doesn't expose the clear-coat pins (`MP_CUSTOM_DATA*`), so the script falls back to a glossy default-lit material. It switches to clear coat automatically if the pins become available. |
| `M_MB_Character_Cloth` | Wardrobe, reference colours, accessories | **Denim fix:** texels where blue clearly exceeds red (`(B-R)*DenimMaskGain - 0.3`) are recoloured to `DenimColor` (0.27, 0.46, 0.80 linear), scaled by their luminance relative to `DenimRefLum`, so stitching and seams remain visible. Whites, creams, greens and charcoals are left alone. Also adds a Fresnel fabric sheen. Accessories (metallic > 0.3) get no sheen or denim change. |

The Python enum also lists `MP_ANISOTROPY` and `MP_TANGENT`. Real anisotropy could replace the fake bands later if the renderer supports it on SM5.

### 3. Mesh upgrade V2 (Blender, scripted)

Scripts:

- `Scripts/characters_blender_v2.py`: head, face and lashes, then the hair recipe, the bones, and the export.
- `Scripts/characters_blender_hair.py`: the hair recipes.
- `Scripts/characters_blender_preview.py`: EEVEE preview renders.
- `Scripts/characters_compare.py`: before/after contact sheets (Pillow).

Commands:

```
blender -b assets/characters/<name>.blend --python mb_unreal_engine/Scripts/characters_blender_v2.py -- <name>
blender -b --python mb_unreal_engine/Scripts/characters_blender_v2.py -- noah --from-glb   # see Noah note
```

Output is `SourceArt/Characters/<name>_v2.blend` and `<name>_v2.glb` for all five characters. Each glb was checked: 41 joints with the same names, 30 morph targets, all default morph weights 0, and the same material slot names.

- **Head:** scaled up 6% about the chin/neck pivot (0, -0.02, 1.31). The cranium is squashed 6% above the eyes and widened 3% for a rounder head. The change is blended by the head/eye/jaw weights, so the neck and body stay where they were.
- **Face:** built from smooth Gaussian offsets at landmarks measured on the shared base face. The changes are fuller cheeks, a softer and wider jaw, a shorter chin, an upper-lid shelf, a smaller nose with a rounded upturned tip, and fuller lips. The offsets are measured on the Basis shape and added to every shape key, so the morph deltas are unchanged.
- **Lashes:** the lash islands of `Expression Hair` (max z < 1.475) are scaled about 1.1–1.2x about each eye opening. Brows are left alone. An earlier version selected by position, which also caught the brows and made them jagged; that is fixed.
- **Hair:** every displacement is a function of position only (radial inflate and vector noise stretched along Z), so ribbon seams never tear. Normal-based noise tore the ribbons in the first attempt.
  - **Claire:** volume push, S-waves, and 1.3x length below the jaw, so the ends now reach about z 0.85 (past the chest). Three extra clump layers, each rotated or scaled with its own wave phase. The layer transform fades in below the crown, so the crown sits just inside the base shell with no z-fighting. Islands in front of the face are dropped and `clear_face` tucks the rest to the cheek line, so the eyes stay visible.
  - **Maya:** the bun ribbons (islands with min z > 1.6) are scaled 1.32x, plus three rotated loop copies for a messy bun. The four face-framing strand ribbons are longer and waved, with two extra strand copies per side.
  - **Noah, Mara, Jules:** a generic recipe. The ribbons are inflated and get clump noise, plus two clump layers. Mara also gets long waves.
- **Weights:** the new hair layers take their weights from the untouched original hair through a Data Transfer modifier (vertex groups, `POLYINTERP_NEAREST`), which is applied before the layers are joined. The eye, jaw and head bones are moved with the same field.
- **Noah note:** `assets/characters/noah.blend` is out of sync with `noah.glb`. It has the older olive-jacket outfit, no eye morphs, and every shape key saved at 1.0, so its face renders broken. V2 Noah is therefore built from `noah.glb`, which is what Unreal uses, with `--from-glb`. The v1 preview for Noah is the glb render.

V2 is imported to `/Game/MapleBean/Characters/<Name>/V2/<name>_v2/` with `MB_CHAR_VARIANT=V2`.

### 3b. Scalp cap, parting and hairline fix (user report: pink scalp showing at the crown on Claire and Mara)

Script: `Scripts/characters_blender_scalp.py`, run from `characters_blender_v2.py` after the hair is built.

- **Parting:** front-crown hair verts are pulled up to 35% toward the midline and 2 mm outward, so the two sides of the part overlap.
- **Hairline:** the lower edge of the front hair is pulled down by up to 4 mm.
- **Scalp cap (`Scalp cap geometry`):** a copy of the head skin, built from these regions:
  - skin under the hair, where a radial ray hits hair within 6 cm;
  - the whole crown above c.z + 0.105;
  - the back of the skull;
  - one extra ring of neighbouring verts.

  The face and brows are never included, and neither are bangs hanging more than 12 mm in front of the forehead. The cap sits up to 2 mm out, never through the hair; its edge verts sit 0.3 mm out, so there is no step. It uses the Hair material, with UVs from the nearest hair face so it takes the local hair colour. It is 100% skinned to `head`. Each cap has about 3.9k–5.6k verts.
- **Bug found:** the head field writes to the shape keys, so `mesh.vertices` still held the pre-field basis. The first cap was built inside the enlarged head and was invisible. It is now synced from the reference key first.
- Blender 5 keeps vertex-group names on the mesh, so the cap's `head` group is re-created explicitly.
- **Proof:**
  - `SourceArt/Characters/preview/scalp_check_v2.png`: all five characters, front view from above (top row) and 3/4 view (bottom row). No skin shows at the crown or parting.
  - Per-character images: `preview/<name>_v2_front.png` and `<name>_v2_face.png`.
- **Cap border (lead review):** the cap edge was a jagged stair-step. It is now fixed as follows:
  - Faces with two or more border edges ("spikes") are dropped, over up to 3 passes.
  - The border loop gets 8 curve-shortening relax passes, each snapped back onto the head surface.
- **Root shadow:** the cap has its own material slot, `Hair scalp` (a copy of Hair). In UE it gets the hair master with Tint × 0.6, so it reads as shadowed hair roots.
- `assets/*.glb` is read only, so **Current** (v1) can't get a cap. V2 is the fixed set.

### 3c. Colour fixes after the lead's review of chars-v2 and chars-v3

- **Skin:** no longer uses pre-integrated skin (see the table above). In chars-v3 it reads warm, not chalky.
- **Hair:** the highlights multiply the hair's own albedo. `HairGain` is 0.8, specular dropped from 0.3 to 0.12, and roughness is 0.72 (0.5 in the band). The reflected warm café sky was lifting dark hair to mid brown.
- **Encoding:** a patch script wrote `characters_shaders.py` as cp1252, which broke the UE import once. All `characters_*.py` files are now UTF-8.
- **Current check:** `Saved/QA/chars-v3-current/characters.png` renders all five Current characters textured, with no checker. The checker the environment agent saw in env-plants was a shot taken while the masters were being rebuilt: my run rebuilds their graphs in place, and the headless run doesn't compile shaders. This needs no fix, but don't shoot while `characters cmd` holds the lock. (The lock already prevents that; the shot copy is taken inside the lock.)

### 4. Renders

- Blender before/after images are in `mb_unreal_engine/SourceArt/Characters/preview/`:
  - `compare_all.png`
  - `compare_<name>.png`
  - `<name>_v1|v2_full|face.png`
- UE render of Current with the new materials: `mb_unreal_engine/Saved/QA/chars-v1/` (`characters.png`, `coffee_bar.png`, ...).
- V2 renders: `MB_CHAR_VARIANT=V2 Scripts/ue_run.sh characters shot <tag>`. The shot mode now supports this.
  - `Saved/QA/chars-v2/` was shot by the lead. It shows the washed-out shaders and the scalp gaps.
  - `Saved/QA/chars-v3/` has the scalp cap and the shader colour fix.

### Open items

- The faces are still the procedural base with offsets. The target's large glossy eyes with thick lash lines and sculpted lids need an authored sculpt (audit section 5, option A).
- The generic hair recipe for Noah and Jules adds only mild volume. A dedicated tousled-clump recipe would help.
- The eyes should switch to clear coat once the pins are available from Python, or through a material function asset.

## Final consolidated pass (chars-final)

1. **Hair colour:** a per-character `HAIR_TINT` in `characters_materials.py` sets Mara near-black, Jules medium brown, Maya and Noah dark brown, and Claire golden blonde. The highlights scale the hair's own albedo, `HairGain` is 0.8, and specular is 0.12.
2. **Face depth:** `bake_face_ao` in `characters_blender_v2.py` ray-casts contact AO from the head, hair, lashes, eyes and scalp cap into the `AO` vertex colour (glTF COLOR_0). `M_MB_Character_Skin` multiplies it into the base colour and uses it as AO, which darkens the hairline, brows, eye sockets, nose and jaw.
3. **Outfit:** the cloth master applies a saturation lift of 1.15 after the denim fix, and the fabric normal strength is 0.6.
4. **Scalp:** all five V2 characters have the hair-coloured scalp cap (relaxed border, root-shadow tint), a closed parting and a lower hairline. Proof: `SourceArt/Characters/preview/scalp_check_v2.png`.
5. **Final render:** `MB_CHAR_VARIANT=V2 Scripts/ue_run.sh characters shot chars-final` writes to `mb_unreal_engine/Saved/QA/chars-final/`. Earlier renders: `chars-v3/`, `chars-v4/`, and the Current check `chars-v3-current/`. Before/after previews are in `SourceArt/Characters/preview/compare_all.png`.
