// Mini-games that physically live in the café. Each scene builds its pieces on
// the real table / cabinet / wall, answers clicks by raycasting those pieces,
// and asks the app to animate the matching hand (ctx.reach) before any piece
// moves, so every animation corresponds to an actual game action.
import * as THREE from 'three';
import { wait } from './activities.js';
import * as XO from './games/xo.js';
import * as Mem from './games/memory.js';
import * as Chess from './games/chess.js';
import * as Cards from './games/cards.js';
import * as Snake from './games/snake.js';
import * as Darts from './games/darts.js';

const V = THREE.Vector3;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...extra });

// Board frame from the player's seat: f points across the table, r to the player's right.
function frameFor(station, seatIndex = 0) {
  const seat = station.seats ? station.seats[seatIndex] : { x: station.approach[0], z: station.approach[1], angle: station.angle };
  const f = new V(Math.sin(seat.angle), 0, Math.cos(seat.angle)), r = new V(-f.z, 0, f.x);
  const top = (station.tableHeight ?? .79) + .003;
  const center = new V(station.x, top, station.z);
  const at = (u, v, h = 0) => center.clone().addScaledVector(f, u).addScaledVector(r, v).add(new V(0, h, 0));
  return { seat, f, r, top, center, at, yaw: seat.angle };
}
function tableCamera(fr) {
  // Three-quarter side view: the board, your hands and your opponent all in frame.
  return { position: fr.at(-.62, 1.45, 1.02), target: fr.at(.05, .08, .16) };
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function arc(from, to, k, lift) { const p = from.clone().lerp(to, k); p.y += Math.sin(Math.PI * k) * lift; return p; }
async function animate(seconds, step) { const start = performance.now(); for (;;) { await wait(0); const k = Math.min(1, (performance.now() - start) / 1000 / seconds); step(k); if (k >= 1) return; } }

// ============================================================================ XO
export function xoScene(ctx) {
  const fr = frameFor(ctx.station), group = new THREE.Group(); ctx.scene.add(group);
  const cream = std('#efe3cc'), ink = std('#304c40'), rust = std('#b5463a'), gold = std('#e7c27a', { emissive: '#8a6420', emissiveIntensity: .6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(.4, .012, .4), cream); base.position.copy(fr.at(0, 0, .006)); base.rotation.y = fr.yaw; group.add(base);
  for (const k of [-1, 1]) for (const along of [0, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(along ? .36 : .008, .006, along ? .008 : .36), ink);
    bar.position.copy(along ? fr.at(k * .06, 0, .015) : fr.at(0, k * .06, .015)); bar.rotation.y = fr.yaw; group.add(bar);
  }
  const cell = i => fr.at((Math.floor(i / 3) - 1) * .12, (i % 3 - 1) * .12, .015);
  const cells = [...Array(9)].map((_, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.11, .02, .11), new THREE.MeshBasicMaterial({ visible: false })); m.position.copy(cell(i)); m.rotation.y = fr.yaw; m.userData.cell = i; group.add(m); return m; });
  const pieceMesh = mark => {
    const g = new THREE.Group();
    if (mark === 'X') for (const a of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.085, .016, .018), ink); b.rotation.y = a * Math.PI / 4; g.add(b); }
    else { const o = new THREE.Mesh(new THREE.TorusGeometry(.032, .009, 10, 28).rotateX(Math.PI / 2), rust); g.add(o); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
  };
  const ghost = pieceMesh('X'); ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .35; } }); ghost.visible = false; group.add(ghost);
  let game = XO.createXO('X'), busy = false, started = performance.now();
  const ray = new THREE.Raycaster();
  const hitCell = r => { const h = r.intersectObjects(cells, false)[0]; return h ? h.object.userData.cell : null; };
  async function place(who, i) {
    busy = true; await ctx.reach(who, cell(i), { shape: 'pinch' });
    const mark = game.turn, m = pieceMesh(mark); m.position.copy(cell(i)).add(new V(0, .01, 0)); m.rotation.y = fr.yaw; group.add(m); ctx.sfx('tick');
    game = XO.play(game, i); busy = false;
    if (game.winner) return end();
    if (game.turn === 'O') npcTurn(); else ctx.status('Your move — place an X');
  }
  async function npcTurn() {
    busy = true; ctx.status(ctx.opponent.name + ' is thinking…'); ctx.react('npc', 'think');
    await wait(.7 + Math.random() * .9); if (ctx.over) return;
    ctx.react('npc', null); await place('npc', XO.bestMove(game, ctx.opponent.skill ?? .72));
  }
  function end() {
    if (game.line) for (const i of game.line) { const glow = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .004, 24), gold); glow.position.copy(cell(i)); group.add(glow); }
    const result = game.winner === 'draw' ? 'draw' : game.winner === 'X' ? 'win' : 'loss';
    ctx.finish({ result, moves: game.moves, seconds: (performance.now() - started) / 1000 });
  }
  ctx.status('Your move — place an X');
  return {
    title: 'XO', camera: tableCamera(fr),
    hover(r) { const i = !busy && game.turn === 'X' && !game.winner ? hitCell(r) : null; ghost.visible = i !== null && !game.board[i]; if (ghost.visible) { ghost.position.copy(cell(i)).add(new V(0, .01, 0)); ghost.rotation.y = fr.yaw; } return ghost.visible ? 'Place X' : null; },
    click(r) { if (busy || game.turn !== 'X' || game.winner) return false; const i = hitCell(r); if (i === null || game.board[i]) return false; ghost.visible = false; place('me', i); return true; },
    dispose() { ctx.scene.remove(group); },
  };
}

