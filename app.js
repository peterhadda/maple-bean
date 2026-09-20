import { createCreator, readProfile, applyProfile } from './systems/creator.js';
import { socialSpot, socialArrived } from './systems/social-approach.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaya as createCharacter, loadCharacters, makeCup } from './assets/characters/runtime.js';
import { polishMaterial, worldUV, addVisualDetails, refineCafe } from './assets/visual-world.js';
import { createLighting } from './systems/lighting.js';
import { cast } from './characters.js';
import { isWalkable, findPath, zoneAt } from './navigation.js';
import { menu, DRINKS, FAVOURITES, buyDrink, sipDrink, resident, updateResident } from './cafe-life.js';
import { createSteam, cupWorldPosition } from './effects.js';
import { randomBrowseLine } from './interactions.js';
import { formatRemaining, formatMinutes, defaultStats, recordSession, statsForDisplay } from './focus.js';
import { CATEGORIES, createProceduralProvider, createLocalFilesProvider, trackAfter, INTEGRATION_NOTES } from './music.js';
import { createSequenceGame, attemptStep, GAMES } from './minigames.js';
import { deriveStatus, statusText, EMOTES, emoteEmoji } from './social.js';
import { readSaved, save, KEYS, defaultSettings } from './save.js';
import * as Econ from './economy.js';
import * as Bond from './relationships.js';
import * as Shop from './shop.js';
import { SESSION_PRESETS, ENTER_STEPS, EXIT_STEPS, studyActivityAt, createFocusClock, focusElapsed, focusRemaining, pauseClock, resumeClock } from './study.js';
import { PERSONAS } from './npc-brain.js';
import { Actor, Script, wait, tickTimers } from './activities.js';
import { createWorld, VERB, gameName } from './world.js';
import { SCENES } from './game-scenes.js';
import { createNpcChat, createMessenger } from './messenger.js';

const $ = id => document.getElementById(id), world = $('world');
const createMaya = options => createCharacter({ ...options, detail: 'game' });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = THREE.Vector3;
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200); }
const persist = (key, value) => save(key, value, () => toast('Browser storage is unavailable. Export your notes before closing.'));
function download(data, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function failure(error) { console.error(error); $('load-message').textContent = 'The café could not open. Start Cafe.cmd must be running, then reload this page.'; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------------------------ renderer & scene (unchanged look)
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); } catch (e) { failure(e); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer:coarse)').matches ? 1.25 : 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; world.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label', '3D café. Click chairs, plants, people and games to use them; WASD to walk.'); renderer.domElement.tabIndex = 0;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d5d6bd'); scene.fog = new THREE.Fog('#d5d6bd', 45, 95);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 150); camera.position.set(22, 22, 28);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .1, 0); controls.enableDamping = true; controls.dampingFactor = .09; controls.maxPolarAngle = Math.PI * .48; controls.minDistance = 2; controls.maxDistance = 52; controls.update();
// Lights (environment, sun, fill, pendant pools, accents, fire) and the time-of-day presets live in systems/lighting.js (A2).
const lighting = createLighting(scene, renderer), { ambient, sun, fill, lamps, fire } = lighting;
new ResizeObserver(() => { const w = world.clientWidth, h = world.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }).observe(world);

// ------------------------------------------------------------------ saved player state
let avatarProfile = readProfile();
let settings = readSaved(KEYS.settings, defaultSettings());
if (!Number.isFinite(settings.volume) || settings.volume < 0 || settings.volume > 100) settings.volume = defaultSettings().volume;
if (!['afternoon', 'evening', 'day'].includes(settings.lighting)) settings.lighting = defaultSettings().lighting;
settings.hints = settings.hints || {};
const oldWallet = readSaved('maple-bean-wallet', null);
let econ = Econ.migrateEconomy(readSaved('maple-bean-economy', null), { legacyWallet: oldWallet });
let cupState = readSaved('maple-bean-drink', { drink: null, sips: 0 });
if (!cupState || (cupState.drink && !Object.hasOwn(menu, cupState.drink)) || !Number.isInteger(cupState.sips)) cupState = { drink: null, sips: 0 };
let wardrobe = readSaved('maple-bean-wardrobe', null); if (!Shop.validWardrobe(wardrobe)) wardrobe = Shop.defaultWardrobe();
let bonds = readSaved('maple-bean-bonds', {}); if (typeof bonds !== 'object' || !bonds) bonds = {};
let focusStats = readSaved(KEYS.focusStats, defaultStats());
let notifications = readSaved('maple-bean-notifications', []); if (!Array.isArray(notifications)) notifications = [];
const saveEcon = () => persist('maple-bean-economy', econ), saveCup = () => persist('maple-bean-drink', cupState);

// ------------------------------------------------------------------ QA clock (real time; ?qa lets tests speed it up)
const qa = new URLSearchParams(location.search).has('qa');
const clock = { scale: 1, base: Date.now(), real: Date.now() };
const nowMs = () => clock.base + (Date.now() - clock.real) * clock.scale;
function setTimeScale(s) { clock.base = nowMs(); clock.real = Date.now(); clock.scale = s; }

// ------------------------------------------------------------------ HUD
function updateHUD(bump) {
  $('coins').textContent = '🍁 ' + econ.coins; if (bump) { $('coins').classList.remove('bump'); void $('coins').offsetWidth; $('coins').classList.add('bump'); }
  const lv = Econ.levelFor(econ.xp); $('level-badge').textContent = 'Lv ' + lv.level; $('xp-bar').style.width = (lv.into / lv.need * 100) + '%';
}
function setActivity(text) { $('activity').textContent = text; }
function notify(text, kind = 'info', show = true) {
  notifications.unshift({ text, kind, at: Date.now(), read: false }); notifications = notifications.slice(0, 40); persist('maple-bean-notifications', notifications);
  $('notifications-badge').hidden = !notifications.some(n => !n.read); if (show) toast(text);
}
function reward(eyebrow, title, lines = []) {
  $('reward-eyebrow').textContent = eyebrow; $('reward-title').textContent = title; $('reward-lines').innerHTML = lines.map(esc).join('<br>');
  $('reward').hidden = false; clearTimeout(reward.t); reward.t = setTimeout(() => $('reward').hidden = true, 3600); blip('chime');
}
function grant(result, what) {
  if (!result?.reward) return null; econ = result.state; saveEcon(); updateHUD(true);
  if (result.reward.coins) notify(`+${result.reward.coins} Maple Coins · ${what}`, 'coins', false);
  return result.reward;
}
// Context actions: a small row of verbs for what you can do right now.
function setContext(actions) {
  const box = $('context'); const key = actions.map(a => a.label).join('|'); if (box.dataset.key === key) return; box.dataset.key = key; box.replaceChildren();
  for (const a of actions) { const b = document.createElement('button'); b.innerHTML = esc(a.label) + (a.key ? '<kbd>' + a.key + '</kbd>' : ''); if (a.primary) b.className = 'primary-action'; b.onclick = e => { e.stopPropagation(); a.run(); }; box.append(b); }
}
function hint(id, text, seconds = 7) {
  if (settings.hints[id]) return; settings.hints[id] = true; persist(KEYS.settings, settings);
  const h = $('hint'); h.textContent = text; h.hidden = false; h.classList.remove('fade'); clearTimeout(hint.t); hint.t = setTimeout(() => { h.classList.add('fade'); setTimeout(() => h.hidden = true, 700); }, seconds * 1000);
}

// ------------------------------------------------------------------ relationships
const bondStore = {
  get(id) { return bonds[id] ||= Bond.defaultBond(); },
  points(id) { return this.get(id).points; },
  label(id) { const b = this.get(id); const l = Bond.levelOf(b.points).label, c = Bond.crushLabel(b); return c ? l + ' · 💛 ' + c : l; },
  remember(id, fact) { bonds[id] = Bond.remember(this.get(id), fact); persist('maple-bean-bonds', bonds); },
  add(id, kind) {
    const r = Bond.gain(this.get(id), kind, nowMs()); bonds[id] = r.bond; persist('maple-bean-bonds', bonds);
    if (r.levelUp) notify(`${PERSONAS[id].name} now sees you as a ${r.levelUp.label.toLowerCase()} ✨`, 'bond');
    return r.gained;
  },
};

// ------------------------------------------------------------------ network
let session, network, sessionDead = false;
async function api(data) {
  const response = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, id: session?.id, token: session?.token }) });
  const result = await response.json();
  if (response.status === 401 && !sessionDead) { sessionDead = true; toast('The café connection ended. Reload the page to reconnect with others.'); }
  if (!response.ok) throw new Error(result.error || 'The café connection was interrupted.'); return result;
}

// ------------------------------------------------------------------ world labels (bubbles, reactions, room names)
const markers = [];
function worldLabel(text, position, className = '', ms = 0) {
  const el = document.createElement('div'); el.className = 'world-label ' + className; el.textContent = text; $('labels').append(el);
  const m = { el, position }; markers.push(m);
  if (ms) setTimeout(() => { el.remove(); markers.splice(markers.indexOf(m), 1); }, ms);
  return m;
}
function say(position, text, ms = 3200) { return worldLabel(text, position.clone().add(new V(0, 2.05, 0)), 'bubble', ms); }
function showReaction(position, emoji) { worldLabel(emoji, position.clone(), 'reaction', 1800); }

// ------------------------------------------------------------------ café geometry
const obstructions = [], staticMeshes = [], beams = new THREE.Group();
const collisionGroup = new THREE.Group(); collisionGroup.visible = false; scene.add(collisionGroup, beams);
let visualDetails;
function addCafe(root) {
  root.updateMatrixWorld(true); const batches = new Map();
  refineCafe(root, scene);
  root.traverse(o => {
    if (!o.isMesh || o.userData.replaced || /Broad_living_leaf|Plant_frond/.test(o.name)) return;
    if (o.name === 'Menu_welcome') o.matrixWorld.elements[13] -= .34;
    if (/Garden_backdrop/.test(o.name)) { o.material = new THREE.MeshStandardMaterial({ color: '#899578', roughness: 1 }); }
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const a of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(a)) geometry.deleteAttribute(a);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    worldUV(geometry); polishMaterial(o.material);
    const g = geometry.index ? geometry.toNonIndexed() : geometry; if (g !== geometry) geometry.dispose();
    const overhead = /Ceiling_beam/.test(o.name);
    const obstruction = /Left_plaster|Right_plaster|Wing_plaster|Wing_door_lintel|Wing_window|Maple_Bean_marquee|Pine_awning|Awning_valance|Entrance_door_jamb|Cream_window_upright|Window_slender_mullion|Back_plaster|Bookcase_oak_frame/.test(o.name) ? o.name.replace(/\.\d+$|_\d+$/, '') + (/Wing|Back|Right|Left/.test(o.name) ? Math.round(o.matrixWorld.elements[12]) + ':' + Math.round(o.matrixWorld.elements[14]) : '') : '';
    const mat = o.material, key = mat.uuid + overhead + obstruction;
    if (!batches.has(key)) batches.set(key, { mat, parts: [], overhead, obstruction }); batches.get(key).parts.push(g);
  });
  for (const { mat, parts, overhead, obstruction } of batches.values()) {
    const geometry = mergeGeometries(parts), m = new THREE.Mesh(geometry, obstruction ? mat.clone() : mat); parts.forEach(g => g.dispose());
    if (obstruction) { geometry.computeBoundingBox(); m.userData.sightBounds = geometry.boundingBox.clone().expandByScalar(.25); obstructions.push(m); }
    m.castShadow = true; m.receiveShadow = true; (overhead ? beams : scene).add(m); if (!overhead) staticMeshes.push(m);
  }
}

// ------------------------------------------------------------------ camera: modes and activity framing
let mode = 'overview', cameraTween = null, framing = null;
const player = new V(0, 0, 8.3), previousPlayer = player.clone();
function insideCafe(x, z, margin) {
  if (Math.abs(x) <= 9.88 - margin && Math.abs(z) <= 6.88 - margin) return true;
  return (layout?.rooms || []).some(r => x >= r.x0 + .12 + margin && x <= r.x1 - .12 - margin && z >= r.z0 + .12 + margin && z <= r.z1 - .12 - margin) || (layout?.doors || []).some(d => x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1);
}
function tweenCamera(position, target, seconds = 1.2) { cameraTween = { from: camera.position.clone(), to: position.clone(), fromTarget: controls.target.clone(), target: target.clone(), t: 0, seconds }; }
function followOffset() { const narrow = world.clientWidth < 600; return new V(narrow ? .4 : 2.4, narrow ? 1.9 : 2.1, narrow ? 3.2 : 3.6); }
function cameraMode(next) {
  mode = next; framing = null; document.body.classList.toggle('walking', mode === 'walk'); document.body.classList.toggle('floor-plan', mode === 'plan');
  $('welcome').hidden = mode !== 'overview'; $('locations').hidden = mode !== 'overview';
  visualDetails?.update(performance.now() / 1000, mode); cafeWorld?.update(0, mode);
  for (const id of ['overview', 'walk', 'plan']) $(id).classList.toggle('selected', id === mode);
  const narrow = world.clientWidth < 600;
  const target = mode === 'walk' ? player.clone().add(new V(0, 1, 0)) : new V(2.5, .15, -2.5);
  const position = mode === 'walk' ? player.clone().add(followOffset()) : mode === 'plan' ? new V(20, 30, 22).multiplyScalar(narrow ? 1.5 : 1) : new V(21, 20, 22).multiplyScalar(narrow ? 1.55 : 1);
  tweenCamera(position, target, 1.1);
  controls.maxPolarAngle = mode === 'plan' ? .85 : Math.PI * .48; controls.enablePan = mode !== 'walk'; controls.minDistance = mode === 'walk' ? 1.2 : 10; controls.maxDistance = mode === 'walk' ? 10 : 70;
  beams.visible = mode === 'overview' && $('show-beams').checked; previousPlayer.copy(player);
}
// Activity framing: the camera eases in toward the desk, board or friend and
// then stays still (you can still orbit); `release` eases back behind you.
function frame(position, target, seconds = 1.4) {
  if (mode !== 'walk') { mode = 'walk'; document.body.classList.add('walking'); $('welcome').hidden = true; $('locations').hidden = true; for (const id of ['overview', 'walk', 'plan']) $(id).classList.toggle('selected', id === 'walk'); }
  framing = { position, target }; controls.minDistance = .5; controls.enablePan = false; tweenCamera(position, target, seconds);
}
function release(seconds = 1.3) { if (!framing) return; framing = null; controls.minDistance = 1.2; tweenCamera(player.clone().add(followOffset()), player.clone().add(new V(0, 1, 0)), seconds); }
controls.addEventListener('start', () => { cameraTween = null; });

