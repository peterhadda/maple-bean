// Shared page snippets for A3 interaction evidence runs (qa/shoot.mjs views).
export const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
export const helpers = `
  window.qa = window.qa || {
    until: async (fn, ms = 30000) => { const t = performance.now(); while (performance.now() - t < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
  };`;
export const enter = `${helpers} document.getElementById('enter').click(); await qa.sleep(2500); document.getElementById('hint').hidden = true;`;
// Pin the camera like a player orbiting to look at something.
export const cam = (px, py, pz, tx, ty, tz) => `{ const c = window.cafe; c.controls.dispatchEvent({ type: 'start' }); c.camera.position.set(${px}, ${py}, ${pz}); c.controls.target.set(${tx}, ${ty}, ${tz}); c.controls.update(); c.controls.dispatchEvent({ type: 'end' }); } ${settle(700)}`;
export const waitRegular = id => `await qa.until(() => { const n = cafe.npc('${id}'); return n.life?.visible && !n.ctl.scriptedBy && !['away','leaving','to-counter','ordering'].includes(n.life.phase); }, 90000);`;