// ============================================================================ Memory cards
const backTexture = canvasTexture(96, 128, (g, w, h) => { g.fillStyle = '#304c40'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8d6ae'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#e8d6ae'; g.font = '44px serif'; g.textAlign = 'center'; g.fillText('🍁', w / 2, h / 2 + 15); });
const faceTextures = new Map();
function faceTexture(symbol) {
  if (!faceTextures.has(symbol)) faceTextures.set(symbol, canvasTexture(96, 128, (g, w, h) => { g.fillStyle = '#fbf4e4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a36e'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10); g.font = '52px serif'; g.textAlign = 'center'; g.fillText(symbol, w / 2, h / 2 + 18); }));
  return faceTextures.get(symbol);
}
export function memoryScene(ctx) {
  const fr = frameFor(ctx.station), group = new THREE.Group(); ctx.scene.add(group);
  let game = Mem.createMemory(), busy = false; const seen = new Set(), started = performance.now();
  const edge = std('#e9dcc2');
  const spot = i => fr.at((Math.floor(i / 4) - 1.5) * .15, (i % 4 - 1.5) * .13, .004);
  const cards = game.cards.map((c, i) => {
    const mats = [edge, edge, new THREE.MeshStandardMaterial({ map: backTexture, roughness: .7 }), new THREE.MeshStandardMaterial({ map: faceTexture(c.symbol), roughness: .7 }), edge, edge];
    const holder = new THREE.Group(); holder.position.copy(spot(i)); holder.rotation.y = fr.yaw;
    const m = new THREE.Mesh(new THREE.BoxGeometry(.09, .005, .12), mats); m.castShadow = true; m.userData.card = i; holder.add(m); group.add(holder);
    return { holder, mesh: m, up: false };
  });
  async function flipCard(i, up) {
    const c = cards[i], from = c.up ? Math.PI : 0, to = up ? Math.PI : 0; c.up = up;
    await animate(.32, k => { c.mesh.rotation.z = from + (to - from) * k; c.holder.position.y = spot(i).y + Math.sin(Math.PI * k) * .05; });
  }
  async function choose(who, i) {
    busy = true; await ctx.reach(who, spot(i), { shape: 'pinch' });
    game = Mem.flip(game, i); seen.add(i); await flipCard(i, true);
    if (game.open.length === 2) {
      await wait(.8);
      const [a, b] = game.open, matched = game.lastResult === 'match';
      ctx.react(who, matched ? 'happy' : 'think');
      if (matched) {
        const side = who === 'me' ? -1 : 1, n = game.scores[who === 'me' ? 0 : 1];
        for (const [k, idx] of [a, b].entries()) { const c = cards[idx], from = c.holder.position.clone(), to = fr.at(side * .36, -.28 + n * .05 + k * .01, .01 + k * .006); animate(.45, t => c.holder.position.copy(arc(from, to, t, .06))); }
        ctx.sfx('cup');
      } else { await Promise.all([flipCard(a, false), flipCard(b, false)]); }
      await wait(.35); ctx.react(who, null);
      game = Mem.settle(game);
      if (game.done) return end();
    }
    busy = false; next();
  }
  function next() {
    const [me, them] = game.scores; const score = `You ${me} · ${ctx.opponent.name} ${them}`;
    if (game.turn === 0) ctx.status(score + ' — pick a card'); else { ctx.status(score + ' — ' + ctx.opponent.name + '’s turn'); npc(); }
  }
  async function npc() { busy = true; await wait(.6 + Math.random() * .6); if (ctx.over) return; await choose('npc', Mem.npcPick(game, seen, ctx.opponent.recall ?? .55)); }
  function end() { const w = Mem.winner(game); ctx.finish({ result: w === 'draw' ? 'draw' : w === 0 ? 'win' : 'loss', moves: game.moves, seconds: (performance.now() - started) / 1000 }); }
  next();
  const hit = r => { const h = r.intersectObjects(cards.map(c => c.mesh), false)[0]; const i = h?.object.userData.card; return i !== undefined && game.cards[i].matched === null && !game.open.includes(i) ? i : null; };
  return {
    title: 'Memory', camera: tableCamera(fr),
    hover(r) { return !busy && game.turn === 0 && hit(r) !== null ? 'Flip card' : null; },
    click(r) { if (busy || game.turn !== 0) return false; const i = hit(r); if (i === null) return false; choose('me', i); return true; },
    dispose() { ctx.scene.remove(group); },
  };
}

