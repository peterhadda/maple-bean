// Barista Rush rules. Pure: no DOM, no three.js. The whole game is one plain
// state object advanced by `step(state, actions, dt)` at a fixed timestep, so
// Node tests and the browser run exactly the same code.
//
// actions = { moveX, moveZ, use, press }
//   moveX/moveZ  world-space walk direction (length <= 1)
//   use          E is held this step
//   press        E went down since the previous step (tap)

export const ROUND_SECONDS = 75;
export const COUNTDOWN_SECONDS = 3;
export const WALK_SPEED = 1.75;
export const PLAYER_RADIUS = 0.28;
export const REACH = 1.1;
export const FACING_DOT = 0.35;          // "in front": within ~70° of facing
export const BREW_SECONDS = 3;
export const COLD_SHOT_AFTER = 8;        // a finished shot left in the machine this long goes cold
export const MILK_START = 4;             // °C
export const STEAM_RATE = 24;            // °C per second while E is held
export const SWEET_MIN = 60, SWEET_MAX = 70, STEAM_MAX = 95;
export const POUR_SECONDS = 1;
export const PUMP_SECONDS = 0.4;
export const MAX_TICKETS = 3;
export const EXPIRE_PENALTY = 5;
export const FIRST_TICKET_AT = 1;

export const RECIPES = {
  espresso: { id: 'espresso', label: 'Espresso', milk: false, maple: 0, vanilla: 0, base: 8, patience: 40 },
  latte: { id: 'latte', label: 'Latte', milk: true, maple: 0, vanilla: 0, base: 12, patience: 55 },
  maple: { id: 'maple', label: 'Maple Latte', milk: true, maple: 2, vanilla: 0, base: 15, patience: 65 },
  vanilla: { id: 'vanilla', label: 'Vanilla Latte', milk: true, maple: 0, vanilla: 1, base: 15, patience: 65 },
};
const RANDOM_ORDERS = [['espresso', .2], ['latte', .25], ['maple', .3], ['vanilla', .25]];

// ---- Bar layout (metres). The camera looks from +z towards the back wall. ----
export const ROOM = { minX: -3.6, maxX: 3.6, minZ: -2.9, maxZ: 2.05 };
export const COUNTERS = [
  { id: 'back', minX: -3.6, maxX: 2.6, minZ: -2.9, maxZ: -2.2, top: 0.95 },
  { id: 'side', minX: 2.6, maxX: 3.6, minZ: -2.9, maxZ: 0.6, top: 0.95 },
  { id: 'pass', minX: -3.6, maxX: 0.9, minZ: 1.3, maxZ: 2.0, top: 1.0 },
  { id: 'bin', minX: 1.8, maxX: 2.3, minZ: 1.55, maxZ: 2.05, top: 0.72 },
];
// x,z = interaction point on the counter; nx,nz = outward normal towards the working floor.
export const STATION_LAYOUT = [
  { id: 'cups', type: 'cups', label: 'Cup stack', x: -3.0, z: -2.35, nx: 0, nz: 1 },
  { id: 'slot-1', type: 'espresso', label: 'Espresso slot 1', x: -1.75, z: -2.35, nx: 0, nz: 1 },
  { id: 'slot-2', type: 'espresso', label: 'Espresso slot 2', x: -1.15, z: -2.35, nx: 0, nz: 1 },
  { id: 'steamer', type: 'steamer', label: 'Milk steamer', x: -0.05, z: -2.35, nx: 0, nz: 1 },
  { id: 'fridge', type: 'fridge', label: 'Milk fridge', x: 1.2, z: -2.35, nx: 0, nz: 1 },
  { id: 'maple', type: 'syrup', flavor: 'maple', label: 'Maple syrup', x: 2.75, z: -1.55, nx: -1, nz: 0 },
  { id: 'vanilla', type: 'syrup', flavor: 'vanilla', label: 'Vanilla syrup', x: 2.75, z: -0.65, nx: -1, nz: 0 },
  { id: 'pass', type: 'pass', label: 'Pass', x: -2.7, z: 1.45, nx: 0, nz: -1 },
  { id: 'spot-1', type: 'spot', label: 'Counter spot 1', x: -1.3, z: 1.45, nx: 0, nz: -1 },
  { id: 'spot-2', type: 'spot', label: 'Counter spot 2', x: -0.45, z: 1.45, nx: 0, nz: -1 },
  { id: 'bin', type: 'bin', label: 'Bin', x: 2.05, z: 1.8, nx: 0, nz: -1 },
];
export const APPROACH = 0.75;
export const PLAYER_START = { x: -0.6, z: 0, fx: 0, fz: -1 };

