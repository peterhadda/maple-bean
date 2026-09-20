// "Before" captures of the flows A3 changes (run once, before editing):
//   CAFE_URL=http://127.0.0.1:4333/?qa node qa/shoot.mjs qa/expansion/interactions qa/expansion/interactions/before.mjs 1600 1000
import { enter, cam, settle } from './steps-common.mjs';
export default [
  { name: 'coffee/before-00-enter', run: enter + ' return cafe.state;', shot: false },
  { name: 'coffee/before-01-menu', run: `cafe.orderAtCounter(); await qa.until(() => document.getElementById('dialog').open, 40000); ${cam(-1.3, 2.0, -1.2, -3.5, 1.0, -4.6)} return cafe.me;` },
  { name: 'coffee/before-02-ordered', run: `document.querySelector('[data-order="Latte"]').click(); ${settle(1200)} ${cam(-1.3, 2.0, -1.2, -3.5, 1.0, -4.6)} return cafe.script;` },
  { name: 'coffee/before-03-handoff', run: `await qa.until(() => cafe.playerCtl.activity === 'reach', 60000); ${settle(250)} return cafe.cup;` },
  { name: 'coffee/before-04-in-hand', run: `await qa.until(() => cafe.cup.drink, 30000); ${settle(1200)} return cafe.cup;` },
  { name: 'talk/before-01-talk-mara', run: `cafe.talkTo(cafe.npc('mara')); await qa.until(() => !document.getElementById('chatbox').hidden, 30000); ${settle(1800)} return { me: [cafe.me.x.toFixed(2), cafe.me.z.toFixed(2)], cam: cafe.camera.position.toArray().map(v => +v.toFixed(2)) };` },
  { name: 'talk/before-02-closed', run: `document.getElementById('chatbox-close').click(); ${settle(800)}`, shot: false },
  { name: 'study/before-01-duration-dialog', run: `cafe.goToStation('study-room-1'); await qa.until(() => cafe.state.seated === 'study-room-1' && cafe.state.posture === 'seated', 60000); ${settle(500)} document.querySelector('#context button').click(); await qa.until(() => document.getElementById('dialog').open, 5000); ${settle(400)} return [...document.querySelectorAll('[data-min]')].map(b => b.textContent);` },
  { name: 'study/before-02-focus-hud', run: `document.querySelector('[data-min="30"]').click(); await qa.until(() => cafe.focus?.stage === 'study', 30000); ${settle(1500)} document.getElementById('hint').hidden = true; return document.getElementById('focus-hud').textContent;` },
  { name: 'study/before-03-music-panel', run: `document.getElementById('focus-music-open').click(); ${settle(300)} document.querySelector('#music-categories button').click(); document.getElementById('music-play').click(); ${settle(600)} return document.getElementById('music-status').textContent;` },
  { name: 'study/before-04-end', run: `await cafe.endFocus(false); ${settle(1500)} return cafe.state;`, shot: false },
];
