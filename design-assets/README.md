# Maple Bean · design assets

Renders exported from the running game for Figma and Canva. **Three.js is canonical**: every image here is
produced by the production character generator (`maya-character.js`, `characters.js`) and the real café
(`assets/cafe.glb`, `assets/layout.json`). Nothing in this folder is ever read back into the game, and
residents are never redrawn by hand. If a look changes, re-export.

## Regenerate

```powershell
node phase2/server.mjs                                   # :4322, leave running
node phase2/qa/capture.mjs characters                    # turnarounds + poses, all four residents
node phase2/qa/capture.mjs headshots
node phase2/qa/capture.mjs scenes                        # every café shot
$env:SCENE="home-hero"; node phase2/qa/capture.mjs scenes   # one shot
```

Headless SwiftShader rendering: slow but deterministic. Scene cameras and resident placement live in
`phase2/qa/capture.mjs` (`SCENES`); render code in `phase2/render/render.js`.

## Inventory

**`characters/<maya|mara|jules|claire>/`**, transparent PNG, studio lighting (as `maya.html`), same camera for
everyone so heights compare truthfully:

| file | size | notes |
|---|---|---|
| `idle-front`, `idle-34-front`, `idle-side`, `idle-34-back`, `idle-back` | 1024×2048 | turnaround |
| `walking-34-front`, `waving-34-front`, `holding-coffee-34-front`, `sipping-34-front` | 1024×2048 | poses the game supports |
| `headshot` | 1024×1024 | avatars, profile |

No sitting-alone, studying, typing or talking renders exist yet: the game has no such isolated poses
(sitting is shown in café scenes). Leo and Noah have no game model yet, so there are no renders.

**`scenes/`**, café lighting (ACES, "golden afternoon", as `app.js`), 1920×1080 unless noted:

| file | shot |
|---|---|
| `home-hero` (1920×1200) | homepage: counter left for copy; Mara at the bar, Maya walking in, Jules waving, Claire with a coffee |
| `backdrop` | behind UI screens that place their own characters (background life only) |
| `hero-wide` | eye-level wide interior with residents |
| `entrance` | through the open door, "Come as you are" |
| `counter` | Mara behind the bar, a guest ordering |
| `reading-nook` | Claire on the sofa with a latte |
| `community-table` | two regulars at the long table |
| `study-nook` | Phase 2 study camera: facing the resident across the desk |
| `study-1-walk`, `study-2-behind`, `study-3-side` | study camera sequence (2 = today's camera) |
| `overview` | cut-away diorama of the whole café |

## Where they are used in Figma

File `p8TKGHhasO65VBOFvM7BQ1` (Maple Bean — Pre-Game UX):

- **Components → Character Preview** (Maya, Mara, Jules, Claire, Custom = Maya waving) and **Characters · Phase 2 →
  Character Model** (four canonical casts): a `Game render` image layer sits on top; the old vector figures
  are hidden, not deleted. Leo and Noah remain labelled concept placeholders.
- **Components → Café Backdrop**: `backdrop.png` under the original Warmth overlay (illustration layers hidden).
- **Components → Profile Avatar** (S/M/L): Maya `headshot.png`.
- **Characters · Phase 2 → Section · Canonical game renders**: all 40 character renders.
- **Home Page · Room View**: `Home · Living café · Desktop 1440` (on `home-hero.png`) and the
  `Showcase camera · storyboard` (shots A–F).
- **Study Mode · Camera**: `Study Mode · camera sequence`.

## Canva

See [canva/BRIEF.md](canva/BRIEF.md). Canva is connected to the account but was not available inside the
session that produced these files; run the brief from a new session.

## Canva icons (`canva/icons/`)

Made in Canva (folder **Maple Bean · Icons & Logos**, subfolders Mini-game logos / Wardrobe & skins / Café menu /
Barista steps), exported as 512×512 PNG. Unlike characters, these are illustrations, so Canva is their source of truth:
edit in Canva and re-export; never hand-edit the PNGs.

| folder | files |
|---|---|
| `minigames/` | barista-rush, bean-run, latte-art, table-dash |
| `wardrobe/` | skin-tone, hair, tops, bottoms, shoes, accessories |
| `skins/` | skin-01-porcelain … skin-14-ebony (one swatch per tone, drawn as exact-hex shapes in the Canva design "Maple Bean · Skin tones (14 swatches)") |
| `menu/` | latte, espresso, iced-coffee, tea, hot-chocolate, croissant, maple-cookie, bean-card |
| `barista/` | cup, coffee, milk, flavor, serve (ids match the steps in `minigames.js`) |

Manifest for code: `phase2/shared/icons.js` (labels, paths, skin hex values). Check page: `/phase2/icons`.
Test: `phase2/tests/icons.test.mjs` (files exist, every barista step covered, resident skin swatches match `characters.js`).