// ------------------------------------------------------------------ globals filled at load
let layout, cafeWorld, maya, me, playerCtl, mara, regulars = [], counterTop = 1.0;
const remote = new Map(), occupiedSeats = new Set();
const steam = createSteam(scene);
let script = null;                 // the player's current scripted activity
let playing = null;                // active mini-game session
let focus = null;                  // active study session
let hanging = null, talking = null; // hangout / conversation partner
const tableCups = new Map();
function tableCup(key, seat, color, show) {
  let c = tableCups.get(key); if (!c) { c = makeCup(); scene.add(c); tableCups.set(key, c); }
  c.visible = !!(show && seat); if (!c.visible) return;
  const f = new V(Math.sin(seat.angle), 0, Math.cos(seat.angle)), r = new V(-f.z, 0, f.x), y = seat.deskHeight ?? seat.station?.tableHeight ?? .79;
  c.position.set(seat.x, y + .039, seat.z).addScaledVector(f, seat.kind === 'game-seat' ? .5 : .36).addScaledVector(r, -.24); c.userData.liquid.material.color.set(color || '#b98552');
}
let sipUntil = 0, waveUntil = 0, expressionUntil = 0, playerExpression = null;
function startScript(name) { script?.cancel(); script = new Script(name); return script; }

// ------------------------------------------------------------------ dressing the avatar
function dress(look = Shop.lookFor(wardrobe)) { if (!maya) return; maya.setTints({ top: look.top, bottom: look.bottom, shoes: look.shoes, hair: look.hairColor }); maya.setHairStyle(look.hair === 'maya' ? avatarProfile.base : look.hair); maya.setAccessories(look.props); applyProfile(maya, avatarProfile); }

// The creator reuses the current authored avatars and owned wardrobe.
const creator = createCreator({
  getWardrobe: () => wardrobe, getUnlocked: () => econ.unlocked,
  onSave: async (profile, selected) => {
    await api({ action: 'rename', name: profile.name });
    const replacement = createCharacter({ ...cast[profile.base], detail: 'game', customizable: true });
    replacement.group.position.copy(maya.group.position); replacement.group.rotation.copy(maya.group.rotation);
    scene.remove(maya.group); maya = replacement; scene.add(maya.group);
    avatarProfile = profile; wardrobe = selected; dress();
    persist('maple-bean-wardrobe', wardrobe); persist(KEYS.name, profile.name);
    session.name = profile.name; $('player-name').textContent = profile.name; $('avatar-initial').textContent = profile.name[0].toUpperCase();
    cameraMode('walk'); toast('Welcome, ' + profile.name + '. Your look is saved.');
  },
});
function openCreator() {
  if (!maya || !session) return;
  if (focus || playing || playerCtl.arrive || playerCtl.busy || pendingOrder) return toast('Finish your current activity before changing your look.');
  keys.clear(); script?.cancel(); playerCtl.stop(); closeShop(); closeNpcMenu(); $('menu').hidden = true;
  creator.open({ ...avatarProfile, name: session.name });
}
$('create-character').onclick = $('customize-character').onclick = openCreator;

// ------------------------------------------------------------------ seats & occupancy
function seatTaken(seat) {
  if (occupiedSeats.has(seat.id)) return true;
  return regulars.some(n => n.life && (n.life.seat?.id === seat.id) || n.ctl.seat?.id === seat.id || n.ctl.reservedSeat?.id === seat.id);
}
function freeSeats(filter) { return cafeWorld.seats.filter(s => filter(s) && !seatTaken(s) && playerCtl.seat?.id !== s.id); }

async function sitPlayer(seat, s = script) {
  if (seatTaken(seat)) {
    const n = regulars.find(n => n.life?.seat?.id === seat.id && ['to-seat'].includes(n.life.phase));
    if (!n) { toast('That seat is taken. Try another.'); return false; }
    Object.assign(n.life, { seat: null, route: [], phase: 'idle', timer: 6 });
  }
  if (playerCtl.posture === 'seated' && !(await standPlayer())) return false;
  if (!(await playerCtl.goTo(seat.approach[0], seat.approach[1])) || !s?.ok()) return false;
  try { await api({ action: 'move', x: me.x, z: me.z, angle: me.angle }); await api({ action: 'sit', seatId: seat.id }); } catch (e) { toast(e.message); return false; }
  const ok = await playerCtl.sitOn(seat, { seats: cafeWorld.seats, occupied: occupiedSeats, script: s });
  if (!ok) api({ action: 'stand' }).catch(() => {});
  if (ok) setActivity(seat.kind === 'study' ? 'At a quiet desk' : seat.kind === 'read' ? 'One more chapter…' : seat.kind === 'game-seat' ? 'At the ' + gameName(seat.station.game) + ' table' : 'Settled in. No hurry.');
  return ok;
}
async function standPlayer() {
  if (playerCtl.posture !== 'seated' && playerCtl.posture !== 'sitting') return playerCtl.posture === 'stand';
  if (!(await playerCtl.standUp())) { toast('Someone is beside your chair. Try again when there is room.'); return false; }
  api({ action: 'stand' }).catch(() => {}); setActivity('Taking a little wander'); return true;
}

// ------------------------------------------------------------------ barista service (Mara makes, places and slides every drink)
const serviceQueue = [];
let counterCup = null, pendingOrder = null;
function orderFor(customer, drink, x) {
  let ready, taken; const job = { customer, drink, x: THREE.MathUtils.clamp(x, -5.6, -1.4), ready: new Promise(r => ready = r), taken: new Promise(r => taken = r) };
  job.markReady = ready; job.markTaken = taken; serviceQueue.push(job); return job;
}
function faceAngle(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
const localTo = (avatar, point) => avatar.group.worldToLocal(point.clone());
async function baristaLoop() {
  for (;;) {
    if (!serviceQueue.length) { await wait(.4); if (!serviceQueue.length && Math.hypot(mara.ctl.x + 4.7, mara.ctl.z + 5.75) > .1 && !mara.ctl.route.length) { await mara.ctl.goTo(-4.7, -5.75); mara.ctl.face = 0; } continue; }
    const job = serviceQueue.shift();
    await mara.ctl.goTo(-6.25, -5.75); mara.ctl.face = faceAngle(mara.ctl, { x: -6.9, z: -4.7 }); await wait(.4);
    for (let i = 0; i < 2; i++) { await mara.ctl.reachTo(localTo(mara.avatar, new V(-6.8, 1.12, -4.95)), { side: 1, shape: 'grip', seconds: 1.1 }); await wait(.55); }
    mara.drink = job.drink; await wait(.3);
    await mara.ctl.goTo(job.x, -5.75); mara.ctl.face = 0; await wait(.35);
    const place = new V(job.x, counterTop, -5.28);
    await mara.ctl.reachTo(localTo(mara.avatar, place.clone().add(new V(0, .04, 0))), { side: 1, shape: 'grip', seconds: .9, contact: .55 });
    mara.drink = null; counterCup.visible = true; counterCup.userData.liquid.material.color.set(DRINKS[job.drink].color); counterCup.position.copy(place);
    say(mara.avatar.group.position, job.drink + ' for ' + (job.customer === 'player' ? session?.name || 'you' : PERSONAS[job.customer.id]?.name) + '!', 2600);
    const to = new V(job.x, counterTop, -4.42); await wait(.3);
    { const a = counterCup.position.clone(); const start = performance.now(); for (;;) { await wait(0); const k = Math.min(1, (performance.now() - start) / 550); counterCup.position.lerpVectors(a, to, k * k * (3 - 2 * k)); if (k >= 1) break; } }
    job.markReady(to);
    await Promise.race([job.taken, wait(25)]); counterCup.visible = false;
    await wait(.5);
  }
}
// A customer steps up, reaches for the cup on the counter and takes it.
async function takeCup(ctl, avatar, job, s) {
  if (!(await ctl.stepTo(job.x, -3.99, .7))) { job.markTaken(); return false; } ctl.face = Math.PI; if (s && !s.ok()) return false;
  const at = await job.ready; if (s && !s.ok()) { job.markTaken(); return false; }
  await ctl.reachTo(localTo(avatar, at.clone().add(new V(0, .045, 0))), { side: 1, shape: 'grip', seconds: .9, contact: .5 });
  job.markTaken(); counterCup.visible = false; return !s || s.ok();
}

// ------------------------------------------------------------------ ordering (player)
function openDialog(html) { $('dialog-content').innerHTML = html; if (!$('dialog').open) $('dialog').showModal(); }
$('dialog-close').onclick = () => $('dialog').close();
$('dialog').addEventListener('click', e => { if (e.target === $('dialog')) { const r = $('dialog').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('dialog').close(); } });
async function orderAtCounter() {
  const s = startScript('order'); const coffee = layout.stations.find(x => x.kind === 'coffee');
  if (playerCtl.posture !== 'stand' && !(await standPlayer())) return;
  const slot = [coffee.approach[0], -4.1, -2.7, -1.6, -5.4].map(x => ({ x, z: coffee.approach[1] })).find(p => isWalkable(p.x, p.z, layout) && !(layout.people || []).some(q => q !== me && q.visible !== false && Math.hypot(q.x - p.x, q.z - p.z) < .65));
  if (!slot) return toast('The counter is busy — try again in a moment.');
  if (!(await playerCtl.goTo(slot.x, slot.z)) || !s.ok()) return;
  playerCtl.face = Math.PI;
  if (cupState.drink) { toast('Finish your ' + cupState.drink.toLowerCase() + ' first — Mara will happily make another.'); return; }
  const cheapest = Math.min(...Object.values(menu)), freebie = Econ.freeDrinkAvailable(econ, cheapest);
  openDialog(`<section class="coffee-menu" aria-labelledby="coffee-menu-title"><header class="coffee-menu-heading"><div class="coffee-menu-mark" aria-hidden="true">☕</div><div><div class="eyebrow">MAPLE BEAN · MARA’S COFFEE BAR</div><h2 id="coffee-menu-title">A little cup of comfort.</h2><p>${freebie ? 'Running low? Your first cup is on the house today.' : 'Made with care. Pick something warm and stay a while.'}</p></div></header><div class="coffee-menu-meta"><span>Freshly made, just for you</span><span class="coffee-balance"><span aria-hidden="true">🍁</span> ${econ.coins} Maple Coins</span></div><div class="order-grid">${Object.entries(menu).map(([name, price]) => `<button class="coffee-choice" data-order="${esc(name)}"><span class="coffee-choice-icon" aria-hidden="true">${DRINKS[name].emoji}</span><span class="coffee-choice-copy"><strong>${esc(name)}</strong><small>${esc(DRINKS[name].note)}</small></span><b class="coffee-price">${freebie ? 'On us' : price + ' <span aria-hidden="true">🍁</span><span class="sr-only"> Maple Coins</span>'}</b></button>`).join('')}</div><label class="coffee-help"><input type="checkbox" id="help-mara"><span><strong>Lend Mara a hand</strong><small>Help make your drink and earn a little XP.</small></span><span aria-hidden="true">♡</span></label><p class="coffee-menu-foot">Three good sips. One lovely little break.</p></section>`);
  document.querySelectorAll('[data-order]').forEach(b => b.onclick = async () => {
    if (!s.ok() || b.disabled) return;
    const name = b.dataset.order; let orderId;
    try {
      const charged = Econ.chargeOrder(econ, { drink: name, price: menu[name], free: freebie });
      econ = charged.state; orderId = charged.orderId;
      const paid = charged.free ? 0 : menu[name]; pendingOrder = orderId;
      s.onCancel(() => { if (pendingOrder === orderId) { econ = { ...econ, coins: Math.min(Econ.TUNING.maxCoins, econ.coins + paid) }; pendingOrder = null; saveEcon(); updateHUD(); setActivity('Back to the café'); } });
      document.querySelectorAll('[data-order]').forEach(button => button.disabled = true);
      saveEcon(); updateHUD(true);
    } catch (e) { toast(e.message); return; }
    const helping = $('help-mara').checked; $('dialog').close();
    if (helping) await helpMake(name, orderId);
    if (!s.ok()) return;
    setActivity('Waiting for a ' + name.toLowerCase()); waveUntil = performance.now() / 1000 + 1.2; say(mara.avatar.group.position, 'One ' + name.toLowerCase() + ', coming right up.');
    const job = orderFor('player', name, me.x); s.onCancel(() => job.markTaken());
    if (await takeCup(playerCtl, maya, job, s) && s.ok()) {
      pendingOrder = null; cupState = { drink: name, sips: 3 }; saveCup(); grant(Econ.awardOnce(econ, 'order', name), 'served ' + name.toLowerCase()); setActivity('A fresh ' + name.toLowerCase() + ' in hand'); blip('cup');
      hint('sip', 'Tip: take a sip with R — or just find a seat and enjoy it.');
    } else if (s.ok()) { s.cancel(); toast('The counter is busy. Your coins were returned.'); }
  });
}
// The original coffee-making steps remain, now as an optional way to help out.
function helpMake(name, orderId) {
  return new Promise(done => {
    const spec = GAMES['coffee-making']; let game = createSequenceGame(spec.steps);
    openDialog('<div class="eyebrow">HELPING WITH YOUR ' + esc(name.toUpperCase()) + '</div><h2>' + spec.title + '</h2><p class="muted">Click each step in order.</p><div class="game-steps">' + spec.steps.map(s => '<button data-step="' + s.id + '"><span>' + s.emoji + '</span>' + s.label + '</button>').join('') + '</div><p id="step-status" class="muted"></p>');
    $('dialog').addEventListener('close', () => done(), { once: true });
    document.querySelectorAll('.game-steps button').forEach(b => b.onclick = () => {
      const before = game.index; game = attemptStep(game, b.dataset.step);
      if (game.index > before) { b.disabled = true; b.classList.add('done'); } else { b.classList.add('miss'); setTimeout(() => b.classList.remove('miss'), 300); }
      if (game.done) { $('step-status').textContent = 'Beautiful. Mara will finish it off.'; grant(Econ.awardHelp(econ, orderId), 'helping Mara'); blip('cup'); setTimeout(() => $('dialog').close(), 700); }
    });
  });
}

// ------------------------------------------------------------------ plants
async function waterPlant(p) {
  const s = startScript('water'); const st = p.station;
  if (playerCtl.posture !== 'stand' && !(await standPlayer())) return;
  if (!(await playerCtl.goTo(st.approach[0], st.approach[1])) || !s.ok()) return;
  playerCtl.face = faceAngle(me, st); await wait(.4); if (!s.ok()) return;
  playerCtl.activity = 'water'; setActivity('Watering a plant');
  const drops = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(60 * 3), 3)), new THREE.PointsMaterial({ color: '#9fd2e6', size: .025, transparent: true, opacity: .8 }));
  scene.add(drops); const seeds = [...Array(60)].map(() => Math.random());
  const start = performance.now();
  while (performance.now() - start < 2400 && s.ok()) {
    await wait(0); const t = (performance.now() - start) / 1000, spout = maya.handWorld(-1).add(new V(Math.sin(me.angle) * .22, -.02, Math.cos(me.angle) * .22)), pos = drops.geometry.attributes.position;
    seeds.forEach((r, i) => { const k = ((t * 1.6 + r) % 1); pos.setXYZ(i, spout.x + (st.x - spout.x) * k * .8 + (r - .5) * .03, spout.y - k * k * (spout.y - .55), spout.z + (st.z - spout.z) * k * .8); }); pos.needsUpdate = true;
  }
  scene.remove(drops); playerCtl.activity = null; if (!s.ok()) return;
  cafeWorld.water(p); showReaction(new V(st.x, 1.6, st.z), '🌿');
  const r = grant(Econ.awardOnce(econ, 'water', st.id), 'watered a plant');
  toast(r ? 'The plant perks right up. 🌿 +' + r.coins + ' coins' : 'The plant perks right up. 🌿'); setActivity('Tending the café garden');
}

