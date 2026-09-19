# Maple Bean — Character DNA

Source of truth: `maya-character.js` (generator), `animation.js` (pose), `characters.js` (cast presets),
`studio.js` / `maya.html` (turnaround studio). Everything below was read from that code or measured
in the running café / studio on 2026-09-16. Units are metres; "local" means head-local units before
`HEAD_SCALE`.

Maple Bean residents are **not models**. Each one is generated at runtime by one function,
`createMaya(options)`, from parametric surfaces, splines, tapered tubes and canvas-painted textures.
There are no GLB characters, no bones and no image textures on disk. Anything new (Leo, Noah, the
creator) must be produced by the same construction, or it will not look like it belongs.

---

## 1. Identity inputs that exist today

`characters.js` gives each resident exactly:

| field | Maya | Mara | Jules | Claire |
|---|---|---|---|---|
| `male` | false | false | **true** | false |
| skin | `#eeb092` | `#d6a07d` | `#895d43` | `#eaaf8e` |
| hair | `#22140e` | `#4c2b1c` | `#28221f` | `#bba075` |
| top | `#f4e6d9` | `#506b50` | `#b4845c` | `#ede2d9` |
| denim | `#6179a0` | `#45596b` | `#48525a` | `#536d93` |

Everything else is hard-coded inside the generator behind `options.character === 'claire' | 'mara'`
string checks and the `male` flag: hairstyle, iris colour, brow colour, apron, cardigan, necklace,
the heart motif (Maya only).

## 2. Body

| trait | feminine (`male:false`) | masculine (`male:true`) |
|---|---|---|
| crown height | **≈1.64 m** | ≈1.64 m (same) |
| head height (chin→crown) | 0.342 m | 0.321 m |
| **heads tall** | **≈4.8** | ≈5.1 |
| head width | 0.276 m | 0.282 m |
| hip pivot / knee / ankle | 0.80 / 0.42 / 0.04 | same |
| leg length (floor→crotch) | ≈0.72 m (**~44% of height**) | same |
| shoulder pivot span | 0.256 m | 0.389 m (×1.52) |
| body width scale by height | — | ×0.88 at hips → ×1.52 at shoulders (y 0.72→1.20) |
| chest | soft bust bump 0.024 | 0.002 (flat) |
| waist (midriff shell) | half-width 0.077–0.090, bare midriff 0.975–1.065 | top extends to 0.97 (no midriff) |
| hip shell | half-width 0.166 at 0.655 — generous hips | same geometry, narrowed ×0.88 |
| arm | shoulder 1.222 → elbow ≈1.035 → wrist ≈0.785 → fingertip ≈0.664 (reaches mid-thigh) | elbow pivot ×1.34 |
| hands | ellipsoid palm (r 0.0135 × 0.043 × 0.030) + 4 tube fingers (r≈0.007) + thumb, no knuckles | same |
| feet | chunky cream sneakers ≈0.28 m long, ≈0.11 m wide, ≈0.10 m tall | same |

Read: big head, long slim limbs, small torso, chunky shoes. Stylised youthful proportions (between
chibi and realistic), silhouettes built from soft vertical rectangles.

## 3. Head and face

- **Face shape**: egg cranium with superellipse front plane, soft full low cheeks, tapered jaw to a
  small round chin (`WF` spline). Masculine jaw ends at 0.78 width instead of 0.58, so it's broader but still soft.
- **Eyes, the signature**: eyeball radius 0.046 local (**≈5.2 cm on a 27 cm-wide head**), centres
  ±0.056 local apart, set just *below* head centre (y −0.024) → youthful low-set eyes. Iris fills most
  of the opening; dark limbal ring; **two white catchlights** (big upper-outer, small lower-inner,
  unlit `toneMapped:false`). Real geometric eyelids (grid sheets) that blink and squint.
- **Liner and lashes**: painted dark upper liner with a flicked **wing** on everyone, including Jules.
  Feminine: thick lash tube + 8 lash spikes + lower lashes. Masculine: thin lash tube, no spikes.