// ---- Seeded RNG (mulberry32 with its state kept in the game object) ----
function random(s) {
  let a = (s.rng = (s.rng + 0x6D2B79F5) | 0);
  a = Math.imul(a ^ (a >>> 15), 1 | a);
  a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

// ---- Items ----
export const newCup = () => ({ kind: 'cup', espresso: false, shotCold: false, milk: null, pour: 0, maple: 0, vanilla: 0 });
export const newPitcher = () => ({ kind: 'pitcher', temp: MILK_START, milk: null });
const blankCup = c => c.kind === 'cup' && !c.espresso && !c.milk && !c.maple && !c.vanilla && c.pour === 0;
const freshPitcher = p => p.kind === 'pitcher' && p.milk === null && p.temp <= MILK_START;

// Which menu drink a cup is, or null if it matches nothing.
export function identifyDrink(cup) {
  if (!cup || cup.kind !== 'cup' || !cup.espresso) return null;
  for (const r of Object.values(RECIPES))
    if (!!cup.milk === r.milk && cup.maple === r.maple && cup.vanilla === r.vanilla) return r.id;
  return null;
}
export function drinkFlaws(cup) {
  const flaws = [];
  if (cup.shotCold) flaws.push('cold shot');
  if (cup.milk === 'scalded') flaws.push('scalded milk');
  return flaws;
}
export const qualityFor = flaws => flaws.length === 0 ? 1 : flaws.length === 1 ? 0.6 : 0.35;

// ---- State ----
export function createGame({ seed = 1, script = ['latte', 'maple'] } = {}) {
  return {
    seed, rng: seed | 0, baseScript: [...script], script: [...script],
    phase: 'title', countdown: 0, time: 0,
    player: { ...PLAYER_START, moving: false },
    holding: null, holdLock: false, targetId: null,
    stations: STATION_LAYOUT.map(l => ({
      ...l, item: null, worked: false,
      brewing: false, brewT: 0, fresh: false, sitting: 0,   // espresso slots
      wasSteaming: false,                                    // steamer
      pumpT: 0, pumpCount: 0,                                // syrup
    })),
    tickets: [], nextTicketId: 1, nextTicketAt: FIRST_TICKET_AT,
    score: 0, tips: 0, served: 0, perfect: 0, expired: 0, rejected: 0, binned: 0,
    events: [], eventId: 0, lastServed: null,
  };
}

// Title/results -> a fresh round (same seed unless a new one is given).
export function startRound(s, { countdown = COUNTDOWN_SECONDS, seed = s.seed } = {}) {
  const fresh = createGame({ seed, script: s.baseScript });
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, fresh);
  s.countdown = countdown;
  s.phase = countdown > 0 ? 'countdown' : 'playing';
  return s;
}

export const stationById = (s, id) => s.stations.find(st => st.id === id);
export const approachOf = st => ({ x: st.x + st.nx * APPROACH, z: st.z + st.nz * APPROACH });
// Test/debug helper: stand at a station's approach point, facing it.
export function placePlayerAt(s, id) {
  const st = stationById(s, id), a = approachOf(st);
  Object.assign(s.player, { x: a.x, z: a.z, fx: -st.nx, fz: -st.nz });
  return s;
}

function event(s, text, type = 'info') {
  const last = s.events[s.events.length - 1];
  if (last && last.text === text && s.time - last.t < 1.5) return;
  s.events.push({ id: ++s.eventId, t: +s.time.toFixed(2), type, text });
  if (s.events.length > 8) s.events.shift();
}

