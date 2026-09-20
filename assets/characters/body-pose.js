// Upper-body posing for the production cast: arm IK, hand shapes, torso lean,
// head look and props. Legs, root drop and pelvis still come from
// character-kit/pose.js so seated heights and gait stay exactly as tested.
//
// Every arm pose is described as a target (wrist position, finger direction,
// palm normal, elbow pole, hand shape). Targets are smoothed in character
// ("group") space and solved with a two-bone IK, so any pose blends naturally
// into any other one and hands actually reach the object an activity uses.
//
// Bind space: floor y=0, the character faces +z, and +x is the character's
// LEFT side (rig tag "R"). The relaxed hand's palm faces the thigh.
import * as THREE from 'three';

const V = THREE.Vector3, Q = THREE.Quaternion, M = THREE.Matrix4;
const T = (v, s = 1) => new M().makeTranslation(v.x * s, v.y * s, v.z * s);
const pivot = (m, p) => T(p).multiply(m).multiply(T(p, -1));
const clamp = THREE.MathUtils.clamp;
export const RIGHT = -1, LEFT = 1;   // character's own right/left hand (bind x sign)

// Per-finger base curl [index, middle, ring, pinky, thumb], tip curl scale and spread.
export const HAND_SHAPES = {
  relaxed: { curl: [.34, .40, .46, .52, .22], tip: .75, spread: .02 },
  open: { curl: [.02, .02, .04, .07, -.05], tip: .15, spread: .16 },
  peace: { curl: [.02, .02, 1.35, 1.4, .65], tip: .9, spread: .18 },
  flat: { curl: [.10, .10, .12, .14, .05], tip: .3, spread: .05 },
  grip: { curl: [1.05, 1.12, 1.18, 1.22, .55], tip: .85, spread: -.04 },
  pinch: { curl: [.72, 1.05, 1.2, 1.3, .62], tip: .6, spread: -.02 },
  fist: { curl: [1.35, 1.4, 1.45, 1.5, .8], tip: 1.1, spread: -.05 },
  point: { curl: [.02, 1.3, 1.38, 1.45, .7], tip: 1.0, spread: 0 },
  book: { curl: [.45, .5, .55, .6, .3], tip: .5, spread: .04 },
  type: { curl: [.16, .19, .22, .25, .2], tip: .4, spread: .06 },
};

function rig(male) {
  const w = male ? 1.34 : 1;
  return side => ({
    S: new V(side * .128 * w, 1.222, -.02),
    E: new V(side * (male ? .201 : .16), 1.035, 0),
    W: new V(side * (male ? .180 : .191), .785, .03),
  });
}

// Rotation that maps the rest hand basis (fingers down, palm toward the thigh)
// onto a requested finger direction and palm normal.
const restBasis = side => new M().makeBasis(new V(0, -1, 0), new V(-side, 0, 0), new V(0, -1, 0).cross(new V(-side, 0, 0)));
export function handQuaternion(side, f, n) {
  const F = f.clone().normalize(), N = n.clone().addScaledVector(F, -n.dot(F));
  if (N.lengthSq() < 1e-6) {
    N.set(0, Math.abs(F.y) < .9 ? 1 : 0, Math.abs(F.y) < .9 ? 0 : 1);
    N.addScaledVector(F, -N.dot(F));
  }
  N.normalize();
  const target = new M().makeBasis(F, N, F.clone().cross(N));
  return new Q().setFromRotationMatrix(target.multiply(restBasis(side).transpose()));
}

