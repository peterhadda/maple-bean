import * as THREE from 'three';
import { createResident, legacyLook, CANONICAL_IDS } from '/phase2/character-kit/index.js';

const params = new URLSearchParams(location.search);
const ids = params.get('ids')?.split(',') || CANONICAL_IDS;
const log = document.getElementById('log'), lines = [];
const say = s => { lines.push(s); log.textContent = lines.join('\n'); };

const W = 256, H = 512;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const target = new THREE.WebGLRenderTarget(W, H);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d5d6bd');
scene.add(new THREE.HemisphereLight(0xffedd2, 0x819178, 2.1));
const sun = new THREE.DirectionalLight(0xffdfad, 3.3); sun.position.set(-2, 4, 3); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 2.2, bottom: -.2 }); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0xc19972 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(26, W / H, .05, 20); camera.position.set(.9, 1.1, 4.4); camera.lookAt(0, .85, 0);
const background = new THREE.Color('#d5d6bd');

const STEPS = [
  ['bind', 0, 0, { still: true }],
  ['walk a', 1.0, .10, { walking: true }],
  ['walk b', 1.3, .10, { walking: true }],
  ['sit', 2.5, .60, { sitting: true, seatHeight: .44 }],
  ['wave', 3.5, .60, { wave: true, expression: 'happy' }],
  ['sip', 4.5, .60, { cup: true, sipping: true }],
];

function shoot(group) {
  scene.add(group); renderer.setRenderTarget(target); renderer.render(scene, camera);
  const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(target, 0, 0, W, H, px);
  renderer.setRenderTarget(null); renderer.render(scene, camera);
  const img = new Image(); img.src = renderer.domElement.toDataURL(); img.width = 96;
  scene.remove(group); return { px, img };
}
function compare(a, b) {
  const bg = [background.r, background.g, background.b].map(v => Math.round(v * 255));
  let silhouette = 0, differing = 0, sumAbs = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    const isFigure = Math.abs(a[i] - bg[0]) + Math.abs(a[i + 1] - bg[1]) + Math.abs(a[i + 2] - bg[2]) > 6 || d > 0;
    if (isFigure) { silhouette++; sumAbs += d; if (d > 12) differing++; }
  }
  return { silhouette, differing, pct: +(100 * differing / Math.max(1, silhouette)).toFixed(2), meanAbs: +(sumAbs / Math.max(1, silhouette)).toFixed(2) };
}
function timeWalk(resident, n = 40) {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) resident.update(10 + i * .05, .05, { walking: true });
  return +((performance.now() - t0) / n).toFixed(2);
}

const report = { residents: [] };
for (const id of ids) {
  const cpu = createResident({ ...legacyLook(id), skinning: 'cpu' });
  const gpu = createResident({ ...legacyLook(id), skinning: 'gpu' });
  const row = document.createElement('div'); row.append(id + ': '); document.getElementById('shots').append(row);
  const steps = [];
  for (const [label, t, dt, state] of STEPS) {
    cpu.update(t, dt, state); gpu.update(t, dt, state);
    const a = shoot(cpu.group), b = shoot(gpu.group);
    steps.push({ label, ...compare(a.px, b.px) });
    row.append(a.img, b.img);
  }
  const entry = { id, skinning: gpu.skinning, steps, cpuWalkUpdateMs: timeWalk(cpu), gpuWalkUpdateMs: timeWalk(gpu) };
  report.residents.push(entry);
  say(`${id} (${entry.skinning}): walk update CPU ${entry.cpuWalkUpdateMs} ms vs GPU ${entry.gpuWalkUpdateMs} ms\n  ` +
    steps.map(s => `${s.label}: ${s.pct}% px differ (mean |Δ| ${s.meanAbs})`).join('\n  '));
  await new Promise(r => setTimeout(r, 0));
}
report.worstPct = Math.max(...report.residents.flatMap(r => r.steps.map(s => s.pct)));
say(`\nworst silhouette difference: ${report.worstPct}%`);
window.__gpuSkin = report;
