import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:4321/cafe?guest=1';
const SHOTS = 'C:\\Users\\Aymen\\Documents\\ChatGPT\\coffeshop\\qa';
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    const issues = [];
    page.on('console', m => { if (m.type() === 'error') issues.push(`[console.error] ${m.text()}`); });
    page.on('pageerror', e => issues.push(`[pageerror] ${e.message}`));
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    for (let i=0;i<50;i++){ if (await page.evaluate(() => window.__ready === true).catch(()=>false)) break; await page.waitForTimeout(3000); }
    await page.evaluate(() => document.getElementById('enter').click());
    async function waitFrames(n, timeoutMs=25000) {
      const start = Date.now();
      const f0 = await page.evaluate(() => window.cafe.renderer.info.render.frame);
      while (Date.now() - start < timeoutMs) {
        const f = await page.evaluate(() => window.cafe.renderer.info.render.frame);
        if (f - f0 >= n) return true;
        await page.waitForTimeout(500);
      }
      return false;
    }
    async function shot(name){ const {data}=await cdp.send('Page.captureScreenshot',{format:'png'}); const fs=await import('node:fs'); fs.writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data,'base64')); }

    const coffee = await page.evaluate(() => window.cafe.layout.stations.find(s=>s.id==='coffee'));
    await page.evaluate((st) => { window.cafe.player.set(st.approach[0], 0, st.approach[1]); }, coffee);
    await waitFrames(3);
    for (let i=0;i<5;i++){
      await page.evaluate(() => window.cafe.interact());
      await page.waitForTimeout(500);
      if (await page.evaluate(() => document.getElementById('dialog').open)) break;
      await waitFrames(1);
    }
    log('order dialog open:', await page.evaluate(() => document.getElementById('dialog').open));
    await page.evaluate(() => document.querySelector('[data-order="Maple latte"]').click());
    await page.waitForTimeout(300);
    log('dialog open:', await page.evaluate(() => document.getElementById('dialog').open));
    log('game steps rendered:', await page.evaluate(() => [...document.querySelectorAll('.game-steps button')].map(b=>b.dataset.step)));
    await shot('phase2.6-coffee-game-start');

    // click out of order first (coffee before cup) - should register a miss, not advance
    await page.evaluate(() => document.querySelector('[data-step="coffee"]').click());
    await page.waitForTimeout(200);
    log('coffee button has miss class (wrong order):', await page.evaluate(() => document.querySelector('[data-step="coffee"]').classList.contains('miss')));
    log('coffee button disabled (should be false, wrong click):', await page.evaluate(() => document.querySelector('[data-step="coffee"]').disabled));

    // now click in correct order
    for (const step of ['cup','coffee','milk','flavor','serve']) {
      await page.evaluate((s) => document.querySelector(`[data-step="${s}"]`).click(), step);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(700);
    log('drink after completing game:', await page.evaluate(() => window.cafe.state.drink));
    log('dialog closed after completion:', !(await page.evaluate(() => document.getElementById('dialog').open)));
    await shot('phase2.6-coffee-game-done');

    // try ordering again while already holding a drink - should be blocked before the game even opens
    await page.evaluate(() => window.cafe.interact());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-order="Forest tea"]')?.click());
    await page.waitForTimeout(200);
    log('toast when already holding a drink:', await page.evaluate(() => document.getElementById('toast').textContent));
    log('dialog still open (game should NOT have started):', await page.evaluate(() => document.getElementById('dialog').open));

    log('=== ISSUES ==='); for (const i of issues) log(i);
    log('=== BAD RESPONSES ==='); for (const b of bad) log(b);
    log(issues.length===0 && bad.length===0 ? 'CLEAN RUN' : 'PROBLEMS FOUND');
  } finally {
    await browser.close();
  }
}
main().catch(e=>{ console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
