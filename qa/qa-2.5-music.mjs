import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:4321/cafe?guest=1';
const SHOTS = 'C:\\Users\\Aymen\\Documents\\ChatGPT\\coffeshop\\qa';
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
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
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('focus-open').click());
    await page.evaluate(() => document.getElementById('focus-begin').click());
    await page.waitForTimeout(300);

    // categories present?
    const cats = await page.evaluate(() => [...document.querySelectorAll('#music-categories button')].map(b => b.textContent));
    log('categories rendered:', JSON.stringify(cats));

    // select Ambient (procedural, should actually work)
    await page.evaluate(() => document.querySelector('#music-categories button:nth-child(1)').click());
    await page.waitForTimeout(300);
    log('ambient status:', await page.evaluate(() => document.getElementById('music-status').textContent));
    log('transport hidden (should be false):', await page.evaluate(() => document.getElementById('music-transport').hidden));
    await shot('phase2.5-ambient-selected');
    await page.evaluate(() => document.getElementById('music-play').click());
    await page.waitForTimeout(300);
    log('play button after play:', await page.evaluate(() => document.getElementById('music-play').textContent));
    log('status after play:', await page.evaluate(() => document.getElementById('music-status').textContent));
    const audioState1 = await page.evaluate(() => { const c = window.__musicDebug; return c; });
    await page.evaluate(() => document.getElementById('music-next').click());
    await page.waitForTimeout(200);
    log('status after next:', await page.evaluate(() => document.getElementById('music-status').textContent));
    await page.evaluate(() => document.getElementById('music-volume').value = 20);
    await page.evaluate(() => document.getElementById('music-volume').dispatchEvent(new Event('input')));
    await page.waitForTimeout(100);

    // select an unavailable category (Lo-Fi) and confirm it shows the honest note, not fake playback
    await page.evaluate(() => { const btn = [...document.querySelectorAll('#music-categories button')].find(b => b.textContent === 'Lo-Fi'); btn.click(); });
    await page.waitForTimeout(200);
    log('lofi status (should be an integration note, not fake playback):', await page.evaluate(() => document.getElementById('music-status').textContent));
    log('transport hidden for unavailable category (should be true):', await page.evaluate(() => document.getElementById('music-transport').hidden));
    await shot('phase2.5-lofi-unavailable');

    // My Music category without files chosen yet
    await page.evaluate(() => { const btn = [...document.querySelectorAll('#music-categories button')].find(b => b.textContent === 'My Music'); btn.click(); });
    await page.waitForTimeout(200);
    log('my music status (no files yet):', await page.evaluate(() => document.getElementById('music-status').textContent));
    log('choose files button hidden (should be false):', await page.evaluate(() => document.getElementById('music-choose-files').hidden));
    await page.evaluate(() => document.getElementById('music-play').click());
    await page.waitForTimeout(200);
    log('toast after trying to play with no files:', await page.evaluate(() => document.getElementById('toast').textContent));

    // ending the session should stop music cleanly
    await page.evaluate(() => { const btn = [...document.querySelectorAll('#music-categories button')].find(b => b.textContent === 'Ambient'); btn.click(); });
    await page.evaluate(() => document.getElementById('music-play').click());
    await page.waitForTimeout(300);
    log('playing before end:', await page.evaluate(() => document.getElementById('music-play').textContent));
    await page.evaluate(() => document.getElementById('focus-end').click());
    await page.waitForTimeout(200);
    log('play button reset after ending session:', await page.evaluate(() => document.getElementById('music-play').textContent));

    log('=== ISSUES ==='); for (const i of issues) log(i);
    log('=== BAD RESPONSES ==='); for (const b of bad) log(b);
    log(issues.length===0 && bad.length===0 ? 'CLEAN RUN' : 'PROBLEMS FOUND');
  } finally {
    await browser.close();
  }
}
main().catch(e=>{ console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
