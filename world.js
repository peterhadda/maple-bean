// The café as a place you can touch: pick proxies for every interactable
// (seats, desks, plants, game tables, the counter, people), hover feedback,
// plant care and the extra lighting/ceilings of the added rooms.
import * as THREE from 'three';
import { readSaved, save } from './save.js';
import { makeProp } from './assets/characters/runtime.js';

export const VERB = {
  seat: { icon: '🪑', verb: 'Sit' }, read: { icon: '📖', verb: 'Sit & read' }, study: { icon: '📚', verb: 'Study' },
  plant: { icon: '💧', verb: 'Water' }, game: { icon: '🎲', verb: 'Play' }, counter: { icon: '☕', verb: 'Order' },
  npc: { icon: '💬', verb: 'Talk' }, guest: { icon: '👋', verb: 'Say hi' }, stand: { icon: '↑', verb: 'Stand up' },
};
const GAME_NAMES = { chess: 'Chess', xo: 'XO', memory: 'Memory cards', cards: 'Maple Eights', snake: 'Snake arcade', darts: 'Darts' };
export const gameName = id => GAME_NAMES[id] || id;
const PLANT_KEY = 'maple-bean-plants', THIRST_HOURS = 6;

export function createWorld({ scene, layout, staticMeshes }) {
  const proxies = new THREE.Group(); proxies.name = 'Interaction proxies'; scene.add(proxies);
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const down = new THREE.Raycaster(), tmp = new THREE.Vector3();

  // Table/desk heights are measured from the actual furniture, not guessed.
  function surfaceHeight(x, z, maxY = 1.3) {
    down.set(tmp.set(x, maxY, z), new THREE.Vector3(0, -1, 0)); down.far = maxY + .1;
    const hit = down.intersectObjects(staticMeshes, false)[0];
    return hit ? hit.point.y : null;
  }

  // ---- seats (every chair, sofa place, bench and game seat)
  const seats = [];
  for (const s of layout.stations) {
    if (['seat', 'read', 'study'].includes(s.kind)) seats.push({ ...s, station: s });
    if (s.kind === 'game' && s.seats) s.seats.forEach((seat, i) => seats.push({ ...seat, id: s.id + '#' + i, kind: 'game-seat', seatHeight: s.seatHeight ?? .54, station: s, index: i }));
  }
  for (const seat of seats) {
    if (seat.kind === 'study' && !seat.deskHeight) {
      const f = { x: Math.sin(seat.angle), z: Math.cos(seat.angle) };
      seat.deskHeight = surfaceHeight(seat.x + f.x * .5, seat.z + f.z * .5) ?? .77;
    }
    seat.laptop = /^study-room-\d$/.test(seat.id) || seat.id === 'study-1';
  }

  const pickables = [];
  function addProxy(geometry, x, y, z, rot, target) {
    const m = new THREE.Mesh(geometry, hidden); m.position.set(x, y, z); m.rotation.y = rot || 0; m.userData.target = target; proxies.add(m); pickables.push(m); return m;
  }
  for (const seat of seats) {
    if (seat.kind === 'game-seat') continue;
    const tall = seat.kind === 'read' && /sofa|reading/.test(seat.id) ? .7 : .9;
    addProxy(box(.62, tall, .62), seat.x, tall / 2, seat.z, seat.angle, { type: seat.kind === 'study' ? 'study' : seat.kind === 'read' ? 'read' : 'seat', seat, label: seat.label });
    if (seat.kind === 'study') { const f = { x: Math.sin(seat.angle), z: Math.cos(seat.angle) }; addProxy(box(.8, .25, .5), seat.x + f.x * .55, (seat.deskHeight || .77) - .05, seat.z + f.z * .55, seat.angle, { type: 'study', seat, label: seat.shared ? 'The shared study table' : 'A focus desk' }); }
  }
  const counter = layout.stations.find(s => s.kind === 'coffee');
  addProxy(box(5.2, 1.2, 1.1), -3.4, .6, -4.8, 0, { type: 'counter', station: counter, label: 'The coffee bar' });
  for (const g of layout.stations.filter(s => s.kind === 'game')) {
    const size = g.game === 'snake' ? [1.1, 1.9, .9] : g.game === 'darts' ? [.8, .8, .3] : [1.0, .95, 1.0];
    const pos = g.game === 'snake' ? [6.95, .95, g.z] : g.game === 'darts' ? [g.board.x, g.board.y, g.board.z] : [g.x, .47, g.z];
    addProxy(box(...size), ...pos, 0, { type: 'game', station: g, label: gameName(g.game) });
    if (g.game === 'darts') addProxy(box(1.2, .1, .8), g.x, .05, g.z, 0, { type: 'game', station: g, label: 'Dartboard · throw line' });
  }

  // ---- plants: thirst grows over real hours; watering resets it.
  const plantState = readSaved(PLANT_KEY, {});
  const plants = layout.stations.filter(s => s.kind === 'plant').map(s => {
    const saved = plantState[s.id];
    const last = Number.isFinite(saved) ? saved : Date.now() - (.35 + ((s.id.length * 7) % 5) / 10) * THIRST_HOURS * 36e5;
    return { station: s, lastWatered: last };
  });
  const thirst = p => Math.max(0, Math.min(100, (Date.now() - p.lastWatered) / (THIRST_HOURS * 36e5) * 100));
  for (const p of plants) addProxy(new THREE.CylinderGeometry(.38, .3, 1.3, 10), p.station.x, .65, p.station.z, 0, { type: 'plant', plant: p, label: 'Potted plant' });
  function water(p) { p.lastWatered = Date.now(); plantState[p.station.id] = p.lastWatered; save(PLANT_KEY, plantState); }
  const plantMood = p => { const t = thirst(p); return t > 70 ? 'Thirsty' : t > 35 ? 'Could use a drink' : 'Happy and green'; };

  // ---- people: proxies follow characters every frame
  const people = new Map();
  function person(id, type, label) {
    if (people.has(id)) return people.get(id);
    const m = addProxy(box(.55, 1.75, .55), 0, .875, 0, 0, { type, id, label });
    people.set(id, m); return m;
  }
  function placePerson(id, x, z, visible = true) { const m = people.get(id); if (!m) return; m.position.x = x; m.position.z = z; m.visible = false; m.userData.gone = !visible; }
  function removePerson(id) { const m = people.get(id); if (!m) return; proxies.remove(m); pickables.splice(pickables.indexOf(m), 1); people.delete(id); }

  const ray = new THREE.Raycaster();
  function pick(pointer, camera) {
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(pickables, false).filter(h => !h.object.userData.gone);
    // Prefer people over furniture when both are under the cursor.
    const person = hits.find(h => ['npc', 'guest'].includes(h.object.userData.target.type) && h.distance < (hits[0].distance + 1.2));
    const hit = person || hits[0];
    return hit ? { ...hit.object.userData.target, point: hit.point, proxy: hit.object } : null;
  }

  // ---- hover ring: a soft glowing ring under whatever you could use
  const ringMat = new THREE.MeshBasicMaterial({ color: '#f6d89a', transparent: true, opacity: .75, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.36, .43, 40).rotateX(-Math.PI / 2), ringMat); ring.visible = false; ring.renderOrder = 2; scene.add(ring);
  function highlight(target, t = 0) {
    if (!target) { ring.visible = false; return; }
    const p = target.proxy.position; ring.visible = true;
    const r = target.type === 'counter' ? 1.2 : target.type === 'game' && target.station.game !== 'darts' ? .75 : .45;
    ring.scale.setScalar(r / .43 * (1 + .04 * Math.sin(t * 4)));
    ring.position.set(p.x, target.type === 'game' && target.station.game === 'darts' && p.y > 1 ? .02 : .02, target.type === 'game' && target.station.game === 'darts' && p.y > 1 ? target.station.z : p.z);
    if (target.type === 'game' && target.station.game === 'darts' && p.y > 1) ring.position.x = target.station.x;
  }

  // ---- study desks keep a pair of headphones waiting on them
  const deskPhones = new Map();
  for (const seat of seats.filter(s => s.kind === 'study')) {
    const h = makeProp('phones'); const f = { x: Math.sin(seat.angle), z: Math.cos(seat.angle) }, r = { x: -Math.cos(seat.angle), z: Math.sin(seat.angle) };
    h.position.set(seat.x + f.x * .42 + r.x * .26, (seat.deskHeight || .77) + .02, seat.z + f.z * .42 + r.z * .26);
    h.rotation.set(-Math.PI / 2, 0, seat.angle); h.scale.setScalar(.95); scene.add(h); deskPhones.set(seat.id, h);
  }

  // ---- the added rooms: pendant light, ceilings for walking mode, room names
  const extras = new THREE.Group(); extras.name = 'Wing lighting'; scene.add(extras);
  for (const [x, z, c] of [[11.8, -4.2, 0xffc98a], [15.2, -4.2, 0xffc98a], [13.6, -1.95, 0xffd29b], [1.2, -10.6, 0xffc775], [4.0, -10.9, 0xffc775], [6.2, -12.2, 0xffb870]]) {
    const l = new THREE.PointLight(c, 7, 6.5, 2); l.position.set(x, 2.55, z); extras.add(l);
  }
  const ceilParts = (layout.rooms || []).map(r => new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(Math.PI / 2).translate((r.x0 + r.x1) / 2, 3.81, (r.z0 + r.z1) / 2));
  const ceilings = new THREE.Group();
  for (const g of ceilParts) { const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#e2d0af', roughness: 1 })); ceilings.add(m); const sh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide })); sh.castShadow = true; extras.add(sh); }
  ceilings.visible = false; extras.add(ceilings);
  const zones = (layout.rooms || []).map(r => ({ name: r.name, position: new THREE.Vector3((r.x0 + r.x1) / 2, 3.2, (r.z0 + r.z1) / 2) }));

  return {
    seats, plants, pick, highlight, surfaceHeight, person, placePerson, removePerson, water, thirst, plantMood, deskPhones, zones,
    seatById: id => seats.find(s => s.id === id),
    update(t, mode) { ceilings.visible = mode === 'walk'; if (ring.visible) ringMat.opacity = .55 + .25 * Math.sin(t * 4); },
  };
}
