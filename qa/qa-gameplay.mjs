// End-to-end gameplay QA: drives the real café through its physical
// interactions and records state checks, console errors and screenshots.
//   node server.mjs   (in another terminal)
//   node qa/qa-gameplay.mjs [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'qa/gameplay';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: process.env.GL === 'soft' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], results = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.addInitScript(() => localStorage.clear());
await page.goto((process.env.CAFE_URL || 'http://127.0.0.1:4321/cafe?guest=1') + '&qa', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
// Page helpers: wait for a condition; click on a world-space point like a player would.
await page.evaluate(() => {
  const V = window.cafe.camera.position.constructor;
  window.qa = {
    until: async (fn, ms = 30000) => { const t = performance.now(); while (performance.now() - t < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; },
    clickWorld(x, y, z) {
      const c = window.cafe, v = new V(x, y, z).project(c.camera), r = c.renderer.domElement.getBoundingClientRect();
      const cx = r.left + (v.x * .5 + .5) * r.width, cy = r.top + (-v.y * .5 + .5) * r.height;
      for (const type of ['pointerdown', 'pointerup']) c.renderer.domElement.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, button: 0, bubbles: true, pointerId: 1 }));
      return [Math.round(cx), Math.round(cy)];
    },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    // Look toward a spot like a player turning the camera, then let it settle.
    async look(x, z, dist = 3.2, h = 2.2) { const c = window.cafe; c.camera.position.set(x + dist * .7, h, z + dist * .7); c.controls.target.set(x, .8, z); c.controls.update(); await new Promise(r => setTimeout(r, 400)); },
  };
});
async function step(name, fn, shot = true) {
  let result;
  try { result = await page.evaluate(`(async()=>{${fn}})()`); } catch (e) { result = { error: e.message.split('\n')[0] }; }
  results.push({ name, result }); console.log(name, JSON.stringify(result));
  if (shot) await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 90000 });
}

await step('01-home', `return cafe.state;`);
await step('02-enter', `document.getElementById('enter').click(); await qa.sleep(2500); return {mode:cafe.state.mode, hint:!document.getElementById('hint').hidden};`);
await step('03-npcs-arrive-empty-handed', `
  let seen=null; await qa.until(()=>{const n=cafe.regulars.find(n=>n.life?.phase==='ordering'||n.life?.phase==='to-counter');if(n)seen=[n.id,n.life.phase,n.life.cup];return !!n;}, 40000);
  return {first:seen, allEmptyHandedBeforeService:cafe.regulars.filter(n=>n.life&&['to-counter','ordering'].includes(n.life.phase)).every(n=>!n.life.cup)};`);
await step('04-order-at-counter', `
  await qa.look(-3.4,-4.3,3.4,2.4); qa.clickWorld(-3.4,.95,-4.75); await qa.until(()=>document.getElementById('dialog').open, 40000);
  document.querySelector('[data-order="Matcha latte"]').click();
  const served=await qa.until(()=>cafe.cup.drink==='Matcha latte', 60000);
  return {served, drink:cafe.cup.drink, sips:cafe.cup.sips, coins:cafe.econ.coins};`);
await step('05-npc-served-by-mara', `
  await qa.until(()=>cafe.regulars.some(n=>n.life?.cup), 40000);
  return cafe.regulars.filter(n=>n.life).map(n=>[n.id,n.life.phase,n.life.cup,n.life.drink]);`);
await step('06-sit-on-chair', `
  const seat=cafe.seat('community-1'); await qa.look(seat.x,seat.z); qa.clickWorld(seat.x,.55,seat.z);
  const ok=await qa.until(()=>cafe.state.posture==='seated', 30000); await qa.sleep(600);
  cafe.camera.position.set(seat.x+2.2,1.7,seat.z+1.6); cafe.controls.target.set(seat.x,.8,seat.z);
  return {ok, seat:cafe.state.seated, pos:[+cafe.me.x.toFixed(2),+cafe.me.z.toFixed(2)], seatPos:[seat.x,seat.z]};`);
await step('07-stand-up', `document.querySelector('#context button').click(); const ok=await qa.until(()=>cafe.state.posture==='stand',10000); return {ok, posture:cafe.state.posture};`);
await step('08-water-plant', `
  const p=cafe.world.plants.find(p=>p.station.id.startsWith('plant-1.0')); const before=cafe.world.thirst(p);
  cafe.waterPlant(p); await qa.until(()=>cafe.playerCtl.activity==='water',20000); await qa.sleep(800);
  const watering=cafe.playerCtl.activity; await qa.until(()=>cafe.playerCtl.activity===null,10000);
  return {watering, before:Math.round(before), after:Math.round(cafe.world.thirst(p)), coins:cafe.econ.coins};`);