// ---- Movement & collision ----
function collide(p) {
  const r = PLAYER_RADIUS;
  p.x = Math.min(ROOM.maxX - r, Math.max(ROOM.minX + r, p.x));
  p.z = Math.min(ROOM.maxZ - r, Math.max(ROOM.minZ + r, p.z));
  for (const b of COUNTERS) {
    const cx = Math.min(b.maxX, Math.max(b.minX, p.x)), cz = Math.min(b.maxZ, Math.max(b.minZ, p.z));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; continue; }
    // Centre inside the box: leave by the shallowest side.
    const exits = [[p.x - b.minX + r, -1, 0], [b.maxX - p.x + r, 1, 0], [p.z - b.minZ + r, 0, -1], [b.maxZ - p.z + r, 0, 1]];
    exits.sort((a, c) => a[0] - c[0]);
    p.x += exits[0][1] * exits[0][0]; p.z += exits[0][2] * exits[0][0];
  }
}

function movePlayer(s, mx, mz, dt) {
  const p = s.player, len = Math.hypot(mx, mz);
  p.moving = false;
  if (len < 0.05) return;
  const ux = mx / len, uz = mz / len, dist = WALK_SPEED * Math.min(1, len) * dt;
  p.fx = ux; p.fz = uz;
  const ox = p.x, oz = p.z;
  p.x += ux * dist; collide(p);
  p.z += uz * dist; collide(p);
  p.moving = Math.hypot(p.x - ox, p.z - oz) > dist * 0.2;
}

export function findTarget(s) {
  const p = s.player;
  let best = null, bestD = Infinity;
  for (const st of s.stations) {
    const dx = st.x - p.x, dz = st.z - p.z, d = Math.hypot(dx, dz);
    if (d > REACH) continue;
    if (d > 0.05 && (dx * p.fx + dz * p.fz) / d < FACING_DOT) continue;
    if (d < bestD) { best = st; bestD = d; }
  }
  return best;
}

// ---- Tap actions (E pressed). Return true when something changed. ----
function tap(s, st) {
  const h = s.holding;
  switch (st.type) {
    case 'cups':
      if (!h) { s.holding = newCup(); event(s, 'Took a cup'); return true; }
      if (blankCup(h)) { s.holding = null; event(s, 'Put the cup back'); return true; }
      event(s, 'Hands full: one item at a time'); return false;
    case 'fridge':
      if (!h) { s.holding = newPitcher(); event(s, 'Took a pitcher of cold milk'); return true; }
      if (freshPitcher(h)) { s.holding = null; event(s, 'Put the milk back'); return true; }
      event(s, 'Hands full: one item at a time'); return false;
    case 'espresso':
      if (h?.kind === 'cup') {
        if (st.item) { event(s, 'That slot is taken'); return false; }
        st.item = h; s.holding = null; st.fresh = false; st.sitting = 0; st.brewT = 0;
        event(s, h.espresso ? 'Set the cup down' : 'Cup in place: press E to brew'); return true;
      }
      if (!h && st.item) {
        if (st.brewing) { event(s, 'Still brewing…'); return false; }
        if (!st.item.espresso) { st.brewing = true; st.brewT = 0; event(s, 'Brewing a shot'); return true; }
        s.holding = st.item; st.item = null; st.fresh = false; st.sitting = 0;
        event(s, 'Took the cup'); return true;
      }
      if (!h) event(s, 'Bring a cup from the stack');
      return false;                                         // pitcher: hold E pours
    case 'steamer':
      if (h?.kind === 'pitcher') {
        if (st.item) { event(s, 'The steamer is busy'); return false; }
        if (h.milk !== null) { event(s, 'This milk is already steamed'); return false; }
        st.item = h; s.holding = null; event(s, 'Pitcher on the steamer: hold E'); return true;
      }
      if (!h && st.item?.milk) { s.holding = st.item; st.item = null; event(s, 'Took the steamed milk'); return true; }
      if (!h && !st.item) event(s, 'Fetch a pitcher from the milk fridge');
      if (h?.kind === 'cup') event(s, 'Hands full: one item at a time');
      return false;                                         // pitcher waiting: hold E steams
    case 'spot':
      if (h && !st.item) { st.item = h; s.holding = null; event(s, 'Set it down'); return true; }
      if (!h && st.item) { s.holding = st.item; st.item = null; event(s, 'Picked it up'); return true; }
      return false;
    case 'pass':
      if (h?.kind !== 'cup') { event(s, h ? 'Only drinks go to the pass' : 'Bring a finished drink'); return false; }
      return deliver(s);
    case 'bin':
      if (h) { s.holding = null; s.binned++; event(s, 'Binned the ' + h.kind); return true; }
      return false;
    default:
      return false;                                         // syrup: hold E pumps
  }
}

