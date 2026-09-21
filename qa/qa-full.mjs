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
    const consoleMsgs = [];
    page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', e => consoleMsgs.push(`[pageerror] ${e.message}`));
    page.on('requestfailed', r => consoleMsgs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
    const responses = [];
    page.on('response', r => { if (r.status() >= 400) responses.push(`${r.status()} ${r.url()}`); });

    async function rawShot(name) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const fs = await import('node:fs');
      fs.writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64'));
      log('shot saved:', name);
    }
    async function waitFrames(n, timeoutMs=60000) {
      const start = Date.now();
      const f0 = await page.evaluate(() => window.cafe?.renderer.info.render.frame ?? 0);
      while (Date.now() - start < timeoutMs) {
        const f = await page.evaluate(() => window.cafe?.renderer.info.render.frame ?? 0);
        if (f - f0 >= n) return f - f0;
        await page.waitForTimeout(500);
      }
      return -1;
    }

    log('navigating');
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    for (let i=0;i<50;i++){
      if (await page.evaluate(() => window.__ready === true).catch(()=>false)) break;
      await page.waitForTimeout(3000);
    }
    log('ready:', await page.evaluate(() => window.__ready === true));
    await rawShot('01-overview');
    log('bad responses so far:', JSON.stringify(responses));

    // Enter walk mode
    await page.evaluate(() => document.getElementById('enter').click());
    await page.waitForTimeout(300);
    log('mode:', await page.evaluate(() => window.cafe.state.mode));
    await rawShot('02-walk-mode');

    // Teleport near every talk/seat/coffee station and verify proximity + interaction dialog opens without moving in realtime
    const stationSummaries = await page.evaluate(() => window.cafe.layout.stations.map(s => ({id:s.id, kind:s.kind, approach:s.approach})));
    log('stations:', JSON.stringify(stationSummaries));

    for (const s of stationSummaries) {
      await page.evaluate((st) => { window.cafe.player.set(st.approach[0], 0, st.approach[1]); }, s);
      const framesAdvanced = await waitFrames(2, 20000);
      const nearestInfo = await page.evaluate(() => window.cafe.state);
      log(`teleport->${s.id} framesAdvanced=${framesAdvanced} state=${JSON.stringify(nearestInfo)}`);
    }

    // Collision test: teleport INTO an obstacle center and confirm the game doesn't let the recorded position stay inside it
    // (direct isWalkable/moveOnFloor already unit-tested; here we just confirm teleport+keys doesn't clip through a wall boundary)
    const bounds = await page.evaluate(() => ({w: window.cafe.layout.width, d: window.cafe.layout.depth}));
    await page.evaluate((b) => { window.cafe.player.set(b.w/2 - 0.5, 0, 0); }, bounds);
    await waitFrames(1, 15000);
    await page.evaluate(() => document.getElementById('world').focus());
    await page.keyboard.down('KeyD'); // press toward east wall
    await waitFrames(3, 30000);
    await page.keyboard.up('KeyD');
    const afterWallPress = await page.evaluate(() => ({...window.cafe.player}));
    log('after pressing D toward east wall for a few frames:', JSON.stringify(afterWallPress), 'bounds:', JSON.stringify(bounds));

    // Camera mode toggles (UI state updates synchronously, no frames needed)
    for (const m of ['overview','plan','walk']) {
      await page.evaluate((mm) => document.getElementById(mm).click(), m);
      await page.waitForTimeout(200);
      const cls = await page.evaluate((mm) => document.getElementById(mm).classList.contains('selected'), m);
      log('camera mode', m, 'selected class applied:', cls);
    }
    await rawShot('03-plan-view');

    // UI panels
    await page.evaluate(() => document.getElementById('review-open').click());
    await page.waitForTimeout(150);
    log('notes drawer hidden attr:', await page.evaluate(() => document.getElementById('review').hidden));
    await rawShot('04-notes-drawer');
    await page.evaluate(() => document.getElementById('review-close').click());

    await page.evaluate(() => document.getElementById('chat-toggle').click());
    await page.waitForTimeout(150);
    log('chat drawer hidden attr:', await page.evaluate(() => document.getElementById('chat').hidden));
    await rawShot('05-chat-drawer');
    await page.evaluate(() => document.getElementById('chat-close').click());

    // Coffee dialog via teleport + interact (bypassing walking)
    const coffee = stationSummaries.find(s => s.id === 'coffee');
    await page.evaluate((st) => { window.cafe.player.set(st.approach[0], 0, st.approach[1]); }, coffee);
    await waitFrames(2, 20000);
    await page.evaluate(() => window.cafe.interact());
    await page.waitForTimeout(300);
    log('dialog open after interact(coffee):', await page.evaluate(() => document.getElementById('dialog').open));
    await rawShot('06-coffee-dialog');
    // spam E / close
    for (let i=0;i<5;i++){ await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}))); await page.waitForTimeout(80); }
    await page.evaluate(() => { const d = document.getElementById('dialog'); if (d.open) d.close(); });

    // Talk to Mara
    const mara = stationSummaries.find(s => s.id === 'mara');
    await page.evaluate((st) => { window.cafe.player.set(st.approach[0], 0, st.approach[1]); }, mara);
    await waitFrames(2, 20000);
    await page.evaluate(() => window.cafe.interact());
    await page.waitForTimeout(300);
    log('dialog open after interact(mara):', await page.evaluate(() => document.getElementById('dialog').open));
    await rawShot('07-mara-dialog');
    await page.evaluate(() => { const d = document.getElementById('dialog'); if (d.open) d.close(); });

    // Resize + reload
    await page.setViewportSize({ width: 480, height: 900 });
    await page.waitForTimeout(300);
    await rawShot('08-mobile-width');
    await page.setViewportSize({ width: 1280, height: 800 });

    log('=== CONSOLE / ERRORS ===');
    for (const m of consoleMsgs) log(m);
    log('=== BAD HTTP RESPONSES ===');
    for (const r of responses) log(r);
  } finally {
    await browser.close();
  }
}
main().catch(e=>{ console.error('FATAL', e.stack || e.message); process.exitCode = 1; });