// ---------------------------------------------------------------------------
// Pose library. Each returns {w, f, n, pole, shape, space?, curls?}.
// space 'body' (default) follows the torso; 'group' is fixed in the room
// (desks, boards, controls), so hands stay on the object while the body leans.
// ---------------------------------------------------------------------------
const P = {
  rest(side, c) {
    // A forward foot pairs with the opposite arm, not the same-side wrist.
    const p = c.phase + (side < 0 ? Math.PI : 0), swing = Math.cos(p) * .11 * c.walk;
    return { w: new V(side * .205, .80 + .02 * Math.abs(swing), .035 + swing), f: new V(-side * .06, -1, .06 + swing * .8), n: new V(-side, 0, .12), pole: new V(side * .35, 0, -1), shape: 'relaxed' };
  },
  lap(side) { // seated, hands resting on the thighs
    return { w: new V(side * .105, .86, .19), f: new V(-side * .10, -.15, 1), n: new V(-side * .10, -1, .1), pole: new V(side * .8, -.35, -.5), shape: 'flat' };
  },
  clasp(side) {
    return { w: new V(side * .045, .90, .125), f: new V(-side * .75, -.45, .35), n: new V(-side * .2, .1, -1), pole: new V(side * .6, -.3, -.6), shape: 'book' };
  },
  hair(side) { // tuck hair behind the ear
    return { w: new V(side * .105, 1.50, .015), f: new V(side * .1, .8, -.5), n: new V(-side, 0, 0), pole: new V(side * 1, -.5, .1), shape: 'relaxed' };
  },
  wave(side, c) {
    // The forearm rocks about a steady elbow; the palm faces forward and the
    // fingers stay extended and together with the thumb relaxed alongside.
    const a = Math.sin(c.t * 8.5) * .32, e = new V(side * .30, 1.19, .03);
    const w = e.clone().add(new V(side * Math.sin(a) * .235, Math.cos(a) * .235, .05));
    return { w, f: w.clone().sub(e).normalize().add(new V(0, .15, 0)), n: new V(0, 0, 1), pole: new V(side * 1, -.8, -.25), shape: 'open' };
  },
  cup(side) { // mug held upright at chest height, fingers through/around it
    return { w: new V(side * .135, 1.075, .19), f: new V(-side * .55, -.1, .83), n: new V(-side * .83, 0, -.55), pole: new V(side * .7, -.5, -.5), shape: 'grip' };
  },
  sip(side) {
    // Bring the tilted rim to the lips; the previous target stopped at the chin.
    return { w: new V(side * .085, 1.315, .16), f: new V(-side * .7, .18, .6), n: new V(-side * .6, 0, -.75), pole: new V(side * .75, -.7, -.1), shape: 'grip' };
  },
  typeKeys(side, c) {
    const y = c.desk + .045, tap = .006 * Math.max(0, Math.sin(c.t * 11 + side * 1.9));
    return { space: 'group', w: new V(side * .095, y + .03 + tap, .33), f: new V(-side * .12, -.10, 1), n: new V(0, -1, 0), pole: new V(side * .9, -.35, -.35), shape: 'type', typing: true };
  },
  readBook(side, c) {
    return { w: new V(side * .105, c.seated ? .99 : 1.06, .29), f: new V(-side * .3, .45, .8), n: new V(-side * .75, .55, -.2), pole: new V(side * .8, -.5, -.35), shape: 'book' };
  },
  write(side, c) {
    if (side === RIGHT) {
      const o = c.t * 2.3, y = c.desk + .035;
      return { space: 'group', w: new V(-.07 + .025 * Math.sin(o), y + .03, .31 + .012 * Math.sin(o * 2.7)), f: new V(.25, -.55, .8), n: new V(-.3, -.8, 0), pole: new V(-.9, -.4, -.3), shape: 'pinch', prop: 'pen' };
    }
    return { space: 'group', w: new V(.13, c.desk + .045, .31), f: new V(-.35, -.3, .9), n: new V(0, -1, 0), pole: new V(.9, -.4, -.3), shape: 'flat' };
  },
  think(side, c) {
    if (side === RIGHT) return { w: new V(-.045, 1.24, .19), f: new V(.25, .9, .2), n: new V(0, .1, -1), pole: new V(-.3, -1, .3), shape: 'fist' };
    return P.lap(side, c);
  },
  ears(side) { // hands at the ears: putting headphones on / adjusting them
    return { w: new V(side * .15, 1.49, .02), f: new V(0, 1, .1), n: new V(-side, 0, 0), pole: new V(side * 1, -.6, -.3), shape: 'book' };
  },
  stretch(side) {
    return { w: new V(side * .09, 1.80, .04), f: new V(-side * .4, 1, 0), n: new V(0, 0, -1), pole: new V(side * 1, 0, -.4), shape: 'flat' };
  },
  cheer(side, c) {
    return { w: new V(side * .22, 1.72 + .02 * Math.sin(c.t * 9), .08), f: new V(side * .15, 1, 0), n: new V(0, 0, 1), pole: new V(side * 1, -.3, -.2), shape: 'fist' };
  },
  sad(side) {
    return { w: new V(side * .17, .84, .09), f: new V(-side * .2, -1, .2), n: new V(-side, 0, .2), pole: new V(side * .3, 0, -1), shape: 'relaxed' };
  },
  reach(side, c) {
    const r = c.reach, w = new V(r.x, r.y + .05, r.z);
    const f = new V(-side * .1, -.75, .65).normalize();
    return { space: 'group', w: w.addScaledVector(f, -.05), f, n: new V(0, -1, 0), pole: new V(side * .9, -.5, -.5), shape: r.shape || 'pinch' };
  },
  aim(side) {
    return { w: new V(side * .22, 1.30, .31), f: new V(-side * .08, .08, 1), n: new V(-side * .9, 0, -.2), pole: new V(side * .8, -.7, -.2), shape: 'pinch', prop: 'dart' };
  },
  throwDart(side) {
    return { w: new V(side * .08, 1.43, .60), f: new V(-side * .05, -.1, 1), n: new V(0, -1, 0), pole: new V(side * .8, -.6, -.2), shape: 'open' };
  },
  guard(side) { // the free hand during a throw, relaxed in front
    return { w: new V(side * .17, .95, .16), f: new V(-side * .3, -.8, .5), n: new V(-side, 0, 0), pole: new V(side * .6, -.3, -.6), shape: 'relaxed' };
  },
  arcade(side, c) {
    const y = c.panel ?? 1.02;
    if (side === LEFT) return { space: 'group', w: new V(.11 - (c.stick?.x || 0) * .035, y + .07, .40 + (c.stick?.y || 0) * .035), f: new V(-.1, .9, .3), n: new V(-.95, 0, .2), pole: new V(.9, -.5, -.3), shape: 'fist' };
    const press = .012 * Math.max(0, Math.sin(c.t * 7));
    return { space: 'group', w: new V(-.12, y + .06 - press, .40), f: new V(.1, -.4, 1), n: new V(0, -1, 0), pole: new V(-.9, -.5, -.3), shape: 'point' };
  },
  water(side) { // tilting a watering can over a plant
    if (side === RIGHT) return { w: new V(-.12, 1.05, .34), f: new V(.3, -.2, 1), n: new V(.95, 0, -.25), pole: new V(-.8, -.5, -.3), shape: 'grip', prop: 'can' };
    return P.rest(side, { phase: 0, walk: 0 });
  },
};

