import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, BufferGeometry, Float32BufferAttribute, Matrix4, Vector3, Vector4 } from 'three';
import { poseMatrices, applyPose } from '../character-kit/pose.js';
import { bakeSkinAttributes, writeBones, BONE_COUNT, injectSkinning } from '../character-kit/skinning.js';

// Deterministic sample points across every region and height band applyPose distinguishes.
function samplePoints() {
  const pts = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 600; i++) pts.push([(rnd() - .5) * .5, rnd() * 1.7, (rnd() - .5) * .4]);
  for (const y of [.06, .14, .36, .48, .66, .77, .88, .92, .985, 1.085, 1.16, 1.23, 1.35]) for (const x of [-.2, -.048, 0, .048, .2]) pts.push([x, y, .02]);
  return pts;
}
const POSES = [
  {}, { walk: 1, phase: .7 }, { walk: 1, phase: 3.9 }, { sit: 1, seatHeight: .44 }, { wave: 1, time: 2.3 },
  { sip: 1 }, { sit: .4, walk: .6, wave: .3, sip: .2, phase: 1.3, time: .8, male: true }, { walk: 1, phase: 5.1, male: true },
];

test('GPU skin formula reproduces CPU applyPose positions for every region and pose', () => {
  const pts = samplePoints();
  for (const region of ['body', 'arm', 'shoe']) for (const side of [undefined, -1, 1]) {
    const flat = pts.flat();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(flat, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(pts.flatMap(() => [0, 0, 1]), 3));
    const entry = { mesh: new Mesh(geometry), region, side, positions: new Float32Array(flat), normals: geometry.attributes.normal.array.slice() };
    const baked = bakeSkinAttributes(entry.positions, region, side);
    const bones = Array.from({ length: BONE_COUNT }, () => new Matrix4()), pelvis = new Matrix4();
    for (const params of POSES) {
      const pose = poseMatrices(params);
      applyPose([entry], pose);
      writeBones(pose, bones, pelvis);
      let worst = 0;
      for (let i = 0; i < pts.length; i++) {
        const b = new Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        for (let j = 0; j < 3; j++) {
          const w = baked.weight[i * 3 + j]; if (!w) continue;
          const m = bones[baked.index[i * 3 + j]].elements;
          for (let e = 0; e < 16; e++) b.elements[e] += w * m[e];
        }
        const pb = pelvis.clone().multiply(b), h = baked.hip[i];
        const f = new Matrix4(); for (let e = 0; e < 16; e++) f.elements[e] = (1 - h) * b.elements[e] + h * pb.elements[e];
        const v = new Vector4(...pts[i], 1).applyMatrix4(f);
        const cpu = new Vector3().fromBufferAttribute(geometry.attributes.position, i);
        worst = Math.max(worst, cpu.distanceTo(new Vector3(v.x, v.y, v.z)));
      }
      assert.ok(worst < 2e-6, `${region}/${side}/${JSON.stringify(params)}: GPU formula off by ${worst} m`);
    }
  }
});

test('skin weights are normalised and the shader injection hits every insertion point', () => {
  const { weight, index, hip } = bakeSkinAttributes(new Float32Array(samplePoints().flat()), 'arm', 1);
  for (let i = 0; i < hip.length; i++) {
    const sum = weight[i * 3] + weight[i * 3 + 1] + weight[i * 3 + 2];
    assert.ok(Math.abs(sum - 1) < 1e-6, 'weights must sum to 1');
    assert.ok(hip[i] >= 0 && hip[i] <= 1);
    for (let j = 0; j < 3; j++) assert.ok(index[i * 3 + j] >= 0 && index[i * 3 + j] < BONE_COUNT);
  }
  const physical = 'uniform x;\nvoid main() {\n#include <beginnormal_vertex>\n#include <skinnormal_vertex>\n#include <begin_vertex>\n}';
  const out = injectSkinning(physical);
  assert.match(out, /mat4 mbSkin = mbSkinMatrix\(\);/);
  assert.match(out, /objectNormal = normalize\( mat3\( mbSkin \) \* objectNormal \);/);
  assert.match(out, /transformed = \( mbSkin \* vec4\( transformed, 1\.0 \) \)\.xyz;/);
  const depth = 'void main() {\n#include <begin_vertex>\n}';
  assert.doesNotMatch(injectSkinning(depth), /objectNormal/, 'depth shaders have no normal stage');
});
