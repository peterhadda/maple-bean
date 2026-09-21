// Backdrops for the sign-in journey, captured from the café that is actually
// running — the Phase 2 upgrade, with the wings, warm afternoon lighting,
// curved-leaf plants, shelves and hearth.
//
// The Figma "Café Backdrop" component says exactly this: shapes only in the
// design file, "in build this is replaced by a blurred render of the real
// three.js café (assets/cafe.glb) at the golden-afternoon lighting preset".
// So these are renders of the game, never drawn art.
//
//   node qa/shoot.mjs qa/login qa/login-backdrops.mjs 1920 1080
const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
// Every overlay out of the way, including the world-space room labels, so the
// plate is pure café.
const bare = `
  document.querySelectorAll('.panel, #context, header, #labels, .touch-pad, #hint, #toast, #loading').forEach(e => e.style.visibility = 'hidden');
  document.getElementById('lighting').value = 'afternoon';
  document.getElementById('lighting').dispatchEvent(new Event('change'));
  ${settle(600)}`;
const cam = (px, py, pz, tx, ty, tz) => `
  { const c = window.cafe; if (c.state.mode !== 'walk') { c.cameraMode('walk'); } ${settle(250)}
  c.controls.dispatchEvent({ type: 'start' }); c.controls.dispatchEvent({ type: 'end' });
  c.camera.position.set(${px}, ${py}, ${pz}); c.controls.target.set(${tx}, ${ty}, ${tz}); c.controls.update(); } ${settle(1400)}`;
// The regulars belong in the plate — an empty café reads as a closed one — but
// they should not be posed mid-stride across the middle of the frame.
const settleCast = `
  { const c = window.cafe;
  for (const n of c.regulars) { if (n.life) { n.life.scripted = true; } n.ctl.scriptedBy = true; n.ctl.stop(); }
  c.playerCtl.stop(); c.me.x = 0.4; c.me.z = 7.6; }
  ${settle(1200)}`;

export default [
  { name: 'warmup', run: `${settle(6000)} return window.cafe.state;`, shot: false },
  // The main plate: standing just inside the door, the whole room ahead.
  { name: 'cafe-backdrop', run: bare + settleCast + cam(1.4, 2.15, 7.2, -1.2, 1.05, -3.2) },
  // The storefront, for the welcome screen.
  { name: 'cafe-entrance', run: bare + cam(3.5, 2.2, 13, 0, 1.6, 6.8) },
  // The lounge and hearth, warmest corner in the building.
  { name: 'cafe-lounge', run: bare + cam(1.8, 1.85, 1.4, 7.5, .8, -4.5) },
  // The study room, for the tutorial card Noah narrates.
  { name: 'cafe-study', run: bare + cam(16.6, 2.0, 1.8, 12.5, .8, -4.5) },
];
