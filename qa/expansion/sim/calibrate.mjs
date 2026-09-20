// One-off: print rest vs live bone heights so the guardian's foot/seat thresholds are grounded.
import { launch, openCafe } from './browser.mjs';
const browser = await launch();
const cl = await openCafe(browser, { name: 'cal' });
const out = await cl.page.evaluate(async () => {
  const c = window.cafe; await qa.sleep(3000);
  const M = c.camera.matrixWorld.constructor;
  const info = g => {
    let sk = null; g.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o; });
    const r = {}; const bm = sk.bindMatrix.elements.map(v => +v.toFixed(3));
    sk.skeleton.bones.forEach((b, i) => { const n = b.name; if (!/foot|thigh|hips|head$|^head|shin/.test(n)) return; const inv = new M().copy(sk.skeleton.boneInverses[i]).invert(); const w = b.matrixWorld.elements; r[n] = { restY: +inv.elements[13].toFixed(3), restBoundY: +new M().copy(sk.bindMatrix).multiply(inv).elements[13].toFixed(3), liveY: +(w[13]).toFixed(3), groupY: +g.position.y.toFixed(4) }; });
    return { name: g.name, bindIdentity: bm.join(',') === '1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1', bones: r };
  };
  const res = { player: info(c.maya.group), posture: c.playerCtl.posture };
  const mara = c.regulars.find(n => n.id === 'mara'); res.mara = info(mara.avatar.group);
  res.cam = c.camera.position.toArray(); res.mode = c.state.mode;
  res.seats = c.world.seats.map(s => ({ id: s.id, sh: s.seatHeight, surf: c.world.surfaceHeight(s.x, s.z, (s.seatHeight || .54) + .3) }));
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
