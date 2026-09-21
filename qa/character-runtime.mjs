import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

const dir = new URL('./characters/runtime/', import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const mouthY = Number(process.argv[2] || 1.389);
assert.ok(mouthY > 1.3 && mouthY < 1.5, 'mouth height must be in character bind space');
const errors = [], failures = [], metrics = { renderer: 'Chrome ANGLE SwiftShader software rendering; timing is not a hardware FPS benchmark', capturedAt: new Date().toISOString(), mouthBindY: mouthY };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));
  await page.goto('http://127.0.0.1:4321/cafe?guest=1', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => window.__ready && window.cafe, null, { timeout: 240000 });
  await page.evaluate(async mouthY => {
    const THREE = await import('three'), { cast } = await import('/characters.js'), { createMaya } = await import('/assets/characters/runtime.js');
    cafe.renderer.setAnimationLoop(null); cafe.cameraMode('walk');
    document.getElementById('labels').hidden = true; document.getElementById('welcome').hidden = true;
    const ids = ['maya', 'claire', 'mara', 'jules', 'noah'];
    const actors = { maya: cafe.maya, ...Object.fromEntries(cafe.regulars.map(n => [n.id, n.actor])) };
    const clean = name => name.replaceAll('.', '');
    const near = actor => actor.group.children.find(o => o.isLOD).levels[0].object;
    const meshes = actor => { const result = []; near(actor).traverse(o => { if (o.isMesh) result.push(o); }); return result; };
    const bones = actor => { const result = []; near(actor).traverse(o => { if (o.isBone) result.push(o); }); return result; };
    const bone = (actor, name) => bones(actor).find(o => clean(o.name) === clean(name));
    const bindings = {};
    for (const id of ids) {
      const a = actors[id]; a.group.position.set(0, 0, 0); a.group.rotation.set(0, 0, 0); a.update(0, 0, { still: true });
      const hand = bone(a, 'handR'), head = bone(a, 'head');
      bindings[id] = {
        mouth: new THREE.Vector3(0, mouthY, .110).applyMatrix4(head.matrixWorld.clone().invert()),
        palm: new THREE.Vector3(cast[id].male ? .180 : .191, .753, .035).applyMatrix4(hand.matrixWorld.clone().invert()),
      };
    }
    function positionLineup(source = actors) {
      for (const [i, id] of ids.entries()) { const a = source[id]; a.group.visible = true; a.group.position.set(-4 + i * .8, 0, 1); a.group.rotation.set(0, 0, 0); }
      cafe.camera.position.set(-2.4, 1.25, 4.8); cafe.camera.lookAt(-2.4, .95, 1);
    }
    function render() { cafe.renderer.render(cafe.scene, cafe.camera); return { ...cafe.renderer.info.render }; }
    function tally(source) {
      let triangles = 0, draws = 0, skinnedMeshes = 0;
      for (const a of Object.values(source)) a.group.traverseVisible(o => {
        if (!o.isMesh) return;
        const g = o.geometry, count = g.index?.count ?? g.attributes.position.count;
        triangles += count / 3; draws += Array.isArray(o.material) ? g.groups.length : 1; skinnedMeshes += +!!o.isSkinnedMesh;
      });
      return { triangles, draws, skinnedMeshes };
    }
    function sample(id, state, time = 2.2, dt = 0) {
      const a = actors[id]; a.group.position.set(0, 0, 0); a.group.rotation.set(0, 0, 0); a.update(time, dt, { still: true, ...state }); a.group.updateMatrixWorld(true);
      const footY = { L: Infinity, R: Infinity }, bounds = new THREE.Box3(), p = new THREE.Vector3(); let vertexCount = 0, finite = true;
      for (const o of bones(a)) finite &&= o.matrixWorld.elements.every(Number.isFinite);
      for (const o of meshes(a)) {
        const positions = o.geometry.attributes.position, joints = o.geometry.attributes.skinIndex, weights = o.geometry.attributes.skinWeight;
        for (let i = 0; i < positions.count; i++) {
          let foot;
          if (o.isSkinnedMesh) for (let k = 0; k < 4; k++) {
            const name = clean(o.skeleton.bones[joints.getComponent(i, k)].name);
            if (weights.getComponent(i, k) > .5 && /^foot[LR]$/.test(name)) foot = name.slice(-1);
          }
          if (foot || i % 37 === 0 || i === positions.count - 1) {
            o.getVertexPosition(i, p); p.applyMatrix4(o.matrixWorld); finite &&= p.toArray().every(Number.isFinite); bounds.expandByPoint(p); vertexCount++;
            if (foot) footY[foot] = Math.min(footY[foot], p.y);
          }
        }
      }
      const cup = a.group.children.find(o => o.isMesh), palm = bindings[id].palm.clone().applyMatrix4(bone(a, 'handR').matrixWorld), mouth = bindings[id].mouth.clone().applyMatrix4(bone(a, 'head').matrixWorld);
      const result = { state, finite, sampledVertices: vertexCount, footSoleY: footY, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
      if (cup?.visible) {
        const centre = cup.getWorldPosition(new THREE.Vector3()); let rimDistance = Infinity;
        for (let i = 0; i < 32; i++) { const angle = i * Math.PI / 16; p.set(Math.sin(angle) * .028, .039, Math.cos(angle) * .028).applyMatrix4(cup.matrixWorld); rimDistance = Math.min(rimDistance, p.distanceTo(mouth)); }
        result.cup = { palmToCentre: palm.distanceTo(centre), mouthToRim: rimDistance, palm: palm.toArray(), centre: centre.toArray(), mouth: mouth.toArray() };
      }
      return result;
    }
    function showPose(state) { for (const id of ids) actors[id].update(2.2, 0, { still: true, ...state }); positionLineup(); render(); }
    const duplicate = createMaya(cast.maya), original = actors.maya;
    duplicate.update(0, 0, { still: true }); original.update(0, 0, { still: true });
    const untouched = bones(duplicate).map(b => b.matrix.elements.slice()), morphBefore = meshes(duplicate).filter(m => m.morphTargetInfluences).map(m => m.morphTargetInfluences.slice());
    original.update(1, .016, { still: true, walking: true, wave: true, expression: 'happy' });
    const ownMeshes = meshes(original), otherMeshes = meshes(duplicate);
    const independence = {
      bonesIndependent: bones(original).every((b, i) => b !== bones(duplicate)[i]),
      skeletonsIndependent: ownMeshes.filter(m => m.isSkinnedMesh).every((m, i) => m.skeleton !== otherMeshes.filter(n => n.isSkinnedMesh)[i].skeleton),
      bonesUnchanged: bones(duplicate).every((b, i) => b.matrix.elements.every((v, j) => v === untouched[i][j])),
      morphsUnchanged: meshes(duplicate).filter(m => m.morphTargetInfluences).every((m, i) => m.morphTargetInfluences.every((v, j) => v === morphBefore[i][j])),
      geometryShared: ownMeshes.every((m, i) => m.geometry === otherMeshes[i].geometry),
      materialsShared: ownMeshes.every((m, i) => m.material === otherMeshes[i].material),
    };
    window.characterQA = { THREE, cast, ids, actors, near, meshes, bones, bone, positionLineup, render, tally, sample, showPose, independence };
  }, mouthY);
  metrics.cloning = await page.evaluate(() => characterQA.independence);
  for (const [key, value] of Object.entries(metrics.cloning)) assert.ok(value, `clone check: ${key}`);
  console.log('Independent native skeletons and shared resources verified');
  metrics.poses = {};
  for (const id of ['maya', 'claire', 'mara', 'jules', 'noah']) {
    metrics.poses[id] = await page.evaluate(id => {
      const q = characterQA, results = { neutral: q.sample(id, {}), walking: q.sample(id, { walking: true }), wave: q.sample(id, { wave: true }), cup: q.sample(id, { cup: true }), sip: q.sample(id, { cup: true, sipping: true }) };
      for (const seatHeight of [.44, .54, .585]) {
        results[`seat-${seatHeight}`] = q.sample(id, { sitting: true, seatHeight });
        results[`study-${seatHeight}`] = q.sample(id, { sitting: true, studying: true, seatHeight });
        results[`sip-${seatHeight}`] = q.sample(id, { sitting: true, cup: true, sipping: true, seatHeight });
      }
      results.gait = Array.from({ length: 8 }, (_, i) => q.sample(id, { walking: true, still: false }, 2.2 + i * .08, .08));
      return results;
    }, id);
    console.log(`Measured ${id}: neutral, walk, wave, cup, sip and three seat heights`);
  }
  metrics.defects = [];
  for (const [id, poses] of Object.entries(metrics.poses)) for (const [pose, result] of Object.entries(poses)) for (const r of Array.isArray(result) ? result : [result]) {
    assert.ok(r.finite, `${id}/${pose}: finite skinned vertices and bones`);
    for (const y of Object.values(r.footSoleY)) if (y < -.015 || y > .09) metrics.defects.push(`${id}/${pose}: sole y=${y.toFixed(4)} m`);
    if (r.cup?.palmToCentre > .09) metrics.defects.push(`${id}/${pose}: cup is ${(r.cup.palmToCentre * 100).toFixed(1)} cm from palm`);
    if (r.state.sipping && r.cup?.mouthToRim > .065) metrics.defects.push(`${id}/${pose}: cup rim ${(r.cup.mouthToRim * 100).toFixed(1)} cm from mouth`);
  }
  for (const [name, state] of [['neutral', {}], ['walk', { walking: true }], ['wave', { wave: true }], ['sip', { cup: true, sipping: true }], ...[.44, .54, .585].map(seatHeight => [`study-${seatHeight}`, { sitting: true, studying: true, seatHeight }])]) {
    await page.evaluate(state => characterQA.showPose(state), state);
    await page.screenshot({ path: new URL(`desktop-${name}.png`, dir).pathname.replace(/^\/(\w:)/, '$1'), timeout: 120000 });
  }
  metrics.scene = await page.evaluate(() => {
    const q = characterQA; q.showPose({}); const rendered = q.render(), character = q.tally(q.actors);
    for (const a of Object.values(q.actors)) a.group.visible = false;
    const environment = q.render(); for (const a of Object.values(q.actors)) a.group.visible = true;
    q.render(); return { current: { character, rendered }, environment, camera: cafe.camera.position.toArray(), lookAt: [-2.4, .95, 1], lightingUnchanged: true };
  });
  console.log('Capturing original generator baseline with identical café, camera and lighting');
  metrics.scene.baseline = await page.evaluate(async () => {
    const { createMaya } = await import('/assets/character-kit/generator.js'), q = characterQA, old = {};
    for (const a of Object.values(q.actors)) a.group.visible = false;
    for (const id of q.ids) { const a = old[id] = createMaya({ ...q.cast[id], detail: 'game' }); a.update(0, 0, { still: true }); cafe.scene.add(a.group); }
    q.old = old; q.positionLineup(old); const rendered = q.render(); return { character: q.tally(old), rendered };
  });
  await page.screenshot({ path: new URL('desktop-original-baseline.png', dir).pathname.replace(/^\/(\w:)/, '$1'), timeout: 120000 });
  await page.evaluate(() => { for (const a of Object.values(characterQA.old)) cafe.scene.remove(a.group); characterQA.showPose({}); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  metrics.mobile = await page.evaluate(() => {
    const q = characterQA; for (const [id, a] of Object.entries(q.actors)) { a.group.visible = id === 'maya'; a.group.position.set(-2, 0, 1); a.group.rotation.set(0, 0, 0); a.update(0, 0, { still: true }); }
    cafe.camera.position.set(-2, 1.05, 4.4); cafe.camera.lookAt(-2, .97, 1); q.render();
    const canvas = cafe.renderer.domElement.getBoundingClientRect();
    return { viewport: [innerWidth, innerHeight], documentWidth: document.documentElement.scrollWidth, canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height }, render: { ...cafe.renderer.info.render } };
  });
  await page.screenshot({ path: new URL('mobile-maya.png', dir).pathname.replace(/^\/(\w:)/, '$1'), timeout: 120000 });
  await page.evaluate(() => { const q = characterQA; q.actors.maya.group.visible = false; const a = q.actors.noah; a.group.visible = true; a.update(0, 0, { still: true, cup: true, sipping: true }); q.render(); });
  await page.screenshot({ path: new URL('mobile-noah-sip.png', dir).pathname.replace(/^\/(\w:)/, '$1'), timeout: 120000 });
  assert.ok(metrics.mobile.documentWidth <= 390, 'mobile document has no horizontal overflow');
  metrics.errors = errors; metrics.failedRequests = failures;
  assert.equal(errors.length, 0, 'no browser runtime exceptions');
  console.log(JSON.stringify({ scene: metrics.scene, defects: metrics.defects, mobile: metrics.mobile, errors }, null, 2));
} catch (error) {
  metrics.fatal = error.stack; process.exitCode = 1; console.error(error);
} finally {
  await writeFile(new URL('metrics.json', dir), JSON.stringify(metrics, null, 2));
  await browser.close();
}
