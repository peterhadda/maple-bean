// Where is there actually free wall? Projects everything near the north wall
// onto the x axis and reports the gaps.
const settle = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
export default [
  { name: 'warmup', run: settle(6000), shot: false },
  { name: 'scan', shot: false, run: `
    const THREE = await import('three');
    const spans = [];
    window.cafe.scene.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const box = new THREE.Box3().setFromObject(o);
      if (!isFinite(box.min.x)) return;
      // Things living on the north wall, at hanging height.
      if (box.max.z < -7.4 || box.min.z > -6.2) return;
      if (box.max.y < 1.4 || box.min.y > 3.3) return;
      if (box.max.x - box.min.x > 14) return;            // the wall itself
      spans.push({ name: o.name || '(unnamed)', x0: +box.min.x.toFixed(2), x1: +box.max.x.toFixed(2), y0: +box.min.y.toFixed(2), y1: +box.max.y.toFixed(2) });
    });
    spans.sort((a, b) => a.x0 - b.x0);
    // Merge into occupied ranges and report the gaps between them.
    const merged = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s.x0 <= last.x1 + .05) last.x1 = Math.max(last.x1, s.x1);
      else merged.push({ x0: s.x0, x1: s.x1 });
    }
    const gaps = [];
    for (let i = 0; i < merged.length - 1; i++) {
      const w = +(merged[i + 1].x0 - merged[i].x1).toFixed(2);
      if (w > .5) gaps.push({ from: merged[i].x1, to: merged[i + 1].x0, width: w, centre: +((merged[i].x1 + merged[i + 1].x0) / 2).toFixed(2) });
    }
    return { doors: window.cafe.layout.doors, occupied: merged, gaps, items: spans.slice(0, 40) };` },
];
