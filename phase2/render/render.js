// Canonical render capture. Characters come from the production generator
// (/maya-character.js + /characters.js), unmodified, so every PNG exported to
// design-assets/ is exactly what the game renders. Figma and Canva consume
// these files; nothing here ever writes back into the game.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaya } from '/maya-character.js';
import { cast } from '/characters.js';

const log = document.getElementById('log');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.cssText = 'max-width:320px;border:1px dashed #999';
document.body.append(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

// ---------------------------------------------------------------- characters (studio lighting, as maya.html)
const studio = new THREE.Scene();
studio.environment = environment; studio.environmentIntensity = .42;
studio.add(new THREE.HemisphereLight(0xfff3e5, 0xd8c7b4, 1.7));
const key = new THREE.DirectionalLight(0xfff0df, 2.6); key.position.set(2, 4, 4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.normalBias = .006; key.shadow.bias = -.0002;
Object.assign(key.shadow.camera, { left: -1, right: 1, top: 2, bottom: -.2, near: .1, far: 12 }); studio.add(key);
const rim = new THREE.DirectionalLight(0xe3ebff, 1.3); rim.position.set(-2, 3, -3); studio.add(rim);

const residents = new Map();
function resident(id) {
  if (!residents.has(id)) residents.set(id, { actor: createMaya(cast[id]), phase: 0, walk: 0 });
  return residents.get(id);
}
export const VIEWS = { front: 0, '34-front': 35, side: 90, '34-back': 145, back: 180 };
export const POSES = ['idle', 'walking', 'waving', 'holding-coffee', 'sipping'];

// Settle a pose deterministically. Blinks only start after t=2.5, so t stays at 1.
function pose(r, name) {
  const a = r.actor;
  if (name === 'walking') {
    // Mirror the generator's easing to land on a full stride (cos(phase) = 1).
    for (let i = 0; i < 24; i++) { const e = 1 - Math.exp(-.2 * 9); r.walk += (1 - r.walk) * e; r.phase += .2 * 10.2 * r.walk; a.update(1, .2, { walking: true, expression: 'neutral' }); }
    const e = 1 - Math.exp(-.001 * 9), w = r.walk + (1 - r.walk) * e;
    const target = Math.ceil(r.phase / (2 * Math.PI)) * 2 * Math.PI + Math.PI * .08, dt = (target - r.phase) / (10.2 * w);
    r.walk = w; r.phase = target; a.update(1, dt, { walking: true, expression: 'happy' });
    return;
  }
  const state = { idle: { expression: 'neutral' }, waving: { wave: true, expression: 'happy' }, 'holding-coffee': { cup: true, expression: 'happy' }, sipping: { cup: true, sipping: true, expression: 'neutral' } }[name];
  a.update(1, 0, { ...state, still: true });
  r.walk = 0;
}

async function png(canvas) {
  return canvas.toDataURL('image/png');
}

window.renderCharacter = async function (id, view, poseName, { width = 1024, height = 2048 } = {}) {
  const r = resident(id);
  renderer.setSize(width, height, false); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  pose(r, poseName);
  r.actor.group.rotation.y = -VIEWS[view] * Math.PI / 180;
  const camera = new THREE.PerspectiveCamera(26, width / height, .05, 40);
  camera.position.set(0, .885 + .035 * 4.9, 4.9); camera.lookAt(0, .885, 0);
  studio.add(r.actor.group); renderer.render(studio, camera); studio.remove(r.actor.group);
  r.actor.group.rotation.y = 0;
  return png(renderer.domElement);
};

window.renderHeadshot = async function (id, { size = 1024, angle = 14, expression = 'happy' } = {}) {
  const r = resident(id);
  renderer.setSize(size, size, false); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  r.actor.update(1, 0, { still: true, expression });
  r.actor.group.rotation.y = -angle * Math.PI / 180;
  const camera = new THREE.PerspectiveCamera(26, 1, .05, 40);
  camera.position.set(0, 1.53, 1.72); camera.lookAt(0, 1.48, 0);
  studio.add(r.actor.group); renderer.render(studio, camera); studio.remove(r.actor.group);
  r.actor.group.rotation.y = 0;
  return png(renderer.domElement);
};

// ---------------------------------------------------------------- café scenes (café lighting, as app.js afternoon)
let cafe = null;
async function loadCafe() {
  if (cafe) return cafe;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d5d6bd'); scene.fog = new THREE.Fog('#d5d6bd', 45, 95);
  scene.environment = environment; scene.environmentIntensity = .45;
  scene.add(new THREE.HemisphereLight(0xffedd2, 0x819178, 2.1));
  const sun = new THREE.DirectionalLight(0xffdfad, 3.3); sun.position.set(-9, 17, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.normalBias = .035; sun.shadow.bias = -.00015; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: .1, far: 60 }); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xd7e8f7, 1); fill.position.set(7, 9, -7); scene.add(fill);
  for (const [x, z] of [[-7, -3], [-3, -3], [2, -3], [7, -3], [-7, 3], [-3, 3], [2, 3], [7, 3]]) { const l = new THREE.PointLight(0xffc775, 6, 6, 2); l.position.set(x, 2.55, z); scene.add(l); }
  const fire = new THREE.PointLight(0xff9347, 8, 5, 2); fire.position.set(8.6, .65, -4); scene.add(fire);
  const [layout, gltf] = await Promise.all([fetch('/assets/layout.json').then(r => r.json()), new GLTFLoader().loadAsync('/assets/cafe.glb')]);
  // Same merge as app.js addCafe: one mesh per material, overhead pieces kept separate.
  const root = gltf.scene; root.updateMatrixWorld(true); const batches = new Map(), beams = new THREE.Group();
  root.traverse(o => {
    if (!o.isMesh) return;
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const a of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(a)) geometry.deleteAttribute(a);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const overhead = /Ceiling_beam|Pendant_cord|Pendant_shade|Pendant_warm_diffuser/.test(o.name);
    const k = o.material.uuid + overhead;
    if (!batches.has(k)) batches.set(k, { mat: o.material, parts: [], overhead });
    batches.get(k).parts.push(g);
  });
  for (const { mat, parts, overhead } of batches.values()) {
    const m = new THREE.Mesh(mergeGeometries(parts), mat); m.castShadow = true; m.receiveShadow = true; (overhead ? beams : scene).add(m);
  }
  scene.add(beams);
  cafe = { scene, layout, beams, placed: [] };
  return cafe;
}