- **Brows**: painted, thick at the inner end, arch peaks at 66%, 320 individual hair strokes on top
  of a blurred base. Dark brown for all except Claire (warm light brown).
- **Nose**: small button nose from gaussian bumps, slight upturn, painted nostril shadows.
- **Mouth**: small closed mouth, painted coral-rose lips (`rgba(206,98,84)`), soft corner dimples.
  Smile and wink are **morph targets** on the head mesh.
- **Skin detail**: painted cheek blush (`rgba(238,108,96,.56)`), nose-tip flush, 22 tiny freckles.
- **Ears**: large, rounded, stylised.
- **Expressions available**: neutral, happy (smile .85), wink.

⚠ **Paint is tuned for light skin and is the same for every body type.** Lip colour, blush and freckles
don't adapt to skin tone, and the feminine liner wing appears on Jules. On deep skin (Jules) the lips read
as orange-pink lipstick and the blush as a pink patch. This is the single biggest blocker for credible
masculine faces and a wide skin-tone range in the creator.

## 4. Hair

Construction (all merged into **one mesh, one draw call**):

1. **Scalp shell**: a grid surface lifted off the skull, with grooves converging on the bun point and a
   feathered hairline (`hairness()`).
2. **Clumps**: 78 flattened tapered tubes (`flatten` 0.38) from the hairline toward the crown/bun.
3. **Curtain bangs**: 31 flattened tubes from a slight left part, sweeping to the temples.
4. **Loose temple strands**: 6 thin wisps breaking the edge.
5. Style-specific extras.

| style | used by | extras |
|---|---|---|
| **messy bun + curtain bangs** | Maya, **Mara** (identical) | face-framing wavy tendrils, nape wisps, lumpy bun core, 4 twisted rope coils, 18 knot loops, flyaways, hair tie torus |
| **long honey waves** | Claire | 24 long S-wave locks to the lower back + 6 face-framing locks, plain physical material |
| **short slicked** | Jules | base layers only (shell + clumps + bangs), with no bun, so it reads as a centre-parted slick |

Material: `MeshPhysicalMaterial` + **Kajiya-Kay dual specular lobes** driven by a per-vertex strand
tangent (`aStrand`), wrap diffuse, per-clump vertex-colour tint (0.8–1.2). Claire uses a plain
physical material instead of KK.

Silhouette rule: hair is **clumped and sculptural** (thick ribbons), never a flat cap and never
fine strands.

## 5. Materials

| surface | material |
|---|---|
| skin | `MeshPhysicalMaterial` roughness .52, specular .35, peach sheen .35, **wrap-lighting SSS band** (`uWrap` .5, warm `uSSS`) injected via `onBeforeCompile` |
| face | same skin shader + front-projected 1024² painted canvas (`uPaint`) |
| eyes | physical, clearcoat 1 / .04, 1024×512 painted iris texture, env .8 |
| hair | physical + KK specular (above) |
| knit top | physical, 2048×1024 colour canvas, procedural rib normal map, sheen .5 |
| denim | physical, 2048×1024 hip canvas + 1024² leg canvas with painted stitching, scoop pockets, back patch pockets, yoke, J-fly, side seams, lighter thigh wash; procedural twill normal map; sheen |
| sneakers | cream physical upper + sole, tan welt line, darker contact ring |
| props | brass jean button, belt loops, gold necklace/medallion (Claire), apron (Mara) |

Colour language: warm creams, muted denim blues, soft greens, honey browns. No saturated primaries.
The only accent is the small red heart on Maya's top.

## 6. Clothing

- Clothing shells are **analytic surfaces over spline profiles** (`torsoPoint`, `hipPoint`, legs),
  not cloth simulation. Silhouette detail is modest; the detail lives in painted textures (stitches, pockets, seams).
- **Shared uniform**: every resident wears the same base outfit: fitted rib-knit long-sleeve (cropped
  on feminine), high-rise **wide-leg flared jeans**, chunky cream sneakers.
- **Layering**: ad-hoc extra shells per character (Mara apron + ties + belt + pocket; Claire open
  cardigan shell + cardigan sleeves over bare arms + cami straps + gold buttons + necklace). There is no
  layering system: a new garment means new code in the generator.

