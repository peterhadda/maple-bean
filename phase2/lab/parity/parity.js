import * as THREE from 'three';
import { createMaya as canonicalCreate } from '/maya-character.js';
import { cast } from '/characters.js';
import { createResident, legacyLook } from '/phase2/character-kit/index.js';

const log = document.getElementById('log');
const params = new URLSearchParams(location.search);
const ids = params.get('ids')?.split(',') || Object.keys(cast);
const lines = [];
const say = s => { lines.push(s); log.textContent = lines.join('\n'); };

// The same update sequence is replayed on A and B. Covers bind pose, gait,
// seating, waving, sipping, expressions and blinks (seeded rand inside).
const STEPS = [
  [0, 0, { still: true }],
  [1.0, .10, { walking: true }],
  [1.1, .10, { walking: true }],
  [2.0, .50, { sitting: true, seatHeight: .44 }],
  [3.0, .50, { wave: true, expression: 'happy' }],
  [4.0, .50, { cup: true, sipping: true, expression: 'wink' }],
  [7.3, .04, { walking: true, cup: true }],
];

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(256, 512);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const target = new THREE.WebGLRenderTarget(256, 512, { samples: 0 });
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d5d6bd');
scene.add(new THREE.HemisphereLight(0xffedd2, 0x819178, 2.1));
const sun = new THREE.DirectionalLight(0xffdfad, 3.3); sun.position.set(-2, 4, 3); sun.castShadow = true; scene.add(sun);
const camera = new THREE.PerspectiveCamera(26, .5, .05, 20); camera.position.set(.6, 1.05, 4.2); camera.lookAt(0, .85, 0);

