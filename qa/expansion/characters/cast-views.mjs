// A1 character review views (deterministic: the animation loop is paused and every
// frame is rendered by hand). Usage, with a private server:
//   CAFE_URL=http://127.0.0.1:4331/ node qa/shoot.mjs qa/expansion/characters/passN qa/expansion/characters/cast-views.mjs 1600 1000
// Then: python qa/expansion/characters/compose.py passN  (reference strips side by side)
const ids = ['maya', 'claire', 'noah', 'mara', 'jules'];
const setup = `
  const c = window.cafe; c.renderer.setAnimationLoop(null); if (c.state.mode !== 'walk') c.cameraMode('walk');
  document.querySelectorAll('.panel, #context, header, .touch-pad, #labels, #welcome, #locations, .hud, #hud, footer').forEach(e => e.style.visibility = 'hidden');
  window.qaCast = { maya: c.maya, ...Object.fromEntries(c.regulars.map(n => [n.id, n.avatar])) };
  for (const a of Object.values(qaCast)) a.group.visible = false;
  window.qaShow = (id, x, z, angle = 0, state = {}) => { const a = qaCast[id]; a.group.visible = true; a.group.position.set(x, 0, z); a.group.rotation.set(0, angle, 0); a.update(0, 0, { still: true, expression: 'neutral', ...state }); };
  window.qaRender = (px, py, pz, tx, ty, tz, fov = 42) => { c.camera.fov = fov; c.camera.updateProjectionMatrix(); c.camera.position.set(px, py, pz); c.camera.lookAt(tx, ty, tz); c.renderer.render(c.scene, c.camera); };
  return Object.keys(qaCast);`;
const hideAll = `for (const a of Object.values(qaCast)) a.group.visible = false;`;
const steps = [{ name: '_setup', run: setup, shot: false }];
steps.push({ name: 'lineup', run: `${hideAll} ${JSON.stringify(ids)}.forEach((id, i) => qaShow(id, -3.6 + i * .8, 1)); qaRender(-2, 1.2, 4.9, -2, .92, 1, 40);` });
steps.push({ name: 'lineup-happy', run: `${hideAll} ${JSON.stringify(ids)}.forEach((id, i) => qaShow(id, -3.6 + i * .8, 1, 0, { expression: 'happy' })); qaRender(-2, 1.46, 2.6, -2, 1.42, 1, 40);` });
for (const id of ids) {
  steps.push({ name: `${id}-face`, run: `${hideAll} qaShow('${id}', -2, 1); qaRender(-2, 1.47, 1.95, -2, 1.45, 1, 30);` });
  steps.push({ name: `${id}-face34`, run: `${hideAll} qaShow('${id}', -2, 1, 0, { expression: 'smile' }); qaRender(-2 + .55, 1.49, 1 + .78, -2, 1.45, 1, 30);` });
  steps.push({ name: `${id}-body`, run: `${hideAll} qaShow('${id}', -2, 1, .35); qaRender(-2, .95, 3.55, -2, .88, 1, 40);` });
}
export default steps;
