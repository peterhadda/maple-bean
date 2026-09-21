const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
const bare = `document.querySelectorAll('.panel, #context, header, #labels, .touch-pad, #hint, #toast, #loading').forEach(e => e.style.visibility='hidden'); ${settle(400)}`;
// Hide the poster under review so the wall behind it is visible.
const hidePoster = `window.cafe.scene.traverse(o => { if (o.name === 'Oak framed wall art' && Math.abs(o.position.x - 4.6) < .2) o.visible = false; if (o.isMesh && o.material?.map && Math.abs(o.position.x - 4.6) < .2 && Math.abs(o.position.z + 6.78) < .1) o.visible = false; }); ${settle(200)}`;
const cam = (px, py, pz, tx, ty, tz) => `
  { const c = window.cafe; if (c.state.mode !== 'walk') { c.cameraMode('walk'); } ${settle(250)}
  c.controls.dispatchEvent({type:'start'}); c.controls.dispatchEvent({type:'end'});
  c.camera.fov = 30; c.camera.updateProjectionMatrix();
  c.camera.position.set(${px},${py},${pz}); c.controls.target.set(${tx},${ty},${tz}); c.controls.update(); } ${settle(1100)}`;
export default [
  { name: 'warmup', run: settle(6000), shot: false },
  { name: 'north-wall-empty', run: bare + hidePoster + cam(3.0, 2.35, 5.2, 3.0, 2.35, -6.8) },
];
