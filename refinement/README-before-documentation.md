# Maple Bean — expanded café playtest

The current browser build includes the visual upgrade and Noah. Claire remains blonde. See [visual upgrade notes](VISUAL-UPGRADE.md) for screenshots, verification, source files and the remaining differences from the supplied references.

Open **http://localhost:4321** while the local server is running.

```powershell
cd "C:\Users\Aymen\Documents\ChatGPT\coffeshop"
node server.mjs
```

Keep that terminal open. In another PowerShell window:

```powershell
Start-Process "http://localhost:4321"
```

`Start Cafe.cmd` also starts the server and opens the page. If a server is already running, just open the URL.

## Play

- **Walk as Maya**: WASD / arrows to walk, drag to orbit the camera, scroll to zoom. Click clear floor to walk there, or click anything that glows to use it.
- Destination buttons guide Maya around the furniture. **E** interacts or gets up. **Esc** cancels a route or stands up.
- **F / Wave hello** waves. Order a drink at the counter, take a sip, read, or sit in the lounge.
- Talk to **Mara**, **Jules**, **Claire**, or **Noah**. Their dialogue is authored for this playtest.
- **Maya’s studio** lets you inspect all five characters, angles, expressions and poses. A test chair appears for the seated pose.
- **Playtest notes** saves observations and location in your browser. Export the notebook as JSON to share feedback.
- Try **Cozy evening**, **Floor plan**, boundary display, or the screenshot button.
- Open a second browser window at the same address to test another guest, seat occupancy, and nearby chat. Chat range is 8 metres.

## Gameplay, social and character pass

Maple Bean is now a cozy social café you play by touching the world: anything usable glows and shows a small label (Sit, Study, Water, Talk, Play, Order) when you point at it.

- **Three rooms (406 m²).** The main café keeps every original piece. A new **Study Room** (east doorway) has focus desks with laptops, lamps and headphones, a shared study table, reading armchairs and bookshelves. A new **Games & Garden** room (back doorway) has chess, XO, memory and card tables, a Snake arcade cabinet, a dartboard and plenty of plants. Built by `tools/build_wings.py` in Blender.
- **Characters.** Anatomically correct hands (palm to the thigh, thumb in front), open-palm waves, a real cup grip and sip, softer hips, Maya’s smaller bun, tidier Noah hair and a short men’s cut for Jules (`tools/author_characters.py`, `tools/jules_hair.py`). Upper bodies use arm IK and hand shapes (`assets/characters/body-pose.js`) with idle variations, torso lean, head look and event-driven activity poses.
- **Seating.** People step beside a chair (never through its back), lower themselves onto it and rise again; sofas are sat onto from the front.
- **Drinks.** Regulars walk in empty-handed, queue at the counter, and Mara makes, places and slides each drink over; the customer reaches for it. The menu adds Latte, Coffee and Matcha latte.
- **Study Mode.** Sit at a desk → Study → 30/60 min (or custom). You pick up the headphones, put them on, open the laptop and the camera eases in; the character types, reads, writes, thinks, sips and stretches in a logical sequence, with the cup set down beside the laptop. Completing a session pays Maple Coins, XP and builds a streak (5 days unlocks the Scholar’s Scarf); ending early pays nothing. Study Together seats a regular beside you.
- **Mini-games** play on the physical tables: XO, Memory, Chess, Maple Eights (Crazy Eights), Snake on the arcade screen and Darts scored from where each dart lands. Opponents are Jules, Claire or Noah. Rewards need a real game and have a daily cap.
- **People.** Click a regular to chat, ask, hang out, play, study together or give a maple cookie. Friendships grow Stranger → Acquaintance → Friend → Close Friend, with an optional shy crush for guest regulars once you are friends.
- **NPC chat** uses Claude (`claude-opus-5`) when the server has credentials (`ANTHROPIC_API_KEY` or an `ant auth login` profile); otherwise each regular answers from their own persona lines. Personas: `npc-brain.js`.
- **Group chat** (💬): create a group, invite other guests or regulars, send messages and study / play / hang-out invitations.
- **Coins & wardrobe** (👕): tops, bottoms, shoes, hairstyles, hair colours, glasses, hats and scarves for your own avatar. Purchases stay unlocked.
- **Clean HUD**: profile, coins, home, messages, notifications, wardrobe and menu. Everything else appears in context.

Game rules are pure modules with tests: `economy.js`, `study.js`, `relationships.js`, `shop.js` and `games/` (`tests/gameplay.test.mjs`). The end-to-end check drives the real game in Chrome: `node qa/qa-gameplay.mjs` (server running).

## What was upgraded

The original `MapleBeanGraphics.blend` café grew from **12 × 10 m (120 m²)** to **20 × 14 m (280 m²)**. **112 original objects** remain, including the counter, espresso machine, menus, crockery and original tables. New areas include a fireside lounge, community table, book corner, and window seating. Source backups are in `original/`.

All four residents share the detailed model derived from the supplied `maya.html`. Mara and Jules retain their skin colors; Jules has short hair and masculine proportions. Claire follows her supplied character sheet: blonde waves, blue eyes, cream cami, oatmeal cardigan, denim and necklace. This is a reference-guided café adaptation, not a completed recreation of every outfit/expression on Claire's sheet.

Maya's hidden scalp no longer intersects her eye sockets. Arms and fingers are assigned to shoulder/elbow transforms, rather than being classified as legs by height. Shared pant seams use matching skin weights; feet use two-segment leg positioning, and seated height adapts to each chair. These are procedural animations, not motion capture.

## Files

- `MapleBeanExpanded.blend`: editable café environment for Blender 5.2.
- `assets/cafe.glb`: exported environment used by the browser.
- `assets/layout.json`: furniture boundaries, seat heights and interactions.
- `assets/character-kit/`: current shared character construction, outfits and GPU animation.
- `assets/visual-world.js`: browser environment materials, foliage and visual additions.
- `maya-character.js` and `animation.js`: preserved original model and CPU pose reference.
- `characters.js`: resident identity and color presets.
- `tools/build_cafe.py`: reproduces the expanded Blender environment from `original/MapleBeanGraphics.blend`.
- `tools/build_maya.py`: reproduces the shared character module and studio shell from `original/maya.html`.

```powershell
python -X utf8 tools/build_maya.py
node --test tests/*.test.mjs
```

Run the tests with the local café server open. They check reachable destinations, collision paths, seat reservation, chat validation, planted feet and hand deformation.

## Scope of this preview

This is a local browser playtest with ephemeral guest sessions. The server listens on this computer's loopback interface; it is not publicly hosted. Purchases are free samples; café accounts, inventory and the original Unity economy are not connected. Notes remain in browser storage. The Blender file contains the café environment; characters are generated by the browser model code.

The original Desktop/MappleHollow project is preserved. To iterate, edit this workspace and reload the page; server code changes require restarting `node server.mjs`.