// ---- Hold work (E held) ----
function work(s, st, dt) {
  const h = s.holding;
  if (st.type === 'steamer') {
    const p = st.item;
    if (!p) { event(s, 'Fetch a pitcher from the milk fridge'); return; }
    if (p.milk !== null) return;
    p.temp = Math.min(STEAM_MAX, p.temp + STEAM_RATE * dt);
    st.worked = true;
    if (p.temp >= STEAM_MAX) { finishSteam(s, st); st.worked = false; }
  } else if (st.type === 'espresso' || st.type === 'spot') {
    if (h?.kind !== 'pitcher' || st.item?.kind !== 'cup') return;
    const cup = st.item;
    if (!cup.espresso) { event(s, st.brewing ? 'Wait for the shot' : 'Pull a shot first'); return; }
    if (cup.milk) { event(s, 'This cup already has milk'); return; }
    if (h.milk === null) { event(s, 'Steam the milk first'); return; }
    cup.pour = Math.min(POUR_SECONDS, cup.pour + dt);
    st.worked = true;
    if (cup.pour >= POUR_SECONDS) {
      cup.milk = h.milk; s.holding = null; s.holdLock = true; st.worked = false;
      event(s, h.milk === 'scalded' ? 'Poured a latte (scalded milk)' : 'Poured a silky latte');
    }
  } else if (st.type === 'syrup') {
    if (h?.kind !== 'cup') { event(s, 'Bring a cup to pump syrup'); return; }
    st.worked = true; st.pumpT += dt;
    while (st.pumpT >= PUMP_SECONDS) {
      st.pumpT -= PUMP_SECONDS; h[st.flavor]++; st.pumpCount++;
      event(s, `${st.flavor === 'maple' ? 'Maple' : 'Vanilla'} pump ×${h[st.flavor]}`);
    }
  }
}

function finishSteam(s, st) {
  const p = st.item;
  if (!p || p.milk !== null || p.temp < SWEET_MIN) return;
  p.milk = p.temp <= SWEET_MAX ? 'perfect' : 'scalded';
  event(s, p.milk === 'perfect' ? `Silky milk at ${Math.round(p.temp)} °C` : `Scalded milk (${Math.round(p.temp)} °C)`, p.milk === 'perfect' ? 'good' : 'bad');
}

function deliver(s) {
  const cup = s.holding, recipe = identifyDrink(cup);
  const index = recipe ? s.tickets.findIndex(t => t.recipe === recipe) : -1;
  if (index < 0) {
    s.rejected++;
    event(s, recipe ? `No ticket wants a ${RECIPES[recipe].label}: bin it` : 'That is not on the menu: bin it', 'bad');
    return true;
  }
  const [ticket] = s.tickets.splice(index, 1);
  const flaws = drinkFlaws(cup), quality = qualityFor(flaws), perfect = flaws.length === 0;
  const speed = Math.max(0, Math.min(1, ticket.remaining / ticket.patience));
  const tip = Math.round((1 + 5 * speed) * quality) + (perfect ? 2 : 0);
  const points = Math.round(RECIPES[recipe].base * quality) + tip;
  s.score += points; s.tips += tip; s.served++; if (perfect) s.perfect++;
  s.holding = null;
  s.lastServed = { recipe, ticketId: ticket.id, quality, flaws, tip, points };
  event(s, `Served ${RECIPES[recipe].label} +${points}` + (flaws.length ? ` (${flaws.join(', ')})` : ' (perfect)'), 'served');
  return true;
}