// ------------------------------------------------------------------ study mode
const TASK_LABEL = { type: 'Typing notes', read: 'Reading', write: 'Writing notes', sip: 'A warm sip', think: 'Thinking it through', glance: 'A quick smile', ears: 'Adjusting headphones', stretch: 'A good stretch' };
function studyFrame(seat) {
  const f = new V(Math.sin(seat.angle), 0, Math.cos(seat.angle)), r = new V(-f.z, 0, f.x), base = new V(seat.x, 0, seat.z);
  return { position: base.clone().addScaledVector(f, -.95).addScaledVector(r, .75).add(new V(0, 1.62, 0)), target: base.clone().addScaledVector(f, .42).add(new V(0, (seat.deskHeight || .77) + .12, 0)) };
}
function chooseDuration(title) {
  return new Promise(resolve => {
    openDialog(`<div class="eyebrow">FOCUS MODE · STUDY STREAK ${Econ.streakView(econ)} 🔥</div><h2>${esc(title)}</h2><p>Headphones on, one task. Complete a session to earn Maple Coins — ending early keeps your minutes but no coins.</p><div class="duration-grid">${SESSION_PRESETS.map(m => `<button data-min="${m}">${m}<small>min · ${Econ.studyReward(m).coins} 🍁</small></button>`).join('')}</div><label style="font-size:11px;color:#7f846e">Custom minutes <input id="custom-min" type="number" min="5" max="180" placeholder="e.g. 45" style="width:90px;display:inline-block;margin-left:6px"></label> <button id="custom-go" class="secondary" style="width:auto">Start</button>`);
    let picked = null;
    document.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { picked = +b.dataset.min; $('dialog').close(); });
    $('custom-go').onclick = () => { const m = Math.round(+$('custom-min').value); if (m >= 5 && m <= 180) { picked = m; $('dialog').close(); } };
    $('dialog').addEventListener('close', () => resolve(picked), { once: true });
  });
}
async function studyAt(seat, partner = null) {
  const s = startScript('study');
  if (!(playerCtl.posture === 'seated' && playerCtl.seat?.id === seat.id)) { if (!(await sitPlayer(seat, s))) { if (partner) releaseNpc(partner); return; } }
  if (!s.ok()) return;
  setContext([{ label: '📚 Study', primary: true, key: 'E', run: () => beginFocus(seat, partner) }, { label: 'Stand up', run: () => { if (partner) releaseNpc(partner); startScript('stand'); standPlayer(); } }]);
  hint('study', 'Choose Study to start a focus session at this desk.');
  if (partner) beginFocus(seat, partner);
}
async function beginFocus(seat, partner) {
  const minutes = await chooseDuration(partner ? 'Study with ' + PERSONAS[partner.id].name : 'Ready to focus?'); if (!minutes) return;
  const s = startScript('focus'); document.body.classList.add('focusing');
  focus = { id: Econ.eventId(), seat, partner, minutes, clock: null, stage: 'enter', task: null, sipped: -1, script: s };
  const f = studyFrame(seat); frame(f.position, f.target, 1.6);
  $('focus-hud').hidden = false; $('focus-timer').textContent = formatRemaining(minutes * 60); $('focus-task').textContent = 'Settling in'; $('focus-pause').textContent = 'Pause'; $('focus-pause').setAttribute('aria-pressed', 'false'); $('focus-timer').classList.remove('paused');
  setContext([]);
  const phones = cafeWorld.deskPhones.get(seat.id), f3 = new V(Math.sin(seat.angle), 0, Math.cos(seat.angle));
  for (const step of ENTER_STEPS) {
    if (!s.ok()) return;
    playerCtl.headphones = step.headphones === 'desk' ? false : step.headphones;
    if (step.id === 'pickup' && phones) { await playerCtl.reachTo(localTo(maya, phones.position), { side: -1, shape: 'grip', seconds: step.seconds, contact: .6 }); phones.visible = false; playerCtl.headphones = 'hands'; }
    else if (step.id === 'phones-on') { playerCtl.activity = 'ears'; await wait(step.seconds); playerCtl.headphones = 'head'; playerCtl.activity = null; }
    else if (step.id === 'open-laptop') { if (seat.laptop) await playerCtl.reachTo(localTo(maya, new V(seat.x, seat.deskHeight + .1, seat.z).addScaledVector(f3, .5)), { side: -1, shape: 'flat', seconds: step.seconds }); else await wait(.3); }
    await wait(.15);
  }
  if (!s.ok()) return;
  focus.clock = createFocusClock(minutes, nowMs()); focus.stage = 'study'; setActivity('Focusing · ' + minutes + ' min');
  if (partner) { say(partner.avatar.group.position, 'Headphones on. Let’s do this.', 2400); bondStore.add(partner.id, 'study-together'); }
  hint('focus', 'Focus Mode: the timer runs in real time. Tap the timer to pause.');
}
function studyTaskFor(elapsed, who, offset = 0) {
  const hasDrink = who === 'me' ? !!cupState.drink : false;
  const a = studyActivityAt(elapsed, { offset, hasDrink, partner: !!focus?.partner }).activity;
  return a;
}
async function endFocus(completed) {
  if (!focus || focus.stage === 'exit') return; const f = focus; f.stage = 'exit';
  const focusedSeconds = f.clock ? focusElapsed(f.clock, nowMs()) : 0;
  $('focus-hud').hidden = true; $('focus-music').hidden = true; stopMusic();
  playerCtl.activity = null;
  const phones = cafeWorld.deskPhones.get(f.seat.id), f3 = new V(Math.sin(f.seat.angle), 0, Math.cos(f.seat.angle));
  if (f.seat.laptop) await playerCtl.reachTo(localTo(maya, new V(f.seat.x, f.seat.deskHeight + .1, f.seat.z).addScaledVector(f3, .5)), { side: -1, shape: 'flat', seconds: 1 });
  playerCtl.activity = 'ears'; playerCtl.headphones = 'head'; await wait(.6); playerCtl.headphones = 'hands'; await wait(.6); playerCtl.activity = null;
  if (phones) { await playerCtl.reachTo(localTo(maya, phones.position), { side: -1, shape: 'grip', seconds: .8, contact: .6 }); phones.visible = true; }
  playerCtl.headphones = false;
  if (focusedSeconds >= 60) { focusStats = recordSession(focusStats, focusedSeconds / 60); persist(KEYS.focusStats, focusStats); }
  const result = Econ.awardStudy(econ, { id: f.id, minutes: f.minutes, focusedSeconds, completed }, new Date(nowMs()));
  econ = result.state; saveEcon(); updateHUD(!!result.reward);
  if (f.partner) { if (completed) bondStore.add(f.partner.id, 'study-together'); say(f.partner.avatar.group.position, completed ? 'That was a good session!' : 'Good effort. Same time tomorrow?', 2600); }
  await standPlayer(); if (f.partner) releaseNpc(f.partner);
  document.body.classList.remove('focusing'); release(); focus = null; setActivity(completed ? 'Fresh from a focus session' : 'Taking a break');
  if (result.reward) {
    const lines = ['+' + result.reward.xp + ' XP', '🔥 Study streak · ' + result.reward.streakDays + (result.reward.streakDays === 1 ? ' day' : ' days'), ...result.reward.bonuses.map(b => '✨ ' + b.label + (b.coins ? ' +' + b.coins : ''))];
    reward('FOCUS COMPLETE', '+' + result.reward.coins + ' Maple Coins', lines);
    notify('Focus complete: +' + result.reward.coins + ' Maple Coins', 'coins', false);
    for (const b of result.reward.bonuses) if (b.id === 'five-day') notify('Unlocked the Scholar’s Scarf in your wardrobe 🧣', 'unlock', false);
  } else toast(completed ? 'Session complete.' : `Session ended after ${formatMinutes(focusedSeconds / 60)}. Coins are for completed sessions.`);
}
$('focus-exit').onclick = () => endFocus(false);
$('focus-pause').onclick = $('focus-timer').onclick = () => { if (!focus?.clock) return; focus.clock = focus.clock.pausedAt !== null ? resumeClock(focus.clock, nowMs()) : pauseClock(focus.clock, nowMs()); const paused = focus.clock.pausedAt !== null; $('focus-timer').classList.toggle('paused', paused); $('focus-pause').textContent = paused ? 'Resume' : 'Pause'; $('focus-pause').setAttribute('aria-pressed', String(paused)); $('focus-task').textContent = paused ? 'Paused · take a breath' : TASK_LABEL[focus.task] || 'Focusing'; };
$('focus-music-open').onclick = () => { $('focus-music').hidden = !$('focus-music').hidden; renderFocusStats(); };

// ------------------------------------------------------------------ regulars under a script
function claimNpc(n) {
  if (!npcAvailable(n)) return false;
  const l = n.life;
  l.scripted = true; n.ctl.scriptedBy = true; n.ctl.stop();
  // Hand the resident's current pose over to the script without a jump.
  if (['seated', 'sitting-down'].includes(l.phase) && l.seat) { n.ctl.seat = l.seat; n.ctl.entry = l.entry; n.ctl.posture = 'seated'; n.ctl.sit = 1; }
  else { n.ctl.posture = 'stand'; n.ctl.sit = 0; n.ctl.seat = null; }
  l.route = []; return true;
}
async function releaseNpc(n) {
  if (!n.ctl.scriptedBy) return;
  n.ctl.stop(); n.ctl.reservedSeat = null;
  n.ctl.activity = null; n.ctl.reach = null; n.ctl.lookTarget = null; n.headphones = false;
  if ((n.ctl.posture === 'seated' || n.ctl.posture === 'sitting') && !(await n.ctl.standUp())) {
    Object.assign(n.life, { scripted: false, seat: n.ctl.seat, entry: n.ctl.entry, sit: 1, phase: 'seated', timer: 3 });
    Object.assign(n.ctl, { scriptedBy: false, seat: null, entry: null, posture: 'stand', sit: 0 }); return;
  }
  const l = n.life; n.ctl.scriptedBy = false; l.scripted = false; l.seat = null; l.entry = null; l.sit = 0; l.cup = false;
  l.route = findPath(l, { x: 0, z: 8.5 }, layout); l.phase = l.route.length ? 'leaving' : 'idle'; l.timer = 4;
}
const npcById = id => regulars.find(n => n.id === id);
function npcAvailable(n) { if (!n || n.id === 'mara') return false; const l = n.life; return !!l && l.visible && !n.ctl.scriptedBy && !['away', 'leaving', 'to-counter', 'ordering', 'sitting-down', 'standing-up'].includes(l.phase); }

