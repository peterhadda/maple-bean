// The "Good Coffee / Brighter Days" frame must hang on wall — clear of the
// games doorway (layout.json `games-door`, x 2.26–2.94) and clear of the
// community noticeboard (x 3.4–6.0).
const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
const bare = `document.querySelectorAll('.panel, #context, header, #labels, .touch-pad, #hint, #toast, #loading').forEach(e => e.style.visibility='hidden'); ${settle(400)}`;
const cam = (px, py, pz, tx, ty, tz, fov = 34) => `
  { const c = window.cafe; if (c.state.mode !== 'walk') { c.cameraMode('walk'); } ${settle(250)}
  c.controls.dispatchEvent({type:'start'}); c.controls.dispatchEvent({type:'end'});
  c.camera.fov = ${fov}; c.camera.updateProjectionMatrix();
  c.camera.position.set(${px},${py},${pz}); c.controls.target.set(${tx},${ty},${tz}); c.controls.update(); } ${settle(1200)}`;
export default [
  { name: 'warmup', run: settle(6000), shot: false },
  { name: 'poster-wall', run: bare + cam(-1.25, 2.3, 1.6, -1.25, 2.2, -6.8, 30) },
  { name: 'poster-wide', run: bare + cam(1.5, 2.35, 5.2, 1.5, 2.3, -6.8, 32) },
  {
    name: 'poster-geometry', shot: false,
    run: `
      const THREE = await import('three');
      const doors = window.cafe.layout.doors;
      // The noticeboard is baked into cafe.glb, so its span is stated here.
      const fixtures = [{ id: 'games-door', x0: 2.26, x1: 2.94 }, { id: 'noticeboard', x0: 3.40, x1: 6.00 }, { id: 'floating-shelves', x0: 6.12, x1: 8.08 }];
      const frames = [];
      window.cafe.scene.traverse(o => { if (o.name === 'Oak framed wall art') { const b = new THREE.Box3().setFromObject(o); frames.push({ x0: +b.min.x.toFixed(2), x1: +b.max.x.toFixed(2), z: +o.position.z.toFixed(2) }); } });
      const northWall = frames.filter(f => Math.abs(f.z + 6.82) < .1);
      const clashes = [];
      for (const f of northWall) for (const x of fixtures) if (f.x1 > x.x0 && f.x0 < x.x1) clashes.push({ frame: f, over: x.id });
      return { northWallFrames: northWall, clashes, doors: doors.map(d => d.id) };`,
  },
];
