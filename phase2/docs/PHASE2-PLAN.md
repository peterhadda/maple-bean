# Maple Bean — Phase 2 plan

Audited 2026-09-16 on branch `phase-2-prototypes` (from `main` @ `a0773aa`).
Companion document: [CHARACTER-DNA.md](CHARACTER-DNA.md).

> **Naming note.** `qa/phase2.*.png` and `qa/qa-2.4…2.7` in the existing repo belong to an **earlier**
> iteration (focus timer, music, coffee step-game, social status). This document's "Phase 2" is the new
> brand, character, homepage, study and mini-game prototype layer. It lives only in `phase2/` and `design-assets/`.

---

## A. Project audit

**Stack.** Vanilla ES modules, no bundler. Three.js **0.180.0** via import map from `node_modules`.
A Node `http` server (`server.mjs`) on `127.0.0.1:4321` serves a **fixed allow-list of files** plus
`/assets/*` and `three`, and hosts local multiplayer (join/move/sit/stand/chat/emote over POST `/api` + SSE
`/events`, ≤16 guests, loopback only). Dev dependency: `playwright-core` (QA uses the installed Chrome).

**Repository.** 72 tracked files, 4 commits (all 2026-09-15), clean and in sync with `origin/main`.
Blender 5.2, Node 22.16, Python 3.13 and Chrome are installed.

| area | files | verified state |
|---|---|---|
| Café environment | `MapleBeanExpanded.blend` (938 objects, 924 meshes, 32 materials), `assets/cafe.glb` (9.5 MB, 924 meshes, 21 materials, no textures), `assets/layout.json` (20×14 m, 37 obstacles, 16 stations), `original/MapleBeanGraphics.blend`, `tools/build_cafe.py` | loads; merged by material at runtime |
| Characters | `maya-character.js` (1,142 lines, `createMaya(options)`), `characters.js` (4 presets), `animation.js` | 4 residents render; see DNA doc |
| Game shell | `app.js` (466 lines: camera modes, input, seating, ordering, dialogue, focus, music, notes, chat, render loop), `index.html`, `style.css` | runs |
| Game logic (pure) | `navigation.js`, `cafe-life.js`, `interactions.js`, `focus.js`, `music.js`, `minigames.js`, `social.js`, `save.js`, `effects.js` | unit-tested |
| Studio | `maya.html`, `studio.js` | 6 views, 3 expressions, 5 poses, cast switcher |
| Tests | `tests/*.test.mjs`, 9 files | **23/23 pass** (`node --test`, one test needs the live server) |
| QA | `qa/*.mjs` (6 Playwright scripts) + 22 screenshots | **not re-run**: they overwrite the tracked baseline PNGs in `qa/`. Phase 2 runs copies that write to `phase2/qa/`. |

**Measured performance** (in-app browser, Intel Iris Xe, 1024×768, 4 residents):

| metric | value |
|---|---|
| frame rate (overview camera, pane visible) | **19 fps** |
| draw calls / triangles | 230 / 951k (residents ≈80%) |
| one resident | 168k–201k tris, 51–62 meshes, 8 unshared textures (≈32 MB GPU) |
| `createMaya` | ≈570 ms blocking |
| one walking pose update (CPU skinning) | **≈19 ms** |

The frame budget is already exhausted by character skinning, before Leo and Noah are added.

**Problems found during the audit**

1. **Performance ceiling** (above). Six residents on the current character path is not viable.
2. **Jules's masculine read is weak.** The top colour sits close to his skin tone, and he shares the painted coral lips,
   pink blush and liner wing, a centre-part slick derived from the bun hair flow, and flared wide-leg jeans.
3. **Mara is Maya recoloured** (same hair, face and outfit) plus an apron.
4. **Personality overlap risk.** Claire's dialogue establishes *her* sketchbook, and the brief gives Leo sketching.
5. **Focus camera sits behind the player**, and the study chair back blocks the character (`qa/phase2.4-focus-active.png`).
6. **Two competing identities**: the café's "maple bean" (pine/cream, Georgia) and the studio's "Maple Hollow"
   (navy/maple red, script font, different taglines).
7. **UI type is very small** (8–10 px labels), which hurts both accessibility and the game-like feel.
8. **Figma (corrected 2026-09-16).** `p8TKGHhasO65VBOFvM7BQ1` has 10 pages: Cover, Foundations (variables:
   Primitives, Color Day/Evening, Spacing, Radius, Size; Fraunces + Nunito text styles), Components (58), a
   26-screen *Prototype · Full Journey*, Handoff & Scope, and five Phase 2 pages. An earlier read listed only two
   pages because unopened pages had not loaded yet. Every character and the café backdrop were flat vector
   placeholders; those now use game renders (see J). The "Thumb / Eyes" tiles still contradict the "no face step"
   creator decision.