function updateStations(s, dt) {
  for (const st of s.stations) {
    if (st.type === 'espresso') {
      if (st.brewing) {
        st.brewT += dt;
        if (st.brewT >= BREW_SECONDS) {
          st.brewing = false; st.brewT = BREW_SECONDS; st.item.espresso = true; st.fresh = true; st.sitting = 0;
          event(s, `Shot ready in ${st.label.toLowerCase()}`, 'good');
        }
      } else if (st.fresh && st.item?.espresso && !st.item.milk) {
        st.sitting += dt;
        if (st.sitting >= COLD_SHOT_AFTER && !st.item.shotCold) { st.item.shotCold = true; event(s, 'A shot went cold in the machine', 'bad'); }
      }
    } else if (st.type === 'steamer') {
      if (st.wasSteaming && !st.worked) finishSteam(s, st);
      st.wasSteaming = st.worked;
    } else if (st.type === 'syrup' && !st.worked) {
      st.pumpT = 0;
    }
  }
}

function pickRecipe(s) {
  if (s.script.length) return s.script.shift();
  let r = random(s);
  for (const [id, w] of RANDOM_ORDERS) { if ((r -= w) < 0) return id; }
  return 'latte';
}

function updateTickets(s, dt) {
  for (let i = s.tickets.length - 1; i >= 0; i--) {
    const t = s.tickets[i];
    t.remaining -= dt;
    if (t.remaining <= 0) {
      s.tickets.splice(i, 1); s.expired++; s.score -= EXPIRE_PENALTY;
      event(s, `${RECIPES[t.recipe].label} ticket expired −${EXPIRE_PENALTY}`, 'bad');
    }
  }
  if (s.time >= s.nextTicketAt) {
    if (s.tickets.length < MAX_TICKETS && s.time < ROUND_SECONDS - 6) {
      const recipe = pickRecipe(s), r = RECIPES[recipe];
      s.tickets.push({ id: s.nextTicketId++, recipe, patience: r.patience, remaining: r.patience, at: +s.time.toFixed(2) });
      event(s, `New ticket: ${r.label}`);
      s.nextTicketAt = s.time + 11 + random(s) * 6;
    } else {
      s.nextTicketAt = s.time + 2;
    }
  }
}

export function step(s, a = {}, dt = 1 / 60) {
  if (s.phase === 'countdown') {
    s.countdown -= dt;
    if (s.countdown <= 0) { s.countdown = 0; s.phase = 'playing'; }
    return s;
  }
  if (s.phase !== 'playing') return s;
  s.time += dt;
  movePlayer(s, a.moveX || 0, a.moveZ || 0, dt);
  const target = findTarget(s);
  s.targetId = target ? target.id : null;
  for (const st of s.stations) st.worked = false;
  if (!a.use) s.holdLock = false;
  if (a.press && target && tap(s, target)) s.holdLock = true;
  if (a.use && !s.holdLock && target) work(s, target, dt);
  updateStations(s, dt);
  updateTickets(s, dt);
  if (s.time >= ROUND_SECONDS) { s.time = ROUND_SECONDS; s.phase = 'results'; s.player.moving = false; }
  return s;
}

// ---- Read-only views for the HUD, the renderer and QA ----
export function describeItem(item) {
  if (!item) return null;
  if (item.kind === 'pitcher') return { kind: 'pitcher', temp: +item.temp.toFixed(1), milk: item.milk };
  return { kind: 'cup', espresso: item.espresso, shotCold: item.shotCold, milk: item.milk, pour: +item.pour.toFixed(2),
    maple: item.maple, vanilla: item.vanilla, drink: identifyDrink(item) };
}

