# A3 · Interaction audit (2026-09-19)

Method: ran the existing E2E (`node qa/qa-gameplay.mjs`, private server :4333) → `baseline-e2e/` (+ `baseline-e2e.log`), and captured "before" step shots at 1600×1000 of the flows I change → `coffee/before-*`, `talk/before-*`, `study/before-*` (`before.mjs`). All steps below were observed in the running game via `window.cafe`, not read off the code.

Legend: ✅ works · ⚠️ works but misses the brief · ❌ bug

## Interactions as they play now

| Interaction | Steps as they actually play | Verdict |
|---|---|---|
| Order coffee | click bar → stand → walk to bar approach (-3.4,-3.3) → face bar → menu dialog → pay → **toast** “Mara: One X…” → Mara walks to machine, 2 grip reaches, walks back, places cup, slides it → player steps to (x,-3.99), reaches, takes cup → cup in left hand, R sips | ⚠️ no ordering gesture, Mara never greets/looks at you, her reply is a toast not a bubble, no drinking beat after hand-off, order reward is granted **before** the drink exists. ❌ player uses counter slot x=-3.4, which is also an NPC queue slot → player and Noah stood inside each other (`coffee/before-03-handoff.png`). ⚠️ camera not framed; a player who orbited can end up inside a wall (`baseline-e2e/04`) |
| Help Mara | optional checkbox → click-the-steps dialog → +6 XP written straight into `econ.xp` | ⚠️ bypasses economy (A5) |
| Sit / stand | walk → side-step beside chair → lower → seated; E/Esc rises | ✅ |
| Water plant | walk → face → can pose + droplets 2.4 s → thirst 0, once-a-day reward | ✅ |
| Study / Focus | desk → walk → sit → “📚 Study” → duration dialog (30/60/custom) → pick up headphones → on → open laptop → camera eases in → task loop (type/read/write/sip/think/stretch) → small pill HUD `29:58 · Typing notes · ♪ · Exit focus` → reward card | ⚠️ no Pomodoro 25; HUD is a thin pill (no big timer, no Pause button — pause = tap the timer); ♪ panel opens *on top of* the HUD and hides it (`study/before-03`); its stats row renders as a broken “0m”. No Now Listening display |
| Focus music | Ambient (3 synth pads) + My Music (local files, title = raw filename); Lo-Fi / Jazz / Rain / Nature show integration notes | ⚠️ no registry; Rain/Nature marked “unavailable” although they can be synthesised; status `music` is never visible to others (focus outranks it and music stops when focus ends) |
| Talk (NPC) | click → menu → Chat → walk to a spot 1.05 m from them → chat box → camera side two-shot | ❌ **Mara: the fallback spot search puts you behind the bar, 0.15 m from her** (`talk/before-01`: me (-4.85,-5.76), Mara idles at (-4.7,-5.75)); camera can sit inside a head (`baseline-e2e/10-chat`) |
| Hang out | claim NPC → seat pair → both walk & sit → lines every 9 s, reward at 45 s | ⚠️ camera uses a fixed world offset — partner out of frame (`baseline-e2e/30`) |
| Study together | NPC takes the nearest desk, you take a shared desk, focus loop with glances | ✅ ⚠️ partner out of frame |
| Gift / crush | menu → instant | ❌ happens from across the room — no walk, no hand-off |
| Mini-games ×6 | XO ✅ full game → result → reward → stand → camera back. Memory ✅ Chess ✅ Cards ✅ (first moves, leave). Snake ✅ to game-over + reward. Darts ✅ throw scored | ✅ (partner/opponent seats aligned; see `baseline-e2e/21,25,28,29`) |
| Emotes | F / menu row → reaction above head; wave animates arm; others within 8 m see it | ✅ |
| Remote guest | click → you wave (toast) | ⚠️ no menu, no walking, no invites |
| Invites | messenger group → study/play/hang-out card → Join → `goToStation` | ⚠️ only via a pre-made group; “play” lands on the NPC opponent picker (no player-vs-player game exists) |

Other: `setPointerCapture` page errors in the E2E come from synthetic QA pointer events, not the game. `tests/cafe.test.mjs` fails on the shared :4321 because other agents' browsers occupy the spawn spot (environmental).

## Plan (priority order) — status in the section below
a) Focus Mode panel + 25-min Pomodoro + Pause/Music/Leave · b) Now Listening + `systems/music-*.js` registry + opt-in share · c) ordering gesture, Mara greeting/reply bubbles, free counter slot, first sip, reward after hand-off · d) guest context menu · e) Mara talk spot, gift walk-up · camera director (framing out of walls/heads).