9. **The server allow-list** means any new page needs either a `server.mjs` change or a separate server.
10. **Canva is not available in this session** (not listed among the session's connectors).

## B. Feature state

| feature | state | evidence |
|---|---|---|
| 3D café from Blender GLB, merged by material | **EXISTING** | `app.js addCafe` |
| Walk (WASD/arrows), click-to-walk, BFS paths, AABB collisions, doorway | **EXISTING** | `navigation.js`, `tests/cafe.test.mjs` |
| Seating with server reservation (9 seat, 1 read, 2 study) | **EXISTING** | `server.mjs sit/stand` |
| Ordering (3 drinks, coins, 3 sips) | **EXISTING** | `cafe-life.js` |
| Coffee "mini-game" | **EXISTING**, button-sequence | `minigames.js` |
| Dialogue (Mara, Jules, Claire) | **EXISTING**, static authored | `app.js talkTo` |
| Local multiplayer: guests, 8 m chat, 5 emotes, statuses | **EXISTING**, loopback only | `server.mjs`, `social.js` |
| Focus timer + today/sessions/streak | **EXISTING** | `focus.js` |
| Focus music: synthesized ambient, local files | **EXISTING** | `music.js` |
| Lo-Fi / Jazz / Rain / Nature / Spotify | **PLANNED**, honest notes, not wired | `music.js INTEGRATION_NOTES` |
| NPC routine | **PARTIAL**: Jules & Claire loop order→sit→sip→leave; Mara static with periodic wave; no preferences | `cafe-life.js` |
| NPC social | **PARTIAL**: a 💬 label when two idle regulars are within 2.2 m | `app.js` |
| Steam over held cups, lighting presets, fire flicker | **EXISTING** | `effects.js`, `app.js` |
| Notes, photo, floor plan, collision overlay | **EXISTING** | `app.js` |
| Character studio (turnaround) | **EXISTING** | `maya.html` |
| Procedural character generator | **EXISTING** | `maya-character.js` |
| Poses: idle, walk, sit, wave, sip, blink, smile, wink | **EXISTING** | `animation.js` |
| Masculine body variant | **PARTIAL**: proportions only, shared face paint/hair | `male` flag |
| Hairstyles | **PARTIAL**: 3, hard-coded per character | generator |
| Clothing | **PARTIAL**: one base outfit + 2 bespoke layers, colour-only variation | generator |
| Study experience | **PARTIAL**: desks + panel; camera behind | `app.js` |
| Homepage | **PARTIAL**: welcome card over a distant diorama | `index.html` |
| Brand | **PARTIAL**: café wordmark/favicon/CSS palette; conflicting studio sub-brand | `style.css`, `maya.html` |
| Figma UX | **EXISTING**: tokens, components, 26-screen journey, handoff; characters now game renders | Figma file |
| Design asset pipeline (game renders → `design-assets/`) | **EXISTING** (Phase 2) | `phase2/qa/capture.mjs` |
| Leo, Noah | **MISSING** | — |
| Character creator (runtime) | **MISSING** (Figma thumbs only) | — |
| Living homepage, cinematic camera | **MISSING** | — |
| Weighted NPC state machine, autonomous social interactions | **MISSING** | — |
| Typing / reading / writing / tablet / stretch / talk poses | **MISSING** | — |
| Front-facing study camera, desk props | **MISSING** | — |
| Controlled mini-games (Barista Rush, Bean Run, Latte Art, Table Dash) | **MISSING** | — |
| Render-capture pipeline, `design-assets/` | **EXISTING** (Phase 2): 40 character renders, 13 café scenes | `design-assets/README.md` |
| LOD, shared resources, GPU skinning | **MISSING** | — |
| Accounts / sign-in | **MISSING** (README: not connected) | — |
| Canva brand kit | **PLANNED**: connector added to the account, not loaded in this session; brief ready | `design-assets/canva/BRIEF.md` |
| Door, pedestrian and plant micro-life | **MISSING** (door nodes exist in the GLB, merged at runtime) | — |

## C. Character DNA analysis

Full measurements are in [CHARACTER-DNA.md](CHARACTER-DNA.md). In short:

- **One generator, no models.** Parametric head and body surfaces, tapered-tube hair, canvas-painted face and fabric.
- **Proportions**: ≈1.64 m, **≈4.8 heads tall** (masculine ≈5.1), legs ≈44%, long arms, chunky cream sneakers.
- **Face**: huge low-set glossy eyes with two catchlights and real blinking lids, painted winged liner,
  thick arched painted brows, button nose, small coral mouth, blush and freckles, big round ears.
- **Hair**: sculptural flattened ribbons merged into one mesh, Kajiya-Kay sheen, vertex-tint variation.
- **Clothes**: tailored analytic shells; detail lives in painted stitching and procedural rib/twill normals;
  everyone shares knit top + wide-leg jeans + sneakers.
- **Motion**: procedural CPU skinning; idle, walk, sit, wave, sip; no head look or two-hand poses.
- **Gaps for Phase 2**: skin-aware paint, a hair/outfit registry, masculine face options, performance, new poses.

## D. Brand analysis

**What exists**
- Wordmark: lowercase **"maple bean"** in Georgia. Sub-line "MAPLE HOLLOW · THE NEIGHBOURHOOD CAFÉ".
- Favicon: pine rounded square with a cream steaming cup. This is **generic** (any café could own it).
- Voice: gentle, second person, Canadian/British spelling ("neighbourhood", "favourite").
  "YOUR THIRD PLACE", "A little room to slow down.", "Stay a little longer", "Nothing to rush."
- Studio sub-brand: "Maple Hollow" wordmark with pine silhouettes and a red maple leaf, navy `#1f3354`,
  maple red `#b3443a`, script display font, "People make the story." This conflicts with the café identity.

**Palette measured from the café's actual materials** (`assets/cafe.glb`, sRGB, ordered by use)

| token | hex | café material |
|---|---|---|
| forest | `#334d42` | Bean · forest green (UI pine `#304c40` matches) |
| foliage | `#446b48` | Bean · foliage |
| sage | `#868f70` | Bean · sage upholstery |
| linen | `#ecdfc6` | Bean · linen |
| chalk | `#f1e4ca` | Bean · chalk |
| plaster | `#e8d8bf` | Bean · warm plaster |
| honey oak | `#ac7851` | Bean · honey oak (planks `#a57c59`–`#c19972`) |
| brass | `#bc965d` | Bean · aged brass |
| cinnamon | `#ac6048` | Bean · cinnamon velvet |
| terracotta | `#ab634e` | Bean · terracotta |
| espresso | `#332e2a` | Bean · espresso |
| lamp glow | `#ffe0a1` | Bean · warm light |

**Assessment**
- The café palette is distinctive and should be the brand source of truth. The studio's navy/maple-red should
  be retired or narrowed to a single accent, not kept as a parallel identity.
- **The name's "maple" is almost absent visually.** There's no leaf in the café brand, and the only red is in
  the studio. Cinnamon/terracotta is the natural maple-autumn accent already in the room.
- The current UI is calm, editorial and tiny, which reads closer to a SaaS dashboard than a world. Phase 2 needs larger,
  tactile, rounded surfaces (linen cards, honey-oak and brass details, chalkboard signage) while keeping the same palette.
- Georgia and Segoe UI are system fonts that change per OS. Brand exploration should pick web fonts
  (candidates to test: a warm, soft display serif plus a rounded humanist sans).

**Logo directions to explore** (original, avoiding "cup with steam" and anything Club Penguin)
1. **Leaf-bean**: a single mark where the maple leaf's centre vein is the coffee bean's crease.
2. **Open door**: an arched café door with lamp glow, a steaming cup silhouetted inside (the third place).
3. **Two cups, one leaf**: two mugs meeting; the negative space between them forms a maple leaf (community).
4. **Hanging blade sign**: the lowercase wordmark on a brass-bracket shop sign, with the leaf as a detail.
5. **Bean Card roundel**: a punched loyalty-card stamp for badges, profile and social avatars.

## E. Club Penguin UX research summary

Used strictly as **UX inspiration**. Nothing below copies art, layouts, names, sounds or mechanics.

| why it felt alive | evidence | Maple Bean translation (original) |
|---|---|---|
| The homepage was a **live window** onto current events: the login scene changed with parties and happenings | login screens showed event scenes above Play and changed with island events (CP Wiki: Login Screen, ClubPenguin.com) | The homepage **is** the café in real time: residents mid-routine; a chalkboard "What's brewing" shows the day's event |
| **Rooms as readable stages**: one purpose per room, visible exits, a map | Coffee Shop was both a minigame room and a main meeting place (CP Wiki) | Named café zones (counter, lounge, study nook, community table, back room) with diegetic signs and a café map |
| **Minigames lived inside rooms**; you walked up to them | Bean Counters in the Coffee Shop (CP Wiki) | Barista Rush starts behind the counter, Bean Run in the storage room, Latte Art at the bar. Original mechanics (see Q) |
| **Expression without typing**: emotes, actions, profile cards | emoticons and player-profile reading built social cohesion (research cited in CP Wiki / HandWiki) | Existing emotes + café gestures (cheers with cup, wave, sit together); profile as a **Bean Card** loyalty card with punched stamps |
| **Events refresh the world** | monthly parties transformed rooms | Seasonal café days: Rainy Readathon, Latte Art Friday, Maple Harvest week |
| **Community framing** | the name was chosen so players felt part of a community (CP Wiki) | "Good coffee. Real people. Your place." and the third-place positioning |

Sources: [Club Penguin Wiki](https://clubpenguin.fandom.com/wiki/Club_Penguin),
[Login Screen history](https://clubpenguin.fandom.com/wiki/Login_Screen),
[ClubPenguin.com](https://clubpenguin.fandom.com/wiki/ClubPenguin.com),
[HandWiki: Club Penguin](https://handwiki.org/wiki/Software:Club_Penguin). Rows beyond these sources reflect
general design knowledge. Direct article fetches were blocked (403/402).

**Originality test** applied to every design: *remove all Club Penguin references; does it still look
unmistakably like Maple Bean?* Warm café materials, human residents with the DNA above, coffee culture, and
study/third-place purpose answer yes. Snow, penguins, pets, igloos, an island map and falling-object catch games are excluded.

## F. Phase 2 architecture

```
                 ┌──────────── existing (untouched) ────────────┐
 :4321  server.mjs → index.html, app.js, maya.html …  (production playtest)
                 └──────────────────────────────────────────────┘
                              ▲ read-only imports (navigation, focus, music, effects, animation,
                              │ maya-character for parity, assets/cafe.glb, layout.json, three)
 :4322  phase2/server.mjs → /phase2/*  (isolated prototype layer, no /api, no writes)
          ├─ character-kit/   fork of the generator: looks, hair/outfit registries, shared
          │                   resources, LOD, GPU skinning, new pose channels  ← parity-tested
          ├─ life/            pure NPC brains + café director (reservations, social, quiet budget)
          ├─ shared/          café scene loader, lighting presets, input, perf HUD, UI tokens
          ├─ home/  create/  study/  cast/  render/
          └─ games/ barista/  bean-run/  latte/  (table-dash later)
 design-assets/ ← PNG captures exported from Three.js (canonical) → Figma / Canva (presentation only)
```

Rules:
1. **No file outside `phase2/` and `design-assets/` changes** until a promotion is approved. This is enforced by a test.
2. Phase 2 imports root modules **read-only**. It never monkey-patches them.
3. The kit is a **fork** of `maya-character.js` + `animation.js`. Parity with the canonical four is proven
   before the kit is used anywhere.
4. Logic is pure and Node-testable (life brains, game rules, timers). Rendering stays thin.
5. Design tools never write to code. Tokens flow Figma → `phase2/shared/tokens.json` by a reviewed commit.
6. **UX/UI is designed in Figma, not in code.** Code prototypes carry only unstyled scaffold controls
   (plain buttons, a debug HUD) to drive the 3D scene and gameplay, visibly labelled as scaffolding.
   Homepage overlay, creator screens, HUDs, study panel and game menus are designed in Figma first, then
   implemented only from approved frames.

**Milestones and gates**

| # | milestone | gate |
|---|---|---|
| M0 | backup tag + bundle, branch, isolated server, isolation test | existing 23 tests pass; `git diff pre-phase-2 -- . ':!phase2' ':!design-assets'` empty |
| M1 | character kit fork + parity; shared resources; GPU skinning; LOD | 4 residents identical to canonical; perf targets (R) |
| M2 | Leo & Noah; cast lab; render pipeline → `design-assets/` | your visual approval of Leo/Noah |
| M3 | NPC life system + living homepage scene + micro-life (3D only, scaffold controls) | fps target; "not performing" review |
| M4 | study prototype (front camera, desk poses, audio logic) | camera never occluded; timer logic unchanged |
| M5 | Barista Rush, Bean Run, Latte Art (gameplay, scaffold HUD) | real movement; 30–90 s loops; logic tests |
| M6 | character creator engine (look system + live preview) | canonical residents provably unmodified |
| M7 | Figma: every screen and HUD for M3–M6; Canva brand kit | your design approval |
| M8 | implement approved Figma UI over the prototypes | matches frames; accessibility check |
| Promote | selected pieces merged into production | separate approval, full regression |

## G. Files that will be created

```
phase2/README.md                         how to run; rules; isolation guarantees
phase2/server.mjs                        :4322 isolated server (read-only root allow-list)
phase2/index.html                        /phase2 hub
phase2/docs/PHASE2-PLAN.md, CHARACTER-DNA.md
phase2/shared/cafe-scene.js              GLB load + material merge + café lighting presets
phase2/shared/perf-hud.js                fps / draws / tris / textures / memory overlay
phase2/shared/input.js                   keyboard, pointer, touch joystick
phase2/shared/scaffold.css               deliberately plain scaffold controls (not a UI design)
phase2/shared/tokens.json                later: exported from approved Figma variables
phase2/character-kit/generator.js        forked, look-driven generator
phase2/character-kit/look.js             look schema, validation, canonical + new presets
phase2/character-kit/pose.js             forked pose system + new channels
phase2/character-kit/resources.js        shared textures/geometry cache
phase2/character-kit/skinning.js         GPU skinning (vertex shader) + CPU fallback
phase2/character-kit/hair/*.js           style modules (bun, waves, slick, + new)
phase2/character-kit/outfit/*.js         garment + accessory modules
phase2/life/{activities,personalities,brain,director}.js
phase2/cast/  render/  home/  study/  create/          prototype pages
phase2/games/shared/*  games/barista/*  games/bean-run/*  games/latte/*
phase2/tests/*.test.mjs                  isolation, parity helpers, life, games, looks
phase2/qa/*.mjs, phase2/qa/shots/        Playwright checks writing only here
design-assets/README.md                  "Three.js is canonical" rule
design-assets/characters/{maya,claire,mara,jules,leo,noah}/*.png
design-assets/tokens/                    exported tokens
```

## H. Files that would be modified

**None during M0–M7.** Proposed later, each needing explicit approval at promotion time:

| file | proposed change |
|---|---|
| `package.json` | add `phase2` / `test:phase2` scripts |
| `README.md` | document the prototype layer |
| `server.mjs` | optionally serve `/phase2` from :4321 instead of a second server |
| `maya-character.js`, `animation.js` | become thin wrappers over the approved kit (only after parity + review) |
| `characters.js` | add Leo and Noah to the production cast |
| `app.js`, `index.html`, `style.css` | adopt the study camera, life system, homepage, mini-games |

## I. Files that will not be touched

`index.html`, `app.js`, `style.css`, `maya.html`, `studio.js`, `maya-character.js`, `animation.js`,
`characters.js`, `cafe-life.js`, `navigation.js`, `interactions.js`, `focus.js`, `music.js`,
`minigames.js`, `social.js`, `save.js`, `effects.js`, `server.mjs`, `package.json`, `package-lock.json`,
`README.md`, `Start Cafe.cmd`, `favicon.svg`, `cafe-source.json`, `assets/*`, `original/*`,
`MapleBeanExpanded.blend`, `tests/*`, `qa/*`, `tools/*`, `.gitignore`.

## J. Figma plan

**Done 2026-09-16 (characters taken from the game):**
- Character Preview (Maya, Mara, Jules, Claire, Custom) and Character Model (four canonical casts): real
  game renders on top; vector figures hidden, not deleted. The 15 uses across the 26-screen journey update automatically.
- Café Backdrop (19 screens): real café render with background life only, under the original warmth overlay.
- Profile Avatar S/M/L: Maya headshot.
- Characters · Phase 2: new "Canonical game renders" section (four residents × 10 renders).
- Home Page · Room View: living homepage desktop frame on the game render (tagline, Enter / Create CTAs,
  Sign in · About · Community · What's new) and the showcase camera storyboard, shots A–F.
- Study Mode · Camera: four-step camera sequence, today's behind-the-chair view vs the Phase 2 front view, plus framing rules.
- Handoff notes and the screen 08 footnote now describe game renders instead of placeholders.
- Leo and Noah stay labelled concept placeholders (no game model yet). Figma's existing sheets define **Leo as
  "music & atmosphere"**; that decision stands over section L below.

**Still to do:** NPC Life System and Mini-games pages; creator swatch previews rendered per colour choice;
Leo and Noah renders once the kit builds them; responsive pass.

Extend the existing file (`p8TKGHhasO65VBOFvM7BQ1`). Keep its component library; do not rebuild it.

1. **00 Brand Tokens**: variables from the measured café palette (D), type scale (min 12 px UI,
   14 px body), radii, elevation, spacing; light + evening modes (mirroring the café lighting presets).
2. **01–12 pages** as briefed: Homepage, Login, Create Account, Character Creation, Character Selection,
   Café Loading, Main Café HUD, Social, Study Mode, Mini-games, Profile (Bean Card), Settings.
3. Prototype links cannot cross pages, so a **Prototype · Flow** page will hold the connected desktop journey
   (1440×900), with per-area pages holding specs and states. Responsive pass at 390×844 afterwards.
4. **New components**: nav bar, dialogue, chat bubble, mini-game HUD (timer, score, combo, order ticket),
   hair and clothing cards (reusing Customization Tile), study timer pill, audio panel, Bean Card.
5. **Replace placeholder "Character Preview" art** with real Three.js captures from `design-assets/`.
6. **Flag for decision**: the "Thumb / Eyes / Almond, Round" tiles contradict the no-face-step creator.
   Proposal: remove them.
7. Accounts and sign-in are designed as UX only and marked PLANNED; there's no backend.

## K. Canva plan

**Ready, needs a new session.** The Canva connector is now added to the account but did not load into the
session that did the Figma work. Full brief with assets and tokens: `design-assets/canva/BRIEF.md`. Summary:

- Brand kit proposal: 5 logo directions (D), palette boards from café materials, type pairings,
  voice and tagline sheet ("Good coffee. Real people. Your place.").
- Marketing templates: 1080² post, 1080×1920 story, 1500×500 header, 16:9 presentation deck, poster.
  All use `design-assets/` character renders. No illustrated or redrawn characters.
- Campaign seeds: "Your seat is saved", "Study with me at Maple Bean", "Latte Art Friday".
- Until then, the same exploration can be produced as Figma frames if you prefer.

## L. Leo concept (to be prototyped, then approved)

| | |
|---|---|
| role | the social creative, a **digital** illustrator and designer. Claire keeps the analog sketchbook; Leo works on a tablet and shows his work around. |
| personality | warm, expressive, a connector who drifts between tables; comfortable being seen |
| silhouette hook | **tousled textured quiff** with volume swept to one side + open **overshirt** over a tee |
| body | masculine preset (same height and head scale as Jules) |
| skin | warm olive-tan (distinct from all four current residents) |
| hair | new `textured-quiff` style: short sides from the same scalp shell, taller clumped ribbons on top, side sweep; dark brown with warm KK sheen |
| face | skin-aware lips/blush (lower blush), thin lash line (no wing), light freckles, straighter brows, brown iris |
| outfit | cinnamon/terracotta overshirt (café cinnamon velvet) open over a cream tee; dark indigo **straight** jeans with a cuff; canvas sneakers |
| accessory | tablet prop (held two-handed / on table), optional watch |
| behaviours | socialize 30%, tablet-create 25%, coffee 20%, wander 15%, show-and-tell at another resident's table 10% |

## M. Noah concept (to be prototyped, then approved)

| | |
|---|---|
| role | the regular who makes the study nook feel like a library |
| personality | calm, focused, reserved but kind: nods hello, rarely starts conversations |
| silhouette hook | **round glasses + backpack**, instantly readable at café distance |
| body | masculine preset, slightly narrower shoulders than Leo |
| skin | deep brown (deeper than Jules), with paint tuned for deep skin |
| hair | new `short-curls` style: dense clumped coils on a close scalp shell, soft rounded top; black-brown |
| face | skin-aware paint, no wing, no freckles, calm neutral default, dark brown iris |
| outfit | navy-slate crew sweater over a cream collar; stone chinos (straight); dark brown boots |
| accessories | round glasses (thin brass-toned frames), backpack; laptop, notebook, pen props at the desk |
| behaviours | study 45%, read 20%, coffee 15%, short social 10%, stretch/wander 10% |

Both must pass the DNA checklist (CHARACTER-DNA §10) and be told apart from Jules at overview distance.

## N. Character creator architecture

```
LookDescriptor (plain JSON, validated, versioned)
{ v:1, body:'feminine'|'masculine',
  skin:'#hex' (from 14 curated swatches),
  hair:{ style:'bun-curtain'|'long-waves'|'slick-short'|'textured-quiff'|'short-curls'|…, color:'#hex' },
  face:{ preset:'auto' }            ← derived from body + skin (no face step, by decision)
  top:{ style:'knit'|'tee'|'sweater'|'hoodie'|'overshirt'|'cardigan', color },
  bottom:{ style:'wide-leg'|'straight'|'trousers'|'cargo', color },
  shoes:{ style:'sneakers'|'boots', color },
  accessories:['glasses'|'backpack'|'headphones'|'necklace'|'watch'] }
        │
        ▼  character-kit/generator.js (fork)
  registries: hair/*, outfit/* (each module returns geometry + region tags for skinning)
  resources.js caches by sub-key (head per body; eye tex per iris; paint per skin+body; denim per colour…)
        │
        ▼  { group, update(pose), dispose(), lod }
```

- **Skin tones**: 14 swatches across very light → deep brown, spaced perceptually (OKLab lightness steps
  with warm/neutral/olive undertones). Each swatch carries its derived lip, blush and brow colours.
- **Hair colours**: black, dark brown, brown, light brown, blonde, auburn, red (stylised later).
- **First catalogue** (small and polished): 6 hairstyles (3 existing + quiff + curls + one feminine new
  style, e.g. bob or ponytail), 4 tops, 3 bottoms, 2 shoes, 4 accessories.
- **Isolation**: presets are frozen objects. The creator deep-clones a starting look; a test asserts
  the cast presets are byte-identical after any creator session.
- Figma thumbnails become **real renders** from the capture pipeline.

## O. NPC state system

Pure modules, no Three.js, seeded RNG, Node-tested; reuses `navigation.js` read-only.

- **States**: `ENTER, WALK, QUEUE, ORDER, WAIT, RECEIVE_DRINK, CARRY_DRINK, FIND_ACTIVITY, SIT, STUDY,
  READ, SKETCH, TABLET, SOCIALIZE, DRINK, BREAK, WANDER, CHANGE_ACTIVITY, LEAVE`, plus `WORK` for the barista.
- **Brain** (per resident): picks the next activity from weighted preferences × context (time since
  last drink, seat availability, nearby friends, fatigue), holds it for a duration range, then
  `CHANGE_ACTIVITY` or `LEAVE`. Activities declare their required station kind, pose, props and whether they can be interrupted.
- **Director** (café-level): seat and queue reservations; social matchmaking with cooldowns; a
  **quiet budget** (at most one conversation per ~20 m² and at most two social events running at once, plus enforced silence
  windows); staggered schedules; greetings when paths cross within 1.5 m, at most once per pair per visit.
- **Personalities** (no duplication):

| resident | core | weights |
|---|---|---|
| Mara | barista | work 80% (serve, wipe, prep), break-sip 10%, greet 10% |
| Maya | friendly, outgoing, animal lover | socialize 30%, coffee 20%, lounge 20%, read 15%, wander 15% |
| Jules | board-game-night regular, "put the world to rights" | community table 35%, conversation 30%, coffee 20%, window people-watch 15% |
| Claire | analog sketchbook, coffee enthusiast | sketchbook by the window 35%, coffee tasting 25%, read 15%, quiet chat 15%, wander 10% |
| Leo | digital creative connector | socialize 30%, tablet 25%, coffee 20%, wander 15%, show-and-tell 10% |
| Noah | studious, reserved | study 45%, read 20%, coffee 15%, short social 10%, stretch/wander 10% |

## P. Study camera plan

1. The player chooses a study desk → path to approach → sit (existing seat reservation rules).
2. Props appear: laptop (or book), notebook, cup.
3. **Camera solve**: candidates around the seat facing the character's front: straight front, ±30° 3/4,
   desk-height (eye level ≈1.05 m seated) at 1.2–1.6 m. Each candidate is raycast from lens to head and hands
   against café geometry; the first unobstructed one wins. Fallback: a higher front 3/4.
4. **Transition**: 1.6 s eased curve through a side waypoint (so it never passes through the desk), FOV 42 → 35.
5. **Framing**: face + hands + laptop + cup in the lower two-thirds; café bokeh and background behind.
   A subtle ±2 cm "breathing" drift. Limited orbit (±25° yaw); a view toggle cycles front / 3/4 / over-the-screen.
6. **Loop while focusing**: typing 55%, reading notes 15%, looking at screen, sip every 3–5 min,
   stretch every ~10 min, glance out the window.
7. **Timer**: `focus.js` imported unchanged. The timer and panel UI are designed in Figma (page 09);
   the prototype shows a plain scaffold readout until then.
8. **Audio shell**: "Maple Bean ambience" (synthesized café murmur + rain, real), "My music" (local files,
   real, reusing `music.js`), and Lo-Fi / Spotify / Apple Music marked **PLANNED**, shown with honest notes and no fake playback.

## Q. Mini-game prototype plans

Shared: fixed-timestep loop, input (WASD/arrows + Space/E, pointer, touch joystick), title → countdown →
play → results, HUD, pause, reduced-motion support. Rules live in pure `*-logic.js` files with Node tests.
The existing step-game stays untouched.

**1. Barista Rush** (60–90 s, 3/4 top-down bar)
- Stations: cup stack, espresso machine, milk steamer, syrup rail, pass counter, bin.
- Carry one item. **E** picks up or places; **hold E** to work (brew 1.5 s; steam with a sweet-spot meter).
- Maple Latte: cup → place at machine → brew (runs while you walk away) → pitcher at steamer → steam →
  carry pitcher to the cup and hold to pour → carry the cup to the syrup rail and pump twice → deliver to the pass before the ticket expires.
- Tickets queue up (up to 3); tips for speed and accuracy; a wrong drink goes in the bin.

**2. Bean Run** (90 s, storage room). Deliberately **not** a falling-catch or stacking game.
- Sacks arrive through a delivery hatch, colour- and label-coded (Light, Medium, Dark, Maple Decaf).
- Walk and **Space** pick/drop; carry up to 3, with each sack slowing you 12%.
- Deliver to the matching labelled bins around the room: correct = points + combo, wrong = combo reset.
- Obstacles: fixed crates and shelving, a **rolling cart on a track**, a spill that makes you slide, a backlog alert if 6 sacks pile at the hatch.

**3. Latte Art** (pointer/touch skill game, 2D top-down cup)
- A low-resolution stable-fluids grid (≈96²) carries milk-foam dye over crema.
- **Pitcher position** = pointer; **pour rate** = hold duration ramp; **pitcher height** = vertical drag
  distance (high pour sinks under the crema, low pour draws white); **cup tilt** = A/D or two-finger rotate.
- Patterns: heart, leaf (rosetta wiggle), circle; maple leaf later.
- Score = shape IoU against the template + symmetry + contrast. No buttons during the pour.

**4. Table Dash** (optional, after the above): order tickets, carry the drink through the café using the real layout and collisions, deliver to the right resident.

## R. Performance plan

Targets (1440×900 desktop): **≥55 fps on a discrete GPU; ≥30 fps stable on Intel Iris Xe** with six
residents on the homepage; each resident <40 ms build after the first; <250 draw calls.

| # | change | expected effect |
|---|---|---|
| 1 | **GPU skinning**: per-vertex matrix indices and weights precomputed from the same region/height rules; ~12 matrices uploaded as uniforms | removes the ≈19 ms/character CPU pose cost |
| 2 | **Shared resources** keyed by look sub-keys (head geometry per body type, eye texture per iris, paint per skin+body, fabric per colour, rib/twill normal maps global) | ≈32 MB → a few MB per extra resident; build ≈570 ms → tens of ms |
| 3 | **LOD by tessellation** (same generator, fewer grid rows/cols): hero 100%, mid ≈30%, far ≈10% + blob shadow | homepage triangles ÷3 |
| 4 | Update throttling by distance and frustum; background residents at 15–30 Hz | CPU headroom |
| 5 | Shadows only for near residents; adaptive pixel ratio 1.0–1.5 from frame time | GPU headroom |
| 6 | Progressive spawn, lazy page modules, `requestIdleCallback` builds | smooth first paint |
| 7 | Perf HUD + a Playwright counter script (draws, tris, geometries, textures, heap, load time) per prototype | regressions visible |

Fps is measured in the real in-app browser (GPU). Headless SwiftShader runs are used only for counts.

## S. QA and rollback plan

**Safety net (done in M0)**
- Tag `pre-phase-2` → `a0773aa`.
- Verified bundle `..\maple-bean-backups\maple-bean-pre-phase-2-2026-09-16.bundle` (all refs).
- All work on `phase-2-prototypes`; `main` untouched; nothing pushed.

**Automated checks, run after every prototype**
1. Existing `node --test tests/*.test.mjs` (23 tests, live server on :4321).
2. `phase2/tests/isolation.test.mjs`: every tracked file outside `phase2/` and `design-assets/` is byte-identical to `pre-phase-2`.
3. Kit parity: Maya, Mara, Jules and Claire geometry, texture pixels and a rendered frame are identical to `createMaya`.
4. Phase 2 unit tests: looks, life brains (no furniture crossing, no double seats, weight distributions), game rules.
5. Playwright regression (writes to `phase2/qa/shots/` only): Maya walks, collisions, seats, ordering, dialogue, chat,
   focus timer, café loads, studio loads; Leo and Noah load; six residents coexist; study camera unobstructed;
   mini-game movement changes position; the creator leaves the cast untouched.

**Rollback**
- Abandon the prototypes: `git switch main` (production is unchanged by construction).
- Undo one prototype: revert its commit on the branch (one commit per milestone).
- Disaster: `git clone ..\maple-bean-backups\maple-bean-pre-phase-2-2026-09-16.bundle`.