// ------------------------------------------------------------------ conversations
const chat = createNpcChat({
  api, bonds: bondStore,
  context: id => ({ activity: npcActivityText(npcById(id)), timeOfDay: $('lighting').value === 'evening' ? 'the evening' : 'the afternoon', levelLabel: Bond.levelOf(bondStore.points(id)).label, level: Bond.levelOf(bondStore.points(id)).id, crush: bondStore.get(id).crushOn }),
  onMessage: (id, kind, res) => {
    bondStore.add(id, kind === 'question' ? 'question' : 'chat'); grant(Econ.awardOnce(econ, 'chat', id), 'first chat with ' + PERSONAS[id].name + ' today');
    const n = npcById(id); if (n) { n.expression = 'happy'; n.exprUntil = performance.now() / 1000 + 2.5; }
    $('chat-bond').textContent = bondStore.label(id); if (res.source === 'offline') chat.offline = true;
  },
  onClose: id => { const n = npcById(id); if (n) { n.talkingToPlayer = false; n.ctl.lookTarget = null; } talking = null; if (!hanging && !playing && !focus) release(); },
});
function npcActivityText(n) {
  if (!n) return 'relaxing in the café';
  if (n.id === 'mara') return 'working behind the coffee bar';
  const l = n.life; if (!l) return 'relaxing';
  if (l.phase === 'seated') return l.seat?.kind === 'study' ? 'studying at a desk with headphones' : l.seat?.kind === 'read' ? 'reading in a comfy seat' : 'sitting with a drink';
  return { 'to-counter': 'walking up to order', ordering: 'waiting at the counter', 'to-seat': 'looking for a seat' }[l.phase] || 'hanging around the café';
}
async function approachSocial(n, name) {
  if (focus || playing) { toast('Finish your current activity before joining someone.'); return null; }
  closeNpcMenu();
  if (!n || n.avatar.group.visible === false || (n.life && !npcAvailable(n))) { toast('They are busy right now — try again shortly.'); return null; }
  const s = startScript(name);
  const clear = () => { n.talkingToPlayer = false; n.ctl.lookTarget = null; if (talking === n) { chat.close(); talking = null; } playerCtl.activity = null; playerCtl.reach = null; };
  s.onCancel(() => { playerCtl.stop(); clear(); release(); });
  n.talkingToPlayer = true;
  if (playerCtl.posture !== 'stand' && !(await standPlayer())) { clear(); return null; }
  if (!s.ok()) return null;
  const target = n.avatar.group.position, spot = socialSpot(me, target, layout, n.id === 'mara');
  if (!spot || !(await playerCtl.goTo(spot.x, spot.z)) || !s.ok() || !socialArrived(me, n.avatar.group.position, spot, n.id === 'mara')) {
    if (s.ok()) { clear(); toast('There is no clear place to join them. Try again in a moment.'); }
    return null;
  }
  playerCtl.face = faceAngle(me, target); n.ctl.lookTarget = player.clone().add(new V(0, 1.45, 0));
  return { s, clear, spot };
}
async function talkTo(n, openChips) {
  const arrival = await approachSocial(n, 'talk'); if (!arrival) return;
  const target = n.avatar.group.position;
  talking = n;
  const mid = player.clone().lerp(target, .5), side = new V(-(target.z - me.z), 0, target.x - me.x).normalize(), gap = player.distanceTo(target);
  const view = n.id === 'mara' ? new V(me.x + 1.8, 1.8, me.z + 1.8) : mid.clone().addScaledVector(side, Math.max(2.3, gap * 1.35)).add(new V(0, 1.7, 0));
  frame(view, mid.clone().add(new V(0, 1.2, 0)), 1.3);
  chat.open(n.id); void openChips;
  hint('chat', PERSONAS[n.id].name + ' is listening — type anything, or pick a suggestion.');
}
async function hangOut(n) {
  closeNpcMenu(); if (!claimNpc(n)) return toast(PERSONAS[n.id].name + ' is busy right now.');
  const pairs = [['sofa', 'lounge-chair'], ['community-0', 'community-1'], ['community-1', 'community-2'], ['study-armchair-11', 'study-armchair-16'], ['window--3.1', 'reading'], ['garden-bench', 'game-cards#1']];
  const pair = pairs.map(p => p.map(id => cafeWorld.seatById(id))).find(p => p.every(s => s && !seatTaken(s)));
  if (!pair) { releaseNpc(n); return toast('Every comfy spot is taken — try again soon.'); }
  const s = startScript('hangout'); hanging = n; setActivity('Hanging out with ' + PERSONAS[n.id].name);
  say(n.avatar.group.position, 'Sure! Let’s grab a seat.', 2200);
  const seated = await Promise.all([sitPlayer(pair[0], s), n.ctl.sitOn(pair[1], { seats: cafeWorld.seats, occupied: occupiedSeats })]);
  if (!s.ok() || seated.some(ok => !ok)) { releaseNpc(n); hanging = null; return; }
  n.ctl.lookTarget = player.clone().add(new V(0, 1.2, 0)); playerCtl.lookTarget = n.avatar.group.position.clone().add(new V(0, 1.2, 0));
  const mid = player.clone().lerp(n.avatar.group.position, .5); frame(mid.clone().add(new V(1.6, 1.5, 1.6)), mid.clone().add(new V(0, .9, 0)));
  const started = performance.now(); let lastLine = 0;
  s.onCancel(() => { hanging = null; playerCtl.lookTarget = null; releaseNpc(n); release(); });
  while (s.ok() && playerCtl.posture === 'seated') {
    await wait(1);
    const secs = (performance.now() - started) / 1000;
    if (secs - lastLine > 9) { lastLine = secs; const p = PERSONAS[n.id], pool = [...p.lines.default, ...p.lines.coffee, ...p.lines.self]; say(n.avatar.group.position, pool[Math.floor(Math.random() * pool.length)], 3800); n.expression = 'happy'; n.exprUntil = performance.now() / 1000 + 2; }
    if (secs > 45 && !hanging.rewarded) { hanging.rewarded = true; bondStore.add(n.id, 'hangout'); grant(Econ.awardOnce(econ, 'hangout', n.id), 'time with ' + PERSONAS[n.id].name); }
  }
  if (s.ok()) { hanging = null; playerCtl.lookTarget = null; releaseNpc(n); release(); }
}
async function studyTogether(n) {
  closeNpcMenu(); if (!claimNpc(n)) return toast(PERSONAS[n.id].name + ' is busy right now.');
  let mine = playerCtl.posture === 'seated' && playerCtl.seat?.kind === 'study' ? playerCtl.seat : null;
  const shared = cafeWorld.seats.filter(s => s.shared && !seatTaken(s));
  if (!mine) mine = shared.find(s => s.id === 'study-table-2') || shared[0];
  const theirs = cafeWorld.seats.filter(s => mine && s.kind === 'study' && s.id !== mine.id && !seatTaken(s)).sort((a, b) => Math.hypot(a.x - mine.x, a.z - mine.z) - Math.hypot(b.x - mine.x, b.z - mine.z))[0];
  if (!mine || !theirs) { releaseNpc(n); return toast('No two desks free right now.'); }
  say(n.avatar.group.position, 'Yes! I’ll grab the desk next to you.', 2400);
  n.ctl.sitOn(theirs, { seats: cafeWorld.seats, occupied: occupiedSeats }).then(() => { n.studySeat = theirs; });
  n.studySeat = theirs; await studyAt(mine, n);
}
async function giveGift(n) {
  const arrival = await approachSocial(n, 'gift'); if (!arrival) return;
  await playerCtl.reachTo(localTo(maya, n.avatar.group.position.clone().add(new V(0, 1.1, 0))), { shape: 'grip', seconds: .8 });
  if (!arrival.s.ok()) return;
  arrival.clear();
  try { econ = Econ.spend(econ, 8); } catch (e) { return toast(e.message); }
  saveEcon(); updateHUD(); const gained = bondStore.add(n.id, 'gift');
  showReaction(n.avatar.group.position.clone().add(new V(0, 2.1, 0)), '🍪');
  say(n.avatar.group.position, gained ? ({ mara: 'For me? You’re a sweetheart.', jules: 'A bribe? …Accepted.', claire: 'Oh! That’s so thoughtful — thank you.', noah: 'Oh — thanks. That’s really kind.' }[n.id]) : 'Aw, you already spoiled me today!', 2600);
}
async function toggleCrush(n) {
  const arrival = await approachSocial(n, 'crush'); if (!arrival) return;
  arrival.clear(); const b = bondStore.get(n.id);
  try { bonds[n.id] = Bond.setCrush(n.id, b, !b.crushOn); persist('maple-bean-bonds', bonds); } catch (e) { return toast(e.message); }
  const on = bonds[n.id].crushOn;
  say(n.avatar.group.position, on ? ({ claire: 'Oh… I — I like you too. A lot, actually. 🌸', noah: 'Oh. Wow. I… yeah. Me too.', jules: 'Well. That’s the best move anyone’s made on me all week.' }[n.id]) : 'Friends is great too. Always.', 3400);
  n.expression = on ? 'happy' : 'smile'; n.exprUntil = performance.now() / 1000 + 3;
}

// ------------------------------------------------------------------ NPC context menu
function closeNpcMenu() { $('npc-menu').hidden = true; npcMenuFor = null; }
let npcMenuFor = null;
function openNpcMenu(n) {
  npcMenuFor = n; const m = $('npc-menu'); m.replaceChildren(); const p = PERSONAS[n.id];
  const head = document.createElement('div'); head.className = 'who'; head.innerHTML = `<b>${esc(p.name)}</b><span>${esc(bondStore.label(n.id))}</span>`; m.append(head);
  const add = (label, run, disabled) => { const b = document.createElement('button'); b.textContent = label; b.disabled = !!disabled; b.onclick = e => { e.stopPropagation(); run(); }; m.append(b); };
  const free = npcAvailable(n), staff = n.id === 'mara';
  add('💬 Chat', () => talkTo(n));
  add('❓ Ask a question', () => talkTo(n, true));
  if (staff) add('☕ Order a drink', () => { closeNpcMenu(); orderAtCounter(); });
  else {
    add('☕ Hang out', () => hangOut(n), !free);
    add('🎲 Play a game…', () => openGamePicker(n), !free);
    add('📚 Study together', () => studyTogether(n), !free);
  }
  add('🍪 Give a maple cookie · 8 🍁', () => giveGift(n));
  if (!staff && (Bond.canCrush(n.id, bondStore.get(n.id)) || bondStore.get(n.id).crushOn)) add(bondStore.get(n.id).crushOn ? '💛 Just friends' : '💛 Tell them you like them', () => toggleCrush(n));
  if (!free && !staff) { const note = document.createElement('div'); note.className = 'who'; note.textContent = n.ctl.scriptedBy ? 'Busy with you already' : 'Getting settled — try in a moment'; m.append(note); }
  m.hidden = false;
}
function openGamePicker(n) {
  const m = $('npc-menu'); m.replaceChildren();
  const head = document.createElement('div'); head.className = 'who'; head.textContent = 'Play with ' + PERSONAS[n.id].name; m.append(head);
  for (const st of layout.stations.filter(s => s.kind === 'game' && s.game !== 'snake')) { const b = document.createElement('button'); b.textContent = '🎲 ' + gameName(st.game); b.onclick = e => { e.stopPropagation(); closeNpcMenu(); startGame(st, n); }; m.append(b); }
}
function openOpponentPicker(st) {
  if (st.game === 'snake') return startGame(st, null);
  const m = $('npc-menu'); m.replaceChildren(); npcMenuFor = { avatar: { group: { position: new V(st.x, .6, st.z) } } };
  const head = document.createElement('div'); head.className = 'who'; head.textContent = gameName(st.game) + ' · choose an opponent'; m.append(head);
  const options = regulars.filter(n => n.id !== 'mara');
  for (const n of options) { const b = document.createElement('button'); const ok = npcAvailable(n); b.textContent = (ok ? '🙂 ' : '… ') + PERSONAS[n.id].name + (ok ? '' : ' (busy)'); b.disabled = !ok; b.onclick = e => { e.stopPropagation(); closeNpcMenu(); startGame(st, n); }; m.append(b); }
  m.hidden = false;
}

