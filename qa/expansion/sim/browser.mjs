// Shared Chrome/page helpers for the simulation guardian (A6).
// Launches Chrome the same way qa/qa-gameplay.mjs does (real GPU via ANGLE/D3D11,
// GL=soft for SwiftShader) and opens the café in ?qa mode.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CAFE_URL = process.env.CAFE_URL || 'http://127.0.0.1:4321/';
export const PROBE_SOURCE = fs.readFileSync(path.join(here, 'probe.js'), 'utf8');

export async function launch() {
  return chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: process.env.GL === 'soft' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
}

// Opens one café client in its own browser context (own localStorage = own guest).
export async function openCafe(browser, { name = 'client', width = 1280, height = 800, playerName } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
  await page.addInitScript(n => { localStorage.clear(); if (n) localStorage.setItem('maple-bean-name', JSON.stringify(n)); }, playerName || null);
  await page.goto(CAFE_URL + '?qa', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true && window.cafe, null, { timeout: 240000 });
  await page.evaluate(PROBE_SOURCE);
  await page.evaluate(() => {
    const V = window.cafe.camera.position.constructor;
    window.qa = {
      until: async (fn, ms = 30000) => { const t = performance.now(); while (performance.now() - t < ms) { try { if (fn()) return true; } catch { } await new Promise(r => setTimeout(r, 100)); } return false; },
      sleep: ms => new Promise(r => setTimeout(r, ms)),
      clickWorld(x, y, z) {
        const c = window.cafe, v = new V(x, y, z).project(c.camera), r = c.renderer.domElement.getBoundingClientRect();
        const cx = r.left + (v.x * .5 + .5) * r.width, cy = r.top + (-v.y * .5 + .5) * r.height;
        for (const type of ['pointerdown', 'pointerup']) c.renderer.domElement.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, button: 0, bubbles: true, pointerId: 1 }));
        return [Math.round(cx), Math.round(cy)];
      },
      async look(x, z, dist = 3.2, h = 2.2) { const c = window.cafe; c.camera.position.set(x + dist * .7, h, z + dist * .7); c.controls.target.set(x, .8, z); c.controls.update(); await new Promise(r => setTimeout(r, 400)); },
      key(code, down = true) { dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })); },
      async hold(code, ms) { qa.key(code, true); await qa.sleep(ms); qa.key(code, false); },
      dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); },
    };
  });
  return { context, page, errors, name };
}

// Runs one scripted step in the page; never throws (a broken step is a finding, not a crash).
export function stepper(client, log) {
  return async function step(name, body, { timeout = 180000 } = {}) {
    const t0 = Date.now();
    let result;
    try {
      await client.page.evaluate(n => window.simProbe?.mark(n), name);
      result = await Promise.race([
        client.page.evaluate(`(async()=>{${body}})()`),
        new Promise((_, rej) => setTimeout(() => rej(new Error('step timeout ' + timeout + 'ms')), timeout)),
      ]);
    } catch (e) { result = { error: String(e.message || e).split('\n')[0] }; }
    const entry = { client: client.name, step: name, ms: Date.now() - t0, result };
    log.push(entry); console.log(`[${client.name}] ${name} (${Math.round(entry.ms / 1000)}s)`, JSON.stringify(result)?.slice(0, 400));
    return result;
  };
}

// Pulls pending first-occurrence evidence images out of the page and writes them.
export async function drainShots(client, outDir) {
  let shots = [];
  try { shots = await client.page.evaluate(() => window.simProbe?.takeShots() || []); } catch { return []; }
  const written = [];
  for (const s of shots) {
    const file = path.join(outDir, `${client.name}-${s.name}.jpg`);
    fs.writeFileSync(file, Buffer.from(s.data.split(',')[1], 'base64'));
    written.push(file);
  }
  return written;
}
