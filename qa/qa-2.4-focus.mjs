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

    const study0 = await page.evaluate(() => window.cafe.layout.stations.find(s=>s.id==='study-0'));
    await page.evaluate((st) => { window.cafe.player.set(st.approach[0], 0, st.approach[1]); }, study0);
    await waitFrames(2);
    await page.evaluate(() => window.cafe.interact());
    await page.waitForTimeout(400);
    log('seated:', await page.evaluate(() => window.cafe.state.seated));

    // open focus panel
    await page.evaluate(() => document.getElementById('focus-open').click());
    await page.waitForTimeout(200);
    log('focus panel hidden:', await page.evaluate(() => document.getElementById('focus').hidden));
    log('setup visible:', !(await page.evaluate(() => document.getElementById('focus-setup').hidden)));
    await shot('phase2.4-focus-setup');

    // pick 45 min preset and begin
    await page.evaluate(() => document.querySelector('#focus-presets button[data-min="45"]').click());
    await page.evaluate(() => document.getElementById('focus-begin').click());
    await page.waitForTimeout(300);
    log('active visible:', !(await page.evaluate(() => document.getElementById('focus-active').hidden)));
    log('focus-time text:', await page.evaluate(() => document.getElementById('focus-time').textContent));
    log('body has focus-mode class:', await page.evaluate(() => document.body.classList.contains('focus-mode')));
    log('banner hidden:', await page.evaluate(() => document.getElementById('focus-banner').hidden));
    log('locations panel hidden (distraction reduced):', await page.evaluate(() => getComputedStyle(document.querySelector('.locations')).display));
    await waitFrames(2);
    await shot('phase2.4-focus-active');

    // close the drawer mid-session, confirm banner still shows and reopening restores active view
    await page.evaluate(() => document.getElementById('focus-close').click());
    await page.waitForTimeout(200);
    log('drawer hidden after close:', await page.evaluate(() => document.getElementById('focus').hidden));
    log('banner still visible after close:', !(await page.evaluate(() => document.getElementById('focus-banner').hidden)));
    await shot('phase2.4-banner-only');
    await page.evaluate(() => document.getElementById('focus-banner').click());
    await page.waitForTimeout(200);
    log('reopened to active view (not setup):', !(await page.evaluate(() => document.getElementById('focus-active').hidden)));

    // pause / resume
    await page.evaluate(() => document.getElementById('focus-pause').click());
    log('pause button after pause click:', await page.evaluate(() => document.getElementById('focus-pause').textContent));
    const t1 = await page.evaluate(() => document.getElementById('focus-time').textContent);
    await waitFrames(2);
    const t2 = await page.evaluate(() => document.getElementById('focus-time').textContent);
    log('time unchanged while paused:', t1, '->', t2, t1===t2);
    await page.evaluate(() => document.getElementById('focus-pause').click());
    log('pause button after resume click:', await page.evaluate(() => document.getElementById('focus-pause').textContent));

    // end session
    await page.evaluate(() => document.getElementById('focus-end').click());
    await page.waitForTimeout(300);
    log('body still has focus-mode class (should be false):', await page.evaluate(() => document.body.classList.contains('focus-mode')));
    log('banner hidden after end:', await page.evaluate(() => document.getElementById('focus-banner').hidden));
    log('mode after end:', await page.evaluate(() => window.cafe.state.mode));
    log('stats saved:', await page.evaluate(() => localStorage.getItem('maple-bean-focus-stats')));
    await shot('phase2.4-after-end');

    log('=== ISSUES ==='); for (const i of issues) log(i);
    log('=== BAD RESPONSES ==='); for (const b of bad) log(b);
    log(issues.length===0 && bad.length===0 ? 'CLEAN RUN' : 'PROBLEMS FOUND');
  } finally {
    await browser.close();
  }
}
main().catch(e=>{ console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