await step('09-npc-menu', `
  const n=cafe.regulars.find(n=>n.id==='mara'); const p=n.avatar.group.position; await qa.look(p.x,p.z+.8,3,2); qa.clickWorld(p.x,1.3,p.z); await qa.sleep(400);
  return {menu:!document.getElementById('npc-menu').hidden, items:[...document.querySelectorAll('#npc-menu button')].map(b=>b.textContent)};`);
await step('10-chat', `
  [...document.querySelectorAll('#npc-menu button')].find(b=>b.textContent.includes('Chat')).click();
  await qa.until(()=>!document.getElementById('chatbox').hidden,20000);
  document.getElementById('chat-text').value='Hi Mara! My name is Robin. What do you recommend?'; document.getElementById('chat-send').requestSubmit();
  await qa.sleep(300); const typing=!!document.querySelector('.typing');
  await qa.until(()=>document.querySelectorAll('#chat-log .msg:not(.me):not(.sys)').length>0,30000);
  return {typing, reply:[...document.querySelectorAll('#chat-log .msg')].map(m=>m.textContent).slice(-2), bond:cafe.bonds.mara};`);
await step('11-close-chat', `document.getElementById('chatbox-close').click(); await qa.sleep(800); return {open:!document.getElementById('chatbox').hidden};`, false);
await step('12-study-sit', `
  const seat=cafe.seat('study-room-1'); cafe.goToStation('study-room-1');
  const ok=await qa.until(()=>cafe.state.posture==='seated'&&cafe.state.seated==='study-room-1',40000);
  return {ok, context:[...document.querySelectorAll('#context button')].map(b=>b.textContent)};`);
await step('13-study-choose', `
  document.querySelector('#context button').click(); await qa.until(()=>document.getElementById('dialog').open,5000);
  return {options:[...document.querySelectorAll('[data-min]')].map(b=>b.textContent)};`);
await step('14-headphones-on', `
  document.querySelector('[data-min="30"]').click();
  await qa.until(()=>cafe.focus?.stage==='study',20000); await qa.sleep(1500);
  return {stage:cafe.focus?.stage, headphones:cafe.playerCtl.headphones, hud:!document.getElementById('focus-hud').hidden, timer:document.getElementById('focus-timer').textContent, task:document.getElementById('focus-task').textContent};`);
await step('15-studying', `cafe.setTimeScale(40); await qa.sleep(3500); return {task:document.getElementById('focus-task').textContent, timer:document.getElementById('focus-timer').textContent};`);
await step('16-focus-complete', `
  cafe.setTimeScale(400); const coins=cafe.econ.coins;
  await qa.until(()=>!cafe.focus,90000); cafe.setTimeScale(1); await qa.sleep(600);
  return {coinsBefore:coins, coinsAfter:cafe.econ.coins, reward:document.getElementById('reward-title').textContent, lines:document.getElementById('reward-lines').textContent, streak:cafe.econ.streak, posture:cafe.state.posture};`);
await step('17-cancel-no-reward', `
  const seat=cafe.seat('study-room-0'); await cafe.studyAt(seat); await qa.until(()=>cafe.state.posture==='seated',20000);
  cafe.beginFocus(seat,null); await qa.until(()=>document.getElementById('dialog').open,5000); document.querySelector('[data-min="30"]').click();
  await qa.until(()=>cafe.focus?.stage==='study',20000); const coins=cafe.econ.coins; await cafe.endFocus(false); await qa.sleep(500);
  return {coinsBefore:coins, coinsAfter:cafe.econ.coins};`, false);
await step('18-shop', `
  document.getElementById('shop-open').click(); await qa.sleep(1500);
  const before=cafe.econ.coins; const card=[...document.querySelectorAll('.shop-item')].find(c=>c.textContent.includes('Matcha Knit')); card.querySelector('.buy').click(); await qa.sleep(600);
  return {coinsBefore:before, coinsAfter:cafe.econ.coins, equipped:cafe.wardrobe.equipped.top, owned:cafe.wardrobe.owned.includes('top-matcha')};`);
await step('19-shop-hair', `
  document.querySelectorAll('.shop-tabs button')[3].click(); await qa.sleep(200);
  const card=[...document.querySelectorAll('.shop-item')].find(c=>c.textContent.includes('Long Waves')); card.click(); await qa.sleep(900);
  return {previewing:!!document.querySelector('.shop-item.previewing')};`);
