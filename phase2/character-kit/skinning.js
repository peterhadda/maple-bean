// GPU skinning for the Maple Bean pose system. applyPose (pose.js) blends, per
// vertex, between 1–3 pose matrices chosen by region and bind height, then mixes
// in the pelvis matrix. Those choices depend only on the bind position, so they
// are baked once into vertex attributes here and the blend runs in the vertex
// shader: position = ((1-h)·I + h·P) · Σ wᵢ·Mᵢ · v. This removes the per-frame
// CPU loop over every vertex and the per-frame normal recomputation.
import { smooth } from './pose.js';

export const BONE = { root: 0, thigh0: 1, thigh1: 2, shin0: 3, shin1: 4, foot0: 5, foot1: 6, upper0: 7, upper1: 8, lower0: 9, lower1: 10 };
export const BONE_COUNT = 11;

// Mirrors applyPose exactly. Returns up to three [bone, weight] pairs and the pelvis weight.
export function vertexInfluences(x, y, region, side) {
  const index = (side ?? (x < 0 ? -1 : 1)) < 0 ? 0 : 1;
  let influences;
  if (region === 'arm') {
    const k = 1 - smooth(.985, 1.085, y);
    const rootWeight = (1 - smooth(.08, .135, Math.abs(x))) * smooth(1.16, 1.23, y);
    influences = [[BONE.upper0 + index, (1 - rootWeight) * (1 - k)], [BONE.lower0 + index, (1 - rootWeight) * k], [BONE.root, rootWeight]];
  } else if (region === 'shoe') {
    influences = [[BONE.foot0 + index, 1]];
  } else if (y < .88) {
    if (y > .66) {
      const s = smooth(-.048, .048, x), rootWeight = smooth(.77, .88, y);
      influences = [[BONE.thigh0, (1 - rootWeight) * (1 - s)], [BONE.thigh1, (1 - rootWeight) * s], [BONE.root, rootWeight]];
    } else if (y < .14) {
      const s = smooth(.06, .14, y);
      influences = [[BONE.foot0 + index, 1 - s], [BONE.shin0 + index, s]];
    } else {
      const s = smooth(.36, .48, y);
      influences = [[BONE.shin0 + index, 1 - s], [BONE.thigh0 + index, s]];
    }
  } else {
    influences = [[BONE.root, 1]];
  }
  const hip = smooth(.30, .72, y) * (1 - smooth(.92, 1.35, y));
  return { influences, hip };
}

// Bakes mbIndex/mbWeight/mbHip for one bound mesh entry (from bindBody).
export function bakeSkinAttributes(positions, region, side) {
  const count = positions.length / 3;
  const index = new Float32Array(count * 3), weight = new Float32Array(count * 3), hip = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = vertexInfluences(positions[i * 3], positions[i * 3 + 1], region, side);
    r.influences.forEach(([bone, w], j) => { index[i * 3 + j] = bone; weight[i * 3 + j] = w; });
    hip[i] = r.hip;
  }
  return { index, weight, hip };
}

// Copies a poseMatrices() result into the bone uniform layout.
export function writeBones(pose, bones, pelvis) {
  bones[BONE.root].copy(pose.root);
  pose.legs.forEach((leg, i) => { bones[BONE.thigh0 + i].copy(leg.thigh); bones[BONE.shin0 + i].copy(leg.shin); bones[BONE.foot0 + i].copy(leg.foot); });
  pose.arms.forEach((arm, i) => { bones[BONE.upper0 + i].copy(arm.upper); bones[BONE.lower0 + i].copy(arm.lower); });
  pelvis.copy(pose.pelvis);
}

const PARS = `
attribute vec3 mbIndex;
attribute vec3 mbWeight;
attribute float mbHip;
uniform mat4 mbBones[ ${BONE_COUNT} ];
uniform mat4 mbPelvis;
mat4 mbSkinMatrix() {
  mat4 b = mbWeight.x * mbBones[ int( mbIndex.x + 0.5 ) ] + mbWeight.y * mbBones[ int( mbIndex.y + 0.5 ) ] + mbWeight.z * mbBones[ int( mbIndex.z + 0.5 ) ];
  return ( 1.0 - mbHip ) * b + mbHip * ( mbPelvis * b );
}
`;
export function injectSkinning(vertexShader) {
  let s = vertexShader.replace('void main() {', PARS + 'void main() {\n\tmat4 mbSkin = mbSkinMatrix();');
  if (s.includes('#include <skinnormal_vertex>')) s = s.replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\n\tobjectNormal = normalize( mat3( mbSkin ) * objectNormal );');
  return s.replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = ( mbSkin * vec4( transformed, 1.0 ) ).xyz;');
}

// Chains onto any existing onBeforeCompile (e.g. the skin SSS shader) so the
// material's own look is untouched, and keys the program separately.
export function installSkinning(material, uniforms) {
  if (material.userData.mbSkinned) return material;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  const hadCustomKey = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey');
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.mbBones = uniforms.mbBones; shader.uniforms.mbPelvis = uniforms.mbPelvis;
    shader.vertexShader = injectSkinning(shader.vertexShader);
  };
  const base = hadCustomKey ? previousKey.call(material) : String(previous);
  material.customProgramCacheKey = () => base + '|mb-gpu-skin';
  material.userData.mbSkinned = true;
  return material;
}