// Which pose each hand takes. Keeps the cup in the left hand (bind +x, tag R)
// and does fine work with the right hand, so a character can wave or write
// while still holding a drink.
function chooseArms(state, c) {
  const a = state.activity, seated = c.sit > .5;
  const base = side => seated ? (c.idle === 'clasp' ? P.clasp(side) : P.lap(side, c)) : c.idle === 'clasp' ? P.clasp(side) : P.rest(side, c);
  let L = base(LEFT), R = base(RIGHT);
  const two = { type: 'typeKeys', read: 'readBook', ears: 'ears', stretch: 'stretch', cheer: 'cheer', sad: 'sad' };
  if (two[a]) { L = P[two[a]](LEFT, c); R = P[two[a]](RIGHT, c); }
  else if (a === 'write' || a === 'think' || a === 'arcade') { L = P[a](LEFT, c); R = P[a](RIGHT, c); }
  else if (a === 'reach' && c.reach) { const s = c.reach.side ?? RIGHT; if (s === RIGHT) R = P.reach(RIGHT, c); else L = P.reach(LEFT, c); }
  else if (a === 'aim') { R = P.aim(RIGHT); L = P.guard(LEFT); }
  else if (a === 'throw') { R = P.throwDart(RIGHT); L = P.guard(LEFT); }
  else if (a === 'water') { R = P.water(RIGHT); }
  else if (!a && !seated && c.idle === 'hair' && !state.cup) R = P.hair(RIGHT);
  if (!two[a] && a !== 'arcade') {
    if (state.sipping) L = P.sip(LEFT);
    else if (state.cup) L = P.cup(LEFT);
  }
  if (state.wave) { if (a !== 'type') R = P.wave(RIGHT, c); }
  return { [LEFT]: L, [RIGHT]: R };
}