// ============================================================================ Chess
const LATHE = {
  p: [[.016, 0], [.017, .004], [.011, .009], [.007, .026], [.011, .03], [.0105, .038], [.004, .045]],
  r: [[.018, 0], [.018, .005], [.013, .01], [.012, .04], [.016, .045], [.016, .056], [.0005, .056]],
  b: [[.018, 0], [.018, .005], [.012, .01], [.008, .044], [.012, .05], [.009, .062], [.004, .069], [.0005, .072]],
  q: [[.02, 0], [.02, .006], [.013, .012], [.009, .055], [.015, .065], [.012, .072], [.006, .078], [.0005, .08]],
  k: [[.021, 0], [.021, .006], [.014, .012], [.01, .062], [.016, .07], [.012, .078], [.0005, .08]],
  n: [[.018, 0], [.018, .005], [.013, .01], [.011, .025], [.0005, .026]],
};
function pieceGeometry(type) {
  const g = new THREE.LatheGeometry(LATHE[type].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  if (type === 'n') { const head = new THREE.BoxGeometry(.016, .04, .03).translate(0, .044, .004).applyMatrix4(new THREE.Matrix4().makeRotationX(-.35)); const nose = new THREE.BoxGeometry(.014, .014, .024).translate(0, .058, .022); return mergeParts([g, head, nose]); }
  if (type === 'k') { return mergeParts([g, new THREE.BoxGeometry(.004, .022, .004).translate(0, .09, 0), new THREE.BoxGeometry(.014, .004, .004).translate(0, .092, 0)]); }
  if (type === 'q') return mergeParts([g, new THREE.SphereGeometry(.006, 10, 8).translate(0, .084, 0)]);
  return g;
}
function mergeParts(list) {
  const parts = list.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal'].includes(a)) n.deleteAttribute(a); if (!n.attributes.normal) n.computeVertexNormals(); return n; });
  const out = new THREE.BufferGeometry(); const pos = [], nor = [];
  for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return out;
}
export function chessScene(ctx) {
  const fr = frameFor(ctx.station), group = new THREE.Group(); ctx.scene.add(group);
  const S = .058, light = std('#ead9b6'), darkSq = std('#7b5a3c'), white = std('#f1e6cf', { roughness: .45 }), black = std('#3a2a22', { roughness: .45 });
  const sq = i => fr.at((7 - Math.floor(i / 8) - 3.5) * S, (i % 8 - 3.5) * S, .012);
  const squares = [];
  for (let i = 0; i < 64; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(S, .01, S), (Math.floor(i / 8) + i % 8) % 2 ? darkSq : light); m.position.copy(sq(i)).add(new V(0, -.005, 0)); m.rotation.y = fr.yaw; m.receiveShadow = true; m.userData.square = i; group.add(m); squares.push(m); }
  let state = Chess.createChess(), busy = false, selected = null; const started = performance.now(); let moves = 0;
  const meshes = new Map(), geoms = {};
  function spawn(i, p) { const t = p.toLowerCase(); geoms[t] = geoms[t] || pieceGeometry(t); const m = new THREE.Mesh(geoms[t], p === t ? black : white); m.castShadow = true; m.position.copy(sq(i)); m.rotation.y = fr.yaw + (p === t ? Math.PI : 0); m.userData.square = i; group.add(m); meshes.set(i, m); }
  state.board.forEach((p, i) => { if (p) spawn(i, p); });
  const markerMat = new THREE.MeshBasicMaterial({ color: '#8fb56a', transparent: true, opacity: .75 }), markers = [];
  const selectRing = new THREE.Mesh(new THREE.RingGeometry(.022, .028, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e7c27a' })); selectRing.visible = false; group.add(selectRing);
  function showTargets(from) {
    for (const m of markers) group.remove(m); markers.length = 0;
    if (from === null) { selectRing.visible = false; return; }
    selectRing.visible = true; selectRing.position.copy(sq(from)).add(new V(0, .002, 0));
    for (const mv of Chess.legalMoves(state).filter(m => m.from === from)) { const d = new THREE.Mesh(new THREE.CircleGeometry(.01, 16).rotateX(-Math.PI / 2), markerMat); d.position.copy(sq(mv.to)).add(new V(0, .003, 0)); d.userData.square = mv.to; group.add(d); markers.push(d); }
  }
  const captured = { me: 0, npc: 0 };
  async function perform(who, from, to) {
    busy = true; showTargets(null);
    const { state: next, move } = Chess.move(state, from, to);
    // Hand goes to the piece; the piece then travels with the hand to its square.
    await ctx.reach(who, sq(from), { shape: 'pinch', seconds: 1.3, contact: .35 });
    const piece = meshes.get(from); meshes.delete(from);
    const victimSq = move.enPassant ? to + (state.turn === 'w' ? 8 : -8) : to, victim = move.capture ? meshes.get(victimSq) : null;
    ctx.follow(who, sq(to), .55);
    const a = piece.position.clone(), b = sq(to);
    await animate(.55, k => piece.position.copy(arc(a, b, k, .05)));
    if (victim) { meshes.delete(victimSq); const side = who === 'me' ? -1 : 1, n = captured[who]++; const va = victim.position.clone(), vb = fr.at(side * .31, (n % 8 - 3.5) * .05, -.002 + Math.floor(n / 8) * 0); animate(.4, k => victim.position.copy(arc(va, vb, k, .04))); ctx.sfx('tick'); }
    if (move.castle) { const rf = move.castle === 'k' ? to + 1 : to - 2, rt = move.castle === 'k' ? to - 1 : to + 1, rook = meshes.get(rf); meshes.delete(rf); meshes.set(rt, rook); const ra = rook.position.clone(); await animate(.35, k => rook.position.copy(arc(ra, sq(rt), k, .03))); }
    if (move.promo) { group.remove(piece); spawn(to, state.turn === 'w' ? 'Q' : 'q'); } else meshes.set(to, piece);
    state = next; moves++; ctx.sfx('tick'); busy = false;
    const st = Chess.status(state);
    if (st.over) return end(st);
    if (state.turn === 'b') npcTurn(st.check); else ctx.status(st.check ? 'Check! Your move' : 'Your move (white)');
  }
  async function npcTurn(check) {
    busy = true; ctx.status((check ? 'Check! ' : '') + ctx.opponent.name + ' is thinking…'); ctx.react('npc', 'think');
    await wait(.9 + Math.random() * .8); if (ctx.over) return;
    const mv = Chess.chooseMove(state, { depth: 2, jitter: ctx.opponent.chessJitter ?? 40 }); ctx.react('npc', null);
    await perform('npc', mv.from, mv.to);
  }
  function end(st) { const result = st.winner === 'w' ? 'win' : st.winner === 'b' ? 'loss' : 'draw'; ctx.status(st.result === 'checkmate' ? 'Checkmate!' : 'Draw — ' + st.result); ctx.finish({ result, moves, seconds: (performance.now() - started) / 1000 }); }
  const pickSquare = r => { const h = r.intersectObjects([...meshes.values(), ...squares, ...markers], false)[0]; return h ? h.object.userData.square : null; };
  ctx.status('Your move (white) — pick a piece');
  return {
    title: 'Chess', camera: { position: fr.at(-.78, 1.1, 1.0), target: fr.at(.02, .02, .1) },
    hover(r) { if (busy || state.turn !== 'w') return null; const i = pickSquare(r); if (i === null) return null; const p = state.board[i]; if (p && p === p.toUpperCase()) return 'Pick up ' + ({ P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' })[p]; return selected !== null && Chess.legalMoves(state).some(m => m.from === selected && m.to === i) ? 'Move here' : null; },
    click(r) {
      if (busy || state.turn !== 'w') return false; const i = pickSquare(r); if (i === null) return false; const p = state.board[i];
      if (selected !== null && Chess.legalMoves(state).some(m => m.from === selected && m.to === i)) { const from = selected; selected = null; perform('me', from, i); return true; }
      if (p && p === p.toUpperCase()) { selected = i; showTargets(i); if (!Chess.legalMoves(state).some(m => m.from === i)) ctx.status('That piece has no moves right now'); return true; }
      selected = null; showTargets(null); return true;
    },
    dispose() { ctx.scene.remove(group); },
  };
}

// ============================================================================ Maple Eights (cards)
const cardFaces = new Map();
function cardFace(card) {
  if (!cardFaces.has(card.id)) cardFaces.set(card.id, canvasTexture(80, 112, (g, w, h) => { const red = '♥♦'.includes(card.suit); g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9b48f'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = red ? '#b5463a' : '#2d2a26'; g.font = 'bold 22px Georgia'; g.textAlign = 'left'; g.fillText(card.rank, 8, 26); g.font = '44px serif'; g.textAlign = 'center'; g.fillText(card.suit, w / 2, h / 2 + 22); }));
  return cardFaces.get(card.id);
}
export function cardsScene(ctx) {
  const fr = frameFor(ctx.station), group = new THREE.Group(); ctx.scene.add(group);
  let game = Cards.createEights(), busy = false; const started = performance.now();
  const edge = std('#e9dcc2'), back = new THREE.MeshStandardMaterial({ map: backTexture, roughness: .7 });
  const mk = (card, faceUp) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.058, .003, .082), [edge, edge, faceUp ? new THREE.MeshStandardMaterial({ map: cardFace(card), roughness: .7 }) : back, back, edge, edge]); m.castShadow = true; m.userData.card = card; return m; };
  let meshes = [];
  const pilePos = fr.at(.02, -.09, .005), discardPos = fr.at(.02, .08, .005);
  function layout() {
    for (const m of meshes) group.remove(m); meshes = [];
    const hand = game.hands[0], them = game.hands[1];
    hand.forEach((c, i) => { const m = mk(c, true), v = (i - (hand.length - 1) / 2) * Math.min(.05, .34 / hand.length); m.position.copy(fr.at(-.25, v, .03 + i * .0008)); m.rotation.set(0, fr.yaw, 0); m.rotateX(-.95); m.userData.hand = true; group.add(m); meshes.push(m); });
    them.forEach((c, i) => { const m = mk(c, false), v = (i - (them.length - 1) / 2) * Math.min(.05, .34 / them.length); m.position.copy(fr.at(.25, v, .006 + i * .0008)); m.rotation.y = fr.yaw + Math.PI; group.add(m); meshes.push(m); });
    for (let i = 0; i < Math.min(6, Math.ceil(game.pile.length / 8)); i++) { const m = mk(game.pile[0] || { id: 'x' }, false); m.position.copy(pilePos).add(new V(0, i * .003, 0)); m.rotation.y = fr.yaw; m.userData.pile = true; group.add(m); meshes.push(m); }
    const top = Cards.top(game), d = mk(top, true); d.position.copy(discardPos); d.rotation.y = fr.yaw + .12; group.add(d); meshes.push(d);
    const [mine, theirs] = [hand.length, them.length];
    const suitNote = top.rank === '8' ? ' · suit is ' + game.suit : '';
    ctx.status(game.turn === 0 ? `Your turn — match ${top.rank}${top.suit}${suitNote} (${mine} vs ${theirs})` : `${ctx.opponent.name}’s turn (${mine} vs ${theirs})`);
    ctx.extra(game.turn === 0 && game.winner === null ? [game.drew ? { label: 'Pass', run: () => { game = Cards.pass(game); layout(); npc(); } } : { label: 'Draw a card', run: () => drawCard('me') }] : []);
  }
  async function drawCard(who) {
    busy = true; await ctx.reach(who, pilePos, { shape: 'pinch' }); game = Cards.draw(game); ctx.sfx('tick'); busy = false; layout();
    if (who === 'me' && !game.hands[0].some(c => Cards.canPlay(game, c))) ctx.status('Nothing playable — pass when ready');
  }
  async function play(who, card, suit) {
    busy = true; const m = meshes.find(x => x.userData.card?.id === card.id);
    await ctx.reach(who, m ? m.position : discardPos, { shape: 'pinch', seconds: 1.1, contact: .35 });
    ctx.follow(who, discardPos, .45);
    if (m) { const a = m.position.clone(); await animate(.45, k => m.position.copy(arc(a, discardPos, k, .05))); }
    game = Cards.playCard(game, card.id, suit); ctx.sfx('tick'); busy = false; layout();
    if (game.winner !== null) return ctx.finish({ result: game.winner === 0 ? 'win' : 'loss', moves: game.moves, seconds: (performance.now() - started) / 1000 });
    if (game.turn === 1) npc();
  }
  async function npc() {
    if (game.turn !== 1 || game.winner !== null) return;
    busy = true; ctx.react('npc', 'think'); await wait(.8 + Math.random() * .6); if (ctx.over) return; ctx.react('npc', null); busy = false;
    let a = Cards.npcTurn(game);
    if (a.type === 'draw') { await drawCard('npc'); a = Cards.npcTurn(game); }
    if (a.type === 'play') await play('npc', a.card, a.suit); else if (a.type === 'pass') { game = Cards.pass(game); layout(); }
  }
  layout();
  const hitHand = r => { const h = r.intersectObjects(meshes.filter(m => m.userData.hand || m.userData.pile), false)[0]; return h?.object.userData; };
  return {
    title: 'Maple Eights', camera: { position: fr.at(-.8, 1.0, .98), target: fr.at(-.02, .02, .1) },
    hover(r) { if (busy || game.turn !== 0) return null; const u = hitHand(r); if (!u) return null; if (u.pile) return game.drew ? null : 'Draw'; return Cards.canPlay(game, u.card) ? 'Play ' + u.card.rank + u.card.suit : 'Doesn’t match'; },
    click(r) {
      if (busy || game.turn !== 0 || game.winner !== null) return false; const u = hitHand(r); if (!u) return false;
      if (u.pile) { if (!game.drew) drawCard('me'); return true; }
      if (!Cards.canPlay(game, u.card)) { ctx.status('Match the suit or number — or play an 8'); return true; }
      if (u.card.rank === '8') { ctx.extra(Cards.SUITS.map(s => ({ label: s, run: () => play('me', u.card, s) }))); ctx.status('Wild 8! Choose the new suit'); return true; }
      play('me', u.card); return true;
    },
    dispose() { ctx.scene.remove(group); ctx.extra([]); },
  };
}

// ============================================================================ Snake on the arcade cabinet
export function snakeScene(ctx) {
  const st = ctx.station, group = new THREE.Group(); ctx.scene.add(group);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 204; const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.48, .383), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(6.673, 1.36, st.z); screen.rotation.y = -Math.PI / 2; group.add(screen);
  const glow = new THREE.PointLight(0xa8d78b, 1.4, 1.6, 2); glow.position.set(6.45, 1.36, st.z); group.add(glow);
  let s = Snake.createSnake(16, 12), started = false, clock = 0, over = false; const t0 = performance.now();
  const LCD = '#a7bf7b', INK = '#2c3a1f';
  function draw() {
    g.fillStyle = LCD; g.fillRect(0, 0, 256, 204); g.fillStyle = INK; g.font = 'bold 14px monospace'; g.fillText('SNAKE', 8, 16); g.textAlign = 'right'; g.fillText(String(s.score).padStart(4, '0'), 248, 16); g.textAlign = 'left';
    g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(7, 23, 242, 174);
    const c = 15, ox = 8, oy = 24;
    for (const [x, y] of s.body) g.fillRect(ox + x * c + 1, oy + y * c * .96 + 1, c - 2, c * .96 - 2);
    if (s.food) { g.beginPath(); g.arc(ox + s.food[0] * c + c / 2, oy + s.food[1] * c * .96 + c / 2, c / 2 - 2, 0, 7); g.fill(); }
    if (!started) { g.fillStyle = INK; g.font = 'bold 13px monospace'; g.textAlign = 'center'; g.fillText('PRESS AN ARROW TO START', 128, 110); g.textAlign = 'left'; }
    if (over) { g.fillStyle = '#a7bf7bdd'; g.fillRect(40, 80, 176, 50); g.fillStyle = INK; g.textAlign = 'center'; g.font = 'bold 16px monospace'; g.fillText('GAME OVER', 128, 102); g.font = 'bold 12px monospace'; g.fillText('SCORE ' + s.score, 128, 120); g.textAlign = 'left'; }
    tex.needsUpdate = true;
  }
  draw(); ctx.status('Arrow keys / WASD to steer');
  ctx.extra(['up', 'left', 'down', 'right'].map(d => ({ label: { up: '↑', left: '←', down: '↓', right: '→' }[d], run: () => steer(d) })));
  const STICK = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
  let stickTimer = 0;
  function steer(dir) { if (over) return; started = true; s = Snake.turn(s, dir); ctx.stick(STICK[dir]); stickTimer = .18; }
  return {
    title: 'Snake', camera: { position: new V(5.5, 1.66, st.z - .72), target: new V(6.66, 1.33, st.z - .04) },
    key(e) { const d = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[e.code]; if (!d) return false; steer(d); return true; },
    update(dt) {
      if (stickTimer > 0) { stickTimer -= dt; if (stickTimer <= 0) ctx.stick(null); }
      if (!started || over) return; clock += dt;
      if (clock >= Snake.tickSeconds(s)) { clock = 0; const before = s.score; s = Snake.step(s); if (s.score > before) ctx.sfx('tick'); draw(); ctx.status('Score ' + s.score);
        if (s.over) { over = true; draw(); ctx.finish({ result: 'score', score: s.score, seconds: (performance.now() - t0) / 1000, moves: s.ticks }); } }
    },
    hover() { return null; }, click() { return false; },
    dispose() { ctx.scene.remove(group); ctx.extra([]); },
  };
}

// ============================================================================ Darts
export function dartsScene(ctx) {
  const st = ctx.station, b = st.board, group = new THREE.Group(); ctx.scene.add(group);
  const onBoard = (x, y) => new V(b.x + x, b.y + y, b.z + .012);
  const reticle = new THREE.Mesh(new THREE.RingGeometry(.012, .018, 24), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: .9, depthTest: false })); reticle.renderOrder = 5; group.add(reticle);
  const dartProto = () => { const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.CylinderGeometry(.003, .0015, .1, 8).rotateX(Math.PI / 2), std('#b7814e'))); const fl = new THREE.Mesh(new THREE.ConeGeometry(.012, .03, 4).rotateX(-Math.PI / 2).translate(0, 0, -.06), std('#c24c3c')); d.add(fl); return d; };
  let game = Darts.createDarts(2), busy = false, holding = false, power = 0, holdT = 0, aimT = 0, steady = .35; const started = performance.now();
  const stuck = [];
  const powerBar = document.createElement('span'); powerBar.className = 'power'; powerBar.style.cssText = 'display:inline-block;width:90px;height:8px;border-radius:5px;background:#e3e0d2;overflow:hidden;vertical-align:middle'; const fill = document.createElement('i'); fill.style.cssText = 'display:block;height:100%;width:0;background:#b7814e'; powerBar.append(fill);
  function show() { const [me, them] = game.totals; ctx.status(`Round ${game.round}/3 · You ${me} · ${ctx.opponent.name} ${them}` + (game.turn === 0 ? ' — hold to aim, release to throw' : '')); ctx.extra([{ node: powerBar }]); }
  async function throwAt(who, aim, pw) {
    busy = true; ctx.pose(who, 'aim'); await wait(who === 'me' ? .15 : .9);
    ctx.pose(who, 'throw'); await wait(.12);
    const hit = Darts.throwDart(aim, pw), from = ctx.handPoint(who), to = onBoard(hit.x, hit.y);
    const dart = dartProto(); dart.position.copy(from); group.add(dart); stuck.push(dart);
    await animate(.42, k => { dart.position.copy(arc(from, to, k, .12)); dart.lookAt(k < 1 ? arc(from, to, Math.min(1, k + .05), .12) : to.clone().add(new V(0, 0, -1))); });
    ctx.sfx('tick'); ctx.pose(who, null);
    ctx.say(who, hit.points ? hit.label + ' · ' + hit.points : 'Missed!');
    game = Darts.recordThrow(game, hit); show(); await wait(.7);
    if (game.dart === 0) { await wait(.5); for (const d of stuck.splice(0)) group.remove(d); }
    busy = false;
    if (game.done) { const w = Darts.dartsWinner(game); return ctx.finish({ result: w === 'draw' ? 'draw' : w === 0 ? 'win' : 'loss', moves: game.throws.length, seconds: (performance.now() - started) / 1000 }); }
    if (game.turn === 1) npc(); else ctx.pose('me', 'aim');
  }
  async function npc() {
    await wait(.6); if (ctx.over) return;
    const skill = ctx.opponent.dartSkill ?? .6, target = Math.random() < .25 ? { x: 0, y: 0 } : { x: 0, y: .103 };
    const aim = { x: target.x + (Math.random() - .5) * .09 * (1.3 - skill), y: target.y + (Math.random() - .5) * .09 * (1.3 - skill) };
    await throwAt('npc', aim, .5 + (Math.random() - .5) * .12);
  }
  show(); ctx.pose('me', 'aim');
  return {
    title: 'Darts', camera: { position: new V(st.x + .35, 1.72, st.z + 1.0), target: new V(b.x, b.y - .05, b.z) },
    pointerDown() { if (busy || game.turn !== 0) return false; holding = true; holdT = 0; return true; },
    pointerUp() { if (!holding) return false; holding = false; const aim = Darts.aimPoint(aimT, steady); throwAt('me', aim, power); return true; },
    key(e, down) { if (e.code !== 'Space') return false; return down ? this.pointerDown() : this.pointerUp(); },
    update(dt) {
      aimT += dt; if (holding) { holdT += dt; steady = Math.min(.95, .35 + holdT * .45); power = .5 - .5 * Math.cos(holdT * 4.2); } else { steady = Math.max(.35, steady - dt); }
      const a = Darts.aimPoint(aimT, steady); reticle.position.copy(onBoard(a.x, a.y)).add(new V(0, 0, .004)); reticle.visible = game.turn === 0 && !busy;
      fill.style.width = (holding ? power * 100 : 0) + '%';
    },
    hover() { return game.turn === 0 && !busy ? 'Hold to steady · release to throw' : null; },
    click() { return false; },
    dispose() { ctx.scene.remove(group); ctx.extra([]); },
  };
}

export const SCENES = { xo: xoScene, memory: memoryScene, chess: chessScene, cards: cardsScene, snake: snakeScene, darts: dartsScene };