## 7. Animation

`animation.js`: procedural matrices applied by **CPU vertex skinning**. Each vertex is assigned by region
(`arm`, `shoe`, by height for legs/torso) and blended between 2–3 matrices, then a pelvis matrix.
Normals are recomputed from faces after every pose.

| channel | behaviour |
|---|---|
| idle | whole-group breathing bob ±6 mm, head yaw sway .018 rad, blink every 3.2–5.2 s |
| walk | phase 10.2 rad/s, stride .23, two-segment IK legs (planted feet), pelvis sway/yaw/roll, arm swing |
| sit | drop to seat height (.44/.54/.585), thighs horizontal, knees 90°, forearms rest |
| wave | right arm up, elbow oscillation |
| sip | right hand brings cup to mouth; cup idles at .22 when held |
| expressions | eased neutral/happy/wink morphs |

**Not available:** head look-at/pitch, torso lean, left-hand props, both-hands poses (typing,
reading, tablet, writing), stretching, talking gestures, laughing, finger control.

## 8. Rendering context

| | café (`app.js`) | studio (`studio.js`) |
|---|---|---|
| tone mapping | ACES Filmic, exposure 1.25 | **Neutral** |
| light | hemisphere 2.1, sun 3.3 (PCF soft 2048² shadows), cool fill, 8 warm point lamps, fireplace flicker | hemisphere 1.7, key 2.6 (shadows), cool rim 1.3 |
| env | RoomEnvironment .45 | RoomEnvironment .42 |
| camera | FOV 42; overview (22,22,28); walk follow (+3.7,+3.5,+5) | FOV 26 turnaround presets |
| background | `#d5d6bd` + fog | transparent over warm grey gradient |

⚠ Café and studio renders use different tone mapping, so a character looks slightly different in each.
Design captures must record which context they used.

## 9. Measured cost (Intel Iris Xe, 2026-09-16)

| | value |
|---|---|
| triangles per resident | 168k (Jules) – 201k (Mara) |
| meshes per resident | 51–62 |
| unique map textures per resident | 8 (≈6.0 MP, **≈32 MB GPU** with mips), none shared between residents |
| `createMaya` build time | **≈570 ms** main-thread (Jules) |
| **one walking pose update** | **≈19 ms CPU** |
| café with 4 residents, 1024×768 | **19 fps**, 230 draws, 951k triangles (residents ≈80% of triangles) |

## 10. The DNA checklist (what makes someone a Maple Bean resident)

A new resident passes only if **all** hold:

1. Generated by the Maple Bean generator: same head function, eye construction, skin/hair shaders.
2. ≈1.64 m crown, ≈4.8–5.1 heads tall, legs ≈44% of height, long arms to mid-thigh.
3. Big low-set glossy eyes with two catchlights and geometric blinking lids.
4. Button nose, small soft mouth, full low cheeks, rounded ears.
5. Sculptural clumped hair ribbons with KK sheen, not caps and not fine strands.
6. Soft tailored-shell clothing with detail in painted texture (stitching, ribs, seams), muted
   warm palette, chunky footwear.
7. Moves with the shared procedural pose system (same gait, same seated pose).
8. Reads clearly at café distance by **hair silhouette + clothing colour block + one accessory**.

## 11. What Phase 2 must add, without changing the four canonical residents

- Skin-aware face paint (lip/blush/freckle tint derived from skin) and a no-wing liner option.
- A hair-style registry (the current three styles plus new ones) instead of `character ===` checks.
- An outfit/layer registry (tee, sweater + collar, overshirt, hoodie; straight jeans, trousers; boots;
  glasses, backpack, headphones, watch).
- Shared resources (textures and geometry keyed by look), LOD tiers, and GPU skinning.
- New pose channels: head look, torso lean, two-hand holds, typing, reading, tablet, writing, stretch, talk.

All of that happens in a **fork** under `phase2/character-kit/`. A parity test proves the fork still
produces Maya, Mara, Jules and Claire **identically** to `maya-character.js` before anything else is trusted.