// ---------------------------------------------------------------------------
export function createBodyPoser({ male = false, rand = Math.random, fingerRest = null } = {}) {
  const dims = rig(male), sides = [RIGHT, LEFT];
  const arms = {}, cur = { lean: 0, yaw: 0, pitch: 0, shift: 0 };
  let idle = 'rest', idleUntil = 4 + rand() * 5, lastSit = 0;
  for (const side of sides) {
    const d = dims(side);
    arms[side] = { w: d.W.clone(), handQ: new Q(), pole: new V(side * .35, 0, -1), curls: [...HAND_SHAPES.relaxed.curl], tip: .75, spread: 0 };
  }
  function nextIdle(t, seated) {
    const list = seated ? ['rest', 'rest', 'look', 'clasp', 'rest'] : ['rest', 'shift', 'look', 'clasp', 'rest', 'hair', 'shift'];
    idle = list[Math.floor(rand() * list.length)];
    idleUntil = t + (idle === 'hair' ? 2.4 : 6 + rand() * 7);
  }

  // Returns bind→group matrices for torso, head and arms, plus finger motions.
  function solve({ t, dt, still, root, sit, walk, phase, state }) {
    const k = still ? 1 : 1 - Math.exp(-dt * (state.snap ? 30 : 8));
    const seated = sit > .5, busy = !!state.activity || walk > .3 || state.wave || state.sipping;
    if (seated !== (lastSit > .5)) { idle = 'rest'; idleUntil = t + 3 + rand() * 4; }
    lastSit = sit;
    if (busy || still) { if (idle !== 'rest') idle = 'rest'; idleUntil = Math.max(idleUntil, t + 3); }
    else if (t > idleUntil) nextIdle(t, seated);

    // Torso: activity lean, plus a forward lean while rising/lowering over the seat.
    const transition = state.sitAmount !== undefined ? 4 * sit * (1 - sit) : 0;
    const act = state.activity;
    const leanTarget = transition * .42 + ({ type: .13, write: .2, read: .06, think: .12, reach: .16, arcade: .06, sad: .12, water: .1, aim: .02 }[act] || 0) + (state.studying && !act ? .1 : 0) + (state.sipping ? -.04 : 0);
    cur.lean += (leanTarget - cur.lean) * k;
    const shiftTarget = idle === 'shift' ? Math.sin(t * .6) * .018 : 0;
    cur.shift += (shiftTarget - cur.shift) * k * .5;
    const rootM = root.clone().premultiply(T(new V(cur.shift, 0, 0)));
    const spine = rootM.clone().multiply(pivot(new M().makeRotationX(cur.lean * .5).multiply(new M().makeRotationZ(-cur.shift * 1.2)), new V(0, .95, 0)));
    const chest = spine.clone().multiply(pivot(new M().makeRotationX(cur.lean * .5), new V(0, 1.14, 0)));

    // Head: explicit look target > activity focus > idle look-around.
    let yaw = 0, pitch = 0;
    if (state.lookTarget) {
      const lt = state.lookTarget; yaw = clamp(Math.atan2(lt.x, lt.z - .1), -.75, .75); pitch = clamp(-(lt.y - 1.45) / Math.max(.3, Math.hypot(lt.x, lt.z)) * .8, -.45, .35);
    } else if (act === 'type' || act === 'write') pitch = .32; else if (act === 'read') pitch = .38; else if (act === 'reach') pitch = .42;
    else if (act === 'sad') pitch = .35; else if (act === 'cheer') pitch = -.15; else if (act === 'arcade') pitch = .12;
    else if (idle === 'look') { yaw = Math.sin(t * .45) * .45; pitch = -.03; }
    cur.yaw += (yaw - cur.yaw) * k * .7; cur.pitch += (pitch - cur.pitch) * k * .7;
    const neck = chest.clone().multiply(pivot(new M().makeRotationY(cur.yaw * .35).multiply(new M().makeRotationX(cur.pitch * .35)), new V(0, 1.28, 0)));
    const head = neck.clone().multiply(pivot(new M().makeRotationY(cur.yaw * .65).multiply(new M().makeRotationX(cur.pitch * .65)), new V(0, 1.39, 0)));

    const ctx = { t, sit, walk, phase, idle, seated, desk: state.deskHeight ?? .78, panel: state.panelHeight, reach: state.reach, stick: state.stick };
    const targets = chooseArms(state, ctx), out = { spine, chest, neck, head, arms: {}, fingers: {}, props: {} };
    const chestQ = new Q().setFromRotationMatrix(chest);
    for (const side of sides) {
      const spec = targets[side], a = arms[side], d = dims(side);
      const toGroup = spec.space === 'group' ? null : chest;
      const w = toGroup ? spec.w.clone().applyMatrix4(toGroup) : spec.w.clone();
      const f = toGroup ? spec.f.clone().normalize().applyQuaternion(chestQ) : spec.f.clone().normalize();
      const n = toGroup ? spec.n.clone().normalize().applyQuaternion(chestQ) : spec.n.clone().normalize();
      const kk = spec.typing || state.wave ? Math.min(1, k * 2.2) : k;
      // Interpolate one orientation: independent direction vectors collapse when
      // fingers change from pointing down to pointing up (rest → wave/stretch).
      a.w.lerp(w, kk); a.handQ.slerp(handQuaternion(side, f, n), kk); a.pole.lerp(spec.pole, k).normalize();
      const shape = HAND_SHAPES[state.handShape ?? spec.shape] || HAND_SHAPES.relaxed;
      for (let i = 0; i < 5; i++) {
        let target = shape.curl[i];
        if (spec.typing && i < 4) target += .10 * Math.max(0, Math.sin(t * 13 + i * 2.1 + side));
        a.curls[i] += (target - a.curls[i]) * Math.min(1, k * 1.6);
      }
      a.tip += (shape.tip - a.tip) * k; a.spread += (shape.spread - a.spread) * k;
      const solved = solveArm(side, d, a, chest);
      out.arms[side] = solved; out.props[side] = spec.prop || null;
      Object.assign(out.fingers, fingerMotions(side, solved.hand, a, fingerRest));
    }
    out.idle = idle;
    return out;
  }
  return { solve, get idle() { return idle; } };
}

