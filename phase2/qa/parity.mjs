// Headless parity gate: the character kit must rebuild the canonical residents
// identically. Usage: node phase2/qa/parity.mjs [ids]   (phase2 server on :4322)
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.env.PHASE2_URL || 'http://127.0.0.1:4322';
const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : '';
const control = process.argv[3] || '';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const query = new URLSearchParams({ ...(ids && { ids }), ...(control && { control }) }).toString();
  await page.goto(`${base}/phase2/parity${query ? '?' + query : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__parity, null, { timeout: 600000, polling: 1000 });
  const report = await page.evaluate(() => window.__parity);
  for (const r of report.residents) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} (${r.meshes} meshes, build canonical ${r.buildMsCanonical} ms, kit ${r.buildMsKit} ms)`);
    for (const issue of r.issues) console.log('   ', issue);
  }
  if (errors.length) console.log('page errors:', errors);
  console.log(report.ok && !errors.length ? 'PARITY OK' : 'PARITY FAILED');
  process.exitCode = report.ok && !errors.length ? 0 : 1;
} finally { await browser.close(); }
