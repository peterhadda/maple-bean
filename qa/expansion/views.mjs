// Fixed review views for the Phase 2 expansion loop. Each view pins the camera
// so screenshots are comparable across iterations:
//   node qa/shoot.mjs qa/expansion/<pass> qa/expansion/views.mjs 1600 1000
// Coordinates: main café x∈[-10,10], z∈[-7,7] (storefront at +z, bar at -z);
// Study Room x∈[10,17.2]; Games & Garden z∈[-14.4,-7].
const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
const cam = (px, py, pz, tx, ty, tz) => `
  { const c = window.cafe; if (c.state.mode !== 'walk') { c.cameraMode('walk'); } ${settle(200)}
  c.controls.dispatchEvent({ type: 'start' }); c.controls.dispatchEvent({ type: 'end' });
  c.camera.position.set(${px}, ${py}, ${pz}); c.controls.target.set(${tx}, ${ty}, ${tz}); c.controls.update(); } ${settle(1200)}`;
const hideUi = `document.querySelectorAll('.panel, #context, header, .touch-pad').forEach(e => e.style.visibility = 'hidden');`;
const lineup = `
  { const c = window.cafe;
  for (const n of c.regulars) { if (n.life) { n.life.scripted = true; n.life.visible = true; n.life.phase = 'idle'; n.life.seat = null; n.life.sit = 0; } n.ctl.scriptedBy = true; n.ctl.stop(); n.ctl.posture = 'stand'; n.ctl.sit = 0; n.ctl.seat = null; }
  const ids = ['maya', 'claire', 'noah', 'mara', 'jules'];
  const place = (b, i) => { b.x = -2.4 + i * 1.2; b.z = 1.9; b.angle = 0; };
  place(c.me, 0); c.playerCtl.stop();
  for (const n of c.regulars) { const b = n.life || n.ctl.body; place(b, ids.indexOf(n.id)); }
  } ${settle(1500)}`;
export default [
  { name: '00-overview', run: `${settle(6000)} return window.cafe.state;` },
  { name: '01-bar', run: hideUi + cam(1.2, 1.75, 1.2, -3.6, 1.05, -5.2) },
  { name: '02-lounge-fire', run: cam(1.8, 1.8, 1.2, 7.5, .8, -4.5) },
  { name: '03-community-window', run: cam(-2.5, 1.9, -2.5, 4.5, .7, 4.5) },
  { name: '04-reading-books', run: cam(-1.5, 1.8, -0.5, -8, 1, 4.5) },
  { name: '05-study-room', run: cam(16.6, 2.0, 1.8, 12.5, .8, -4.5) },
  { name: '06-games-garden', run: cam(6.9, 2.1, -7.6, 1.5, .7, -12.5) },
  { name: '07-storefront', run: cam(3.5, 2.2, 13, 0, 1.6, 6.8) },
  { name: '08-cast-lineup', run: lineup + cam(0, 1.3, 5.6, 0, .95, 1.9) },
  { name: '09-faces-left', run: cam(-1.8, 1.52, 3.1, -1.8, 1.45, 1.9) },
  { name: '10-faces-right', run: cam(1.2, 1.52, 3.1, 1.2, 1.45, 1.9) },
  { name: '11-plan', run: `document.querySelectorAll('.panel, header').forEach(e => e.style.visibility = ''); window.cafe.cameraMode('plan'); ${settle(2500)}` },
];