// Two-bone IK with the forearm taking half of the wrist twist.
function solveArm(side, { S, E, W }, a, chest) {
  const chestQ = new Q().setFromRotationMatrix(chest);
  const s = S.clone().applyMatrix4(chest);
  const L1 = E.distanceTo(S), L2 = W.distanceTo(E);
  const toW = a.w.clone().sub(s); let dist = toW.length();
  dist = clamp(dist, Math.abs(L1 - L2) + .01, L1 + L2 - .003); toW.normalize();
  const w = s.clone().addScaledVector(toW, dist);
  const along = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
  const bend = a.pole.clone().addScaledVector(toW, -a.pole.dot(toW));
  if (bend.lengthSq() < 1e-6) bend.set(side, -.3, -1).addScaledVector(toW, -new V(side, -.3, -1).dot(toW));
  bend.normalize();
  const e = s.clone().addScaledVector(toW, along).addScaledVector(bend, h);
  const upperQ = new Q().setFromUnitVectors(E.clone().sub(S).applyQuaternion(chestQ).normalize(), e.clone().sub(s).normalize()).multiply(chestQ);
  let lowerQ = new Q().setFromUnitVectors(W.clone().sub(E).applyQuaternion(upperQ).normalize(), w.clone().sub(e).normalize()).multiply(upperQ);
  const handQ = a.handQ.clone();
  const rel = handQ.clone().multiply(lowerQ.clone().invert()), axis = w.clone().sub(e).normalize();
  const proj = axis.multiplyScalar(axis.dot(new V(rel.x, rel.y, rel.z)));
  const twist = new Q(proj.x, proj.y, proj.z, rel.w);
  if (twist.lengthSq() > 1e-8) { twist.normalize(); lowerQ = new Q().slerp(twist, .5).multiply(lowerQ); }
  return {
    upper: T(s).multiply(new M().makeRotationFromQuaternion(upperQ)).multiply(T(S, -1)),
    lower: T(e).multiply(new M().makeRotationFromQuaternion(lowerQ)).multiply(T(E, -1)),
    hand: T(w).multiply(new M().makeRotationFromQuaternion(handQ)).multiply(T(W, -1)),
    wrist: w, elbow: e, handQ,
  };
}

// Finger joints are keyed by the bone names used in the GLB rigs (dots removed);
// restFingers maps each to its bind-space joint position.
function fingerMotions(side, hand, a, restFingers) {
  const tag = side > 0 ? 'R' : 'L', out = {};
  if (!restFingers) return out;
  const curlAxis = new V(0, 0, -side);
  for (let i = 0; i < 4; i++) {
    const base = restFingers['finger' + i + tag], tip = restFingers['finger' + i + tag + 'Tip'];
    if (!base) continue;
    const r = new M().makeRotationAxis(new V(1, 0, 0), -a.spread * (1.5 - i) * .55).multiply(new M().makeRotationAxis(curlAxis, a.curls[i]));
    // Seat the outer knuckles along the tapered palm instead of leaving all
    // four roots in one flat row below its edge (visible gaps in an open hand).
    const m = hand.clone().multiply(T(new V(0, .004 + .008 * Math.abs(i - 1.5) / 1.5, 0))).multiply(pivot(r, base));
    out['finger' + i + tag] = m;
    out['finger' + i + tag + 'Tip'] = m.clone().multiply(pivot(new M().makeRotationAxis(curlAxis, a.curls[i] * a.tip), tip));
  }
  const tb = restFingers['thumb' + tag], tt = restFingers['thumb' + tag + 'Tip'];
  if (tb) {
    const dir = tt.clone().sub(tb).normalize(), toward = new V(-side * .55, 0, -.85).normalize();
    const axis = dir.clone().cross(toward).normalize();
    const m = hand.clone().multiply(pivot(new M().makeRotationAxis(axis, a.curls[4]), tb));
    out['thumb' + tag] = m; out['thumb' + tag + 'Tip'] = m.clone().multiply(pivot(new M().makeRotationAxis(axis, a.curls[4] * .8), tt));
  }
  return out;
}
