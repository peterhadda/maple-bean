// Dialogue portraits, rendered from the characters the café runs today.
//
// Not the older plates in design-assets/characters/: those predate the visual
// upgrade and the face/hand/body refinement passes. This re-renders from
// assets/characters/runtime.js through systems/portrait-studio.html, so the
// portraits always match the current cast.
//
//   node qa/portraits.mjs            → assets/ui/portraits/<id>.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.CAFE_URL_BASE || 'http://127.0.0.1:4321';
const who = process.argv.slice(2).filter(a => !a.startsWith('-'));
const cast = who.length ? who : ['maya', 'mara', 'noah', 'claire', 'jules'];
const out = 'qa/portraits';
const shipped = 'assets/ui/portraits';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(shipped, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const errors = [];
try {
  // Square and generous: the crop happens afterwards, from the alpha bounds.
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });

  for (const id of cast) {
    await page.goto(`${base}/systems/portrait-studio.html?who=${id}&shot=bust`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, id + '.png'), omitBackground: true });
    console.log('rendered', id);
  }
  console.log('errors', JSON.stringify(errors, null, 1));
} finally { await browser.close(); }
if (errors.length) process.exitCode = 1;
