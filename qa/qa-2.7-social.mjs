import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:4321/';
const SHOTS = 'C:\\Users\\Aymen\\Documents\\ChatGPT\\coffeshop\\qa';
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

// Rather than run two full heavy WebGL tabs (which starve each other for CPU
// under software rendering), this drives ONE real browser tab and plays the
// part of a second guest via plain HTTP/SSE - a real server round-trip, just
// without a second renderer competing for the CPU.
async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    const issues = [];
    page.on('console', m => { if (m.type() === 'error') issues.push(`[console.error] ${m.text()}`); });
    page.on('pageerror', e => issues.push(`[pageerror] ${e.message}`));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    for (let i=0;i<50;i++){ if (await page.evaluate(() => window.__ready === true).catch(()=>false)) break; await page.waitForTimeout(3000); }
    await page.evaluate(() => document.getElementById('enter').click());
    async function waitFrames(n, timeoutMs=30000) {
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

    // Bring the real player near center so the fake second guest (spawned at
    // the default 0,5.6) is close enough to appear on screen and be "nearby"
    // for chat/emote radius checks.
    await page.evaluate(() => { window.cafe.player.set(0, 0, 4); });
    await waitFrames(3);

    // Join a second guest via plain fetch/SSE - a real server session, no browser needed.
    const joinResp = await page.evaluate(async () => {
      const r = await fetch('/api', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'join', name:'Priya' }) });
      return r.json();
    });
    log('fake guest joined:', joinResp.name, joinResp.id);
    await page.evaluate(({id,token}) => { window.__fakeGuestEvents = new EventSource(`/events?id=${id}&token=${token}`); }, joinResp);
    await page.waitForTimeout(500);

    // Move the fake guest near the player and set a "studying" status, then confirm the label updates.
    await page.evaluate(async ({id,token}) => {
      await fetch('/api', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'move', x:1, z:4, angle:0, status:'studying', id, token }) });
    }, joinResp);
    await waitFrames(3, 40000);
    const label = await page.evaluate(() => { const l=[...document.querySelectorAll('#labels .world-label.guest')]; return l.map(x=>x.textContent); });
    log('remote guest label(s) after status=studying:', JSON.stringify(label));
    await shot('phase2.7-remote-status');

    // Fake guest sends a wave emote - the real player should see a reaction + toast.
    await page.evaluate(async ({id,token}) => {
      await fetch('/api', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'emote', emote:'wave', id, token }) });
    }, joinResp);
    await waitFrames(3, 30000);
    log('toast after remote wave:', await page.evaluate(() => document.getElementById('toast').textContent));
    log('reaction emoji visible:', await page.evaluate(() => [...document.querySelectorAll('.world-label.reaction')].map(r=>r.textContent)));
    await shot('phase2.7-remote-wave-reaction');

    // The real player sends a heart emote themselves - server round trip should succeed (200) and show own reaction.
    await page.evaluate(() => { const btns=[...document.querySelectorAll('#emotes button')]; btns.find(b=>b.title==='Heart').click(); });
    await page.waitForTimeout(400);
    log('own reaction after sending heart:', await page.evaluate(() => [...document.querySelectorAll('.world-label.reaction')].map(r=>r.textContent)));

    // Sit the player at a study desk with focus mode, confirm own status derivation would read 'focus' (checked indirectly via banner, since status itself isn't shown to self).
    const study0 = await page.evaluate(() => window.cafe.layout.stations.find(s=>s.id==='study-0'));
    await page.evaluate((st) => { window.cafe.player.set(st.approach[0], 0, st.approach[1]); }, study0);
    await waitFrames(2, 20000);
    for (let i=0;i<5;i++){ await page.evaluate(() => window.cafe.interact()); await page.waitForTimeout(400); if (await page.evaluate(() => window.cafe.state.seated)) break; }
    await page.evaluate(() => document.getElementById('focus-open').click());
    await page.evaluate(() => document.getElementById('focus-begin').click());
    await page.waitForTimeout(300);
    log('focus banner text (self-facing status):', await page.evaluate(() => document.getElementById('focus-banner-text').textContent));

    log('=== ISSUES ==='); for (const i of issues) log(i);
    log(issues.length===0 ? 'CLEAN RUN' : 'PROBLEMS FOUND');
  } finally {
    await browser.close();
  }
}
main().catch(e=>{ console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