const meshesOf = group => { const out = []; group.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
function sameBytes(a, b) {
  if (!a && !b) return true;
  if (!a || !b || a.constructor !== b.constructor || a.length !== b.length) return false;
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
const pixelCache = new WeakMap();
function texturePixels(tex) {
  if (!tex) return null;
  if (pixelCache.has(tex)) return pixelCache.get(tex);
  const im = tex.image; let data = null;
  if (im instanceof HTMLCanvasElement) data = im.getContext('2d').getImageData(0, 0, im.width, im.height).data;
  else if (im?.data) data = im.data;
  pixelCache.set(tex, data); return data;
}
function sameTexture(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const props = t => JSON.stringify([t.image?.width, t.image?.height, t.colorSpace, t.premultiplyAlpha, t.anisotropy, t.wrapS, t.wrapT, t.repeat.toArray(), t.offset.toArray(), t.minFilter, t.magFilter, t.flipY]);
  return props(a) === props(b) && sameBytes(texturePixels(a), texturePixels(b));
}
const MATERIAL_KEYS = ['type', 'roughness', 'metalness', 'specularIntensity', 'sheen', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness',
  'envMapIntensity', 'side', 'vertexColors', 'transparent', 'toneMapped', 'polygonOffset', 'polygonOffsetFactor', 'wireframe', 'opacity'];
function materialDiff(a, b) {
  const out = [];
  for (const k of MATERIAL_KEYS) if (a[k] !== b[k]) out.push(`${k} ${a[k]} ≠ ${b[k]}`);
  for (const k of ['color', 'sheenColor', 'emissive']) if (a[k] && !a[k].equals(b[k])) out.push(`${k} differs`);
  if (a.normalScale && !a.normalScale.equals(b.normalScale)) out.push('normalScale differs');
  for (const k of ['map', 'normalMap']) if (!sameTexture(a[k], b[k])) out.push(`${k} texture differs`);
  // Line endings only: the canonical file is checked out with CRLF.
  const source = f => String(f).replace(/\r\n/g, '\n');
  if (source(a.onBeforeCompile) !== source(b.onBeforeCompile)) out.push('onBeforeCompile source differs');
  if ((a.customProgramCacheKey?.() ?? '') !== (b.customProgramCacheKey?.() ?? '')) out.push('program cache key differs');
  const ua = a.userData.shader?.uniforms, ub = b.userData.shader?.uniforms;
  if (!!ua !== !!ub) out.push('compiled shader presence differs');
  else if (ua) for (const k of Object.keys(ua).filter(k => k.startsWith('u'))) {
    const va = ua[k].value, vb = ub[k]?.value;
    if (va?.isTexture ? !sameTexture(va, vb) : va?.equals ? !va.equals(vb) : va !== vb) out.push(`uniform ${k} differs`);
  }
  return out;
}
function geometryDiff(a, b, only) {
  const out = [];
  const names = new Set([...Object.keys(a.attributes), ...Object.keys(b.attributes)]);
  for (const n of names) if ((!only || only.includes(n)) && !sameBytes(a.attributes[n]?.array, b.attributes[n]?.array)) out.push(`attribute ${n} differs`);
  if (!only && !sameBytes(a.index?.array, b.index?.array)) out.push('index differs');
  if (!only) for (const n of new Set([...Object.keys(a.morphAttributes), ...Object.keys(b.morphAttributes)])) {
    const ma = a.morphAttributes[n] || [], mb = b.morphAttributes[n] || [];
    if (ma.length !== mb.length || ma.some((m, i) => !sameBytes(m.array, mb[i].array))) out.push(`morph ${n} differs`);
  }
  if (!only && JSON.stringify(a.groups) !== JSON.stringify(b.groups)) out.push('groups differ');
  return out;
}
const transformSig = o => [...o.matrix.elements, o.visible ? 1 : 0, ...(o.morphTargetInfluences || [])];
function compareState(A, B, label, full) {
  const ma = meshesOf(A.group), mb = meshesOf(B.group), issues = [];
  if (ma.length !== mb.length) return [`${label}: mesh count ${ma.length} ≠ ${mb.length}`];
  A.group.updateMatrixWorld(true); B.group.updateMatrixWorld(true);
  for (let i = 0; i < ma.length; i++) {
    const a = ma[i], b = mb[i], where = `${label} mesh#${i} "${a.name}"`;
    if (a.name !== b.name) issues.push(`${where}: name ≠ "${b.name}"`);
    for (const d of geometryDiff(a.geometry, b.geometry, full ? null : ['position', 'normal'])) issues.push(`${where}: ${d}`);
    if (!sameBytes(new Float64Array(transformSig(a)), new Float64Array(transformSig(b)))) issues.push(`${where}: transform/visibility/morph influence differs`);
    if (full) for (const d of materialDiff(a.material, b.material)) issues.push(`${where}: ${d}`);
    if (issues.length > 40) break;
  }
  return issues;
}
function renderPixels(group) {
  scene.add(group); renderer.setRenderTarget(target); renderer.render(scene, camera);
  const px = new Uint8Array(256 * 512 * 4); renderer.readRenderTargetPixels(target, 0, 0, 256, 512, px);
  renderer.setRenderTarget(null); renderer.render(scene, camera);
  const img = new Image(); img.src = renderer.domElement.toDataURL(); img.width = 128; img.title = group.name;
  scene.remove(group); return { px, img };
}
function dispose(group) {
  group.traverse(o => { if (!o.isMesh) return; o.geometry.dispose(); for (const k of ['map', 'normalMap']) o.material[k]?.dispose(); o.material.dispose(); });
}

const report = { ok: true, residents: [] };
for (const id of ids) {
  const started = performance.now();
  const A = canonicalCreate(cast[id]); const buildA = performance.now() - started;
  // ?control=tweak proves the harness can fail: B's skin is off by one unit.
  const lookB = { ...legacyLook(id), skinning: 'cpu' };
  if (params.get('control') === 'tweak') lookB.colors.skin += 1;
  const t1 = performance.now(); const B = createResident(lookB); const buildB = performance.now() - t1;
  const issues = [];
  // Render first so onBeforeCompile runs and compiled uniforms can be compared.
  const ra = renderPixels(A.group), rb = renderPixels(B.group);
  issues.push(...compareState(A, B, 'bind', true));
  for (const [t, dt, state] of STEPS) {
    A.update(t, dt, state); B.update(t, dt, state);
    issues.push(...compareState(A, B, `update(${t},${JSON.stringify(state)})`, false));
    if (issues.length > 40) break;
  }
  const pa = renderPixels(A.group), pb = renderPixels(B.group);
  let diffPixels = 0; for (let i = 0; i < pa.px.length; i += 4) if (pa.px[i] !== pb.px[i] || pa.px[i + 1] !== pb.px[i + 1] || pa.px[i + 2] !== pb.px[i + 2]) diffPixels++;
  let bindDiff = 0; for (let i = 0; i < ra.px.length; i += 4) if (ra.px[i] !== rb.px[i] || ra.px[i + 1] !== rb.px[i + 1] || ra.px[i + 2] !== rb.px[i + 2]) bindDiff++;
  if (diffPixels || bindDiff) issues.push(`rendered frames differ: bind ${bindDiff}px, posed ${diffPixels}px`);
  const meshes = meshesOf(A.group).length;
  const entry = { id, ok: issues.length === 0, meshes, buildMsCanonical: Math.round(buildA), buildMsKit: Math.round(buildB), issues: issues.slice(0, 40) };
  report.residents.push(entry); report.ok &&= entry.ok;
  say(`${entry.ok ? 'PASS' : 'FAIL'} ${id}: ${meshes} meshes, build A ${entry.buildMsCanonical} ms / B ${entry.buildMsKit} ms${entry.ok ? '' : '\n  ' + entry.issues.join('\n  ')}`);
  const row = document.createElement('div'); row.append(`${id}: `, ra.img, rb.img, pa.img, pb.img); document.getElementById('shots').append(row);
  dispose(A.group); dispose(B.group);
  await new Promise(r => setTimeout(r, 0));
}
say(report.ok ? '\nALL IDENTICAL' : '\nPARITY FAILED');
window.__parity = report;