// Stage residents in the real café. spec: [{id, x, z, angle, sit?:stationId, pose}]
window.renderCafeShot = async function ({ width = 1920, height = 1080, camera: c, residents: cast_ = [], beams = true, fov = 42 }) {
  const { scene, layout } = await loadCafe();
  for (const g of cafe.placed) scene.remove(g); cafe.placed = [];
  renderer.setSize(width, height, false); renderer.setClearColor(0xd5d6bd, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  cafe.beams.visible = beams;
  for (const spec of cast_) {
    const r = resident(spec.id), a = r.actor;
    let { x, z, angle = 0 } = spec, seatHeight = .54;
    if (spec.sit) { const s = layout.stations.find(s => s.id === spec.sit); ({ x, z, angle, seatHeight } = s); a.update(1, 0, { still: true, sitting: true, seatHeight, cup: !!spec.cup, expression: spec.expression || 'happy' }); }
    else if (spec.pose === 'walking') { pose(r, 'walking'); }
    else a.update(1, 0, { still: true, wave: spec.pose === 'waving', cup: !!spec.cup, sipping: !!spec.sipping, expression: spec.expression || 'happy' });
    a.group.position.set(x, 0, z); a.group.rotation.y = angle;
    scene.add(a.group); cafe.placed.push(a.group);
  }
  const camera = new THREE.PerspectiveCamera(fov, width / height, .1, 150);
  camera.position.set(...c.position); camera.lookAt(...c.target);
  renderer.render(scene, camera);
  const out = await png(renderer.domElement);
  for (const g of cafe.placed) { scene.remove(g); g.position.set(0, 0, 0); g.rotation.y = 0; }
  cafe.placed = [];
  return out;
};

window.captureReady = true;
log.textContent = 'Ready. Residents: ' + Object.keys(cast).join(', ');
