// Screens of the sign-in journey, shot at the Figma frame size (1440x900).
//   node qa/login-shots.mjs qa/login [width] [height]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [out = 'qa/login', w = '1440', h = '900'] = process.argv.slice(2);
const base = process.env.CAFE_URL || 'http://127.0.0.1:4321';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).host.includes('4321')) errors.push(`[http ${r.status()}] ${r.url()}`); });

  const shot = async (name, screen, prep) => {
    await page.goto(`${base}/login.html?stay=1&screen=${screen}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`#screen-${screen}:not([hidden])`, { timeout: 15000 });
    if (prep) await prep(page);
    await page.waitForTimeout(700);                 // let the entrance settle
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log('shot', name);
  };

  await shot('screen-01-choice', 'choice');
  await shot('screen-02-signup', 'signup');
  await shot('screen-03-signup-errors', 'signup', async p => {
    await p.fill('#signup-email', 'alex@maplebean');
    await p.click('#signup-submit');
    await p.waitForTimeout(250);
  });
  await shot('screen-04-login', 'login');
  await shot('screen-05-forgot', 'forgot');
  await shot('screen-06-mobile', 'choice');
  console.log('errors', JSON.stringify(errors, null, 1));
} finally { await browser.close(); }
if (errors.length) process.exitCode = 1;