await step('20-shop-close', `document.getElementById('shop-close').click(); await qa.sleep(1200); return {equippedHair:cafe.wardrobe.equipped.hair};`, false);
await step('21-xo-start', `
  const st=cafe.layout.stations.find(s=>s.game==='xo'); await qa.until(()=>cafe.regulars.some(n=>n.id==='jules'&&n.life?.visible&&!['away','leaving','to-counter','ordering'].includes(n.life.phase)),60000);
  cafe.startGame(st, cafe.npc('jules')); await qa.until(()=>cafe.playing?.ctl,60000); await qa.sleep(1800);
  return {game:cafe.state.playing, hud:document.getElementById('game-status').textContent, posture:cafe.state.posture, jules:cafe.npc('jules').ctl.posture};`);
await step('22-xo-play', `
  const st=cafe.layout.stations.find(s=>s.game==='xo'), seat=st.seats[0], f={x:Math.sin(seat.angle),z:Math.cos(seat.angle)}, r={x:-f.z,z:f.x};
  const cell=i=>{const u=(Math.floor(i/3)-1)*.12,v=(i%3-1)*.12;return [st.x+f.x*u+r.x*v,.805,st.z+f.z*u+r.z*v];};
  for(let k=0;k<5&&!cafe.playing?.over;k++){
    await qa.until(()=>/Your move/.test(document.getElementById('game-status').textContent)||cafe.playing?.over,20000); if(cafe.playing?.over)break;
    const board=[...Array(9).keys()]; for(const i of [4,0,2,6,8,1,3,5,7]){qa.clickWorld(...cell(i)); await qa.sleep(250); if(!/Your move/.test(document.getElementById('game-status').textContent))break;}
    await qa.sleep(1200);
  }
  await qa.until(()=>!cafe.playing,40000);
  return {reward:document.getElementById('reward-title').textContent, lines:document.getElementById('reward-lines').textContent, coins:cafe.econ.coins, bond:cafe.bonds.jules?.points};`);
await step('23-group-chat', `
  document.getElementById('messages-open').click(); await qa.sleep(300);
  const input=document.querySelector('#messenger-body .group-send input'); input.value='Study Buddies'; input.form.requestSubmit(); await qa.sleep(1500);
  return {title:document.getElementById('messenger-title').textContent, members:[...document.querySelectorAll('#messenger-body .chip')].map(c=>c.textContent)};`);
await step('23b-npc-group', `
  const members=()=>[...document.querySelectorAll('#messenger-body .chip')].map(c=>c.textContent);
  cafe.bonds.noah=cafe.bonds.noah||{points:0,crush:0,crushOn:false,last:{},day:null,today:{},memory:[]}; cafe.bonds.noah.points=25;
  [...document.querySelectorAll('#messenger-body .row-actions button')].find(b=>b.textContent.includes('Invite')).click(); await qa.sleep(300);
  [...document.querySelectorAll('#messenger-body button')].find(b=>b.textContent.includes('Noah')).click(); await qa.sleep(1200);
  const input=document.querySelector('#messenger-body .group-send input'); input.value='Noah, want to study later?'; input.form.requestSubmit();
  const replied=await qa.until(()=>[...document.querySelectorAll('#messenger-body .group-log .msg')].some(m=>m.textContent.startsWith('Noah')&&!m.classList.contains('sys')),15000);
  return {members:members(), replied, last:[...document.querySelectorAll('#messenger-body .group-log .msg')].map(m=>m.textContent).slice(-2)};`);
