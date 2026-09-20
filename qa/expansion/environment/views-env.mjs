// A2 environment loop views (subset of qa/expansion/views.mjs + stats + evening).
//   CAFE_URL=http://127.0.0.1:4332/ node qa/shoot.mjs qa/expansion/environment/passN qa/expansion/environment/views-env.mjs 1600 1000
// ONLY=01-bar,07-storefront limits the run to a few views.
import base from '../views.mjs';
const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
const stats = `const r = window.cafe.renderer; r.render(window.cafe.scene, window.cafe.camera); return { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tex: r.info.memory.textures };`;
const pick = n => base.find(v => v.name === n);
const cam = (px, py, pz, tx, ty, tz) => `
  { const c = window.cafe; if (c.state.mode !== 'walk') { c.cameraMode('walk'); } ${settle(200)}
  c.controls.dispatchEvent({ type: 'start' }); c.controls.dispatchEvent({ type: 'end' });
  c.camera.position.set(${px}, ${py}, ${pz}); c.controls.target.set(${tx}, ${ty}, ${tz}); c.controls.update(); } ${settle(1200)}`;
const views = [
  { name: '00-overview', run: `${settle(6000)} ${stats}` },
  pick('01-bar'),
  { name: '01b-entrance-to-bar', run: cam(0.5, 1.8, 6.2, -1.5, 1.0, -4.5) + stats },
  pick('02-lounge-fire'), pick('03-community-window'), pick('04-reading-books'), pick('05-study-room'), pick('06-games-garden'), pick('07-storefront'),
  { name: '12-evening-bar', run: `document.getElementById('lighting').value='evening'; document.getElementById('lighting').dispatchEvent(new Event('change'));` + cam(1.2, 1.75, 1.2, -3.6, 1.05, -5.2) },
  { name: '13-evening-overview', run: `window.cafe.cameraMode('overview'); ${settle(2500)} ${stats}` },
  { name: '11-plan', run: `document.getElementById('lighting').value='afternoon'; document.getElementById('lighting').dispatchEvent(new Event('change')); ` + pick('11-plan').run + stats },
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
export default views.filter(v => !only || only.includes(v.name) || v.name === '00-overview');
