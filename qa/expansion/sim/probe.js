// Simulation guardian — page-side probe (A6 · QA).
// Injected into a running café (window.cafe, ?qa) by qa/expansion/sim/browser.mjs.
// Runs its own requestAnimationFrame loop *after* the game's loop each frame,
// accumulates the same capped sim time (dt ≤ 40 ms) and checks believability
// invariants. Continuous conditions are grouped into episodes (debounced), so
// counts mean "distinct occurrences", not "bad frames". The first occurrence of
// every violation type is captured as a captioned PNG (witness camera aimed at
// the spot, or the player's own view for camera problems).
(async () => {
  if (window.simProbe) return;
  const c = window.cafe;
  const THREE = await import('three');
  const nav = await import('/navigation.js');
  const $ = id => document.getElementById(id);
  const CFG = {
    sampleMs: 125, overlap: .40, furnitureShrink: .10, footFloat: .03, footSink: -.03, seatTol: .05,
    camHead: .30, camBody: .25, stuckSec: 8, waitSec: 60, slideSpeed: .05, moonwalkSec: 1.5, teleport: .5,
    flipWindow: 1, flipMax: 4, farChat: 3, farStation: 1.6, farBond: 3, stepSpeed: .3, stepLift: .012, witness: true,
  };
  // Minimum sim-seconds a condition must persist before it counts (filters 1-frame noise).
  const MIN_DUR = { 'in-furniture': .3, 'in-plant': .3, 'off-floor': .3, 'feet-float': .3, 'feet-sink': .3, 'seated-float': .5, 'seated-sink': .5, 'seated-feet-dangle': .5,
    'slide-flag': .3, 'slide-no-steps': 0, 'moonwalk': 0, 'seat-claim-conflict': 1, 'guest-facing': .5, 'guest-seat-facing': .5 };
  const S = { simT: 0, wall0: performance.now(), frames: 0, samples: 0, lastSampleWall: 0, running: false, marks: [], episodes: [], open: new Map(), seen: new Set(),
    counts: {}, transients: {}, shots: [], shot: new Set(), econ: [], bonds: [], timeline: [], errors: [], static: {}, per: new Map(), lastTimeline: -1 };
  const mark = label => { S.marks.push({ t: +S.simT.toFixed(2), label }); };
  const lastMark = () => S.marks.length ? S.marks[S.marks.length - 1].label : '(start)';
  const r2 = v => Math.round(v * 100) / 100;
  const wy = b => b.matrixWorld.elements[13];
  const wpos = b => ({ x: b.matrixWorld.elements[12], y: b.matrixWorld.elements[13], z: b.matrixWorld.elements[14] });
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const layout = c.layout;

  // ---------------------------------------------------------------- rigs (rest heights from the bind pose)
  const rigs = new WeakMap(), clean = s => s.replace(/[._]/g, '');
  function rig(group) {
    if (rigs.has(group)) return rigs.get(group);
    let sk = null; group.traverse(o => { if (!sk && o.isSkinnedMesh && o.skeleton) sk = o; });
    let r = null;
    if (sk) {
      const bones = {}, rest = {}, bind = new THREE.Matrix4();
      sk.skeleton.bones.forEach((b, i) => { const k = clean(b.name); bones[k] = b; bind.copy(sk.bindMatrix).multiply(new THREE.Matrix4().copy(sk.skeleton.boneInverses[i]).invert()); rest[k] = bind.elements[13]; });
      if (bones.footL && bones.footR && bones.thighL && bones.head) r = { bones, rest };
    }
    rigs.set(group, r); return r;
  }

  // ---------------------------------------------------------------- who is in the café right now
  const SEAT_PHASES = new Set(['sitting-down', 'seated', 'standing-up']), SEAT_POSTURES = new Set(['sitting', 'seated', 'rising']);
  const remoteGroups = () => c.scene.children.filter(o => o !== c.maya.group && o.isGroup && o.name === c.maya.group.name);
  function people() {
    const out = [], pc = c.playerCtl;
    out.push({ id: 'player', kind: 'player', group: c.maya.group, x: c.me.x, z: c.me.z, angle: c.me.angle, visible: true,
      seatMode: pc.posture === 'seated' ? 'seated' : SEAT_POSTURES.has(pc.posture) ? 'transition' : null, seatId: SEAT_POSTURES.has(pc.posture) ? pc.seat?.id || null : null,
      claim: pc.seat?.id || null, walking: !!pc.walking, route: pc.route.length, state: pc.posture, activity: pc.activity || null });
    for (const n of c.regulars) {
      const l = n.life, k = n.ctl, scripted = !l || l.scripted || k.scriptedBy, body = l || k.body;
      const e = { id: n.id, kind: n.id === 'mara' ? 'staff' : 'npc', group: n.avatar.group, x: body.x, z: body.z, angle: body.angle, visible: n.avatar.group.visible, phase: l?.phase || null, talking: !!n.talkingToPlayer };
      if (!scripted) Object.assign(e, { seatMode: l.phase === 'seated' ? 'seated' : SEAT_PHASES.has(l.phase) ? 'transition' : null, seatId: SEAT_PHASES.has(l.phase) ? l.seat?.id || null : null, claim: l.seat?.id || null, walking: !!l.walking, route: l.route.length, state: l.phase, activity: l.sipping ? 'sip' : null });
      else Object.assign(e, { seatMode: k.posture === 'seated' ? 'seated' : SEAT_POSTURES.has(k.posture) ? 'transition' : null, seatId: SEAT_POSTURES.has(k.posture) ? k.seat?.id || null : null, claim: k.seat?.id || null, walking: !!k.walking, route: k.route.length, state: (l ? 'scripted:' : 'staff:') + k.posture, activity: k.activity || null });
      out.push(e);
    }
    remoteGroups().forEach((g, i) => out.push({ id: 'guest' + i, kind: 'guest', group: g, x: g.position.x, z: g.position.z, angle: g.rotation.y, visible: g.visible, seatMode: null, seatId: null, claim: null, walking: null, route: 0, state: 'remote', activity: null }));
    return out;
  }

  // ---------------------------------------------------------------- static geometry helpers
  const room = (x, z) => (layout.rooms || []).find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
  const roomCenter = (x, z) => { const r = room(x, z); return r ? [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2] : [0, 0]; };
  function onFloor(x, z) {
    if (Math.abs(x) <= layout.width / 2 && Math.abs(z) <= layout.depth / 2) return true;
    if (layout.entrance && Math.abs(x) <= layout.entrance.halfWidth && z >= layout.depth / 2 && z <= layout.entrance.endZ) return true;
    return !!room(x, z) || (layout.doors || []).some(d => x >= d.x0 - .05 && x <= d.x1 + .05 && z >= d.z0 - .05 && z <= d.z1 + .05);
  }
  const plants = layout.stations.filter(s => s.kind === 'plant');
  // Seat surfaces measured from every visible, non-character mesh in the scene.
  const skip = new Set([c.maya.group, ...c.regulars.map(n => n.avatar.group)]);
  function sceneMeshes() {
    const list = [];
    const walk = o => { if (!o.visible || skip.has(o) || o.name === 'Interaction proxies' || o.isSprite || o.isPoints || o.isLine || o.name === c.maya.group.name) return; if (o.isMesh && o.material && o.material.visible !== false && o.material.colorWrite !== false) list.push(o); for (const ch of o.children) walk(ch); };
    for (const ch of c.scene.children) walk(ch);
    return list;
  }
  const down = new THREE.Raycaster(), surfCache = new Map();
  function surfaceAt(x, z, fromY) {
    const key = x.toFixed(2) + ',' + z.toFixed(2) + ',' + fromY.toFixed(2); if (surfCache.has(key)) return surfCache.get(key);
    down.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0)); down.far = fromY + .2;
    const hit = down.intersectObjects(S.meshes || (S.meshes = sceneMeshes()), false)[0];
    const y = hit ? hit.point.y : 0; surfCache.set(key, { y, obj: hit?.object?.name || '' }); return surfCache.get(key);
  }
  function staticChecks() {
    const seats = c.world.seats.map(s => { const sh = s.seatHeight ?? .54, f = surfaceAt(s.x, s.z, sh + .3); return { id: s.id, kind: s.kind, seatHeight: sh, surface: r2(f.y), mesh: f.obj, delta: r2(sh - f.y) }; });
    const plantGaps = plants.filter(p => !layout.obstacles.some(o => Math.abs(p.x - o.x) < o.w / 2 && Math.abs(p.z - o.z) < o.d / 2)).map(p => p.id);
    const approaches = [...c.world.seats, ...layout.stations.filter(s => s.approach)].filter(s => s.approach && !nav.isWalkable(s.approach[0], s.approach[1], layout)).map(s => s.id);
    S.static = { seats, seatMismatch: seats.filter(s => Math.abs(s.delta) > .04), plantsWithoutObstacle: plantGaps, blockedApproaches: [...new Set(approaches)] };
  }

  // ---------------------------------------------------------------- evidence capture
  let wcam = null, ring = null;
  function capture(type, info) {
    if (!CFG.witness) return;
    try {
      const r = c.renderer, canvas = r.domElement;
      if (info.view !== 'main' && info.at) {
        wcam ||= new THREE.PerspectiveCamera(50, 1, .05, 150);
        if (!ring) { ring = new THREE.Mesh(new THREE.RingGeometry(.42, .5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2d55', depthTest: false, transparent: true, opacity: .9 })); ring.renderOrder = 9; }
        const [x, z] = info.at, [cx, cz] = roomCenter(x, z); let dx = cx - x, dz = cz - z; const d = Math.hypot(dx, dz);
        if (d < .6) { dx = .7071; dz = .7071; } else { dx /= d; dz /= d; }
        wcam.aspect = canvas.width / canvas.height; wcam.updateProjectionMatrix();
        wcam.position.set(x + dx * 2.6 + dz * .6, 2.35, z + dz * 2.6 - dx * .6); wcam.lookAt(x, .7, z); wcam.updateMatrixWorld();
        ring.position.set(x, .03, z); c.scene.add(ring); r.render(c.scene, wcam); c.scene.remove(ring);
      }
      const out = document.createElement('canvas'); out.width = 1100; out.height = Math.round(1100 * canvas.height / canvas.width);
      const g = out.getContext('2d'); g.drawImage(canvas, 0, 0, out.width, out.height);
      g.fillStyle = 'rgba(18,18,18,.74)'; g.fillRect(0, 0, out.width, 52); g.fillStyle = '#ffe28a'; g.font = 'bold 16px sans-serif';
      g.fillText(`${type}  ·  sim t=${S.simT.toFixed(1)}s  ·  during: ${lastMark()}`, 10, 20);
      g.fillStyle = '#fff'; g.font = '14px monospace'; g.fillText(JSON.stringify(info.caption ?? info).slice(0, 150), 10, 42);
      S.shots.push({ name: 'bug-' + type, type, data: out.toDataURL('image/png'), info: info.caption ?? info, t: r2(S.simT), mark: lastMark() });
    } catch (e) { S.errors.push('capture ' + type + ': ' + e.message); }
  }

  // ---------------------------------------------------------------- episodes
  function flag(type, key, info, sev = 0) {
    const k = type + '|' + key; S.seen.add(k);
    let e = S.open.get(k);
    if (!e) { e = { type, key, start: S.simT, last: S.simT, n: 0, gap: 0, sev, info, first: info, counted: false, mark: lastMark(), wall: Date.now() }; S.open.set(k, e); }
    e.last = S.simT; e.n++; if (sev > e.sev) { e.sev = sev; e.info = info; }
    if (!e.counted && e.last - e.start >= (MIN_DUR[type] ?? 0)) {
      e.counted = true; S.counts[type] = (S.counts[type] || 0) + 1;
      if (!S.shot.has(type)) { S.shot.add(type); capture(type, info); }
    }
  }
  function closeEpisodes(force = false) {
    for (const [k, e] of S.open) {
      if (!force && S.seen.has(k)) { e.gap = 0; continue; }
      if (!force && ++e.gap < 3) continue;
      S.open.delete(k);
      const rec = { type: e.type, key: e.key, start: r2(e.start), dur: r2(e.last - e.start), samples: e.n, during: e.mark, worst: e.info, first: e.first };
      if (e.counted) S.episodes.push(rec); else S.transients[e.type] = (S.transients[e.type] || 0) + 1;
    }
    S.seen = new Set();
  }

  // ---------------------------------------------------------------- per-frame checks (motion)
  function perState(p) { let s = S.per.get(p.id); if (!s) { s = { prev: null, flips: [], sig: '', steps: [], anchor: null, anchorT: 0, phase: p.state, phaseT: S.simT, seatedSince: null, stillWalk: 0 }; S.per.set(p.id, s); } return s; }
  function frameChecks(dt, ps) {
    for (const p of ps) {
      const s = perState(p);
      if (!p.visible) { s.prev = null; s.steps = []; continue; }
      const r = rig(p.group);
      const lift = r ? Math.max(wy(r.bones.footL), wy(r.bones.footR)) - r.rest.footL : 0;
      if (s.prev) {
        const d = Math.hypot(p.x - s.prev.x, p.z - s.prev.z), speed = dt > 0 ? d / dt : 0;
        if (d > CFG.teleport) flag('teleport', p.id + '@' + S.frames, { caption: { who: p.id, jump: r2(d), from: [r2(s.prev.x), r2(s.prev.z)], to: [r2(p.x), r2(p.z)], state: p.state }, at: [p.x, p.z] }, d);
        else if (p.kind !== 'guest' && !p.seatMode && !p.walking && speed > CFG.slideSpeed && speed < 3) flag('slide-flag', p.id, { caption: { who: p.id, speed: r2(speed), state: p.state, activity: p.activity }, at: [p.x, p.z] }, speed);
        if (p.kind !== 'guest' && p.walking && d < .0005) { s.stillWalk += dt; if (s.stillWalk > CFG.moonwalkSec) flag('moonwalk', p.id, { caption: { who: p.id, secs: r2(s.stillWalk), state: p.state }, at: [p.x, p.z] }, s.stillWalk); }
        else s.stillWalk = 0;
      }
      // Bone-based sliding: travelling steadily while neither foot ever lifts.
      s.steps.push({ t: S.simT, x: p.x, z: p.z, lift }); while (s.steps.length && S.simT - s.steps[0].t > 1.0) s.steps.shift();
      if (!p.seatMode && s.steps.length > 3 && S.simT - s.steps[0].t > .8) {
        const a = s.steps[0], b = s.steps[s.steps.length - 1], v = Math.hypot(b.x - a.x, b.z - a.z) / (b.t - a.t), maxLift = Math.max(...s.steps.map(q => q.lift));
        if (v > CFG.stepSpeed && maxLift < CFG.stepLift) flag('slide-no-steps', p.id, { caption: { who: p.id, speed: r2(v), maxFootLift: +maxLift.toFixed(3), state: p.state }, at: [p.x, p.z] }, v);
        if (p.kind === 'guest' && v > CFG.stepSpeed) { const heading = Math.atan2(b.x - a.x, b.z - a.z), off = Math.abs(wrap(heading - p.angle)); if (off > Math.PI / 3) flag('guest-facing', p.id, { caption: { who: p.id, facingOffDeg: Math.round(off * 57.3), speed: r2(v) }, at: [p.x, p.z] }, off); }
      }
      // Animation fighting: pose/locomotion signature flipping too often.
      const sig = [p.seatMode, p.walking, p.activity, p.state].join('|');
      if (s.sig && sig !== s.sig) s.flips.push(S.simT); s.sig = sig;
      while (s.flips.length && S.simT - s.flips[0] > CFG.flipWindow) s.flips.shift();
      if (p.kind !== 'guest' && s.flips.length > CFG.flipMax) flag('anim-fight', p.id, { caption: { who: p.id, flipsPerSec: s.flips.length, sig }, at: [p.x, p.z] }, s.flips.length);
      if (p.state !== s.phase) { s.phase = p.state; s.phaseT = S.simT; }
      s.prev = { x: p.x, z: p.z };
    }
  }

  // ---------------------------------------------------------------- sampled checks (placement, pose, camera, social, economy)
  let prevEcon = null, prevBonds = {}, prevChatOpen = false;
  function sample(ps) {
    S.samples++;
    const player = ps[0], cam = c.camera.position, mode = c.state.mode;
    for (const p of ps) {
      if (!p.visible) continue;
      const r = rig(p.group), s = perState(p);
      if (r) {
        p.foot = Math.min(wy(r.bones.footL), wy(r.bones.footR)) - r.rest.footL;
        p.thighY = (wy(r.bones.thighL) + wy(r.bones.thighR)) / 2; p.impliedSeat = p.thighY - (r.rest.thighL - .70);
        const h = wpos(r.bones.head); p.head = { x: h.x, y: h.y + .1, z: h.z };
        if (p.kind === 'guest' && p.thighY - r.rest.thighL < -.15) {   // infer a remote guest's seat from its pose
          const seat = c.world.seats.map(q => ({ q, d: Math.hypot(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d)[0];
          p.seatMode = 'seated'; p.seatId = seat && seat.d < .3 ? seat.q.id : '(no seat)';
          if (seat && seat.d < .3 && Math.abs(wrap(p.angle - seat.q.angle)) > .5) flag('guest-seat-facing', p.id, { caption: { who: p.id, seat: seat.q.id, offDeg: Math.round(Math.abs(wrap(p.angle - seat.q.angle)) * 57.3) }, at: [p.x, p.z] });
        }
      }
      // Standing placement.
      if (!p.seatMode) {
        const inside = layout.obstacles.findIndex(o => Math.abs(p.x - o.x) < o.w / 2 - CFG.furnitureShrink && Math.abs(p.z - o.z) < o.d / 2 - CFG.furnitureShrink);
        if (inside >= 0) { const o = layout.obstacles[inside]; flag('in-furniture', p.id + '@' + inside, { caption: { who: p.id, pos: [r2(p.x), r2(p.z)], obstacle: [o.x, o.z, o.w, o.d], state: p.state }, at: [p.x, p.z] }); }
        const pot = plants.find(q => Math.hypot(q.x - p.x, q.z - p.z) < .22);
        if (pot) flag('in-plant', p.id + '@' + pot.id, { caption: { who: p.id, plant: pot.id, d: r2(Math.hypot(pot.x - p.x, pot.z - p.z)), state: p.state }, at: [p.x, p.z] });
        if (!onFloor(p.x, p.z)) flag('off-floor', p.id, { caption: { who: p.id, pos: [r2(p.x), r2(p.z)], state: p.state }, at: [p.x, p.z] });
        if (p.foot !== undefined && p.foot > CFG.footFloat) flag('feet-float', p.id, { caption: { who: p.id, lowestFootAboveFloor: +p.foot.toFixed(3), state: p.state, activity: p.activity }, at: [p.x, p.z] }, p.foot);
        if (p.foot !== undefined && p.foot < CFG.footSink) flag('feet-sink', p.id, { caption: { who: p.id, lowestFootBelowFloor: +p.foot.toFixed(3), state: p.state }, at: [p.x, p.z] }, -p.foot);
      }
      // Seated pose vs the actual seat surface.
      if (p.seatMode === 'seated') {
        s.seatedSince ??= S.simT;
        if (S.simT - s.seatedSince > .6 && p.impliedSeat !== undefined) {
          const seat = c.world.seatById(p.seatId), sx = seat ? seat.x : p.x, sz = seat ? seat.z : p.z;
          const surf = surfaceAt(sx, sz, (seat?.seatHeight ?? .54) + .3).y, dz = p.impliedSeat - surf;
          const cap = { who: p.id, seat: p.seatId, pelvisSeatY: r2(p.impliedSeat), surfaceY: r2(surf), delta: r2(dz) };
          if (dz > CFG.seatTol) flag('seated-float', p.id + '@' + p.seatId, { caption: cap, at: [p.x, p.z] }, dz);
          if (dz < -CFG.seatTol) flag('seated-sink', p.id + '@' + p.seatId, { caption: cap, at: [p.x, p.z] }, -dz);
          if (p.foot !== undefined && p.foot > .06) flag('seated-feet-dangle', p.id + '@' + p.seatId, { caption: { who: p.id, seat: p.seatId, footAboveFloor: r2(p.foot) }, at: [p.x, p.z] }, p.foot);
        }
      } else s.seatedSince = null;
      // Stuck: wants to move (has a route) but has not got anywhere for a while.
      if (p.route > 0 && p.kind !== 'guest') {
        if (!s.anchor || Math.hypot(p.x - s.anchor.x, p.z - s.anchor.z) > .05) { s.anchor = { x: p.x, z: p.z }; s.anchorT = S.simT; }
        else if (S.simT - s.anchorT > CFG.stuckSec) flag(p.kind === 'player' ? 'player-stuck' : 'npc-stuck', p.id, { caption: { who: p.id, secs: r2(S.simT - s.anchorT), pos: [r2(p.x), r2(p.z)], state: p.state, routeLeft: p.route, playerDist: r2(Math.hypot(p.x - player.x, p.z - player.z)), talking: p.talking }, at: [p.x, p.z] }, S.simT - s.anchorT);
      } else { s.anchor = null; }
      if (p.phase === 'ordering' && S.simT - s.phaseT > CFG.waitSec) flag('npc-waiting', p.id, { caption: { who: p.id, waitingSecs: r2(S.simT - s.phaseT), queue: 'counter' }, at: [p.x, p.z] }, S.simT - s.phaseT);
    }
    // People overlapping.
    const vis = ps.filter(p => p.visible);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (a.seatMode && b.seatMode && a.seatId !== b.seatId) continue;   // neighbours on their own seats
      const d = Math.hypot(a.x - b.x, a.z - b.z); if (d >= CFG.overlap) continue;
      const kinds = [a.kind === 'staff' ? 'npc' : a.kind, b.kind === 'staff' ? 'npc' : b.kind].sort().join('-');
      flag('overlap-' + kinds, [a.id, b.id].sort().join('+'), { caption: { a: a.id, b: b.id, d: r2(d), aState: a.state, bState: b.state, pos: [r2((a.x + b.x) / 2), r2((a.z + b.z) / 2)] }, at: [(a.x + b.x) / 2, (a.z + b.z) / 2] }, CFG.overlap - d);
    }
    // Seats: two bodies on one seat; or a body and someone else's claim.
    const seatMap = new Map();
    for (const p of vis) { if (p.seatId) (seatMap.get(p.seatId) || seatMap.set(p.seatId, []).get(p.seatId)).push({ id: p.id, physical: true }); else if (p.claim) (seatMap.get(p.claim) || seatMap.set(p.claim, []).get(p.claim)).push({ id: p.id, physical: false }); }
    for (const [id, list] of seatMap) {
      if (list.length < 2 || id === '(no seat)') continue; const seat = c.world.seatById(id), at = seat ? [seat.x, seat.z] : [player.x, player.z];
      if (list.filter(h => h.physical).length >= 2) flag('seat-shared', id, { caption: { seat: id, holders: list.map(h => h.id) }, at });
      else flag('seat-claim-conflict', id, { caption: { seat: id, holders: list.map(h => (h.physical ? '' : 'claim:') + h.id) }, at });
    }
    // Camera inside a head / the player's body (only when the camera is at eye level).
    if (mode === 'walk') for (const p of vis) {
      if (p.head) { const d = Math.hypot(cam.x - p.head.x, cam.y - p.head.y, cam.z - p.head.z); if (d < CFG.camHead) flag('camera-in-head', p.id, { caption: { who: p.id, camToHead: r2(d), framing: lastMark() }, view: 'main' }, CFG.camHead - d); }
      const hd = Math.hypot(cam.x - p.x, cam.z - p.z); if (hd < CFG.camBody && cam.y > 0 && cam.y < 1.75) flag('camera-in-body', p.id, { caption: { who: p.id, horiz: r2(hd), camY: r2(cam.y) }, view: 'main' }, CFG.camBody - hd);
    }
    // Interactions that start from too far away.
    const chatOpen = !$('chatbox')?.hidden && c.chat?.npc;
    if (chatOpen) { const n = ps.find(p => p.id === c.chat.npc); if (n && Math.hypot(n.x - player.x, n.z - player.z) > CFG.farChat) flag('far-chat', n.id, { caption: { npc: n.id, dist: r2(Math.hypot(n.x - player.x, n.z - player.z)), opened: !prevChatOpen }, at: [player.x, player.z] }); }
    prevChatOpen = !!chatOpen;
    if ($('dialog')?.open && document.querySelector('#dialog [data-order]')) { const st = layout.stations.find(s => s.kind === 'coffee'), d = Math.hypot(player.x - st.approach[0], player.z - st.approach[1]); if (d > CFG.farStation) flag('far-order', 'counter', { caption: { dist: r2(d) }, at: [player.x, player.z] }); }
    if (c.playing?.ctl) { const st = c.playing.st, spots = [st.approach, ...(st.seats || []).map(q => [q.x, q.z])].filter(Boolean), d = Math.min(...spots.map(q => Math.hypot(player.x - q[0], player.z - q[1]))); if (d > CFG.farStation) flag('far-game', st.id, { caption: { game: st.game, dist: r2(d) }, at: [player.x, player.z] }); }
    if (c.focus?.stage === 'study' && !(c.playerCtl.posture === 'seated' && c.playerCtl.seat?.id === c.focus.seat.id)) flag('focus-not-seated', c.focus.seat.id, { caption: { posture: c.playerCtl.posture, seat: c.playerCtl.seat?.id }, at: [player.x, player.z] });
    if (c.playerCtl.activity === 'water') { const d = Math.min(...plants.map(q => Math.hypot(q.x - player.x, q.z - player.z))); if (d > CFG.farStation) flag('far-water', 'plant', { caption: { dist: r2(d) }, at: [player.x, player.z] }); }
    // Friendship points: who gained, and how far away was the player?
    for (const [id, b] of Object.entries(c.bonds || {})) {
      const before = prevBonds[id] ?? b.points; prevBonds[id] = b.points;
      if (b.points > before) {
        const n = ps.find(p => p.id === id), d = n ? Math.hypot(n.x - player.x, n.z - player.z) : null;
        const withMe = c.focus?.partner?.id === id || c.playing?.n?.id === id || (c.chat?.npc === id && !$('chatbox')?.hidden) || c.npc(id)?.ctl?.scriptedBy;
        S.bonds.push({ t: r2(S.simT), npc: id, gain: b.points - before, points: b.points, dist: d === null ? null : r2(d), during: lastMark(), withMe: !!withMe });
        if (d !== null && d > CFG.farBond && !withMe) flag('far-bond', id + '@' + S.samples, { caption: { npc: id, gain: b.points - before, dist: r2(d) }, at: [player.x, player.z] });
      }
    }
    // Economy ledger: every coin/XP change, with the history entries that explain it.
    const e = c.econ;
    if (prevEcon && (e.coins !== prevEcon.coins || e.xp !== prevEcon.xp)) {
      const fresh = []; for (const h of e.history || []) { if (h === prevEcon.head) break; fresh.push({ reason: h.reason, coins: h.coins, xp: h.xp }); }
      const entry = { t: r2(S.simT), dCoins: e.coins - prevEcon.coins, dXp: e.xp - prevEcon.xp, coins: e.coins, xp: e.xp, history: fresh, during: lastMark(), script: c.script, focus: c.focus?.stage || null, game: c.playing?.st?.game || null };
      S.econ.push(entry);
      if (entry.dCoins > 0 && !fresh.some(h => h.coins > 0)) flag('untracked-coin-grant', 'econ@' + S.samples, { caption: entry, at: [player.x, player.z] });
      if (entry.dXp > 0 && !fresh.length) flag('untracked-xp-grant', 'econ@' + S.samples, { caption: entry, at: [player.x, player.z] });
    }
    prevEcon = { coins: e.coins, xp: e.xp, head: (e.history || [])[0] };
    // A light 1 Hz timeline for debugging trajectories.
    if (Math.floor(S.simT) !== S.lastTimeline) { S.lastTimeline = Math.floor(S.simT); S.timeline.push({ t: S.lastTimeline, cam: [r2(cam.x), r2(cam.y), r2(cam.z)], mode, people: vis.map(p => [p.id, r2(p.x), r2(p.z), p.state, p.seatId || '', p.walking ? 1 : 0]) }); }
    closeEpisodes();
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function tick(ms) {
    if (!S.running) return;
    const dt = Math.min(.04, (ms - last) / 1000); last = ms; S.simT += dt; S.frames++;
    try {
      const ps = people(); frameChecks(dt, ps);
      if (ms - S.lastSampleWall >= CFG.sampleMs) { S.lastSampleWall = ms; sample(ps); }
    } catch (e) { if (S.errors.length < 50) S.errors.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]); }
    requestAnimationFrame(tick);
  }

  window.simProbe = {
    CFG, S, mark, people, surfaceAt,
    start(opts = {}) { Object.assign(CFG, opts); staticChecks(); S.running = true; last = performance.now(); S.wall0 = performance.now(); requestAnimationFrame(tick); return S.static; },
    stop() { S.running = false; closeEpisodes(true); },
    takeShots() { const s = S.shots; S.shots = []; return s; },
    summary() {
      const byType = {};
      for (const e of [...S.episodes, ...[...S.open.values()].filter(e => e.counted).map(e => ({ type: e.type, dur: e.last - e.start }))]) { const b = byType[e.type] ||= { episodes: 0, totalSecs: 0 }; b.episodes++; b.totalSecs = r2(b.totalSecs + e.dur); }
      return { simSeconds: r2(S.simT), wallSeconds: r2((performance.now() - S.wall0) / 1000), frames: S.frames, samples: S.samples, fps: r2(S.frames / ((performance.now() - S.wall0) / 1000)), byType, transients: S.transients, errors: S.errors.slice(0, 20) };
    },
    dump() { return { summary: this.summary(), static: S.static, marks: S.marks, episodes: S.episodes, econ: S.econ, bonds: S.bonds, timeline: S.timeline }; },
  };
})();