await step('23c-close-messenger', `document.getElementById('messenger-close').click(); return true;`, false);
for (const [game, id] of [['memory','claire'],['chess','jules'],['cards','noah']]) {
  await step('25-' + game + '-start', `
    const st=cafe.layout.stations.find(s=>s.game==='${game}'); const n=cafe.npc('${id}');
    await qa.until(()=>n.life?.visible&&!n.ctl.scriptedBy&&!['away','leaving','to-counter','ordering'].includes(n.life.phase),90000);
    cafe.startGame(st, n); const ok=await qa.until(()=>cafe.playing?.ctl,60000); await qa.sleep(2200);
    return {ok, status:document.getElementById('game-status').textContent, me:cafe.state.posture, them:n.ctl.posture};`);
  await step('26-' + game + '-move', `
    const st=cafe.layout.stations.find(s=>s.game==='${game}'), seat=st.seats[0], f={x:Math.sin(seat.angle),z:Math.cos(seat.angle)}, r={x:-f.z,z:f.x};
    const at=(u,v,h)=>[st.x+f.x*u+r.x*v,.79+h,st.z+f.z*u+r.z*v];
    if('${game}'==='memory'){qa.clickWorld(...at(-.225,-.195,.006)); await qa.sleep(1500); qa.clickWorld(...at(-.225,-.065,.006)); await qa.sleep(3500);}
    if('${game}'==='chess'){qa.clickWorld(...at(-.145,.029,.03)); await qa.sleep(500); qa.clickWorld(...at(-.029,.029,.015)); await qa.sleep(6000);}
    if('${game}'==='cards'){document.querySelector('#game-extra button')?.click(); await qa.sleep(4000);}
    return {status:document.getElementById('game-status').textContent};`);
  await step('27-' + game + '-leave', `document.getElementById('game-quit').click(); await qa.until(()=>!cafe.playing&&cafe.state.posture==='stand',20000); await qa.sleep(1500); return cafe.state;`, false);
}
await step('28-snake', `
  const st=cafe.layout.stations.find(s=>s.game==='snake'); cafe.startGame(st,null); await qa.until(()=>cafe.playing?.ctl,60000); await qa.sleep(2000);
  for(const k of ['ArrowUp','ArrowRight','ArrowDown','ArrowRight']){dispatchEvent(new KeyboardEvent('keydown',{code:k})); await qa.sleep(700);}
  return {status:document.getElementById('game-status').textContent, activity:cafe.playerCtl.activity};`);
await step('28b-snake-over', `const ok=await qa.until(()=>!cafe.playing,60000); await qa.sleep(500); return {ok, reward:document.getElementById('reward-title').textContent, lines:document.getElementById('reward-lines').textContent};`, false);
await step('29-darts', `
  const st=cafe.layout.stations.find(s=>s.game==='darts'); const n=cafe.npc('claire'); await qa.until(()=>n.life?.visible&&!n.ctl.scriptedBy&&!['away','leaving','to-counter','ordering'].includes(n.life.phase),90000);
  cafe.startGame(st,n); await qa.until(()=>cafe.playing?.ctl,60000); await qa.sleep(2000);
  const canvas=cafe.renderer.domElement; const r=canvas.getBoundingClientRect();
  for(let i=0;i<3;i++){ await qa.until(()=>/hold to aim/.test(document.getElementById('game-status').textContent),20000);
    canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,bubbles:true}));
    await qa.sleep(700); canvas.dispatchEvent(new PointerEvent('pointerup',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,bubbles:true})); await qa.sleep(1600); }
  return {status:document.getElementById('game-status').textContent};`);
await step('29b-darts-leave', `document.getElementById('game-quit').click(); await qa.until(()=>!cafe.playing,20000); return cafe.state;`, false);
await step('30-hangout', `
  const n=cafe.npc('noah'); await qa.until(()=>n.life?.visible&&!n.ctl.scriptedBy&&!['away','leaving','to-counter','ordering'].includes(n.life.phase),90000);
  cafe.hangOut(n); const ok=await qa.until(()=>cafe.state.posture==='seated'&&n.ctl.posture==='seated',60000); await qa.sleep(2500);
  return {ok, me:cafe.state.seated, them:n.ctl.seat?.id};`);
await step('31-hangout-end', `document.querySelector('#context button').click(); await qa.until(()=>cafe.state.posture==='stand',15000); await qa.sleep(1500); return {posture:cafe.state.posture, noah:cafe.npc('noah').ctl.scriptedBy};`, false);
await step('32-study-together', `
  const n=cafe.npc('claire'); await qa.until(()=>n.life?.visible&&!n.ctl.scriptedBy&&!['away','leaving','to-counter','ordering'].includes(n.life.phase),90000);
  cafe.studyTogether(n); await qa.until(()=>document.getElementById('dialog').open,60000); document.querySelector('[data-min="30"]').click();
  await qa.until(()=>cafe.focus?.stage==='study'&&n.ctl.posture==='seated',40000); cafe.setTimeScale(30); await qa.sleep(4000);
  return {me:cafe.state.seated, them:n.ctl.seat?.id, task:document.getElementById('focus-task').textContent};`);
await step('33-study-together-end', `cafe.setTimeScale(600); await qa.until(()=>!cafe.focus,60000); cafe.setTimeScale(1); await qa.sleep(800); return {reward:document.getElementById('reward-title').textContent, claire:cafe.bonds.claire?.points};`);
await step('24-home', `document.getElementById('home').click(); await qa.sleep(1800); return {mode:cafe.state.mode, welcome:!document.getElementById('welcome').hidden, coins:cafe.econ.coins, drink:cafe.state.drink};`);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, errors }, null, 2));
console.log('errors', JSON.stringify(errors, null, 1));
await browser.close();