// ------------------------------------------------------------------ mini-games in the world
const OPPONENT = { jules: { skill: .85, chessJitter: 18, dartSkill: .75, recall: .65 }, claire: { skill: .58, chessJitter: 70, dartSkill: .45, recall: .78 }, noah: { skill: .74, chessJitter: 35, dartSkill: .6, recall: .6 } };
async function startGame(st, n) {
  if (playing) return; if (focus) return toast('Finish your focus session first.');
  if (n && !claimNpc(n)) return toast(PERSONAS[n.id].name + ' is busy right now.');
  const s = startScript('game'); document.body.classList.add('playing');
  const opp = n ? { id: n.id, name: PERSONAS[n.id].name, ...OPPONENT[n.id] } : null;
  playing = { id: Econ.eventId(), st, n, s, ctl: null, over: false, started: performance.now() };
  setActivity('Playing ' + gameName(st.game) + (opp ? ' with ' + opp.name : ''));
  if (n) say(n.avatar.group.position, { jules: 'Oh, it’s ON.', claire: 'Be gentle with me!', noah: 'Okay — best of one.' }[n.id], 2200);
  // Walk over and take positions.
  const standing = st.game === 'snake' || st.game === 'darts';
  if (standing) {
    if (playerCtl.posture !== 'stand' && !(await standPlayer())) { await leaveGame(); return; }
    const tasks = [playerCtl.goTo(st.approach[0], st.approach[1])];
    if (n) tasks.push((async () => { if (n.ctl.posture !== 'stand' && !(await n.ctl.standUp())) return false; const arrived = await n.ctl.goTo(st.x - .7, st.z); n.ctl.face = st.angle; return arrived; })());
    const arrived = await Promise.all(tasks); if (arrived.some(ok => ok === false)) { toast('The game area is blocked. Try again shortly.'); await leaveGame(); return; } playerCtl.face = st.angle; if (st.game === 'snake') { playerCtl.activity = 'arcade'; playerCtl.panelHeight = st.panelHeight; }
  } else {
    const [a, b] = st.seats.map((_, i) => cafeWorld.seatById(st.id + '#' + i));
    const tasks = [sitPlayer(a, s)]; if (n) tasks.push(n.ctl.sitOn(b, { seats: cafeWorld.seats, occupied: occupiedSeats }));
    if ((await Promise.all(tasks)).some(ok => !ok)) { toast('Those seats are not available.'); await leaveGame(); return; }
  }
  if (!s.ok() || playing?.s !== s) return;
  const actorOf = who => who === 'me' ? { ctl: playerCtl, avatar: maya } : { ctl: n.ctl, avatar: n.avatar };
  const ctx = {
    scene, station: st, opponent: opp, get over() { return playing?.over; },
    reach(who, point, opts = {}) { if (ctx.dead) return wait(opts.seconds || .5); const { ctl, avatar } = actorOf(who); return ctl.reachTo(localTo(avatar, point), { side: -1, ...opts }); },
    follow(who, point) { if (ctx.dead) return; const { ctl, avatar } = actorOf(who); if (ctl.reach) ctl.reach = { ...ctl.reach, ...localTo(avatar, point) }; },
    react(who, kind) { if (ctx.dead) return; const { ctl } = actorOf(who); if (kind === 'think') ctl.activity = 'think'; else if (kind === 'happy') { if (who === 'me') { playerExpression = 'happy'; expressionUntil = performance.now() / 1000 + 1.6; } else { n.expression = 'happy'; n.exprUntil = performance.now() / 1000 + 1.6; } } else if (ctl.activity === 'think') ctl.activity = null; },
    pose(who, act) { if (ctx.dead) return; const { ctl } = actorOf(who); ctl.activity = act; },
    handPoint(who) { return actorOf(who).avatar.handWorld(-1); },
    say(who, text) { if (ctx.dead) return; say(actorOf(who).avatar.group.position, text, 1500); },
    stick(v) { if (ctx.dead) return; playerCtl.stick = v ? { x: v[0], y: v[1] } : null; },
    status(text) { if (ctx.dead) return; $('game-status').textContent = text; },
    extra(buttons) { if (ctx.dead) return; const box = $('game-extra'); box.replaceChildren(); for (const b of buttons) { if (b.node) { box.append(b.node); continue; } const e = document.createElement('button'); e.textContent = b.label; e.onclick = ev => { ev.stopPropagation(); b.run(); }; box.append(e); } },
    sfx: blip,
    finish: res => { if (!ctx.dead) finishGame(res); },
  };
  visualDetails.setGameActive?.(st.id, true);
  const controller = SCENES[st.game](ctx); playing.ctl = controller; playing.ctx = ctx;
  $('game-title').textContent = controller.title; $('game-hud').hidden = false;
  frame(controller.camera.position, controller.camera.target, 1.5);
  hint('game-' + st.game, st.game === 'darts' ? 'Hold the mouse (or Space) to steady your aim, release to throw.' : st.game === 'snake' ? 'Steer with the arrow keys or WASD.' : 'Click the pieces on the table to play.');
}
async function finishGame(res) {
  const p = playing; if (!p || p.over) return; p.over = true;
  const who = res.result;
  const title = res.result === 'score' ? 'Score ' + res.score : who === 'win' ? 'You win!' : who === 'draw' ? 'A draw!' : (p.n ? PERSONAS[p.n.id].name + ' wins' : 'Game over');
  $('game-status').textContent = title;
  // Winner celebrates a little, the other reacts naturally.
  if (p.n) {
    const winnerCtl = who === 'win' ? playerCtl : who === 'loss' ? p.n.ctl : null, loserCtl = who === 'win' ? p.n.ctl : who === 'loss' ? playerCtl : null;
    if (winnerCtl) winnerCtl.activity = 'cheer'; if (loserCtl) loserCtl.activity = 'sad';
    say(p.n.avatar.group.position, who === 'win' ? ({ jules: 'Rematch. Immediately.', claire: 'You’re so good at this!', noah: 'Well played. Seriously.' }[p.n.id]) : who === 'loss' ? ({ jules: 'And the crowd goes wild!', claire: 'Wait, did I actually win?!', noah: 'Good game — that was close.' }[p.n.id]) : 'Evenly matched!', 2600);
  } else if (res.result === 'score') { playerCtl.activity = res.score >= 5 ? 'cheer' : 'sad'; }
  const r = Econ.awardGame(econ, p.st.game, { ...res, id: p.id }, new Date(nowMs())); econ = r.state; saveEcon(); updateHUD(!!r.reward?.coins);
  if (p.n) bondStore.add(p.n.id, 'game');
  await wait(2.2);
  playerCtl.activity = null; if (p.n) p.n.ctl.activity = null;
  reward(gameName(p.st.game).toUpperCase(), r.reward.coins ? '+' + r.reward.coins + ' Maple Coins' : title, [title, r.reward.note || ('+' + r.reward.xp + ' XP')]);
  await leaveGame();
}
async function leaveGame() {
  const p = playing; if (!p) return; playing = null;
  visualDetails.setGameActive?.(p.st.id, false);
  p.over = true; if (p.ctx) p.ctx.dead = true; p.ctl?.dispose(); $('game-hud').hidden = true; document.body.classList.remove('playing');
  playerCtl.activity = null; playerCtl.stick = null; playerCtl.panelHeight = undefined;
  release();
  await standPlayer(); if (p.n) releaseNpc(p.n);
  setActivity('Back to the café');
}
$('game-quit').onclick = () => { if (playing && !playing.over) { toast('Left the game — no coins for unfinished games.'); } leaveGame(); };

// ------------------------------------------------------------------ interacting with the world
async function useTarget(t) {
  closeNpcMenu();
  if (focus && !['npc'].includes(t.type)) return toast('You’re in Focus Mode — exit focus first.');
  if (playing) return;
  if (t.type === 'npc') { const n = npcById(t.id); if (n) openNpcMenu(n); return; }
  if (t.type === 'guest') { const g = remote.get(t.id); if (g) { sendEmote('wave'); toast('You wave at ' + g.data.name + '.'); } return; }
  if (t.type === 'counter') return orderAtCounter();
  if (t.type === 'plant') { if (t.plant.station.approach) waterPlant(t.plant); return; }
  if (t.type === 'game') return openOpponentPicker(t.station);
  const seat = t.seat; if (!seat) return;
  if (playerCtl.seat?.id === seat.id && playerCtl.posture === 'seated') { if (seat.kind === 'study') return beginFocus(seat, null); startScript('stand'); return standPlayer(); }
  if (t.type === 'study') return studyAt(seat);
  const s = startScript('sit'); await sitPlayer(seat, s);
}
function goToStation(id) {
  const st = layout.stations.find(s => s.id === id); if (!st) return;
  if (mode !== 'walk') cameraMode('walk');
  if (st.kind === 'coffee') return orderAtCounter();
  if (st.kind === 'game') return openOpponentPicker(st);
  const seat = cafeWorld.seatById(id); if (seat) useTarget({ type: seat.kind === 'study' ? 'study' : 'seat', seat });
}
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => goToStation(b.dataset.go));

// ------------------------------------------------------------------ emotes, sipping, reading
function sendEmote(id) {
  if (id === 'wave') waveUntil = performance.now() / 1000 + 2.5;
  showReaction(player.clone().add(new V(0, 2.1, 0)), emoteEmoji(id)); api({ action: 'emote', emote: id }).catch(() => {});
}
for (const e of EMOTES) { if (e.id === 'wave') continue; const b = document.createElement('button'); b.textContent = e.emoji; b.title = e.label; $('emotes').append(b); b.onclick = () => sendEmote(e.id); }
$('wave').onclick = () => sendEmote('wave');
function sip() { if (!cupState.drink || sipUntil) return; sipUntil = performance.now() / 1000 + 1.7; }

// ------------------------------------------------------------------ input
const keys = new Set();
const typingNow = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable || $('dialog').open || creator.isOpen;
addEventListener('keydown', e => {
  if (playing?.ctl?.key && !typingNow()) { if (playing.ctl.key(e, true)) { e.preventDefault(); return; } }
  if (e.code === 'Escape') { keys.clear(); closeNpcMenu(); $('menu').hidden = true; if (chat.npc) return chat.close(); if (playing) return; if (!focus) { if (script && !['focus', 'game'].includes(script.name)) script.cancel(); playerCtl?.stop(); if (playerCtl?.posture === 'seated') { startScript('stand'); standPlayer(); } } return; }
  if (typingNow()) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault(); if (focus || playing) return;
    keys.add(e.code); if (mode !== 'walk') cameraMode('walk'); if (framing && !talking) release();
    if (script && !['focus', 'game'].includes(script.name)) { script.cancel(); script = null; }
    playerCtl.stop(); if (playerCtl.posture === 'seated') { startScript('stand'); standPlayer(); }
  }
  if (e.code === 'KeyE' && !e.repeat) $('context').querySelector('button')?.click();
  if (e.code === 'KeyR' && !e.repeat) sip();
  if (e.code === 'KeyF' && !e.repeat) sendEmote('wave');
  if (e.code === 'KeyB' && !e.repeat && playerCtl?.seat?.kind === 'read') toast(randomBrowseLine());
});
addEventListener('keyup', e => { keys.delete(e.code); if (playing?.ctl?.key && e.code === 'Space') playing.ctl.key(e, false); });
addEventListener('blur', () => keys.clear()); document.addEventListener('visibilitychange', () => keys.clear());

const pointer = new THREE.Vector2(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new V(0, 1, 0), 0), point = new V();
let down = null, hovered = null;
function setPointer(e) { const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera); return rect; }
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; renderer.domElement.focus(); if (playing?.ctl?.pointerDown && e.button === 0) { setPointer(e); if (playing.ctl.pointerDown()) { controls.enabled = false; } } });
renderer.domElement.addEventListener('pointermove', e => {
  if (!layout || e.buttons) { $('tooltip').hidden = true; return; }
  const rect = setPointer(e); let label = null;
  if (playing?.ctl) label = playing.ctl.hover(ray);
  else if (mode !== 'plan') {
    hovered = cafeWorld.pick(pointer, camera);
    if (hovered) {
      const v = VERB[hovered.type] || VERB.seat;
      const sub = hovered.type === 'npc' ? PERSONAS[hovered.id]?.name + ' · ' + bondStore.label(hovered.id) : hovered.type === 'plant' ? cafeWorld.plantMood(hovered.plant) : hovered.type === 'guest' ? hovered.label : hovered.label;
      const seatedHere = hovered.seat && playerCtl.seat?.id === hovered.seat.id && playerCtl.posture === 'seated';
      label = (seatedHere ? (hovered.seat.kind === 'study' ? '📚 Study' : '↑ Stand up') : v.icon + ' ' + v.verb) + '<small>' + esc(sub || '') + '</small>';
    }
  }
  cafeWorld.highlight(playing ? null : hovered, performance.now() / 1000);
  renderer.domElement.style.cursor = label ? 'pointer' : '';
  const tip = $('tooltip'); tip.hidden = !label; if (label) { tip.innerHTML = label; tip.style.left = (e.clientX - rect.left) + 'px'; tip.style.top = (e.clientY - rect.top) + 'px'; }
});
renderer.domElement.addEventListener('pointerleave', () => { $('tooltip').hidden = true; cafeWorld?.highlight(null); });
renderer.domElement.addEventListener('pointerup', e => {
  controls.enabled = true;
  if (playing?.ctl?.pointerUp && playing.ctl.pointerUp()) { down = null; return; }
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || e.button !== 0 || !layout) return;
  setPointer(e);
  if (playing) { playing.ctl?.click(ray); return; }
  closeNpcMenu(); $('menu').hidden = true;
  const t = mode !== 'plan' ? cafeWorld.pick(pointer, camera) : null;
  if (t) { useTarget(t); return; }
  if (focus || playerCtl.posture === 'seated') return;
  if (ray.ray.intersectPlane(plane, point) && isWalkable(point.x, point.z, layout)) {
    if (script && !['focus', 'game'].includes(script.name)) { script.cancel(); script = null; }
    if (mode !== 'walk') cameraMode('walk'); if (framing && !talking) release();
    playerCtl.goTo(point.x, point.z); setActivity('A little wander through the café');
  }
});

// ------------------------------------------------------------------ touch walking pad (unchanged behaviour)
const touchPad = document.createElement('div'); touchPad.className = 'touch-pad'; touchPad.setAttribute('aria-label', 'Walking controls');
for (const [code, glyph, title] of [['KeyW', '↑', 'Walk forward'], ['KeyA', '←', 'Walk left'], ['KeyS', '↓', 'Walk backward'], ['KeyD', '→', 'Walk right']]) {
  const b = document.createElement('button'); b.textContent = glyph; b.setAttribute('aria-label', title); b.dataset.key = code;
  b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (focus || playing) return; playerCtl?.stop(); keys.add(code); };
  b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => keys.delete(code); touchPad.append(b);
}
world.append(touchPad);

// ------------------------------------------------------------------ menu, home, panels
const drawers = ['messenger', 'shop', 'profile', 'notifications', 'review', 'nearby'];
function openDrawer(id) { for (const d of drawers) if (d !== id) $(d).hidden = true; $(id).hidden = false; $('menu').hidden = true; keys.clear(); }
$('menu-open').onclick = e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; $('menu-open').setAttribute('aria-expanded', String(!$('menu').hidden)); };
for (const id of ['overview', 'walk', 'plan']) $(id).onclick = () => { $('menu').hidden = true; cameraMode(id); };
function goHome() {
  closeNpcMenu(); for (const d of drawers) $(d).hidden = true; $('menu').hidden = true; if (chat.npc) chat.close();
  if (playing) leaveGame();
  cameraMode('overview');   // the café keeps living; progress and focus timers continue
}
$('home').onclick = goHome; $('brand').onclick = e => { e.preventDefault(); goHome(); }; $('cafe-nav').onclick = goHome;
$('enter').onclick = () => { cameraMode('walk'); blip('chime'); hint('explore', 'Click anything that glows — chairs, plants, people and games. WASD or click the floor to walk.', 9); };
$('review-open').onclick = () => openDrawer('review'); $('review-open-2').onclick = () => openDrawer('review'); $('review-close').onclick = () => $('review').hidden = true;
$('nearby-open').onclick = () => { openDrawer('nearby'); $('chat-input').focus(); }; $('nearby-close').onclick = () => $('nearby').hidden = true;
$('notifications-open').onclick = () => { openDrawer('notifications'); renderNotifications(); };
$('notifications-close').onclick = () => $('notifications').hidden = true;
$('profile-open').onclick = () => { openDrawer('profile'); renderProfile(); }; $('profile-close').onclick = () => $('profile').hidden = true;
$('shop-open').onclick = () => openShop(); $('shop-close').onclick = () => closeShop();
$('messages-open').onclick = () => { openDrawer('messenger'); messenger.open(); };
$('help-open').onclick = () => { $('menu').hidden = true; openDialog('<div class="eyebrow">HOW MAPLE BEAN WORKS</div><h2>Just explore.</h2><p>Anything you can use glows when you point at it. Click a <b>chair</b> to sit, a <b>plant</b> to water it, a <b>person</b> to talk, study or play, the <b>coffee bar</b> to order, a <b>desk</b> in the Study Room to focus, and the tables in <b>Games &amp; Garden</b> to play.</p><p>Earn Maple Coins by finishing focus sessions, playing games and daily challenges — spend them in the wardrobe 👕. WASD or click the floor to walk, E for the main action, R to sip, F to wave, Esc to stand.</p>'); };
document.addEventListener('click', e => { if (!$('menu').hidden && !$('menu').contains(e.target) && e.target !== $('menu-open')) $('menu').hidden = true; });

