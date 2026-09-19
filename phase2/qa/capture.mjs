// Exports canonical game renders to design-assets/ for Figma and Canva.
// Usage: node phase2/qa/capture.mjs [characters|headshots|scenes|all] [ids]
// Needs the phase2 server on :4322. Headless SwiftShader: slow but deterministic.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.env.PHASE2_URL || 'http://127.0.0.1:4322';
const what = process.argv[2] || 'all';
const ids = (process.argv[3] || 'maya,mara,jules,claire').split(',');
const assets = fileURLToPath(new URL('../../design-assets/', import.meta.url));
const save = (rel, dataUrl) => { const file = path.join(assets, rel); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('saved', rel); };

export const SCENES = {
  'hero-wide': {
    camera: { position: [3.0, 1.65, 6.4], target: [.2, 1.1, -3.0] }, fov: 44,
    residents: [
      { id: 'mara', x: -4.7, z: -5.75, angle: .35, pose: 'idle' },
      { id: 'maya', x: 1.6, z: 3.9, angle: .51, pose: 'walking' },
      { id: 'claire', sit: 'sofa', cup: true },
      { id: 'jules', x: -.8, z: .9, angle: .6, pose: 'waving' },
    ],
  },
  // Homepage: residents in the right two-thirds, counter side left for copy.
  'home-hero': {
    camera: { position: [-2.5, 1.6, 6.3], target: [1.5, 1.05, -2.5] }, fov: 50, aspect: 1.6,
    residents: [
      { id: 'mara', x: -4.7, z: -5.75, angle: .3, pose: 'idle' },
      { id: 'maya', x: -.17, z: 2.42, angle: -.54, pose: 'walking' },
      { id: 'jules', x: 4.35, z: -2.67, angle: -.65, pose: 'waving' },
      { id: 'claire', x: 6.86, z: -.42, angle: -.95, pose: 'holding-coffee', cup: true },
    ],
  },
  // Behind UI screens that place their own characters: background life only.
  'backdrop': {
    camera: { position: [3.0, 1.65, 6.4], target: [.2, 1.1, -3.0] }, fov: 44,
    residents: [
      { id: 'mara', x: -4.7, z: -5.75, angle: .35, pose: 'idle' },
      { id: 'claire', sit: 'sofa', cup: true },
    ],
  },
  'counter': {
    camera: { position: [-1.6, 1.5, -1.1], target: [-4.4, 1.2, -5.3] }, fov: 40,
    residents: [
      { id: 'mara', x: -4.7, z: -5.75, angle: .45, pose: 'idle' },
      { id: 'maya', x: -2.75, z: -3.35, angle: Math.PI - .55, pose: 'holding-coffee', cup: true },
    ],
  },
  'reading-nook': {
    camera: { position: [-4.7, 1.25, 5.0], target: [-5.9, .85, 3.0] }, fov: 42,
    residents: [{ id: 'claire', sit: 'reading', cup: true }],
  },
  'entrance': {
    camera: { position: [2.4, 1.7, 11.5], target: [0, 1.2, 3.5] }, fov: 44,
    residents: [{ id: 'maya', x: .2, z: 6.2, angle: Math.PI, pose: 'walking' }, { id: 'jules', x: -1.2, z: 3.2, angle: .3, pose: 'waving' }],
  },
  'community-table': {
    camera: { position: [4.0, 1.5, .7], target: [4.0, .95, 3.6] }, fov: 44,
    residents: [{ id: 'jules', sit: 'community-0' }, { id: 'maya', sit: 'community-2', cup: true }],
  },
  'study-nook': {
    camera: { position: [6.55, 1.22, 1.05], target: [7.1, 1.02, 2.5] }, fov: 38,
    residents: [{ id: 'maya', sit: 'study-0', expression: 'neutral' }],
  },
  // Study camera sequence (desk study-0 at 7.1, 2.5 facing -z).
  'study-1-walk': {
    camera: { position: [9.3, 2.5, 6.2], target: [7.1, .9, 3.1] }, fov: 46,
    residents: [{ id: 'maya', x: 7.1, z: 3.8, angle: Math.PI, pose: 'walking' }],
  },
  'study-2-behind': {
    camera: { position: [7.1, 1.75, 4.4], target: [7.1, 1.15, 2.5] }, fov: 42,
    residents: [{ id: 'maya', sit: 'study-0', expression: 'neutral' }],
  },
  'study-3-side': {
    camera: { position: [5.75, 1.3, 2.35], target: [7.1, 1.0, 2.45] }, fov: 40,
    residents: [{ id: 'maya', sit: 'study-0', expression: 'neutral' }],
  },
  'overview': {
    camera: { position: [17, 19, 22], target: [0, 0, 0] }, fov: 42, beams: false,
    residents: [
      { id: 'mara', x: -4.7, z: -5.75, angle: 0, pose: 'idle' },
      { id: 'maya', x: 0, z: 4.6, angle: Math.PI, pose: 'walking' },
      { id: 'claire', sit: 'reading', cup: true },
      { id: 'jules', sit: 'community-1' },
    ],
  },
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(`${base}/phase2/render`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.captureReady, null, { timeout: 120000 });
  const onlyScene = process.env.SCENE;
  if (what === 'characters' || what === 'all') {
    const views = (process.env.VIEWS || 'front,34-front,side,34-back,back').split(',');
    const poses = (process.env.POSES || 'idle,walking,waving,holding-coffee,sipping').split(',');
    for (const id of ids) {
      for (const view of views) save(`characters/${id}/idle-${view}.png`, await page.evaluate(([i, v]) => window.renderCharacter(i, v, 'idle'), [id, view]));
      for (const pose of poses.filter(p => p !== 'idle')) save(`characters/${id}/${pose}-34-front.png`, await page.evaluate(([i, p]) => window.renderCharacter(i, '34-front', p), [id, pose]));
    }
  }
  if (what === 'headshots' || what === 'all') {
    for (const id of ids) save(`characters/${id}/headshot.png`, await page.evaluate(i => window.renderHeadshot(i), id));
  }
  if (what === 'scenes' || what === 'all') {
    for (const [name, spec] of Object.entries(SCENES)) {
      if (onlyScene && !onlyScene.split(',').includes(name)) continue;
      const width = +(process.env.WIDTH || 1920), height = Math.round(width / (spec.aspect || 16 / 9));
      save(`scenes/${name}.png`, await page.evaluate(s => window.renderCafeShot(s), { ...spec, width, height }));
    }
  }
} finally { await browser.close(); }
