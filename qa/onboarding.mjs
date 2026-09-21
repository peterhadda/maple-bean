// End-to-end walk of the front door: sign up → character creator (mandatory)
// → guided tour → in the café. Screenshots every stop.
//
//   node qa/onboarding.mjs qa/onboarding
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [out = 'qa/onboarding'] = process.argv.slice(2);
const base = process.env.CAFE_URL || 'http://127.0.0.1:4321';
const email = process.env.QA_EMAIL || `qa-${Date.now()}@maplebean.test`;
const password = 'latte2024';
const handle = process.env.QA_HANDLE || 'QA ' + String(Date.now()).slice(-5);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const errors = [], notes = [];
const say = (...a) => { console.log(...a); notes.push(a.join(' ')); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('4321')) errors.push(`[http ${r.status()}] ${r.url()}`); });
  const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); say('shot', name); };

  // ---- 1. the front door is the sign-in journey
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-choice:not([hidden])');
  say('door:', await page.title());

  // ---- 2. create an account
  await page.click('[data-go="signup"]');
  await page.waitForSelector('#screen-signup:not([hidden])');
  await page.fill('#signup-handle', handle);
  await page.waitForTimeout(700);                      // let the availability check land
  say('username check:', await page.textContent('#signup-handle-state'));
  await page.fill('#signup-email', email);
  await page.fill('#signup-password', password);
  await page.fill('#signup-confirm', password);
  await page.click('#signup-terms + .mb-check__box');
  await shot('01-signup-filled');
  await Promise.all([page.waitForURL(/\/cafe/, { timeout: 60000 }), page.click('#signup-submit')]);
  say('signed up as', email, '->', page.url());

  // ---- 3. the café loads, and the creator is waiting and cannot be dismissed
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.waitForSelector('#character-creator[open]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  const gate = await page.evaluate(() => ({
    required: window.cafe.creator.isRequired,
    closeHidden: document.querySelector('#character-creator [data-close]').hidden,
    steps: [...document.querySelectorAll('.mb-progress__label')].map(e => e.textContent),
    starterFree: [...document.querySelectorAll('.mb-tile__price')].length,
  }));
  say('creator gate', JSON.stringify(gate));
  if (!gate.required || !gate.closeHidden) errors.push('[gate] the creator was dismissable on a first visit');
  await shot('02-creator-skin');

  // Escape must not get you out of it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (!(await page.$('#character-creator[open]'))) errors.push('[gate] Escape closed the mandatory creator');

  // ---- 4. walk the four steps
  await page.click('#character-creator [data-next]');   // → Hair
  await page.waitForTimeout(900);
  const hair = await page.evaluate(() => [...document.querySelectorAll('.mb-tile__name')].map(e => e.textContent));
  say('hair styles', JSON.stringify(hair));
  await page.click('.mb-tiles .mb-tile:nth-child(2)');  // a different style
  await page.waitForTimeout(700);
  await shot('03-creator-hair');

  await page.click('#character-creator [data-next]');   // → Clothing
  await page.waitForTimeout(700);
  const locked = await page.evaluate(() => [...document.querySelectorAll('.mb-tile')].filter(b => b.querySelector('.mb-tile__price')).map(b => b.querySelector('.mb-tile__name').textContent + ' · ' + b.querySelector('.mb-tile__price').textContent));
  say('priced pieces on the clothing step', JSON.stringify(locked));
  await shot('04-creator-clothing');

  await page.click('#character-creator [data-next]');   // → Name
  await page.waitForSelector('#creator-name');
  await page.fill('#creator-name', handle);
  await shot('05-creator-name');

  // ---- 5. finishing drops you into the café with the tour running
  await page.click('#character-creator [data-next]');
  await page.waitForSelector('.tour:not([hidden])', { timeout: 60000 });
  await page.waitForTimeout(2500);
  say('tour beat 1', await page.textContent('.tour__name'), '·', await page.textContent('.tour__place'));
  await shot('06-tour-maya');

  for (const step of ['07-tour-mara', '08-tour-noah', '09-tour-claire', '10-tour-jules']) {
    await page.click('.tour [data-next]');              // finish typing
    await page.waitForTimeout(150);
    await page.click('.tour [data-next]');              // next beat
    await page.waitForTimeout(2600);
    say(step, await page.textContent('.tour__name'), '·', await page.textContent('.tour__place'));
    await shot(step);
  }

  // ---- 6. end the tour and land in the game
  for (let i = 0; i < 4 && await page.$('.tour:not([hidden])'); i++) {
    await page.click('.tour [data-next]'); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2200);
  const state = await page.evaluate(() => ({ ...window.cafe.state, name: document.getElementById('player-name').textContent, account: window.cafe.account }));
  say('in the café', JSON.stringify(state));
  await shot('11-in-the-cafe');

  // ---- 7. coming back is straight in: no door, no creator, no tour
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForURL(/\/cafe/, { timeout: 30000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  const second = await page.evaluate(() => ({
    creatorOpen: !!document.querySelector('#character-creator[open]'),
    tourOpen: !!document.querySelector('.tour:not([hidden])'),
    name: document.getElementById('player-name').textContent,
  }));
  say('second visit', JSON.stringify(second));
  if (second.creatorOpen || second.tourOpen) errors.push('[return] a returning player was stopped at onboarding again');
  if (second.name !== handle) errors.push(`[return] the saved name did not come back (got ${second.name})`);
  await shot('12-second-visit');

  console.log('\nerrors', JSON.stringify(errors, null, 1));
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'report.txt'), notes.concat('', 'errors:', ...errors).join('\n'));
if (errors.length) process.exitCode = 1;