function renderNotifications() {
  const body = $('notifications-body'); body.replaceChildren();
  if (!notifications.length) body.innerHTML = '<p class="muted">Nothing yet. Rewards, friendships and messages show up here.</p>';
  for (const n of notifications) { const d = document.createElement('div'); d.className = 'note-item'; d.innerHTML = esc(n.text) + '<small>' + new Date(n.at).toLocaleString() + '</small>'; body.append(d); n.read = true; }
  persist('maple-bean-notifications', notifications); $('notifications-badge').hidden = true;
}
function renderProfile() {
  const lv = Econ.levelFor(econ.xp), st = statsForDisplay(focusStats), streak = Econ.streakView(econ, new Date(nowMs()));
  $('profile-title').textContent = session?.name || 'Maya';
  const body = $('profile-body');
  body.innerHTML = `<div class="stat-row"><div><b>${lv.level}</b>Level · ${lv.into}/${lv.need} XP</div><div><b>${econ.coins}</b>Maple Coins</div><div><b>${streak}🔥</b>Study streak</div></div>
  <div class="stat-row"><div><b>${formatMinutes(st.todayMinutes)}</b>Focused today</div><div><b>${st.totalSessions}</b>Sessions</div><div><b>${(econ.today?.gamesPlayed) || 0}</b>Games today</div></div>
  <div class="eyebrow" style="margin-top:14px">DAILY CHALLENGES</div><div id="challenges"></div>
  <div class="eyebrow" style="margin-top:16px">FRIENDSHIPS</div><div id="bonds"></div>
  <button class="secondary" id="rename-2" style="margin-top:12px">✎ Change your name</button>`;
  const ch = $('challenges');
  for (const c of Econ.challengesView(econ, new Date(nowMs()))) {
    const row = document.createElement('div'); row.className = 'challenge'; row.innerHTML = `<span>${esc(c.label)}<br><small>${c.progress}/${c.target} · ${c.coins} 🍁</small></span>`;
    if (c.claimed) row.append(Object.assign(document.createElement('small'), { textContent: 'Claimed ✓' }));
    else if (c.progress >= c.target) { const b = document.createElement('button'); b.textContent = 'Claim'; b.onclick = () => { grant(Econ.claimChallenge(econ, c.id, new Date(nowMs())), c.label); renderProfile(); }; row.append(b); }
    ch.append(row);
  }
  const bl = $('bonds');
  for (const id of Object.keys(PERSONAS)) {
    const b = bondStore.get(id), lvl = Bond.levelOf(b.points), next = Bond.nextLevel(b.points);
    const d = document.createElement('div'); d.className = 'bond';
    d.innerHTML = `<b>${esc(PERSONAS[id].name)}</b> · ${esc(bondStore.label(id))}<div class="meter"><i style="width:${next ? ((b.points - lvl.min) / (next.min - lvl.min) * 100) : 100}%"></i></div><small>${next ? (next.min - b.points) + ' to ' + next.label : 'The closest of friends'}${b.memory.length ? ' · remembers: ' + esc(b.memory.slice(0, 2).join(', ')) : ''}</small>`;
    bl.append(d);
  }
  $('rename-2').onclick = () => $('rename').click();
}

// ------------------------------------------------------------------ wardrobe shop
let shopTab = 'top', preview = null;
function openShop() {
  openDrawer('shop'); renderShop();
  if (!playing && !focus && maya) { const f = new V(Math.sin(me.angle), 0, Math.cos(me.angle)); frame(player.clone().addScaledVector(f, 2.2).add(new V(.35, 1.25, 0)), player.clone().add(new V(0, .95, 0)), 1.1); shopFraming = true; }
}
let shopFraming = false;
function closeShop() { $('shop').hidden = true; preview = null; dress(); if (shopFraming) { shopFraming = false; release(); } }
function renderShop() {
  const body = $('shop-body'); body.replaceChildren();
  const tabs = document.createElement('div'); tabs.className = 'shop-tabs';
  for (const s of Shop.SLOTS) { const b = document.createElement('button'); b.textContent = s.label; b.classList.toggle('selected', s.id === shopTab); b.onclick = () => { shopTab = s.id; renderShop(); }; tabs.append(b); }
  body.append(tabs);
  const p = document.createElement('p'); p.className = 'shop-preview'; p.textContent = preview ? 'Previewing ' + Shop.itemById(preview).name + ' — buy or equip to keep it.' : 'Click an item to preview it on yourself. Purchases stay unlocked forever.'; body.append(p);
  const grid = document.createElement('div'); grid.className = 'shop-grid';
  for (const item of Shop.CATALOG.filter(i => i.slot === shopTab)) {
    const owned = wardrobe.owned.includes(item.id) || econ.unlocked.includes(item.id), equipped = wardrobe.equipped[item.slot] === item.id;
    const card = document.createElement('div'); card.className = 'shop-item' + (equipped ? ' equipped' : '') + (preview === item.id ? ' previewing' : '');
    const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = item.tint || item.color || '#f4ecdf';
    sw.textContent = item.prop ? ({ glasses: '👓', beret: '🧢', 'leaf-clip': '🍁', scarf: '🧣' }[item.prop]) : item.source ? '💇' : item.tint ? '' : '✓';
    card.append(sw, Object.assign(document.createElement('b'), { textContent: item.name }), Object.assign(document.createElement('small'), { textContent: equipped ? 'Wearing' : owned ? 'Owned' : item.price === null ? 'Reward: ' + item.reward : item.price + ' 🍁' }));
    const btn = document.createElement('button'); btn.className = 'buy' + (!owned && item.price !== null && econ.coins >= item.price ? ' go' : '');
    btn.textContent = equipped ? 'Equipped' : owned ? 'Equip' : item.price === null ? 'Locked' : 'Buy';
    btn.disabled = equipped || (!owned && (item.price === null || econ.coins < item.price));
    btn.onclick = e => {
      e.stopPropagation();
      try {
        if (!owned) { const r = Shop.buy(wardrobe, econ, item.id); wardrobe = r.wardrobe; econ = r.economy; saveEcon(); updateHUD(true); notify('Bought ' + item.name + ' 🛍', 'shop', false); blip('cup'); }
        wardrobe = Shop.equip(wardrobe, item.id, econ.unlocked); persist('maple-bean-wardrobe', wardrobe); preview = null; dress(); renderShop();
      } catch (err) { toast(err.message); }
    };
    card.append(btn);
    card.onclick = () => { preview = item.id; const trial = { ...wardrobe, equipped: { ...wardrobe.equipped, [item.slot]: item.id } }; dress(Shop.lookFor(trial)); renderShop(); };
    grid.append(card);
  }
  body.append(grid);
}

// ------------------------------------------------------------------ nearby chat, rename, notes (kept from the playtest)
function chatLine(name, text) { const line = document.createElement('p'); line.className = 'chat-line'; const b = document.createElement('b'); b.textContent = name; line.append(b, document.createTextNode(text)); $('chat-messages').append(line); if ($('chat-messages').children.length > 80) $('chat-messages').firstChild.remove(); $('chat-messages').scrollTop = $('chat-messages').scrollHeight; }
$('chat-form').onsubmit = async e => { e.preventDefault(); try { await api({ action: 'chat', text: $('chat-input').value }); $('chat-input').value = ''; } catch (err) { toast(err.message); } };
$('rename').onclick = () => { $('menu').hidden = true; openDialog('<div class="eyebrow">PULL UP A CHAIR</div><h2>What should we call you?</h2><form id="name-form"><input id="name-input" maxlength="24" required aria-label="Your guest name"><button class="primary">Save name</button></form>'); $('name-input').value = session?.name || 'Maya'; $('name-form').onsubmit = async e => { e.preventDefault(); const name = $('name-input').value.trim(); try { await api({ action: 'rename', name }); session.name = name; $('player-name').textContent = name; $('avatar-initial').textContent = name[0].toUpperCase(); persist('maple-bean-name', name); $('dialog').close(); } catch (err) { toast(err.message); } }; };
let notes = readSaved('maple-bean-notes', []); if (!Array.isArray(notes)) notes = [];
function showNotes() { $('note-count').textContent = notes.length; $('notes').replaceChildren(); notes.forEach((note, i) => { const el = document.createElement('article'); el.className = 'note'; const small = document.createElement('small'); small.textContent = note.kind + ' · ' + new Date(note.date).toLocaleDateString(); const p = document.createElement('p'); p.textContent = note.text; const button = document.createElement('button'); button.textContent = 'Delete note'; button.onclick = () => { notes.splice(i, 1); persist('maple-bean-notes', notes); showNotes(); }; el.append(small, p, button); $('notes').append(el); }); }
showNotes();
$('note-form').onsubmit = e => { e.preventDefault(); const text = $('note-text').value.trim(); if (!text) return; notes.push({ kind: $('note-kind').value, text, date: new Date().toISOString(), position: { x: +player.x.toFixed(2), z: +player.z.toFixed(2) }, camera: camera.position.toArray(), lighting: $('lighting').value }); persist('maple-bean-notes', notes); $('note-text').value = ''; showNotes(); toast('Saved in your playtest notebook.'); };
$('export-notes').onclick = () => download(JSON.stringify({ project: 'Maple Bean', date: new Date().toISOString(), notes }, null, 2), 'Maple-Bean-playtest-notes.json', 'application/json');
$('show-collisions').onchange = () => collisionGroup.visible = $('show-collisions').checked;
$('show-beams').onchange = () => beams.visible = mode === 'overview' && $('show-beams').checked;

// ------------------------------------------------------------------ lighting & sound (unchanged)
$('lighting').onchange = () => {
  const m = $('lighting').value; lighting.apply(m); settings.lighting = m; persist(KEYS.settings, settings);
};
$('lighting').value = settings.lighting; $('lighting').dispatchEvent(new Event('change'));
$('music-volume').value = settings.volume;
let audio = null;
$('sound').onclick = async () => {
  if (!audio) {
    const context = new AudioContext(), gain = context.createGain(); gain.gain.value = .022; gain.connect(context.destination);
    for (const hz of [130.81, 164.81, 196, 246.94]) { const o = context.createOscillator(), g = context.createGain(); o.type = 'sine'; o.frequency.value = hz; g.gain.value = .15; o.connect(g).connect(gain); o.start(); }
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate), data = buffer.getChannelData(0); let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .025) / 1.02; data[i] = last; }
    const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true; noise.connect(gain); noise.start(); audio = { context, on: true };
  } else { audio.on = !audio.on; await audio.context[audio.on ? 'resume' : 'suspend'](); }
  $('sound').textContent = audio.on ? '♪ Café sound on' : '♪ Café sound off'; $('sound').setAttribute('aria-pressed', String(audio.on));
};
function blip(kind) {
  if (!audio || !audio.on) return;
  const context = audio.context, now = context.currentTime, gain = context.createGain(); gain.connect(context.destination);
  if (kind === 'tick') { const o = context.createOscillator(); o.type = 'square'; o.frequency.value = 2200 + Math.random() * 400; o.connect(gain); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.012, now + .002); gain.gain.exponentialRampToValueAtTime(.0001, now + .03); o.start(now); o.stop(now + .04); return; }
  const notesHz = kind === 'cup' ? [[880, 0], [1320, .05]] : kind === 'chime' ? [[988, 0], [1319, .09], [1568, .18]] : [[660, 0]];
  gain.gain.setValueAtTime(0, now);
  for (const [hz, at] of notesHz) { const o = context.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(gain); gain.gain.setValueAtTime(0, now + at); gain.gain.linearRampToValueAtTime(.05, now + at + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + at + .35); o.start(now + at); o.stop(now + at + .4); }
}
$('photo').onclick = () => { renderer.render(scene, camera); renderer.domElement.toBlob(blob => { if (blob) download(blob, 'Maple-Bean-' + Date.now() + '.png', 'image/png'); }); toast('A little memory, saved.'); };

