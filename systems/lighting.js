import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Maple Bean lighting rig (A2). Sky, sun and fill light the shell. Warm spot pools hang
// under every pendant. Cheap additive floor pools and bulb glows sell the cozy look
// without extra shadow maps. Presets: afternoon · evening · day.
export const PENDANTS = [[-7, -3], [-3, -3], [2, -3], [7, -3], [-7, 3], [-3, 3], [2, 3], [7, 3]];
const WING_PENDANTS = [[11.8, -4.2], [15.2, -4.2], [13.6, -1.95], [1.2, -10.6], [4, -10.9]];
const PRESETS = {
  afternoon: { exposure: 1.1, bg: '#c8cbb6', sky: 0xffe2b8, ground: 0x6e604b, hemi: .78, env: .2, sun: 4.2, sunColor: 0xffc98e, fill: .22, lamp: 20, accent: 11, pool: .2, glow: .45, emissive: 1.5, wing: 7, fire: 6 },
  evening: { exposure: 1.2, bg: '#34433e', sky: 0xc2bda7, ground: 0x78614b, hemi: .78, env: .22, sun: .35, sunColor: 0x9fb4dc, fill: .16, lamp: 32, accent: 36, pool: .18, glow: .72, emissive: 2.2, wing: 11, fire: 12 },
  day: { exposure: 1.06, bg: '#c8cbb6', sky: 0xfff3e2, ground: 0x857a64, hemi: 1.25, env: .3, sun: 3.4, sunColor: 0xfff1dc, fill: .45, lamp: 9, accent: 5, pool: .07, glow: .18, emissive: 1.1, wing: 5, fire: 5 },
};
function radial(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d'), g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, col] of stops) g.addColorStop(t, col); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createLighting(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .45; pmrem.dispose();
  const ambient = new THREE.HemisphereLight(0xffedd2, 0x819178, 2.1); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffdfad, 3.3); sun.position.set(-12, 9, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .012; sun.shadow.bias = -.00008; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: .1, far: 70 }); sun.target.position.set(3, 0, -3); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xd7e8f7, 1); fill.position.set(7, 9, -7); scene.add(fill);
  // Pendant pools: soft-edged spots under each shade light tables and floor in warm circles.
  const lamps = PENDANTS.map(([x, z]) => { const l = new THREE.SpotLight(0xffc47e, 20, 9, .84, .9, 2); l.position.set(x, 2.7, z); l.target.position.set(x, 0, z); scene.add(l, l.target); return l; });
  // Accents: the bar's menu wall and the reading-nook bookcase get a warm wash.
  const accents = [[[-3.4, 3, -4.3], [-3.4, 1.85, -6.6], .72], [[-7.6, 3.4, 3.8], [-9.6, 1.1, 3.8], .75]].map(([p, t, a]) => { const l = new THREE.SpotLight(0xffd197, 11, 10, a, 1, 2); l.position.set(...p); l.target.position.set(...t); scene.add(l, l.target); return l; });
  const fire = new THREE.PointLight(0xff9347, 8, 5, 2); fire.position.set(8.6, .65, -4); scene.add(fire);
  // Floor light pools (one instanced additive draw) and bulb glows (one Points draw).
  const all = [...PENDANTS.map(([x, z]) => [x, z, 2.72, 3.6]), ...WING_PENDANTS.map(([x, z]) => [x, z, 2.76, 3.2])];
  const poolMat = new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(255,196,120,1)'], [.35, 'rgba(255,170,90,.55)'], [1, 'rgba(255,150,70,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .2, polygonOffset: true, polygonOffsetFactor: -2 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, all.length), d = new THREE.Object3D();
  all.forEach(([x, z, , s], i) => { d.position.set(x, .013, z); d.scale.set(s, 1, s); d.updateMatrix(); pools.setMatrixAt(i, d.matrix); }); pools.name = 'Pendant light pools'; pools.renderOrder = 2; scene.add(pools);
  const glowGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(all.flatMap(([x, z, y]) => [x, y - .03, z]), 3));
  const glowMat = new THREE.PointsMaterial({ map: radial([[0, 'rgba(255,236,190,1)'], [.2, 'rgba(255,205,130,.75)'], [.5, 'rgba(255,170,80,.18)'], [1, 'rgba(255,150,60,0)']]), size: .9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .45 });
  const glows = new THREE.Points(glowGeo, glowMat); glows.name = 'Pendant bulb glow'; glows.renderOrder = 3; scene.add(glows);
  let preset = PRESETS.afternoon, wing = null, warm = null;
  function apply(mode) {
    const p = preset = PRESETS[mode] || PRESETS.afternoon;
    renderer.toneMappingExposure = p.exposure; scene.environmentIntensity = p.env;
    ambient.color.set(p.sky); ambient.groundColor.set(p.ground); ambient.intensity = p.hemi;
    sun.intensity = p.sun; sun.color.set(p.sunColor); fill.intensity = p.fill;
    lamps.forEach(l => l.intensity = p.lamp); accents.forEach(l => l.intensity = p.accent); fire.intensity = p.fire;
    poolMat.opacity = p.pool; glowMat.opacity = p.glow;
    scene.background.set(p.bg); scene.fog?.color.copy(scene.background);
    wing = null; warm = null; tries = 0; // re-synced on the next frame (wing lights and emissive shades load later)
  }
  // Per-frame: sync lights/materials created after start-up (wing pendants, warm shades).
  const previous = scene.onBeforeRender; let tries = 0;
  scene.onBeforeRender = (...args) => {
    previous?.apply(scene, args);
    if ((wing && warm) || tries > 900) return; tries++;
    if (!wing) { const g = scene.getObjectByName('Wing lighting'); if (g) { wing = g; g.traverse(o => { if (o.isPointLight) o.intensity = preset.wing; }); } }
    if (!warm) { const found = new Set(); scene.traverse(o => { const m = o.material; if (m && !Array.isArray(m) && /warm light/i.test(m.name)) found.add(m); }); if (found.size) { warm = [...found]; warm.forEach(m => m.emissiveIntensity = preset.emissive); } }
  };
  return { ambient, sun, fill, lamps, accents, fire, pools, glows, apply, get preset() { return preset; } };
}