export function stationState(st) {
  switch (st.type) {
    case 'espresso':
      if (!st.item) return 'empty';
      if (st.brewing) return 'brewing';
      if (st.item.kind !== 'cup') return 'occupied';
      if (!st.item.espresso) return 'cup';
      if (st.item.milk) return 'drink';
      return st.item.shotCold ? 'cold' : 'ready';
    case 'steamer':
      if (!st.item) return 'empty';
      if (st.worked) return 'steaming';
      if (st.item.milk === 'perfect') return 'ready';
      if (st.item.milk === 'scalded') return 'scalded';
      return st.item.temp > MILK_START ? 'warm' : 'cold';
    case 'syrup': return st.worked ? 'pumping' : 'idle';
    case 'spot': return st.item ? st.item.kind : 'empty';
    case 'cups': return 'stack';
    case 'fridge': return 'pitchers';
    case 'pass': return 'open';
    default: return 'bin';
  }
}

// Plain-language hint for the targeted station ("E: take a cup").
export function hintFor(s) {
  const st = s.targetId && stationById(s, s.targetId), h = s.holding;
  if (!st) return h ? `Carrying a ${h.kind}` : 'Walk up to a station';
  const it = st.item;
  const say = t => `${st.label}: ${t}`;
  switch (st.type) {
    case 'cups': return say(!h ? 'E take a cup' : blankCup(h) ? 'E put the cup back' : 'hands full');
    case 'fridge': return say(!h ? 'E take cold milk' : freshPitcher(h) ? 'E put the milk back' : 'hands full');
    case 'espresso':
      if (h?.kind === 'cup') return say(it ? 'slot taken' : 'E place cup');
      if (h?.kind === 'pitcher') return say(it?.espresso && !it.milk && h.milk ? 'hold E pour milk' : 'needs a cup with a shot');
      if (!it) return say('bring a cup');
      if (st.brewing) return say(`brewing ${Math.round(st.brewT / BREW_SECONDS * 100)}%`);
      return say(it.espresso ? 'E take the cup' : 'E start brewing');
    case 'steamer':
      if (!it) return say(h?.kind === 'pitcher' && h.milk === null ? 'E place pitcher' : 'bring cold milk');
      if (it.milk) return say(h ? 'hands full' : 'E take steamed milk');
      return say(`hold E steam, release at ${SWEET_MIN}–${SWEET_MAX} °C (now ${Math.round(it.temp)} °C)`);
    case 'syrup': return say(h?.kind === 'cup' ? `hold E pump (×${h[st.flavor]})` : 'bring a cup');
    case 'spot':
      if (h?.kind === 'pitcher' && it?.kind === 'cup') return say('hold E pour milk');
      return say(h && !it ? 'E set down' : !h && it ? 'E pick up' : 'occupied');
    case 'pass': return say(h?.kind === 'cup' ? 'E deliver' : 'bring a drink');
    default: return say(h ? 'E bin it' : 'nothing to bin');
  }
}

export function snapshot(s) {
  return {
    phase: s.phase, time: +s.time.toFixed(2), timeLeft: +(ROUND_SECONDS - s.time).toFixed(2), countdown: +s.countdown.toFixed(2),
    player: { x: +s.player.x.toFixed(3), z: +s.player.z.toFixed(3), fx: +s.player.fx.toFixed(3), fz: +s.player.fz.toFixed(3), moving: s.player.moving },
    holding: describeItem(s.holding), target: s.targetId, hint: hintFor(s),
    stations: s.stations.map(st => {
      const a = approachOf(st);
      return { id: st.id, type: st.type, x: st.x, z: st.z, ax: +a.x.toFixed(3), az: +a.z.toFixed(3), nx: st.nx, nz: st.nz,
        state: stationState(st), item: describeItem(st.item),
        progress: st.type === 'espresso' ? +(st.brewT / BREW_SECONDS).toFixed(3) : undefined };
    }),
    tickets: s.tickets.map(t => ({ id: t.id, recipe: t.recipe, label: RECIPES[t.recipe].label, remaining: +t.remaining.toFixed(1), patience: t.patience })),
    score: s.score, tips: s.tips, served: s.served, perfect: s.perfect, expired: s.expired, rejected: s.rejected,
    lastServed: s.lastServed, events: s.events.slice(-5),
  };
}
