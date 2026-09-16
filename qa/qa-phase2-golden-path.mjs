import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:4321/';
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
    log('1. Enter Maple Bean: ready =', await page.evaluate(() => window.__ready === true));
    await page.evaluate(() => document.getElementById('enter').click());
    await page.waitForTimeout(300);

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
    async function goSit(id){
      const st = await page.evaluate((sid) => window.cafe.layout.stations.find(s=>s.id===sid), id);
      await page.evaluate((s) => { window.cafe.player.set(s.approach[0], 0, s.approach[1]); }, st);
      await waitFrames(2);
      for (let i=0;i<5;i++){
        await page.evaluate(() => window.cafe.interact());
        await page.waitForTimeout(400);
        if (await page.evaluate(() => window.cafe.state.seated || document.getElementById('dialog').open)) break;
        await waitFrames(1);
      }
    }

    log('2. See NPCs naturally doing things: regulars present =', await page.evaluate(() => window.cafe.scene.children.length > 10));

    log('3. Order coffee (mini-game)');
    await goSit('coffee');
    await page.evaluate(() => document.querySelector('[data-order="Hot chocolate"]')?.click());
    await page.waitForTimeout(300);
    for (const step of ['cup','coffee','milk','flavor','serve']) { await page.evaluate((s) => document.querySelector(`[data-step="${s}"]`)?.click(), step); await page.waitForTimeout(150); }
    await page.waitForTimeout(600);
    log('   drink in hand:', await page.evaluate(() => window.cafe.state.drink));

    log('4. Sit at a table (reading nook) and relax/browse');
    await goSit('reading');
    log('   seated:', await page.evaluate(() => window.cafe.state.seated));
    await page.evaluate(() => document.getElementById('browse')?.click());
    await page.waitForTimeout(200);
    log('   browse toast:', await page.evaluate(() => document.getElementById('toast').textContent));
    await page.evaluate(() => window.cafe.interact()); // stand
    await page.waitForTimeout(300);

    log('5. Enter the Study Area, start a Focus Session');
    await goSit('study-0');
    log('   seated:', await page.evaluate(() => window.cafe.state.seated));
    await page.evaluate(() => document.getElementById('focus-open')?.click());
    await page.evaluate(() => document.getElementById('focus-begin')?.click());
    await page.waitForTimeout(300);
    log('   focus-mode class on body:', await page.evaluate(() => document.body.classList.contains('focus-mode')));
    await shot('golden-01-focus');

    log('6. Listen to focus music');
    await page.evaluate(() => document.querySelector('#music-categories button')?.click());
    await page.evaluate(() => document.getElementById('music-play')?.click());
    await page.waitForTimeout(300);
    log('   now playing:', await page.evaluate(() => document.getElementById('music-status').textContent));

    log('7. See study progress (stats)');
    log('   stats html present:', await page.evaluate(() => document.getElementById('focus-stats').textContent.length > 0));

    log('8. Leave Focus Mode');
    await page.evaluate(() => document.getElementById('focus-end')?.click());
    await page.waitForTimeout(300);
    log('   focus-mode class removed:', !(await page.evaluate(() => document.body.classList.contains('focus-mode'))));
    await page.evaluate(() => window.cafe.interact()); // stand up
    await page.waitForTimeout(300);

    log('9. Interact with characters + use an emote');
    await goSit('mara');
    log('   mara dialog open:', await page.evaluate(() => document.getElementById('dialog').open));
    await page.evaluate(() => { if (document.getElementById('dialog').open) document.getElementById('dialog-close').click(); });
    await page.evaluate(() => document.getElementById('wave')?.click());
    await page.waitForTimeout(200);
    log('   own wave reaction shown:', await page.evaluate(() => [...document.querySelectorAll('.world-label.reaction')].length > 0));

    log('10. Relax in the café (camera modes)');
    await page.evaluate(() => document.getElementById('overview')?.click());
    await page.waitForTimeout(300);
    await shot('golden-02-overview');

    log('11. Leave and return later - settings persistence check');
    await page.evaluate(() => { document.getElementById('lighting').value = 'evening'; document.getElementById('lighting').dispatchEvent(new Event('change')); });
    await page.waitForTimeout(200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    for (let i=0;i<50;i++){ if (await page.evaluate(() => window.__ready === true).catch(()=>false)) break; await page.waitForTimeout(3000); }
    log('   lighting preference persisted after reload:', await page.evaluate(() => document.getElementById('lighting').value));

    async function shot(name){ const {data}=await cdp.send('Page.captureScreenshot',{format:'png'}); const fs=await import('node:fs'); fs.writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data,'base64')); }

    log('=== ISSUES ==='); for (const i of issues) log(i);
    log('=== BAD RESPONSES ==='); for (const b of bad) log(b);
    log(issues.length===0 && bad.length===0 ? 'CLEAN RUN' : 'PROBLEMS FOUND');
  } finally {
    await browser.close();
  }
}
main().catch(e=>{ console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
