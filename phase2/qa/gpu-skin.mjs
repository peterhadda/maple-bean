// Compares GPU-skinned residents against the CPU path and saves a contact sheet.
// Usage: node phase2/qa/gpu-skin.mjs [ids]   (phase2 server on :4322)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.env.PHASE2_URL || 'http://127.0.0.1:4322';
const ids = process.argv[2];
const shots = new URL('./shots/', import.meta.url); mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(`${base}/phase2/lab/gpu-skin/index.html${ids ? '?ids=' + ids : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__gpuSkin, null, { timeout: 900000, polling: 1000 });
  const report = await page.evaluate(() => window.__gpuSkin);
  console.log(JSON.stringify(report, null, 1));
  await page.screenshot({ path: new URL('gpu-skin-contact-sheet.png', shots).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  if (errors.length) console.log('page messages:', errors);
} finally { await browser.close(); }