// ------------------------------------------------------------------ focus music (unchanged provider architecture)
let musicCtx = null, musicProviders = null, activeMusic = null, currentTrack = null, musicPlaying = false;
function renderFocusStats() { const view = statsForDisplay(focusStats); $('focus-stats').innerHTML = `<div><b>${formatMinutes(view.todayMinutes)}</b> focused today · ${view.todaySessions} sessions · ${view.streak} day streak</div>`; }
function ensureMusicSetup() { if (musicProviders) return; musicCtx = new AudioContext(); const destination = musicCtx.createGain(); destination.connect(musicCtx.destination); musicProviders = { ambient: createProceduralProvider(musicCtx, destination), mine: createLocalFilesProvider($('music-audio')) }; }
for (const cat of CATEGORIES) { const b = document.createElement('button'); b.textContent = cat.name; b.dataset.cat = cat.id; $('music-categories').append(b); }
function updateListening() { $('now-listening').hidden = !musicPlaying || !currentTrack; $('now-listening-track').textContent = currentTrack ? currentTrack.title + ' — ' + (currentTrack.artist || activeMusic?.name || 'Maple Bean') : ''; }
function stopMusic() { activeMusic?.stop(); musicPlaying = false; $('music-play').textContent = '▶'; updateListening(); }
function selectMusicCategory(cat) {
  stopMusic(); currentTrack = null;
  document.querySelectorAll('#music-categories button').forEach(b => b.classList.toggle('selected', b.dataset.cat === cat.id));
  if (cat.kind === 'unavailable') { $('music-status').textContent = INTEGRATION_NOTES[cat.id]; $('music-transport').hidden = true; $('music-volume-label').hidden = true; $('music-choose-files').hidden = true; activeMusic = null; return; }
  ensureMusicSetup(); $('music-transport').hidden = false; $('music-volume-label').hidden = false;
  activeMusic = cat.kind === 'procedural' ? musicProviders.ambient : musicProviders.mine; activeMusic.setVolume(+$('music-volume').value / 100);
  if (cat.kind === 'local-files') { $('music-choose-files').hidden = false; $('music-status').textContent = activeMusic.tracks.length ? activeMusic.tracks.length + ' file(s) ready.' : 'Choose audio files from your computer to begin.'; }
  else { $('music-choose-files').hidden = true; $('music-status').textContent = 'Ready to play: ' + activeMusic.tracks[0].title; }
}
$('music-choose-files').onclick = () => $('music-file-picker').click();
$('music-file-picker').onchange = e => { musicProviders.mine.setFiles(e.target.files); currentTrack = null; musicPlaying = false; $('music-play').textContent = '▶'; $('music-status').textContent = e.target.files.length + ' file(s) ready.'; updateListening(); };
async function playMusic(track, resume = false) {
  try {
    await musicCtx?.resume();
    if (resume) await activeMusic.resume(); else await activeMusic.play(track);
    currentTrack = track; musicPlaying = true; $('music-play').textContent = '⏸'; $('music-status').textContent = 'Now playing: ' + track.title;
  } catch { musicPlaying = false; $('music-status').textContent = 'This audio could not play. Choose another file or press Play to retry.'; }
  updateListening();
}
$('music-play').onclick = () => { if (!activeMusic) return; if (musicPlaying) { activeMusic.pause(); musicPlaying = false; $('music-play').textContent = '▶'; updateListening(); return; } const track = currentTrack || trackAfter(activeMusic.tracks, undefined, 1); if (!track) return toast('Choose a file first.'); playMusic(track, !!currentTrack); };
for (const [id, direction] of [['music-next', 1], ['music-prev', -1]]) $(id).onclick = () => { if (!activeMusic) return; const track = trackAfter(activeMusic.tracks, currentTrack?.id, direction); if (track) playMusic(track); };
$('music-audio').onended = () => $('music-next').click();
$('music-share').checked = !!settings.shareMusic;
$('music-share').onchange = () => { settings.shareMusic = $('music-share').checked; persist(KEYS.settings, settings); };
$('music-volume').oninput = () => { activeMusic?.setVolume(+$('music-volume').value / 100); settings.volume = +$('music-volume').value; persist(KEYS.settings, settings); };
document.querySelectorAll('#music-categories button').forEach(b => b.onclick = () => selectMusicCategory(CATEGORIES.find(c => c.id === b.dataset.cat)));

// ------------------------------------------------------------------ multiplayer
let guestList = [];
const messenger = createMessenger({
  api, me: () => session || {}, guests: () => guestList, bonds: bondStore, notify: (t) => notify(t, 'message'),
  onInvite: inv => { $('messenger').hidden = true; if (inv.kind === 'play') goToStation(inv.place || 'game-chess'); else if (inv.kind === 'study') goToStation(inv.place || 'study-table-0'); else goToStation(inv.place || 'sofa'); },
});
function connect() {
  network = new EventSource(`/events?id=${session.id}&token=${session.token}`);
  network.addEventListener('guests', e => {
    const guests = JSON.parse(e.data), ids = new Set(); guestList = guests; occupiedSeats.clear(); for (const g of guests) if (g.seatId && g.id !== session.id) occupiedSeats.add(g.seatId);
    $('guest-count').textContent = `(${guests.length})`;
    for (const guest of guests) {
      if (guest.id === session.id) continue; ids.add(guest.id); let item = remote.get(guest.id);
      if (!item) { const avatar = createMaya(cast.maya), marker = worldLabel(guest.name, new V(guest.x, 1.95, guest.z), 'guest'); item = { avatar, marker, data: guest, waveUntil: 0 }; scene.add(avatar.group); avatar.group.position.set(guest.x, 0, guest.z); remote.set(guest.id, item); cafeWorld.person('guest:' + guest.id, 'guest', guest.name).userData.target.id = guest.id; }
      item.data = guest; item.marker.el.textContent = guest.name + (guest.status ? ' · ' + statusText(guest.status, guest.statusDetail) : '');
    }
    for (const [id, item] of remote) if (!ids.has(id)) { scene.remove(item.avatar.group); item.marker.el.remove(); markers.splice(markers.indexOf(item.marker), 1); remote.delete(id); cafeWorld.removePerson('guest:' + id); }
  });
  network.addEventListener('chat', e => { const data = JSON.parse(e.data); chatLine(data.name, data.text); if ($('nearby').hidden && data.id !== session.id) toast(data.name + ': ' + data.text); });
  network.addEventListener('emote', e => { const data = JSON.parse(e.data); if (data.id === session.id) return; const item = remote.get(data.id); if (!item) return; if (data.emote === 'wave') item.waveUntil = performance.now() / 1000 + 2.5; showReaction(item.avatar.group.position.clone().add(new V(0, 2.1, 0)), emoteEmoji(data.emote)); });
  network.addEventListener('group', e => messenger.upsert(JSON.parse(e.data)));
  network.addEventListener('group-left', e => messenger.remove(JSON.parse(e.data).id));
  network.onerror = () => { $('guest-count').textContent = '(offline)'; if (sessionDead) network.close(); };
}

// ------------------------------------------------------------------ loading
try {
  [layout] = await Promise.all([fetch('/assets/layout.json').then(r => r.json()), new GLTFLoader().loadAsync('/assets/cafe.glb').then(g => addCafe(g.scene)), loadCharacters()]);
  visualDetails = addVisualDetails(scene, layout);
  layout.stations.push({ id: 'noah', label: 'Meet Noah', kind: 'talk', x: 7.1, z: 3.4, approach: [7.1, 3.4], angle: Math.PI });
  cafeWorld = createWorld({ scene, layout, staticMeshes });
  counterTop = cafeWorld.surfaceHeight(-3.4, -4.45, 1.6) ?? 1.0;
  counterCup = makeCup(); counterCup.visible = false; scene.add(counterCup);
  for (const z of cafeWorld.zones) worldLabel(z.name.toUpperCase(), z.position, 'zone');
  $('load-message').textContent = 'Maya is getting ready…'; await new Promise(r => setTimeout(r, 30));
  maya = createCharacter({ ...cast[avatarProfile.base], detail: 'game', customizable: true }); scene.add(maya.group);
  me = { x: 0, z: 8.3, angle: Math.PI }; playerCtl = new Actor(me, layout); dress();
  for (const o of layout.obstacles) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.w + .48, .12, o.d + .48), new THREE.MeshBasicMaterial({ color: 0xd06b4c, wireframe: true })); mesh.position.set(o.x, .10, o.z); collisionGroup.add(mesh); }
  // Regulars arrive from the street, order at the counter, then settle in.
  for (const [id, delay] of [['mara', 0], ['noah', 1.5], ['claire', 6], ['jules', 11]]) {
    $('load-message').textContent = `${cast[id].name} is on the way…`; await new Promise(resolve => setTimeout(resolve, 30));
    const avatar = createMaya({ ...cast[id], phaseOffset: id === 'claire' ? 2.3 : 4.7 }); scene.add(avatar.group);
    const life = id === 'mara' ? null : Object.assign(resident(id, 0, 8.4, delay), { phase: 'away', visible: false, waitForService: true });
    const body = life || { x: -4.7, z: -5.75, angle: 0 };
    const n = { id, avatar, life, ctl: new Actor(body, layout, { speed: .95 }), clock: 0, expression: null, exprUntil: 0, drink: null, studyStart: 0 };
    if (id === 'mara') { mara = n; n.ctl.speed = 1.1; }
    avatar.group.position.set(body.x, 0, body.z); avatar.group.rotation.y = body.angle; avatar.group.visible = id === 'mara';
    cafeWorld.person(id, 'npc', cast[id].name).userData.target.id = id;
    regulars.push(n);
  }
  baristaLoop();
  session = await api({ action: 'join', name: readSaved('maple-bean-name', 'Maya') }); if (Number.isFinite(session.x) && Number.isFinite(session.z)) { me.x = session.x; me.z = session.z; } $('player-name').textContent = session.name; $('avatar-initial').textContent = session.name[0].toUpperCase(); connect();
  api({ action: 'groups' }).then(r => { messenger.setGroups(r.groups); chat.ai = r.ai; }).catch(() => {});
  updateHUD(); $('notifications-badge').hidden = !notifications.some(n => !n.read);
  // Compile every shader up front (hidden regulars, ceilings, props included) so
  // nothing stutters the first time someone walks in or sits down.
  $('load-message').textContent = 'Warming up the espresso machine…';
  { const hiddenNow = []; scene.traverse(o => { if (!o.visible && !o.isLight && o !== collisionGroup) { hiddenNow.push(o); o.visible = true; } });
    try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn(e); }
    for (const o of hiddenNow) o.visible = false; }
  cameraMode('overview');

  let last = performance.now(), lastNetwork = 0, lastStats = 0, frameCount = 0, sending = false;
  const forward = new V(), right = new V(), dir = new V(), projected = new V();
  renderer.setAnimationLoop(ms => {
    const dt = Math.min(.04, (ms - last) / 1000), t = ms / 1000; last = ms;
    tickTimers(dt);
    layout.people = [me, ...regulars.map(n => n.life || n.ctl.body), ...[...remote.values()].filter(r => r.avatar.group.visible).map(r => r.avatar.group.position)];
    // ---- player movement
    if (keys.size && playerCtl.posture === 'stand' && !focus && !playing) {
      camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); right.crossVectors(forward, new V(0, 1, 0)); dir.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) dir.add(forward); if (keys.has('KeyS') || keys.has('ArrowDown')) dir.sub(forward);
      if (keys.has('KeyD') || keys.has('ArrowRight')) dir.add(right); if (keys.has('KeyA') || keys.has('ArrowLeft')) dir.sub(right);
      playerCtl.walking = false;
      if (dir.lengthSq() > .0001) {
        dir.normalize(); const nx = me.x + dir.x * .35, nz = me.z + dir.z * .35;
        // People are solid too: stop short instead of walking through someone.
        const blocked = [...regulars.map(n => n.avatar.group), ...[...remote.values()].map(r => r.avatar.group)].some(g => g.visible && Math.hypot(g.position.x - nx, g.position.z - nz) < .42 && Math.hypot(g.position.x - me.x, g.position.z - me.z) > Math.hypot(g.position.x - nx, g.position.z - nz));
        if (!blocked) playerCtl.push(dir.x * 1.75 * dt, dir.z * 1.75 * dt); else playerCtl.body.angle += Math.atan2(Math.sin(Math.atan2(dir.x, dir.z) - me.angle), Math.cos(Math.atan2(dir.x, dir.z) - me.angle)) * .3;
      }
    } else playerCtl.update(dt);
    player.set(me.x, 0, me.z);
    // ---- study session choreography
    let playerActivity = playerCtl.activity, sipping = sipUntil > t;
    if (focus?.stage === 'study' && focus.clock) {
      const elapsed = focusElapsed(focus.clock, nowMs()), remaining = focusRemaining(focus.clock, nowMs());
      const task = focus.clock.pausedAt ? 'think' : studyTaskFor(elapsed, 'me');
      if (task !== focus.task) {
        focus.task = task; $('focus-task').textContent = focus.clock.pausedAt ? 'Paused' : TASK_LABEL[task] || task;
        if (task === 'sip') { if (cupState.drink) { sipUntil = t + 1.8; } }
      }
      playerActivity = task === 'sip' ? null : task === 'glance' ? null : task;
      if (task === 'type' && !focus.seat.laptop) playerActivity = 'write';
      playerCtl.lookTarget = task === 'glance' && focus.partner ? focus.partner.avatar.group.position.clone().add(new V(0, 1.2, 0)) : null;
      if (task === 'glance' && focus.partner) { playerExpression = 'smile'; expressionUntil = t + .5; }
      $('focus-timer').textContent = formatRemaining(remaining);
      if (remaining <= 0) endFocus(true);
    }
    if (sipUntil && t >= sipUntil) { sipUntil = 0; try { cupState = sipDrink(cupState); saveCup(); if (!focus) toast(cupState.drink ? 'A warm sip. ' + cupState.sips + ' left.' : 'Last sip. That hit the spot.'); } catch { } }
    // ---- player pose
    const busyHands = !!playerActivity && playerActivity !== 'reach' && !sipping;
    tableCup('me', playerCtl.posture === 'seated' ? playerCtl.seat : null, cupState.drink && DRINKS[cupState.drink].color, cupState.drink && busyHands && playerCtl.posture === 'seated');
    maya.group.position.copy(player); maya.group.rotation.y = me.angle;
    const pv = playerCtl.visual();
    maya.update(t, dt, { ...pv, walking: pv.walking || (keys.size > 0 && playerCtl.walking), activity: sipping ? null : playerActivity, sipping, cup: !!cupState.drink, cupColor: cupState.drink ? DRINKS[cupState.drink].color : null, wave: t < waveUntil, expression: t < expressionUntil ? playerExpression : playerCtl.posture === 'seated' || t < waveUntil ? 'happy' : 'neutral' });
    // ---- regulars
    const occupied = new Set(occupiedSeats); if (playerCtl.seat) occupied.add(playerCtl.seat.id);
    for (const n of regulars) { if (n.life?.seat) occupied.add(n.life.seat.id); if (n.ctl.seat) occupied.add(n.ctl.seat.id); if (n.ctl.reservedSeat) occupied.add(n.ctl.reservedSeat.id); }
    for (const n of regulars) {
      n.clock += dt; const a = n.avatar, l = n.life;
      if (l && !l.scripted) {
        updateResident(l, dt, layout, occupied, player, n.talkingToPlayer);
        if (n.talkingToPlayer && l.phase !== 'seated') { const want = faceAngle(l, me); l.angle += Math.atan2(Math.sin(want - l.angle), Math.cos(want - l.angle)) * Math.min(1, dt * 6); }
        // A regular waiting at the counter joins the barista's queue once.
        if (l.phase === 'ordering' && !l.queued) { l.queued = true; const job = orderFor(n, l.drink, l.x); n.job = job;
          job.ready.then(async () => { l.scripted = true; n.ctl.posture = 'stand'; const received = await takeCup(n.ctl, a, job); n.drink = received ? l.drink : null; l.cup = received; l.served = received; l.scripted = false; if (!received) { l.phase = 'idle'; l.route = []; l.timer = 3; } }); }
        if (l.phase !== 'ordering') l.queued = false;
      } else n.ctl.update(dt);
      const body = l || n.ctl.body; a.group.position.set(body.x, 0, body.z); a.group.rotation.y = body.angle; a.group.visible = l ? l.visible : true;
      cafeWorld.placePerson(n.id, body.x, body.z, a.group.visible);
      // Ambient study at a desk: pick the headphones up, put them on, then study.
      let activity = null, headphones = false; const seated = l && !l.scripted && l.phase === 'seated';
      if (seated && l.seat?.kind === 'study') {
        n.studyStart ||= t; const since = t - n.studyStart, phones = cafeWorld.deskPhones.get(l.seat.id);
        if (since < 1) { activity = 'reach'; n.ctl.reach = phones ? { ...localTo(a, phones.position), side: -1, shape: 'grip' } : null; }
        else if (since < 2.3) { activity = 'ears'; headphones = 'hands'; }
        else { headphones = 'head'; activity = studyActivityAt(since, { offset: n.id.length * 23, hasDrink: l.cup }).activity; if (activity === 'sip' || activity === 'glance') activity = null; if (activity === 'type' && !cafeWorld.seatById(l.seat.id)?.laptop) activity = 'write'; }
        if (phones) phones.visible = since < .6;
      } else if (seated && l.seat?.kind === 'read') { activity = 'read'; }
      if (!seated && n.studyStart) { n.studyStart = 0; const phones = l?.seat && cafeWorld.deskPhones.get(l.seat.id); if (phones) phones.visible = true; }
      // Scripted: study together / games drive the pose instead.
      if (n.ctl.scriptedBy || n.id === 'mara') {
        const v = n.ctl.visual(); activity = v.activity; headphones = n.headphones || false;
        if (focus?.partner === n && focus.stage === 'study' && focus.clock && n.ctl.posture === 'seated') {
          const task = studyActivityAt(focusElapsed(focus.clock, nowMs()), { offset: 41, partner: true }).activity; headphones = 'head';
          activity = task === 'sip' || task === 'glance' ? null : task; if (activity === 'type' && !n.ctl.seat?.laptop) activity = 'write';
          n.ctl.lookTarget = task === 'glance' ? player.clone().add(new V(0, 1.2, 0)) : null; if (task === 'glance') { n.expression = 'smile'; n.exprUntil = t + .6; }
          const phones = cafeWorld.deskPhones.get(n.ctl.seat.id); if (phones) phones.visible = false;
        } else if (focus?.partner === n && focus.stage === 'enter') headphones = 'hands';
      }
      if (n.clock >= 1 / 15 || n.ctl.activity === 'reach') {
        const v = n.ctl.visual(), scripted = n.ctl.scriptedBy || n.id === 'mara' || l?.scripted;
        const hasCup = n.id === 'mara' ? !!n.drink : !!l?.cup;
        a.update(t + (n.id === 'claire' ? 2.3 : 4.7), n.clock, {
          walking: scripted ? v.walking : l?.walking, sitAmount: scripted ? v.sitAmount : (l?.sit ?? 0), seatHeight: (scripted ? n.ctl.seat : l?.seat)?.seatHeight ?? .54,
          deskHeight: (scripted ? n.ctl.seat : l?.seat)?.deskHeight ?? cafeWorld.seatById((scripted ? n.ctl.seat : l?.seat)?.id)?.deskHeight,
          activity: l?.sipping && !scripted ? null : activity, cupDown: false, reach: activity === 'reach' ? n.ctl.reach : null, headphones,
          cup: hasCup, cupColor: DRINKS[n.id === 'mara' ? n.drink : l?.drink]?.color, sipping: !scripted && l?.sipping,
          lookTarget: n.ctl.lookTarget || (n.talkingToPlayer ? player.clone().add(new V(0, 1.45, 0)) : null),
          expression: t < n.exprUntil ? n.expression : n.id === 'noah' ? 'neutral' : 'happy',
        });
        n.clock = 0;
      }
      const nSeat = (n.ctl.scriptedBy ? n.ctl.seat : l?.seat); tableCup(n.id, nSeat, DRINKS[l?.drink]?.color, !!l?.cup && !!activity && activity !== 'reach' && (n.ctl.scriptedBy ? n.ctl.posture === 'seated' : l.phase === 'seated') && !l?.sipping);
    }
    // ---- remote guests
    for (const item of remote.values()) {
      const d = item.data, avatar = item.avatar, old = avatar.group.position.clone(); avatar.group.position.x = THREE.MathUtils.damp(avatar.group.position.x, d.x, 12, dt); avatar.group.position.z = THREE.MathUtils.damp(avatar.group.position.z, d.z, 12, dt); avatar.group.rotation.y = d.angle;
      const seat = d.seatId && cafeWorld.seatById(d.seatId);
      avatar.update(t, dt, { sitting: !!d.seatId, seatHeight: seat?.seatHeight ?? .54, walking: old.distanceTo(avatar.group.position) > .003, wave: t < item.waveUntil, expression: t < item.waveUntil ? 'happy' : 'neutral' });
      item.marker.position.copy(avatar.group.position).add(new V(0, 1.95, 0)); cafeWorld.placePerson('guest:' + [...remote.entries()].find(([, v]) => v === item)[0], avatar.group.position.x, avatar.group.position.z);
    }
    steam.update(dt, [{ position: cupWorldPosition(player.x, player.z, me.angle), active: !!cupState.drink && playerCtl.posture !== 'seated' }]);
    playing?.ctl?.update?.(dt, t);
    // ---- camera
    if (cameraTween) { const a = cameraTween; a.t = Math.min(1, a.t + dt / (reduced ? .01 : a.seconds)); const k = a.t * a.t * (3 - 2 * a.t); camera.position.lerpVectors(a.from, a.to, k); controls.target.lerpVectors(a.fromTarget, a.target, k); if (a.t === 1) cameraTween = null; }
    else if (mode === 'walk' && !framing) { const delta = player.clone().sub(previousPlayer); camera.position.add(delta); controls.target.add(delta); }
    previousPlayer.copy(player); controls.update();
    // Keep the camera inside the building while you are inside it: swing it
    // around you to the nearest angle that stays indoors (keeping its height and
    // distance), and only slide it closer if no angle fits. Eased, never snapped.
    if (mode === 'walk' && !cameraTween && insideCafe(player.x, player.z, 0) && !insideCafe(camera.position.x, camera.position.z, .18)) {
      const t0 = controls.target, off = camera.position.clone().sub(t0); let best = null;
      for (let k = 1; k <= 12 && !best; k++) for (const sgn of [1, -1]) { const q = off.clone().applyAxisAngle(new V(0, 1, 0), sgn * k * Math.PI / 12); if (insideCafe(t0.x + q.x, t0.z + q.z, .18)) { best = t0.clone().add(q); break; } }
      if (!best) { let lo = 0, hi = 1; for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2, q = t0.clone().addScaledVector(off, mid); if (insideCafe(q.x, q.z, .18)) lo = mid; else hi = mid; } best = t0.clone().addScaledVector(off, Math.max(.45, lo)); best.y = Math.max(best.y, t0.y + .8); }
      camera.position.lerp(best, Math.min(1, dt * 5)); controls.update();
    }
    const sight = new THREE.Ray(camera.position, controls.target.clone().sub(camera.position).normalize()), hit = new V(), distance = camera.position.distanceTo(controls.target);
    for (const mesh of obstructions) { const blocked = mode === 'walk' && sight.intersectBox(mesh.userData.sightBounds, hit) && camera.position.distanceTo(hit) < distance - .25; mesh.material.transparent = !!blocked; mesh.material.opacity = blocked ? .12 : 1; mesh.material.depthWrite = !blocked; }
    visualDetails.update(t, mode); cafeWorld.update(t, mode);
    // ---- contextual actions
    if (!focus && !playing) {
      const acts = [];
      if (playerCtl.posture === 'seated') {
        if (playerCtl.seat?.kind === 'study') acts.push({ label: '📚 Study', primary: true, key: 'E', run: () => beginFocus(playerCtl.seat, null) });
        acts.push({ label: hanging ? 'Say goodbye' : 'Stand up', primary: playerCtl.seat?.kind !== 'study', key: playerCtl.seat?.kind === 'study' ? '' : 'E', run: () => { startScript('stand'); standPlayer(); } });
        if (playerCtl.seat?.kind === 'read') acts.push({ label: '📖 Browse the shelf', key: 'B', run: () => toast(randomBrowseLine()) });
      }
      if (cupState.drink) acts.push({ label: '☕ Sip · ' + cupState.sips, key: 'R', run: sip });
      setContext(acts);
    } else if (playing) setContext([]);
    // ---- labels
    for (const marker of markers) {
      projected.copy(marker.position).project(camera);
      const zone = marker.el.classList.contains('zone'), show = zone ? mode !== 'walk' : true;
      marker.el.hidden = !show || projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1;
      marker.el.style.left = (projected.x * .5 + .5) * world.clientWidth + 'px'; marker.el.style.top = (-projected.y * .5 + .5) * world.clientHeight + 'px';
    }
    if (npcMenuFor && !$('npc-menu').hidden) { projected.copy(npcMenuFor.avatar.group.position).add(new V(0, 1.9, 0)).project(camera); const mh = $('npc-menu').offsetHeight, mw = $('npc-menu').offsetWidth; $('npc-menu').style.left = THREE.MathUtils.clamp((projected.x * .5 + .5) * world.clientWidth, mw / 2 + 8, world.clientWidth - mw / 2 - 8) + 'px'; $('npc-menu').style.top = THREE.MathUtils.clamp((-projected.y * .5 + .5) * world.clientHeight, mh + 60, world.clientHeight - 8) + 'px'; }
    fire.intensity = lighting.preset.fire * (1 + .045 * Math.sin(t * 6) + .02 * Math.sin(t * 11));
    // Keep the café camera outside visible characters, including seated heads.
    if (mode === 'walk') for (const avatar of [maya, ...regulars.map(n => n.avatar), ...[...remote.values()].map(r => r.avatar)]) {
      if (!avatar.group.visible) continue;
      const head = avatar.head.getWorldPosition(new V()), offset = camera.position.clone().sub(head), distance = offset.length();
      if (distance < .48) { if (distance < .001) offset.set(0, .2, 1); camera.position.copy(head).add(offset.normalize().multiplyScalar(.48)); }
    }
    renderer.render(scene, camera); frameCount++;
    const myStatus = deriveStatus({ seated: playerCtl.posture === 'seated', stationKind: playerCtl.seat?.kind, focusActive: !!focus?.clock, focusDetail: focus?.clock ? formatRemaining(focusRemaining(focus.clock, nowMs())) + ' remaining' : null, musicPlaying: !!settings.shareMusic && musicPlaying, hasDrink: !!cupState.drink, playing: !!playing });
    if (settings.shareMusic && musicPlaying) myStatus.detail = [myStatus.detail, '🎧 Music'].filter(Boolean).join(' · ');
    if (ms - lastNetwork > 200 && !sending && !sessionDead) { lastNetwork = ms; sending = true; api({ action: 'move', x: me.x, z: me.z, angle: me.angle, status: myStatus.id, statusDetail: myStatus.detail }).catch(() => {}).finally(() => sending = false); }
    if (ms - lastStats > 1500) { $('stats').textContent = `${Math.round(frameCount * 1000 / (ms - lastStats))} fps · ${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles / 1000)}k triangles · ${layout.area} m² across 3 rooms.`; frameCount = 0; lastStats = ms; }
    window.__ready = true;
  });
  $('loading').style.opacity = 0; setTimeout(() => $('loading').hidden = true, 550);
  window.cafe = {
    scene, camera, controls, renderer, get maya() { return maya; }, creator, openCreator, regulars, layout, player, world: cafeWorld, playerCtl, me, chat, messenger,
    goToStation, useTarget, cameraMode, startGame, studyAt, beginFocus, endFocus, orderAtCounter, waterPlant, talkTo, hangOut, studyTogether, leaveGame, openShop, closeShop, goHome, setTimeScale,
    get script() { return script?.name + (script?.cancelled ? " (cancelled)" : ""); }, get econ() { return econ; }, get cup() { return cupState; }, get focus() { return focus; }, get playing() { return playing; }, get wardrobe() { return wardrobe; }, get bonds() { return bonds; },
    npc: npcById, seat: id => cafeWorld.seatById(id),
    get state() { return { mode, seated: playerCtl.seat?.id, posture: playerCtl.posture, drink: cupState.drink, session: session?.id, remote: remote.size, focus: focus?.stage, playing: playing?.st.game, coins: econ.coins }; },
    qa,
  };
} catch (e) { failure(e); }

