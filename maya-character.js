import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bindBody, applyPose, poseMatrices } from './animation.js';
export function createMaya(options = {}) {
const V3 = THREE.Vector3;
const mark = () => {};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rand = mulberry32(20260915);
const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const gauss = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy));

function spline1(tab){
  const n = tab.length, m = tab.map((p, i) => { const a = tab[Math.max(0, i-1)], b = tab[Math.min(n-1, i+1)]; return (b[1]-a[1]) / (b[0]-a[0]); });
  return x => {
    if (x <= tab[0][0]) return tab[0][1];
    if (x >= tab[n-1][0]) return tab[n-1][1];
    let i = 0; while (x > tab[i+1][0]) i++;
    const h = tab[i+1][0]-tab[i][0], s = (x-tab[i][0])/h, s2 = s*s, s3 = s2*s;
    return (2*s3-3*s2+1)*tab[i][1] + (s3-2*s2+s)*h*m[i] + (-2*s3+3*s2)*tab[i+1][1] + (s3-s2)*h*m[i+1];
  };
}

function weldNormals(g, eps = 1e-5) {
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal, map = new Map(), inv = 1 / eps;
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(pos.getX(i)*inv) + '_' + Math.round(pos.getY(i)*inv) + '_' + Math.round(pos.getZ(i)*inv);
    let a = map.get(k); if (!a) map.set(k, a = []); a.push(i);
  }
  const n = new V3();
  for (const ids of map.values()) {
    if (ids.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of ids) { n.x += nor.getX(i); n.y += nor.getY(i); n.z += nor.getZ(i); }
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    for (const i of ids) nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

// rows along t (0..1, usually upward), cols along u (0..1 around; x = sin(phi), z = cos(phi), phi=(u-.5)*2PI)
function gridSurface(rows, cols, fn) {
  const pos = new Float32Array((rows+1)*(cols+1)*3), uv = new Float32Array((rows+1)*(cols+1)*2), idx = [], v = new V3();
  let k = 0;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    fn(i / rows, j / cols, v); pos[k*3] = v.x; pos[k*3+1] = v.y; pos[k*3+2] = v.z; uv[k*2] = j / cols; uv[k*2+1] = i / rows; k++;
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i*(cols+1)+j, b = a + cols + 1;
    idx.push(a, a+1, b, a+1, b+1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return weldNormals(g);
}

function taperedTube(pts, { segments = 32, radial = 8, radius = () => 0.01, flatten = 1, closed = false, up = null } = {}) {
  const curve = pts.isCurve ? pts : new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, closed);
  const pos = g.attributes.position, P = new V3(), d = new V3(), N = new V3(), B = new V3(), T = new V3();
  const strand = new Float32Array(pos.count * 3);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments; curve.getPointAt(t, P);
    T.copy(g.tangents[i]);
    if (up) { B.copy(up).cross(T).normalize(); if (B.lengthSq() < 1e-6) B.set(1,0,0); N.copy(T).cross(B).normalize(); }
    else { N.copy(g.normals[i]); B.copy(g.binormals[i]); }
    const r = Math.max(radius(t), 1e-5);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      d.fromBufferAttribute(pos, k).sub(P);
      const n = d.dot(g.normals[i]), b = d.dot(g.binormals[i]);
      d.copy(N).multiplyScalar(n * r * flatten).addScaledVector(B, b * r).add(P);
      pos.setXYZ(k, d.x, d.y, d.z);
      strand[k*3] = T.x; strand[k*3+1] = T.y; strand[k*3+2] = T.z;
    }
  }
  g.setAttribute('aStrand', new THREE.BufferAttribute(strand, 3));
  return weldNormals(g);
}
const strandR = (R, p = 0.6) => t => R * Math.pow(Math.max(0, Math.sin(Math.PI * t)), p);
const wispR   = (R, p = 0.7) => t => R * Math.pow(Math.max(0, 1 - t), p) * Math.min(1, t * 12 + 0.25);

function fillAttr(g, name, n, fn) {
  const a = new Float32Array(g.attributes.position.count * n);
  for (let i = 0; i < g.attributes.position.count; i++) { const v = fn(i); for (let c = 0; c < n; c++) a[i*n+c] = v[c]; }
  g.setAttribute(name, new THREE.BufferAttribute(a, n)); return g;
}
function canvasTex(w, h, draw, { srgb = true, premul = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.premultiplyAlpha = premul; t.anisotropy = 8; return t;
}
function heightToNormal(h, size, strength) {
  const nd = new Uint8Array(size * size * 4), H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x+1,y) - H(x-1,y)) * strength, dy = (H(x,y+1) - H(x,y-1)) * strength, l = Math.hypot(dx, dy, 1), i = (y*size + x) * 4;
    nd[i] = (-dx/l*0.5+0.5)*255; nd[i+1] = (-dy/l*0.5+0.5)*255; nd[i+2] = (1/l*0.5+0.5)*255; nd[i+3] = 255;
  }
  const t = new THREE.DataTexture(nd, size, size);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  return t;
}

const COL = {
  skin: 0xeeb092, lip: 0xdc6f5e, hair: 0x22140e, brow: 0x462b20, top: 0xf4e6d9, denim: 0x6179a0,
  stitch: 0xd4b79c, sneaker: 0xf0e2d7, lash: 0x100806, tie: 0x5a2d1a
, ...(options.colors || {})
};

function skinMaterial(paint = null, color = COL.skin) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.52, specularIntensity: 0.35,
    sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffc4a8) });
  m.onBeforeCompile = (s) => {
    s.uniforms.uWrap = { value: 0.5 };
    s.uniforms.uSSS = { value: new THREE.Color(0.85, 0.42, 0.30) };
    let fs = s.fragmentShader;
    if (paint) {
      s.uniforms.uPaint = { value: paint };
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPP;\nvarying float vPN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPP = position; vPN = normal.z;');
      fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vPP;\nvarying float vPN;\nuniform sampler2D uPaint;')
        .replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 puv = (vPP.xy - vec2(-0.16, -0.17)) / 0.32;
  vec4 pc = texture2D(uPaint, puv);
  float msk = smoothstep(0.02, 0.25, vPN) * step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
  diffuseColor.rgb = diffuseColor.rgb * (1.0 - pc.a * msk) + pc.rgb * msk; }`);
    }
    s.fragmentShader = 'uniform float uWrap;\nuniform vec3 uSSS;\n' + fs.replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>
void RE_Direct_Skin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  float nl = dot( geometryNormal, directLight.direction );
  float band = saturate( ( nl + uWrap ) / ( 1.0 + uWrap ) ) - saturate( nl );
  reflectedLight.directDiffuse += directLight.color * uSSS * band * BRDF_Lambert( material.diffuseColor );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Skin`);
    m.userData.shader = s;
  };
  m.customProgramCacheKey = () => paint ? 'skin-paint' : 'skin';
  return m;
}

function hairMaterial(color = COL.hair) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, vertexColors: true, specularIntensity: 0.25 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uSpec1: { value: new THREE.Color(0.22, 0.16, 0.12) }, uSpec2: { value: new THREE.Color(0.12, 0.065, 0.035) }, uShift: { value: 0.12 } });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aStrand;\nvarying vec3 vStrandV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrandV = normalize( ( modelViewMatrix * vec4( aStrand, 0.0 ) ).xyz );');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStrandV;\nuniform vec3 uSpec1;\nuniform vec3 uSpec2;\nuniform float uShift;')
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>
float kkLobe( vec3 T, vec3 H, float e ) { float th = dot( T, H ); return pow( sqrt( max( 0.0, 1.0 - th * th ) ), e ) * smoothstep( -1.0, 0.0, th ); }
void RE_Direct_Hair( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  float nl = dot( geometryNormal, directLight.direction );
  reflectedLight.directDiffuse += saturate( ( nl + 0.4 ) / 1.4 ) * directLight.color * BRDF_Lambert( material.diffuseColor );
  vec3 T = normalize( vStrandV );
  vec3 H = normalize( directLight.direction + geometryViewDir );
  vec3 spec = uSpec1 * kkLobe( normalize( T + geometryNormal * uShift ), H, 140.0 )
            + uSpec2 * kkLobe( normalize( T - geometryNormal * uShift ), H, 22.0 );
  reflectedLight.directSpecular += spec * RECIPROCAL_PI * smoothstep( -0.1, 0.45, nl ) * directLight.color;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Hair`);
    m.userData.shader = s;
  };
  m.customProgramCacheKey = () => 'hair-kk';
  return m;
}

const skinMat = skinMaterial();
const lashMat = new THREE.MeshStandardMaterial({ color: COL.lash, roughness: 0.55 });
const hairMat = options.character === 'claire' ? new THREE.MeshPhysicalMaterial({color:COL.hair,roughness:.62,vertexColors:true,specularIntensity:.24}) : hairMaterial();
hairMat.envMapIntensity = 0.25; hairMat.specularIntensity = 0.08;

// ------------------------------------------------------------------ root groups
const maya = new THREE.Group(); maya.name = 'Maya';
const HEAD_SCALE = options.male ? 1.07 : 1.14, HEAD_POS = new V3(0, 1.648 - 0.161 * HEAD_SCALE, 0.03);
const headGroup = new THREE.Group(); headGroup.position.copy(HEAD_POS); headGroup.scale.setScalar(HEAD_SCALE); maya.add(headGroup);

// ------------------------------------------------------------------ HEAD shape (local meters, head centre at origin)
const HR = { x: options.male ? 0.132 : 0.121, y: 0.150, zf: 0.124, zb: 0.108 };   // head topology sheet: ~0.78 wide and ~0.85 deep per unit height
// front-view width by depth below the head centre (-yn): egg-shaped cranium, soft cheeks, then a tapered jaw to a small soft chin
const WF = spline1([[0,1],[0.2,1.0],[0.35,0.965],[0.5,0.88],[0.65,0.79],[0.8,0.70],[0.9,0.63],[1, options.male ? 0.78 : 0.58]]);
function headBase(v, out) {
  const yn = clamp(v.y, -1, 1), c = yn > 0 ? Math.pow(Math.max(0, 1 - Math.pow(yn, 2.4)), 1 / 2.4) : Math.sqrt(Math.max(0, 1 - yn * yn));   // broad dome on top
  const hl = Math.hypot(v.x, v.z);
  const sn = hl > 1e-9 ? v.x / hl : 0, cs = hl > 1e-9 ? v.z / hl : 1;
  const ex = lerp(1.0, 0.8, ss(-0.1, 0.5, cs));                 // superellipse front => flatter, wider face plane
  const lower = ss(0.0, 1.0, -yn);
  let x = HR.x * Math.sign(sn) * Math.pow(Math.abs(sn), ex) * c;
  let z = (cs > 0 ? HR.zf : HR.zb) * Math.sign(cs) * Math.pow(Math.abs(cs), ex) * c;
  let y = HR.y * yn;
  x *= WF(Math.max(0, -yn));                                      // tapered jaw, small soft chin (head topology sheet)
  if (z > 0) z *= 1 - 0.08 * lower;
  else z *= (1 + 0.05 * ss(-0.2, 0.6, yn)) * (1 - 0.30 * lower * lower);
  z += 0.018 * lower * lower * lower;                             // chin forward, under-jaw back toward neck
  y *= 1 - 0.04 * lower * lower;                                  // shorter, rounder lower face
  out.set(x, y, z);
  return out;
}
// eye construction constants (head-local)
const EYE = { ox: 0.056, oy: -0.024, hw: 0.033, ex: 0.050, re: 0.046, rl: 0.0482, ez: 0.08 };
const cyC = s => 0.003 * clamp(s, -1.5, 1.5);
const yU = s => { const a = Math.max(0, 1 - s * s); return cyC(s) + 0.019 * Math.pow(a, 0.5) + 0.0025 * s * a; };
const yL = s => { const a = Math.max(0, 1 - s * s); return cyC(s) - 0.021 * Math.pow(a, 0.62); };
const mouthSeam = x => -0.0985 + 3.4 * x * x + 0.0017 * clamp(x / 0.040, -1, 1);
// forward offset of the mid/lower face (by head-local y) so the profile reads straighter: nose, lips and chin no longer sink back
const MUZZLE = spline1([[-0.16,0],[-0.145,0.011],[-0.132,0.024],[-0.10,0.019],[-0.07,0.012],[-0.045,0.004],[-0.03,0]]);
// find z of the base head surface at (x,y) (front)
function surfZ(x, y) {
  const d = new V3(), p = new V3(); let best = 1e9, bz = 0, bp = 0, be = 0;
  for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) {
    const psi = -1.3 + 2.6 * i / 60, el = -1.2 + 2.2 * j / 60;
    d.set(Math.cos(el) * Math.sin(psi), Math.sin(el), Math.cos(el) * Math.cos(psi)); headBase(d, p);
    const e = Math.hypot(p.x - x, p.y - y); if (e < best) { best = e; bz = p.z; bp = psi; be = el; }
  }
  let step = 0.04;
  for (let it = 0; it < 40; it++) {
    let improved = false;
    for (const [a, b] of [[step,0],[-step,0],[0,step],[0,-step]]) {
      d.set(Math.cos(be+b) * Math.sin(bp+a), Math.sin(be+b), Math.cos(be+b) * Math.cos(bp+a)); headBase(d, p);
      const e = Math.hypot(p.x - x, p.y - y); if (e < best) { best = e; bz = p.z; bp += a; be += b; improved = true; }
    }
    if (!improved) step *= 0.5;
  }
  return bz;
}
EYE.ez = surfZ(EYE.ox, EYE.oy) - EYE.rl - 0.0015;
const lidZ = (x, y, sx) => { const dx = x - sx * EYE.ex, dy = y - EYE.oy; return EYE.ez + EYE.rl - 0.72 * (EYE.rl - Math.sqrt(Math.max(EYE.rl * EYE.rl - dx * dx - dy * dy, 0))); };

function faceDisplace(p, smile, wink, conform = true) {
  let { x, y, z } = p;
  if (z > 0.01) {
    const ax = Math.abs(x), sx = x >= 0 ? 1 : -1, front = ss(0.01, 0.06, z);
    z += MUZZLE(y) * Math.exp(-(x * x) / (2 * 0.05 * 0.05)) * ss(0.02, 0.07, z);
    // full low cheeks
    const ch = gauss(ax - 0.072, y + 0.062, 0.030, 0.028);
    z += 0.0065 * ch * front; x += sx * 0.002 * ch * front;
    // soft brow bone
    z += 0.0022 * gauss(ax - 0.05, y - 0.022, 0.03, 0.010) * front;
    // button nose
    const nb = gauss(x, y + 0.0705, 0.0105, 0.0100);
    const wing = gauss(ax - 0.0122, y + 0.0775, 0.0060, 0.0056);
    const bridge = Math.exp(-(x * x) / (2 * 0.0075 * 0.0075)) * ss(-0.078, -0.055, y) * (1 - ss(-0.035, -0.005, y));
    const nbody = gauss(x, y + 0.058, 0.0085, 0.016);                        // fills bridge -> tip so the nose projects in profile
    z += (0.020 * nb + 0.0058 * wing + 0.0042 * bridge + 0.0045 * nbody) * front;
    y += 0.002 * nb;                                                        // slight upturn
    z -= 0.0022 * gauss(ax - 0.0075, y + 0.0852, 0.0032, 0.0022) * front;  // nostrils
    z -= 0.0012 * gauss(x, y + 0.0915, 0.0035, 0.0045) * front;            // philtrum
    // lips
    const seam = mouthSeam(x);
    const mw = Math.exp(-Math.pow(ax / 0.040, 4));
    z += 0.0048 * mw * gauss(0, y - (seam + 0.0040), 1, 0.0033) * front;
    z += 0.0060 * mw * gauss(0, y - (seam - 0.0068), 1, 0.0046) * front;
    z -= 0.0016 * Math.exp(-Math.pow(ax / 0.044, 6)) * gauss(0, y - seam, 1, 0.0013) * front;
    z -= 0.0018 * gauss(ax - 0.046, y - (seam + 0.002), 0.004, 0.004) * front; // corner dimples
    z -= 0.0022 * gauss(x, y + 0.118, 0.020, 0.006) * front;                  // mentolabial soft dent
    z += 0.0070 * gauss(x, y + 0.133, 0.020, 0.013) * front;                  // small round chin
    // expressions (vertex motion => paint follows)
    const sm = smile + (sx > 0 ? wink * 0.9 : wink * 0.35);
    if (sm > 0) {
      const corner = Math.exp(-Math.pow(ax - 0.036, 2) / (2 * 0.016 * 0.016)) * gauss(0, y + 0.100, 1, 0.016);
      y += sm * 0.0085 * corner; x += sx * sm * 0.0035 * corner; z -= sm * 0.0018 * corner;
      y += sm * 0.0065 * ch; z += sm * 0.005 * ch;
      y += sm * 0.0025 * gauss(ax - 0.058, y + 0.052, 0.022, 0.010);
    }
    // eye sockets: skin sits just under the lid sheets, and opens a hole behind the eye opening
    if (conform) for (const ex of [-1, 1]) {
      const dxO = x - ex * EYE.ox, dy = y - EYE.oy, de = Math.hypot(dxO * 0.85, dy * 1.45);
      if (de < 0.05) {
        const sk = ss(0.034, 0.046, de);
        const tgt = sheetZ(x, y, ex) - 0.0008 * (1 - sk);
        if (z > tgt) z = tgt;
        const s = dxO * ex / EYE.hw, m = 0.003;
        const e = Math.min(dy - (yL(clamp(s, -1, 1)) - m), (yU(clamp(s, -1, 1)) + m) - dy, (1 - Math.abs(s)) * EYE.hw + m);
        const inside = ss(-0.0015, 0.0025, e);
        z = lerp(z, Math.min(z, EYE.ez + 0.010), inside);
      }
    }
  }
  p.set(x, y, z);
}
// natural (pre-socket) face depth lookup, splatted from a dense parametric sampling
const NAT = { x0: -0.125, y0: -0.085, dx: 0.001, nx: 250, ny: 130 };
NAT.z = new Float32Array(NAT.nx * NAT.ny).fill(-1);
{
  const d = new V3(), p = new V3();
  for (let i = 0; i <= 480; i++) for (let j = 0; j <= 340; j++) {
    const psi = -1.15 + 2.3 * i / 480, el = -0.75 + 1.15 * j / 340;
    d.set(Math.cos(el) * Math.sin(psi), Math.sin(el), Math.cos(el) * Math.cos(psi));
    headBase(d, p); faceDisplace(p, 0, 0, false);
    const gx = Math.round((p.x - NAT.x0) / NAT.dx), gy = Math.round((p.y - NAT.y0) / NAT.dx);
    if (gx >= 0 && gy >= 0 && gx < NAT.nx && gy < NAT.ny) { const k = gy * NAT.nx + gx; if (p.z > NAT.z[k]) NAT.z[k] = p.z; }
  }
  for (let pass = 0; pass < 4; pass++) for (let gy = 1; gy < NAT.ny - 1; gy++) for (let gx = 1; gx < NAT.nx - 1; gx++) {
    const k = gy * NAT.nx + gx; if (NAT.z[k] > -1) continue;
    const nb = [NAT.z[k-1], NAT.z[k+1], NAT.z[k-NAT.nx], NAT.z[k+NAT.nx]].filter(v => v > -1);
    if (nb.length) NAT.z[k] = nb.reduce((a, b) => a + b) / nb.length;
  }
}
function natZ(x, y) {
  const fx = clamp((x - NAT.x0) / NAT.dx, 0, NAT.nx - 1.001), fy = clamp((y - NAT.y0) / NAT.dx, 0, NAT.ny - 1.001);
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, Z = (a, b) => NAT.z[b * NAT.nx + a];
  return lerp(lerp(Z(ix, iy), Z(ix + 1, iy), tx), lerp(Z(ix, iy + 1), Z(ix + 1, iy + 1), tx), ty);
}
// blended lid surface: eyeball-hugging sphere near the opening, relaxing into the natural face further out
function sheetZ(x, y, sx) {
  const dxO = x - sx * EYE.ox, dy = y - EYE.oy, de = Math.hypot(dxO * 0.85, dy * 1.45);
  const l = lidZ(x, y, sx), n = natZ(x, y);
  const dxE = x - sx * EYE.ex, ball = EYE.ez + Math.sqrt(Math.max(EYE.re * EYE.re - dxE * dxE - dy * dy, 0));
  return Math.max(lerp(l, Math.max(n, l - 0.02), ss(0.024, 0.040, de)), ball + 0.0028);
}

// ------------------------------------------------------------------ face paint (front-projected, head-local xy)
const PS = 1024;
const PX = x => (x + 0.16) / 0.32 * PS, PY = y => (1 - (y + 0.17) / 0.32) * PS, PL = l => l / 0.32 * PS;
const paintTex = canvasTex(PS, PS, (g) => {
  const R = mulberry32(77);
  // cheek blush
  for (const sx of [-1, 1]) {
    g.save(); g.translate(PX(sx * 0.071), PY(-0.064)); g.scale(1.15, 1);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, PL(0.046));
    rg.addColorStop(0, 'rgba(238,108,96,0.56)'); rg.addColorStop(0.5, 'rgba(238,114,98,0.32)'); rg.addColorStop(1, 'rgba(238,120,100,0)');
    g.fillStyle = rg; g.fillRect(-PL(0.06), -PL(0.06), PL(0.12), PL(0.12)); g.restore();
  }
  // nose tip flush
  let rg = g.createRadialGradient(PX(0), PY(-0.071), 0, PX(0), PY(-0.071), PL(0.018));
  rg.addColorStop(0, 'rgba(250,128,100,0.38)'); rg.addColorStop(1, 'rgba(250,128,100,0)');
  g.fillStyle = rg; g.fillRect(0, 0, PS, PS);
  // freckles
  for (let i = 0; i < 22; i++) {
    const sx = i % 2 ? 1 : -1, fx = sx * (0.035 + R() * 0.06), fy = -0.045 - R() * 0.035;
    g.fillStyle = `rgba(185,95,65,${0.10 + R() * 0.10})`; g.beginPath(); g.arc(PX(fx), PY(fy), PL(0.0005 + R() * 0.0005), 0, 7); g.fill();
  }
  // nostril shadows
  g.filter = 'blur(2px)';
  for (const sx of [-1, 1]) { g.fillStyle = 'rgba(170,80,62,0.28)'; g.beginPath(); g.ellipse(PX(sx * 0.0078), PY(-0.0852), PL(0.0030), PL(0.0014), sx * 0.35, 0, 7); g.fill(); }
  // lips
  const N = 40, xs = []; for (let i = 0; i <= N; i++) xs.push(-0.043 + 0.086 * i / N);
  for (let i = 0; i <= N; i++) xs[i] = -0.040 + 0.080 * i / N;
  const top = x => mouthSeam(x) + 0.0062 * Math.pow(Math.max(0, 1 - (x / 0.040) ** 2), 0.8) - 0.0011 * Math.exp(-((x / 0.006) ** 2));
  const bot = x => mouthSeam(x) - 0.0100 * Math.pow(Math.max(0, 1 - (x / 0.0395) ** 2), 0.6);
  g.filter = 'blur(1.6px)';
  g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(PX(x), PY(top(x))) : g.moveTo(PX(x), PY(top(x))));
  for (let i = N; i >= 0; i--) g.lineTo(PX(xs[i]), PY(mouthSeam(xs[i]))); g.closePath();
  g.fillStyle = 'rgba(206,98,84,0.80)'; g.fill();
  g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(PX(x), PY(mouthSeam(x))) : g.moveTo(PX(x), PY(mouthSeam(x))));
  for (let i = N; i >= 0; i--) g.lineTo(PX(xs[i]), PY(bot(xs[i]))); g.closePath();
  rg = g.createLinearGradient(0, PY(mouthSeam(0)), 0, PY(bot(0)));
  rg.addColorStop(0, 'rgba(214,100,84,0.85)'); rg.addColorStop(0.5, 'rgba(232,118,96,0.82)'); rg.addColorStop(1, 'rgba(226,120,100,0.55)');
  g.fillStyle = rg; g.fill();
  g.filter = 'blur(0.7px)';
  g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(PX(x), PY(mouthSeam(x))) : g.moveTo(PX(x), PY(mouthSeam(x))));
  g.strokeStyle = 'rgba(140,42,32,0.9)'; g.lineWidth = PL(0.0011); g.lineCap = 'round'; g.stroke();
  for (const sx of [-1, 1]) {            // corner flicks
    g.beginPath(); g.moveTo(PX(sx * 0.039), PY(mouthSeam(sx * 0.039)));
    g.quadraticCurveTo(PX(sx * 0.0435), PY(mouthSeam(sx * 0.039) + 0.0004), PX(sx * 0.0455), PY(mouthSeam(sx * 0.039) + 0.0032));
    g.strokeStyle = 'rgba(150,60,45,0.45)'; g.lineWidth = PL(0.0008); g.stroke();
  }
  g.filter = 'blur(2px)'; g.fillStyle = 'rgba(255,228,212,0.30)';
  g.beginPath(); g.ellipse(PX(0.005), PY(mouthSeam(0) - 0.0062), PL(0.009), PL(0.0017), 0, 0, 7); g.fill();
  // brows
  for (const sx of [-1, 1]) {
    const M = 30, up = [], dn = [];
    for (let i = 0; i <= M; i++) {
      const s = i / M, x = sx * (0.0225 + 0.075 * s);
      const arch = s < 0.66 ? Math.sin(s / 0.66 * Math.PI / 2) : 1 - 0.85 * ((s - 0.66) / 0.34) ** 2;
      const yc = 0.0205 + 0.0070 * arch, th = lerp(0.0165, 0.0065, Math.pow(s, 1.3)) * (s < 0.06 ? 0.75 + 0.25 * s / 0.06 : 1);
      up.push([x, yc + th * 0.55]); dn.push([x, yc - th * 0.45]);
    }
    g.filter = 'blur(2.2px)'; g.fillStyle = options.character === 'claire' ? 'rgba(128,85,52,.96)' : 'rgba(50,30,22,.96)';
    g.beginPath(); up.forEach((p, i) => i ? g.lineTo(PX(p[0]), PY(p[1])) : g.moveTo(PX(p[0]), PY(p[1])));
    for (let i = dn.length - 1; i >= 0; i--) g.lineTo(PX(dn[i][0]), PY(dn[i][1])); g.closePath(); g.fill();
    g.filter = 'none';
    for (let k = 0; k < 320; k++) {
      const s = Math.pow(R(), 1.1), i = Math.min(M, Math.round(s * M)), q = R();
      const x0 = lerp(dn[i][0], up[i][0], q), y0 = lerp(dn[i][1], up[i][1], q);
      const ang = s < 0.18 ? lerp(1.25, 0.6, s / 0.18) : s < 0.7 ? 0.35 - 0.3 * (s - 0.18) : -0.25;
      const len = PL(0.004 + R() * 0.004), cx = PX(x0), cy = PY(y0);
      g.strokeStyle = R() < 0.5 ? `rgba(52,32,24,${0.5 + R() * 0.4})` : `rgba(96,62,46,${0.35 + R() * 0.3})`;
      g.lineWidth = 1 + R() * 1.4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + sx * Math.cos(ang) * len, cy - Math.sin(ang) * len); g.stroke();
    }
  }
  // lid crease, soft lid shading and liner wing
  for (const sx of [-1, 1]) {
    const E = s => [sx * (EYE.ox + s * EYE.hw), EYE.oy];
    g.filter = 'blur(3px)'; g.fillStyle = 'rgba(196,110,86,0.20)';
    g.beginPath();
    for (let i = 0; i <= 20; i++) { const s = -0.9 + 1.9 * i / 20, [x, y] = E(s); const yy = y + yU(Math.min(s, 1)) + 0.009; i ? g.lineTo(PX(x), PY(yy)) : g.moveTo(PX(x), PY(yy)); }
    for (let i = 20; i >= 0; i--) { const s = -0.9 + 1.9 * i / 20, [x, y] = E(s); g.lineTo(PX(x), PY(y + yU(Math.min(s, 1)))); }
    g.fill();
    g.filter = 'blur(1.2px)'; g.strokeStyle = 'rgba(150,80,60,0.38)'; g.lineWidth = PL(0.0011);
    g.beginPath();
    for (let i = 0; i <= 20; i++) { const s = -0.75 + 1.8 * i / 20, [x, y] = E(s); const yy = y + yU(Math.min(s, 1)) + 0.0085 + 0.0015 * (1 - s * s); i ? g.lineTo(PX(x), PY(yy)) : g.moveTo(PX(x), PY(yy)); }
    g.stroke();
    g.filter = 'blur(0.8px)'; g.fillStyle = 'rgba(18,9,6,0.96)';
    const [ax, ay] = E(0.72), [cx, cy] = E(1.0);
    g.beginPath();
    g.moveTo(PX(ax), PY(ay + yU(0.72) + 0.0018));
    g.quadraticCurveTo(PX(sx * (EYE.ox + 0.038)), PY(cy + 0.006), PX(sx * (EYE.ox + EYE.hw + 0.012)), PY(cy + 0.003 + 0.0075));
    g.quadraticCurveTo(PX(sx * (EYE.ox + EYE.hw + 0.003)), PY(cy + 0.0035), PX(cx), PY(cy + 0.0022));
    g.lineTo(PX(ax), PY(ay + yU(0.72) - 0.001)); g.closePath(); g.fill();
  }
  g.filter = 'none';
}, { premul: true });

mark('paint+nat');
// ------------------------------------------------------------------ head mesh with morph targets (smile, wink)
const headMat = skinMaterial(paintTex);
function buildHeadGeometry(ROWS = 116, COLS = 152) {
  const d = new V3();
  const make = (smile, wink) => gridSurface(ROWS, COLS, (t, u, v) => {
    const s = 2 * u - 1, psi = Math.PI * (0.42 * s + 0.58 * s * s * s), el = (t - 0.5) * Math.PI;
    d.set(Math.cos(el) * Math.sin(psi), Math.sin(el), Math.cos(el) * Math.cos(psi));
    headBase(d, v); faceDisplace(v, smile, wink);
  });
  const g = make(0, 0), gs = make(1, 0), gw = make(0, 1);
  g.morphAttributes.position = [gs.attributes.position, gw.attributes.position];
  g.morphAttributes.normal = [gs.attributes.normal, gw.attributes.normal];
  return g;
}
const headMesh = new THREE.Mesh(buildHeadGeometry(), headMat);
headMesh.name = 'Maya face'; headMesh.castShadow = true; headMesh.receiveShadow = false;
headGroup.add(headMesh);

// ears
function earGeometry() {
  const g = new THREE.SphereGeometry(1, 30, 22), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let X = x * 0.012, Y = y * 0.027, Z = z * 0.019 * (1 + 0.08 * y);          // larger, rounder stylized ears (topology sheet)
    if (x > 0) X -= 0.0080 * Math.max(0, 1 - (y * y * 1.1 + z * z * 1.6));      // concha bowl
    if (x > 0) X += 0.0024 * Math.exp(-Math.pow((Math.hypot(y, z) - 0.86) / 0.12, 2)); // helix rim
    p.setXYZ(i, X, Y, Z);
  }
  return weldNormals(g);
}
const earMat = skinMaterial(null, COL.skin);
// ears sit on the side of the skull (mid-depth, between eye line and nose), wherever the head surface is
const EAR_X = (() => {
  const d = new V3(), p = new V3(); let best = 1e9, bx = 0.128;
  for (let i = 0; i <= 80; i++) for (let j = 0; j <= 80; j++) {
    const psi = 1.2 + 0.9 * i / 80, el = -0.7 + 0.8 * j / 80;
    d.set(Math.cos(el) * Math.sin(psi), Math.sin(el), Math.cos(el) * Math.cos(psi)); headBase(d, p);
    const e = Math.hypot(p.y + 0.041, p.z + 0.024); if (e < best) { best = e; bx = p.x; }
  }
  return bx - 0.005;
})();
for (const sx of [-1, 1]) {
  const ear = new THREE.Mesh(earGeometry(), earMat);
  ear.position.set(sx * EAR_X, -0.041, -0.024); ear.scale.x = sx; ear.rotation.set(-0.12, sx * 0.30, 0);
  ear.castShadow = true; headGroup.add(ear);
}

// ------------------------------------------------------------------ eyes
function eyeTexture() {
  const W = 1024, H = 512, rnd = mulberry32(3);
  return canvasTex(W, H, (g) => {
    const row = th => th / Math.PI * H, TP = Math.asin(0.011 / EYE.re), TI = Math.asin(0.0225 / EYE.re);
    let gr = g.createLinearGradient(0, row(TI), 0, H);
    gr.addColorStop(0, '#f4e7df'); gr.addColorStop(0.3, '#eddcd3'); gr.addColorStop(1, '#d2aea4');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // shade sclera toward the top (u=0.75 is up)
    for (let x = 0; x < W; x++) {
      const up = Math.max(0, Math.cos((x / W - 0.75) * Math.PI * 2));
      g.fillStyle = `rgba(120,80,70,${0.28 * up * up})`; g.fillRect(x, row(TI + 0.05), 1, H);
    }
    gr = g.createLinearGradient(0, row(TP), 0, row(TI));
    gr.addColorStop(0, options.character === 'claire' ? '#15314c' : '#2e1408'); gr.addColorStop(0.18, (options.character === 'claire' ? '#739fc6' : '#874526')); gr.addColorStop(0.55, (options.character === 'claire' ? '#5481ad' : '#6a3419'));
    gr.addColorStop(0.82, (options.character === 'claire' ? '#355879' : '#4a210d')); gr.addColorStop(1, (options.character === 'claire' ? '#172e48' : '#1c0b04'));
    g.fillStyle = gr; g.fillRect(0, row(TP), W, row(TI) - row(TP) + 1);
    // lighter amber below the pupil (u=0.25 is down), darker on top under the lid
    for (let x = 0; x < W; x++) {
      const dn = Math.cos((x / W - 0.25) * Math.PI * 2);
      g.fillStyle = dn > 0 ? `rgba(${options.character === 'claire' ? '160,201,232' : '210,130,70'},${0.30 * dn})` : `rgba(30,12,5,${0.35 * -dn})`;
      g.fillRect(x, row(TP) + 2, 1, (row(TI) - row(TP)) * 0.8);
    }
    for (let i = 0; i < 420; i++) {
      const x = rnd() * W; g.lineWidth = 1 + rnd() * 3;
      g.strokeStyle = rnd() < 0.5 ? `rgba(255,190,130,${0.05 + rnd() * 0.10})` : `rgba(35,14,5,${0.08 + rnd() * 0.14})`;
      g.beginPath(); g.moveTo(x, row(TP)); g.lineTo(x + (rnd() - 0.5) * 10, row(TI) * (0.8 + rnd() * 0.15)); g.stroke();
    }
    g.fillStyle = '#080302'; g.fillRect(0, 0, W, row(TP));
    gr = g.createLinearGradient(0, row(TP) - 3, 0, row(TP) + 6); gr.addColorStop(0, 'rgba(8,3,2,1)'); gr.addColorStop(1, 'rgba(8,3,2,0)');
    g.fillStyle = gr; g.fillRect(0, row(TP) - 3, W, 9);
  });
}
const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTexture(), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.8 });
const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
const eyes = [];
function makeEye(sx) {
  const e = { sx, blink: -1, squint: -1 };
  const ball = new THREE.Mesh(new THREE.SphereGeometry(EYE.re, 44, 30).rotateX(Math.PI / 2), eyeMat);
  const yaw = Math.asin((EYE.ox - EYE.ex) / EYE.re);
  ball.position.set(sx * EYE.ex, EYE.oy, EYE.ez); ball.rotation.y = sx * yaw;
  headGroup.add(ball);
  const pd = new V3(sx * Math.sin(yaw), 0, Math.cos(yaw));
  for (const [ox, oy, r] of [[0.16, 0.17, 0.0052], [-0.13, -0.15, 0.0017]]) {
    const dir = new V3(pd.x + ox, oy, pd.z).normalize();
    const c = new THREE.Mesh(new THREE.CircleGeometry(r, 20), catchMat);
    c.position.copy(ball.position).addScaledVector(dir, EYE.re * 1.006);
    c.quaternion.setFromUnitVectors(new V3(0, 0, 1), dir);
    headGroup.add(c);
  }
  const NC = 44, NR = 12;
  const sheet = () => { const g = gridSurface(NR, NC, (t, u, v) => v.set(u, t, 0)); return g; };
  e.upper = new THREE.Mesh(sheet(), headMat); e.lower = new THREE.Mesh(sheet(), headMat);
  for (const m of [e.upper, e.lower]) { m.material = headMat; headGroup.add(m); }
  e.lash = new THREE.Mesh(new THREE.BufferGeometry(), lashMat); headGroup.add(e.lash);
  e.rim = new THREE.Mesh(new THREE.BufferGeometry(), headMat); headGroup.add(e.rim);
  e.NC = NC; e.NR = NR;
  eyes.push(e);
  return e;
}
const edgeU = (s, blink) => Math.abs(s) < 1 ? lerp(yU(s), yL(s) + 0.0006, blink) : cyC(s);
const edgeL = (s, sq, blink) => Math.abs(s) < 1 ? Math.min(lerp(yL(s), yL(s) + 0.011 * (1 - s * s), sq), edgeU(s, blink) + 0.0008) : cyC(s);
function updateEye(e, blink, squint) {
  if (Math.abs(e.blink - blink) < 0.008 && Math.abs(e.squint - squint) < 0.008) return;
  e.blink = blink; e.squint = squint;
  const { sx, NC, NR } = e;
  const fill = (mesh, upper) => {
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NC; j++) {
      const t = i / NR, s = sx * (-1.30 + 2.6 * j / NC);   // reversed for the mirrored eye so winding stays outward
      let dy;
      if (upper) dy = lerp(edgeU(s, blink), 0.036, Math.pow(t, 1.7));
      else dy = lerp(edgeL(s, squint, blink), -0.034, Math.pow(1 - t, 1.7));
      const x = sx * (EYE.ox + s * EYE.hw), y = EYE.oy + dy;
      const de = Math.hypot((x - sx * EYE.ox) * 0.85, dy * 1.45);
      const dxE = x - sx * EYE.ex, ballZ = EYE.ez + Math.sqrt(Math.max(EYE.re * EYE.re - dxE * dxE - dy * dy, 0));
      let lz = Math.max(sheetZ(x, y, sx) - 0.0012 * ss(0.034, 0.046, de), ballZ + 0.0032) - (upper ? 0 : 0.0005 * blink); // lids overlap (lower tucked behind)
      const nz = natZ(x, y);
      if (nz > 0) lz = Math.min(lz, lerp(lz, nz + 0.0004, ss(0.040, 0.050, de)));   // outer ring lies on the face: no lid corner poking out of the cheek
      p.setXYZ(i * (NC + 1) + j, x, y, lz);
    }
    p.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
  };
  fill(e.upper, true); fill(e.lower, false);
  // lash line + wing + spikes
  const pt = (s, dy, off) => { const x = sx * (EYE.ox + s * EYE.hw), y = EYE.oy + dy; return new V3(x, y, sheetZ(x, y, sx) + off); };
  const parts = [];
  const line = []; for (let i = 0; i <= 26; i++) { const s = -0.96 + 2.08 * i / 26; const dy = s < 1 ? edgeU(s, blink) + 0.0006 : cyC(1) + (s - 1) * 0.045 * (1 - blink * 0.6); line.push(pt(Math.min(s, 1.12), dy, 0.0012)); }
  parts.push(taperedTube(line, { segments: 60, radial: 6, radius: t => ((options.male ? 0.0006 : 0.0011) + (options.male ? 0.0008 : 0.0024) * Math.pow(t, 0.9)) * (t > 0.86 ? Math.max(0.25, 1 - (t - 0.86) / 0.14 * 0.75) : 1) * Math.min(1, t * 8 + 0.4), flatten: 0.75 }));
  const spikes = options.male ? [] : [[0.35, 0.0035], [0.52, 0.0048], [0.66, 0.0062], [0.8, 0.0074], [0.93, 0.0082], [1.04, 0.0078], [-0.2, 0.0026], [0.1, 0.003]];
  for (const [s, len0] of spikes) {
    const len = s < 0.3 ? len0 * (1 - blink) : len0;   // inner lashes tuck away when the lid closes
    if (len < 0.0012) continue;
    const b = s < 1 ? pt(s, edgeU(s, blink) + 0.0012, 0.0012) : line[line.length - 3];
    const dir = new V3(sx * (0.35 + 0.5 * Math.max(0, s)), lerp(0.85, -0.7, blink), 0.55).normalize();
    const mid = b.clone().addScaledVector(dir, len * 0.55).add(new V3(0, lerp(0.001, -0.0008, blink), 0.0012));
    parts.push(taperedTube([b, mid, b.clone().addScaledVector(dir, len).add(new V3(sx * 0.0015, lerp(-0.0006, 0, blink), 0))], { segments: 6, radial: 4, radius: wispR(0.00085, 0.9) }));
  }
  const ll = []; for (let i = 0; i <= 12; i++) { const s = 0.05 + 0.95 * i / 12; ll.push(pt(s, edgeL(s, squint, blink) - 0.0006, 0.0009)); }
  parts.push(taperedTube(ll, { segments: 20, radial: 4, radius: t => 0.00035 + 0.0003 * t }));
  for (const s of [0.55, 0.75, 0.92]) {
    const b = pt(s, edgeL(s, squint, blink) - 0.0006, 0.0009), dir = new V3(sx * 0.5, -0.8, 0.35).normalize();
    parts.push(taperedTube([b, b.clone().addScaledVector(dir, 0.0014), b.clone().addScaledVector(dir, 0.0028)], { segments: 4, radial: 3, radius: wispR(0.0004) }));
  }
  e.lash.geometry.dispose(); e.lash.geometry = mergeGeometries(parts); parts.forEach(g => g.dispose());
  const rim = []; for (let i = 0; i <= 20; i++) { const s = -0.98 + 1.96 * i / 20; rim.push(pt(s, edgeL(s, squint, blink) - 0.0004, 0.0003)); }
  e.rim.geometry.dispose(); e.rim.geometry = taperedTube(rim, { segments: 30, radial: 6, radius: t => 0.0013 * Math.pow(Math.sin(Math.PI * t), 0.3) });
}
makeEye(1); makeEye(-1);

const face = { smile: 0, wink: 0, blinkL: 0, blinkR: 0 };
function applyFaceState(blink) {
  headMesh.morphTargetInfluences[0] = face.smile;
  headMesh.morphTargetInfluences[1] = face.wink;
  for (const e of eyes) {
    const left = e.sx > 0;
    const b = Math.min(1, blink + (left ? face.blinkL : face.blinkR));
    const sq = Math.max(face.smile * 0.4, left ? face.wink * 0.6 : face.wink * 0.3);
    updateEye(e, b, sq);
  }
}

mark('head+eyes');
// ------------------------------------------------------------------ HAIR (all strands merged, one draw call)
const hairParts = [], PI_ = Math.PI;
const BUN = new V3(0, 0.184, -0.072), BUNR = new V3(0.110, 0.084, 0.100);
const BUN_AXIS = new V3(0, 1, -0.42).normalize();
const bunQ = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), BUN_AXIS);
const dirOf = (psi, el, out = new V3()) => out.set(Math.cos(el) * Math.sin(psi), Math.sin(el), Math.cos(el) * Math.cos(psi));
const EAR_C = new V3(0.11, -0.041, -0.024);
function hairness(p) {
  const ax = Math.abs(p.x);
  const yF = 0.103 - 2.42 * Math.pow(Math.abs(p.x - 0.012) + 1e-6, 1.4);
  // nape hairline curves up behind the ears (U shape) instead of a straight bowl cut
  const back = ss(0.03, -0.06, p.z), yH = lerp(Math.max(yF, -0.05), -0.062 - 0.048 * Math.exp(-(p.x * p.x) / 0.005), back), bw = lerp(0.011, 0.02, back);
  let h = ss(yH - bw, yH + bw, p.y);
  const ed = Math.hypot(p.y - EAR_C.y + 0.004, (p.z - EAR_C.z) * 0.95);
  h *= 1 - (1 - ss(0.026, 0.048, ed)) * ss(0.07, 0.10, ax) * (1 - ss(0.02, 0.06, p.y));   // snug, soft cut-out: hair hugs the ear without a bald ring or jagged edge
  return h;
}
function shellPoint(psi, el, lift, out = new V3()) {
  const d = dirOf(psi, el); headBase(d, out);
  const n = out.clone().normalize();
  return out.addScaledVector(n, 0.011 + lift);
}
function prepHair(g, tint) {
  g.deleteAttribute('uv');
  if (!g.attributes.color) fillAttr(g, 'color', 3, () => [tint, tint * 0.97, tint * 0.95]);
  return g;
}
function hairlineElevation(psi) {
  const p = new V3(); let lo = -1.2, hi = 1.45;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    headBase(dirOf(psi, mid), p);
    if (hairness(p) > 0.08) hi = mid; else lo = mid;
  }
  return hi;
}
// scalp shell: grooves converge on the bun
{
  const pole = BUN.clone().normalize(), e1 = new V3(1, 0, 0), e2 = new V3().crossVectors(pole, e1).normalize();
  const d = new V3(), P = new V3();
  const grooveAt = (v) => { const ang = Math.atan2(v.dot(e1), v.dot(e2)); return Math.pow(Math.abs(Math.sin(ang * 21 + 1.7 * Math.sin(ang * 5))), 0.7); };
  const g = gridSurface(90, 124, (t, u, out) => {
    const s = 2 * u - 1, psi = Math.PI * s, el = lerp(hairlineElevation(psi), Math.PI / 2, t);
    dirOf(psi, el, d); headBase(d, P);
    const h = hairness(P), n = P.clone().normalize();
    const pc = ss(0.97, 0.80, n.dot(pole));
    const vol = 0.003 + 0.009 * ss(-0.12, 0.02, P.y) + 0.005 * ss(-0.05, 0.08, P.y) * ss(0.05, -0.08, P.z) + 0.003 * ss(0.0, 0.1, P.y);
    const off = lerp(lerp(-0.010, -0.004, ss(0.0, -0.06, P.z)), vol - 0.0024 * grooveAt(n) * pc, Math.pow(h, 1.6)); // eased: hairline feathers instead of forming a rim
    out.copy(P).addScaledVector(n, off);
  });
  const p = g.attributes.position, T = new V3(), n = new V3(), v = new V3();
  fillAttr(g, 'aStrand', 3, i => {
    v.fromBufferAttribute(p, i); n.fromBufferAttribute(g.attributes.normal, i);
    T.copy(BUN).sub(v); T.addScaledVector(n, -T.dot(n)).normalize(); return [T.x, T.y, T.z];
  });
  fillAttr(g, 'color', 3, i => { v.fromBufferAttribute(p, i).normalize(); const k = 0.76 + 0.2 * grooveAt(v); return [k, k * 0.97, k * 0.94]; });
  hairParts.push(prepHair(g));
}
// clumps from hairline (sides/back) to the bun
for (let k = 0; k < 78; k++) {
  const psi0 = (k / 78) * Math.PI * 2 - Math.PI + (rand() - 0.5) * 0.05;
  if (Math.abs(psi0) < 1.0) continue;                          // front is covered by the bangs
  let el0 = -1.1; const P = new V3();
  for (; el0 < 1.2; el0 += 0.01) { headBase(dirOf(psi0, el0), P); if (hairness(P) > 0.6) break; }
  const d0 = dirOf(psi0, el0 + 0.03), d1 = BUN.clone().sub(BUN_AXIS.clone().multiplyScalar(0.05)).normalize();
  const pts = [];
  for (let i = 0; i <= 9; i++) {
    const u = i / 9, dd = d0.clone().lerp(d1, u).normalize();
    const el = Math.asin(dd.y), psi = Math.atan2(dd.x, dd.z);
    pts.push(shellPoint(psi, el, 0.001 - 0.009 * (1 - ss(0, 0.3, u)) + 0.004 * Math.sin(Math.PI * u) + 0.002 * rand())); // roots sit on the scalp
  }
  const g = taperedTube(pts, { segments: 20, radial: 4, flatten: 0.38, radius: t => 0.0105 * Math.min(1, t * 3 + 0.08) * (1 - 0.5 * t) });
  hairParts.push(prepHair(g, 0.85 + rand() * 0.3));
}
// curtain bangs from a slight left part
for (const sd of [-1, 1]) {
  const n = sd < 0 ? 17 : 14;
  for (let k = 0; k < n; k++) {
    const q = k / (n - 1), pts = [];
    const elS = lerp(0.80, 1.22, q) + (rand() - 0.5) * 0.02;
    const psiE = sd * lerp(0.80, 1.55, q) + (rand() - 0.5) * 0.06, elE = lerp(0.15, 0.22, q) + (sd > 0 ? 0.02 : 0) + (rand() - 0.5) * 0.06;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, uu = Math.pow(u, 1.15);
      const psi = 0.09 + (psiE - 0.09) * uu;
      const el = lerp(elS, elE, Math.pow(u, 1.5));
      const lift = 0.002 + (0.008 - 0.003 * q) * Math.sin(Math.PI * Math.min(1, u * 1.1)) + 0.0015 * rand();
      pts.push(shellPoint(psi, el, lift));
    }
    const g = taperedTube(pts, { segments: 30, radial: 5, flatten: 0.3, radius: t => (0.0078 - 0.002 * q) * Math.min(1, t * 6 + 0.4) * Math.pow(1 - t, 0.8) });
    hairParts.push(prepHair(g, 0.9 + rand() * 0.3));
  }
}
// loose strands breaking the temple edge of the bangs
for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    pts.push(shellPoint(sd * lerp(0.62 + 0.14 * k, 1.12 + 0.12 * k, u), lerp(0.46 - 0.05 * k, 0.02 - 0.05 * k, Math.pow(u, 1.3)), 0.004 + 0.012 * Math.sin(PI_ * u) + 0.003 * k));
  }
  hairParts.push(prepHair(taperedTube(pts, { segments: 24, radial: 5, flatten: 0.5, radius: t => 0.0045 * Math.min(1, t * 6 + 0.35) * Math.pow(1 - t, 0.6) }), 0.95 + rand() * 0.2));
}
if (!options.male && options.character !== 'claire') {
// face-framing tendrils (wavy, curl outward) and nape wisps
const TX = 0.80;   // face-framing locks follow the narrower jaw
const tendril = (pts, R, tint) => hairParts.push(prepHair(taperedTube(pts, { segments: 48, radial: 5, flatten: 0.55, radius: t => R * Math.min(1, t * 6 + 0.35) * Math.pow(1 - t, 0.6) }), tint));
for (const sd of [-1, 1]) {
  for (let k = 0; k < 2; k++) {
    const p0 = shellPoint(sd * (1.02 + 0.16 * k), 0.20 - 0.09 * k, 0.002);
    const zo = 0.058 - 0.017 * k, len = (sd > 0 ? 0.015 : 0) + (k === 1 ? 0.01 : 0);
    const w = 0.006 * (k % 2 ? -1 : 1);
    tendril([
      p0,
      p0.clone().add(new V3(sd * 0.004, -0.03, 0.004)),
      new V3(sd * TX * (0.134 + w), -0.065, zo),
      new V3(sd * TX * (0.114 - w), -0.115, zo - 0.004),
      new V3(sd * TX * (0.102 + w), -0.152 - len * 0.4, zo - 0.008),
      new V3(sd * TX * 0.108, -0.180 - len, zo - 0.012),
      new V3(sd * TX * 0.124, -0.187 - len, zo - 0.016),
    ], 0.0088 - 0.0012 * k, 0.9 + rand() * 0.2);
  }
  for (let k = 0; k < 2; k++) {
    const p0 = shellPoint(sd * (2.25 + 0.3 * k), -0.44 + 0.05 * k, 0.0);
    tendril([p0, p0.clone().add(new V3(sd * 0.008, -0.04, -0.01)), p0.clone().add(new V3(sd * 0.0, -0.08, -0.004)),
      p0.clone().add(new V3(sd * 0.014, -0.10, -0.012)), p0.clone().add(new V3(sd * 0.026, -0.108, -0.008))], 0.0052, 0.9);
  }
}
// bun: core + twisted rope coils + flyaway loops
{
  // round, lumpy ball with wrapped-strand grooves (reads as a full messy knot)
  const core = new THREE.SphereGeometry(1, 64, 44), cp = core.attributes.position, v = new V3(), wrapAx = new V3(0.35, 0.3, 1).normalize();
  const tang = [], shade = [];
  for (let i = 0; i < cp.count; i++) {
    v.fromBufferAttribute(cp, i);
    const lat = Math.asin(clamp(v.dot(wrapAx), -1, 1));
    const lump = 0.075 * Math.sin(v.x * 5.1 + 1.3) * Math.sin(v.y * 4.3 + 0.4) * Math.sin(v.z * 4.7 + 2.1) + 0.04 * Math.sin(lat * 5 + Math.sin(v.x * 3 + v.y * 2) * 2.2);
    const gv = Math.pow(Math.abs(Math.sin(lat * 15 + 1.6 * Math.sin(v.x * 4 + v.z * 3))), 0.6);
    const r = 0.97 + lump - 0.035 * gv;
    cp.setXYZ(i, v.x * BUNR.x * r, v.y * BUNR.y * r, v.z * BUNR.z * r);
    tang.push(new V3().crossVectors(wrapAx, v).normalize()); shade.push(0.78 + 0.22 * gv + 0.6 * lump);
  }
  core.applyQuaternion(bunQ); core.translate(BUN.x, BUN.y, BUN.z); weldNormals(core);
  fillAttr(core, 'aStrand', 3, i => { const t = tang[i].clone().applyQuaternion(bunQ); return [t.x, t.y, t.z]; });
  fillAttr(core, 'color', 3, i => [shade[i], shade[i] * 0.97, shade[i] * 0.94]);
  hairParts.push(prepHair(core));
  const turns = 1.25, NS = 240, center = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, ang = Math.PI * 2 * turns * s + 0.6, h = lerp(-0.60, -0.05, s), ringR = Math.sqrt(1 - h * h);
    const rr = lerp(0.024, 0.016, s), jit = 0.005 * Math.sin(ang * 2.3 + s * 9);
    const c = new V3(Math.cos(ang) * ringR * (BUNR.x - rr * 0.85 + jit), h * (BUNR.y - rr * 0.35), Math.sin(ang) * ringR * (BUNR.z - rr * 0.85 + jit));
    center.push({ c, rr });
  }
  center.push({ c: new V3(0, BUNR.y * 0.35, 0), rr: 0.012 });
  const curve = new THREE.CatmullRomCurve3(center.map(o => o.c), false, 'centripetal');
  const rrAt = t => lerp(0.024, 0.015, t);
  const SUB = 4, M = 300;
  for (let k = 0; k < SUB; k++) {
    const pts = [], T = new V3(), N = new V3(), B = new V3(), up = new V3(0, 1, 0);
    for (let i = 0; i <= M; i++) {
      const t = i / M; curve.getPointAt(t, T.set(0, 0, 0)); const c = T.clone();
      curve.getTangentAt(t, T); N.crossVectors(T, up).normalize(); B.crossVectors(N, T).normalize();
      const phi = (k / SUB) * Math.PI * 2 + t * Math.PI * 2 * 2.2, r = rrAt(t) * 0.55;
      const p = c.addScaledVector(N, Math.cos(phi) * r).addScaledVector(B, Math.sin(phi) * r);
      pts.push(p.applyQuaternion(bunQ).add(BUN));
    }
    const g = taperedTube(pts.filter((_, i) => i % 3 === 0), { segments: 150, radial: 6, flatten: 0.85, radius: t => rrAt(t) * 0.60 * Math.min(1, (1 - t) * 10 + 0.2) });
    hairParts.push(prepHair(g, 0.86 + 0.08 * (k % 3) + rand() * 0.1));
  }
  // messy knot: thick wrapped loops around random axes, each a clump of 3 strands
  for (let k = 0; k < 6; k++) {
    const axis = new V3(rand() - 0.5, 0.35 + rand() * 0.6, rand() - 0.5).normalize();
    const uu = new V3().crossVectors(axis, new V3(0.3, 0.1, 1).normalize()).normalize(), ww = new V3().crossVectors(axis, uu);
    const rad = 0.076 + rand() * 0.006, a0 = rand() * Math.PI * 2, turn = 0.45 + rand() * 0.35, hOff = (rand() - 0.5) * 0.02;
    for (const [off, rs] of [[0, 1], [0.010, 0.6], [-0.010, 0.6]]) {
      const pts = [];
      for (let j = 0; j <= 14; j++) {
        const a = a0 + (j / 14) * Math.PI * 2 * turn, rr = (rad + off) * (1 + 0.12 * Math.sin(j * 1.3 + k)) * (j === 0 || j === 14 ? 0.5 : 1);
        const p = uu.clone().multiplyScalar(Math.cos(a) * rr).addScaledVector(ww, Math.sin(a) * rr).addScaledVector(axis, hOff + off * 0.3);
        p.set(p.x * BUNR.x / 0.085, p.y * BUNR.y / 0.085, p.z * BUNR.z / 0.085);
        pts.push(p.applyQuaternion(bunQ).add(BUN));
      }
      hairParts.push(prepHair(taperedTube(pts, { flatten: 0.6, radius: strandR(0.013 * rs, 0.5), segments: 36, radial: 6 }), 0.8 + rand() * 0.25));
    }
  }
  const surf = (d, sc) => new V3(d.x * BUNR.x * sc, d.y * BUNR.y * sc, d.z * BUNR.z * sc).applyQuaternion(bunQ).add(BUN);
  for (let k = 0; k < 3; k++) {
    const a = rand() * Math.PI * 2, e = 0.1 + rand() * 0.7, d = dirOf(a, e), d2 = dirOf(a + 0.5 + rand() * 0.3, e + (rand() - 0.5) * 0.4);
    const mid = d.clone().add(d2).normalize();
    tendril([surf(d, 0.9), surf(d.clone().lerp(mid, 0.5).normalize(), 1.12), surf(mid, 1.16 + rand() * 0.06), surf(d2.clone().lerp(mid, 0.5).normalize(), 1.12), surf(d2, 0.9)], 0.0045, 0.9 + rand() * 0.2);
  }
  for (let k = 0; k < 5; k++) {
    const a = rand() * Math.PI * 2, e = 0.3 + rand() * 0.9, d = dirOf(a, e);
    tendril([surf(d, 0.92), surf(d, 1.15).add(new V3(0.01, 0.012, 0)), surf(d, 1.3).add(new V3(0.02, 0.006, 0.01))], 0.0026, 1.0);
  }
}
}
if (options.character === 'claire') {
  // Claire's reference: full, honey-blonde S-waves to the lower back.
  for (let k = 0; k < 24; k++) {
    const psi = 0.72 + (Math.PI * 2 - 1.44) * k / 23;
    const pts = [];
    for (let j = 0; j <= 14; j++) {
      const t = j/14, start = shellPoint(psi, .60, .002);
      const spread = .139 + .024*Math.sin(t*Math.PI);
      const sway = .015*Math.sin(t*12+k*.5)*ss(0,.25,t);
      pts.push(new V3(lerp(start.x, Math.sin(psi)*spread+sway, ss(0,.3,t)), lerp(start.y,-.47+.033*Math.sin(k*1.9),t), lerp(start.z, Math.cos(psi)*.146-.023+.012*Math.sin(t*12+k*.5),ss(0,.3,t))));
    }
    hairParts.push(prepHair(taperedTube(pts,{segments:52,radial:7,flatten:.70,radius:t=>.022*(.7+.3*Math.sin(Math.PI*t))*Math.pow(1-t,.32)}),.9+(k%3)*.07));
  }
  for (const sd of [-1,1]) for (let k=0;k<3;k++) {
    const p=shellPoint(sd*(.7+k*.15),.53,.006);
    const pts=[p,new V3(sd*.142,-.015,.074),new V3(sd*(.132+k*.009),-.115,.109),new V3(sd*(.155+k*.008),-.24,.115),new V3(sd*.128,-.36,.126),new V3(sd*.153,-.43,.11)];
    hairParts.push(prepHair(taperedTube(pts,{segments:60,radial:7,flatten:.72,radius:t=>.013*Math.pow(1-t,.4)}),1.03+k*.04));
  }
}
const hairMesh = new THREE.Mesh(mergeGeometries(hairParts), hairMat); hairParts.forEach(g => g.dispose());
hairMesh.name = 'Maya hair'; hairMesh.castShadow = true; hairMesh.receiveShadow = false;
headGroup.add(hairMesh);
const tie = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.0065, 10, 56), new THREE.MeshStandardMaterial({ color: COL.tie, roughness: 0.55 }));
tie.quaternion.setFromUnitVectors(new V3(0, 0, 1), BUN_AXIS);
tie.position.copy(BUN).addScaledVector(BUN_AXIS, -BUNR.y * 0.60);
headGroup.add(tie); tie.visible = !options.male && options.character !== 'claire';
if (options.nohair) { hairMesh.visible = false; tie.visible = false; }   // debug: inspect the bare head shape

//@@HAIR@@

mark('hair');
// ------------------------------------------------------------------ BODY / OUTFIT (world space)
const body = new THREE.Group(); maya.add(body);
const addMesh = (geo, mat, parent = body, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
const PI = Math.PI;

// --- textures
function ribNormal(vertical) {
  const S = 256, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = vertical ? x : y; h[y * S + x] = 0.5 + 0.5 * Math.cos(2 * PI * c / 8); }
  return heightToNormal(h, S, 1.1);
}
function twillNormal() {
  const S = 256, h = new Float32Array(S * S), R = mulberry32(9);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (((x + y) % 8) < 4 ? 0.7 : 0) + R() * 0.35;
  return heightToNormal(h, S, 1.6);
}
function denimBase(g, W, H, seed) {
  const img = g.createImageData(W, H), R = mulberry32(seed), base = [(COL.denim >> 16)&255, (COL.denim >> 8)&255, COL.denim&255];
  for (let i = 0; i < W * H; i++) {
    const n = R(), k = 0.95 + 0.07 * (n - 0.5) + (n > 0.985 ? 0.12 : 0);
    img.data[i*4] = base[0] * k; img.data[i*4+1] = base[1] * k; img.data[i*4+2] = base[2] * k; img.data[i*4+3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const STITCH = 'rgba(214,186,158,0.95)', SEAM = 'rgba(38,52,78,0.30)';
function strokePath(g, pts, { color = STITCH, width = 3, dash = [7, 5], blur = 0 } = {}) {
  g.save(); g.filter = blur ? `blur(${blur}px)` : 'none'; g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
}
const topRib = ribNormal(true); topRib.repeat.set(7, 3);
const sleeveRib = ribNormal(false); sleeveRib.repeat.set(5, 2);
const twill = twillNormal(); twill.repeat.set(18, 7);
const twillLeg = twill.clone(); twillLeg.repeat.set(14, 18); twillLeg.needsUpdate = true;

// --- top (cream rib knit, cropped) ------------------------------------------------
const TOP = { y0: options.male ? 0.97 : 1.030, y1: options.character === 'claire' ? 1.215 : 1.262 };
const topW = spline1([[1.030,0.083],[1.05,0.081],[1.08,0.084],[1.11,0.094],[1.135,0.102],[1.17,0.105],[1.20,0.110],[1.225,0.114],[1.245,0.108],[1.255,0.095],[1.262,0.077]]);
const topDf = spline1([[1.03,0.066],[1.08,0.070],[1.13,0.076],[1.20,0.078],[1.245,0.068],[1.262,0.052]]);
const topDb = spline1([[1.03,0.068],[1.10,0.076],[1.19,0.084],[1.24,0.076],[1.262,0.050]]);
const topCz = spline1([[1.03,0.0],[1.13,-0.008],[1.262,-0.022]]);
const topYTop = phi => TOP.y1 - 0.013 * Math.pow(Math.max(0, Math.cos(phi)), 2.5);
function torsoPoint(t, phi, out, grow = 0) {
  const yn = lerp(TOP.y0, TOP.y1, t), y = lerp(TOP.y0, topYTop(phi), t);
  const w = topW(yn) + grow, cs = Math.cos(phi), sn = Math.sin(phi);
  let x = w * sn, z = topCz(yn) + cs * ((cs > 0 ? topDf(yn) : topDb(yn)) + grow);
  if (cs > 0) { const ax = Math.abs(x), sy = y < 1.135 ? 0.021 : 0.03; z += (options.male ? 0.002 : 0.024) * cs * gauss(ax - 0.047, y - 1.135, 0.030, sy); }
  else z -= 0.006 * gauss(Math.abs(x) - 0.05, y - 1.19, 0.03, 0.03) * -cs;
  return out.set(x, y, z);
}
const topTex = canvasTex(2048, 1024, (g, W, H) => {
  g.fillStyle = '#' + COL.top.toString(16).padStart(6, '0'); g.fillRect(0, 0, W, H);
  const hy = (1.2 - TOP.y0) / (topYTop(0) - TOP.y0), cx = W * 0.5, cy = (1 - hy) * H, hw = 0.038 / (2 * PI * topW(1.2)) * W, hh = 0.036 / (TOP.y1 - TOP.y0) * H;
  g.save(); g.translate(cx, cy); g.scale(hw / 100, hh / 100);
  g.beginPath(); g.moveTo(0, 46); g.bezierCurveTo(-30, 22, -52, 4, -50, -22); g.bezierCurveTo(-48, -44, -18, -52, 0, -28);
  g.bezierCurveTo(18, -52, 48, -44, 50, -22); g.bezierCurveTo(52, 4, 30, 22, 0, 46); g.closePath();
  if (!options.character || options.character === 'maya') {g.fillStyle = '#ef5a52'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(190,50,45,0.6)'; g.stroke();} g.restore();
  const grd = g.createLinearGradient(0, H, 0, H * 0.9); grd.addColorStop(0, 'rgba(200,170,150,0.35)'); grd.addColorStop(1, 'rgba(200,170,150,0)');
  g.fillStyle = grd; g.fillRect(0, H * 0.9, W, H * 0.1);
});
const topMat = new THREE.MeshPhysicalMaterial({ map: topTex, normalMap: topRib, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.88, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xfff4ea) });
const sleeveMat = new THREE.MeshPhysicalMaterial({ color: COL.top, normalMap: sleeveRib, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.88, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xfff4ea) });
addMesh(gridSurface(54, 96, (t, u, v) => torsoPoint(t, (u - 0.5) * 2 * PI, v)), topMat);
{ // hem band + neckline binding
  const hem = [], neck = [], v = new V3();
  for (let i = 0; i < 72; i++) { const phi = (i / 72) * 2 * PI - PI; hem.push(torsoPoint(0.0, phi, new V3(), 0.0025)); neck.push(torsoPoint(1.0, phi, new V3(), 0.001)); }
  addMesh(taperedTube(hem, { segments: 144, radial: 8, closed: true, radius: () => 0.0042, flatten: 0.8 }), sleeveMat);
  addMesh(taperedTube(neck, { segments: 144, radial: 8, closed: true, radius: () => 0.0030 }), sleeveMat);
}
// neck + upper chest skin (under the neckline), midriff skin
// neck: slightly fuller and leaning forward into the skull (head topology sheet)
const neckW = spline1([[1.18,0.092],[1.235,0.080],[1.255,0.066],[1.28,0.054],[1.33,0.050],[1.46,0.049]]);
const neckD = spline1([[1.18,0.060],[1.235,0.049],[1.255,0.044],[1.28,0.045],[1.33,0.048],[1.46,0.050]]);
addMesh(gridSurface(40, 48, (t, u, v) => { const y = lerp(1.18, 1.46, t), phi = (u - 0.5) * 2 * PI; return v.set(neckW(y) * Math.sin(phi), y, lerp(-0.02, 0.002, t) + neckD(y) * Math.cos(phi)); }), skinMat);
const midW = spline1([[0.975,0.090],[1.0,0.080],[1.02,0.0765],[1.04,0.077],[1.065,0.081]]);
addMesh(gridSurface(12, 64, (t, u, v) => { const y = lerp(0.975, 1.065, t), phi = (u - 0.5) * 2 * PI, cs = Math.cos(phi); return v.set(midW(y) * Math.sin(phi), y, cs * (cs > 0 ? 0.060 : 0.064)); }), skinMat);

// --- sleeves, forearms, hands --------------------------------------------------------
const sleeveR = spline1([[0,0.024],[0.16,0.031],[0.30,0.031],[0.55,0.026],[0.75,0.0235],[0.93,0.0212],[1,0.0218]]);
const roundTip = (R, s = 0.8) => t => R * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (t - s) / (1 - s)), 2))) * Math.min(1, 0.7 + t);
for (const sd of [-1, 1]) {
  const armStart=body.children.length;
  const P = (x, y, z) => new V3(sd * x, y, z);
  addMesh(taperedTube([P(0.05, 1.19, -0.02), P(0.095, 1.232, -0.02), P(0.128, 1.222, -0.02), P(0.146, 1.15, -0.014), P(0.160, 1.048, -0.004), P(0.172, 0.97, 0.010), P(0.180, 0.905, 0.020)],
    { segments: 72, radial: 16, radius: t => sleeveR(t) * (1 + 0.035 * Math.sin(t * 60) * ss(0.55, 0.8, t) * ss(1.0, 0.85, t)) }), options.character === 'claire' ? skinMat : sleeveMat);
  addMesh(taperedTube([P(0.176, 0.95, 0.014), P(0.181, 0.89, 0.022), P(0.187, 0.83, 0.028), P(0.191, 0.785, 0.030)], { segments: 16, radial: 16, radius: t => lerp(0.0172, 0.0150, t) }), skinMat);
  const palm = new THREE.SphereGeometry(1, 28, 20); palm.scale(0.0135, 0.043, 0.0300);
  const pm = addMesh(palm, skinMat); pm.position.set(sd * 0.192, 0.768, 0.031); pm.rotation.set(0.05, 0, sd * 0.05);
  const fingers = [[-0.0185, 0.680], [-0.006, 0.669], [0.006, 0.664], [0.0185, 0.672]];
  const fg = [];
  for (const [zo, tipY] of fingers) {
    fg.push(taperedTube([P(0.192, 0.752, 0.031 + zo), P(0.190, 0.71, 0.034 + zo * 1.05), P(0.185, (0.71 + tipY) / 2 - 0.004, 0.037 + zo * 1.08), P(0.178, tipY, 0.038 + zo * 1.1)],
      { segments: 14, radial: 10, radius: roundTip(zo > 0.01 || zo < -0.01 ? 0.0068 : 0.0074, 0.82) }));
  }
  fg.push(taperedTube([P(0.188, 0.79, 0.046), P(0.184, 0.762, 0.058), P(0.178, 0.737, 0.061)], { segments: 10, radial: 10, radius: roundTip(0.0074, 0.75) }));
  addMesh(mergeGeometries(fg), skinMat);
  for(const mesh of body.children.slice(armStart)){mesh.userData.region='arm';mesh.userData.side=sd;}
}

// --- jeans ----------------------------------------------------------------------------
const HIP = { y0: 0.760, y1: 1.003 };
const hipW = spline1([[0.655,0.166],[0.70,0.164],[0.75,0.160],[0.813,0.157],[0.87,0.148],[0.93,0.126],[0.97,0.105],[1.003,0.097]]);
const hipDf = spline1([[0.655,0.085],[0.75,0.088],[0.85,0.090],[0.93,0.084],[1.003,0.076]]);
const hipDb = spline1([[0.655,0.100],[0.72,0.124],[0.80,0.138],[0.87,0.128],[0.93,0.104],[1.003,0.078]]);
function hipPoint(t, phi, out, grow = 0) {
  const y = lerp(HIP.y0, HIP.y1, t), cs = Math.cos(phi), w = hipW(y) + grow;
  const x = w * Math.sin(phi);
  let d = (cs > 0 ? hipDf(y) : hipDb(y)) + grow;
  if (cs < 0) { d += 0.008 * gauss(Math.abs(x) - 0.07, y - 0.80, 0.045, 0.05); d -= 0.010 * Math.exp(-(x * x) / (2 * 0.016 * 0.016)) * ss(0.90, 0.80, y); }
  return out.set(x, y, cs * d);
}
function hipUV(x, y, back) {
  const s = Math.asin(clamp(x / hipW(y), -1, 1)), phi = back ? (x >= 0 ? PI - s : -PI - s) : s;
  return [(phi + PI) / (2 * PI) * 2048, (1 - (y - HIP.y0) / (HIP.y1 - HIP.y0)) * 1024];
}
const hipTex = canvasTex(2048, 1024, (g, W, H) => {
  denimBase(g, W, H, 11);
  const path = (fn, n, back) => { const a = []; for (let i = 0; i <= n; i++) { const [x, y] = fn(i / n); a.push(hipUV(x, y, back)); } return a; };
  // waistband shading + stitches
  const wbTop = hipUV(0, 1.0, false)[1], wbBot = hipUV(0, 0.972, false)[1];
  g.fillStyle = 'rgba(40,55,85,0.10)'; g.fillRect(0, wbTop, W, wbBot - wbTop);
  for (const yy of [0.9995, 0.9765]) strokePath(g, [[0, hipUV(0, yy, false)[1]], [W, hipUV(0, yy, false)[1]]], { width: 2.5 });
  strokePath(g, [[0, wbBot + 1], [W, wbBot + 1]], { color: SEAM, dash: [], width: 3, blur: 1 });
  for (const sd of [-1, 1]) {
    // front scoop pockets
    const scoop = s => [sd * (0.066 + 0.090 * Math.pow(s, 0.75)), 0.972 - 0.075 * Math.pow(s, 1.9)];
    strokePath(g, path(scoop, 30, false), { color: 'rgba(30,42,66,0.55)', dash: [], width: 3.5, blur: 1 });
    strokePath(g, path(s => { const [x, y] = scoop(s); return [x + sd * 0.004, y - 0.005]; }, 30, false), { width: 2.5 });
    // side seams
    const side = hipUV(sd * hipW(0.8) * 0.9999, 0.8, false)[0];
    strokePath(g, [[side, 0], [side, H]], { color: 'rgba(170,190,220,0.35)', dash: [], width: 5, blur: 1.5 });
    strokePath(g, [[side + sd * 5, 0], [side + sd * 5, H]], { width: 2.2, dash: [6, 5] });
    // back yoke and patch pockets
    strokePath(g, path(s => [sd * s * 0.16, lerp(0.936, 0.958, s)], 20, true), { color: SEAM, dash: [], width: 3, blur: 1 });
    strokePath(g, path(s => [sd * s * 0.16, lerp(0.931, 0.953, s)], 20, true), { width: 2.4 });
    const cxp = sd * 0.080, ang = sd * 0.07, pk = [[-0.050, 0.930], [0.050, 0.930], [0.047, 0.840], [0.0, 0.813], [-0.047, 0.840], [-0.050, 0.930]];
    const pkt = (inset) => pk.map(([px, py]) => { const qx = px * (1 - inset / 0.05), qy = (py - 0.87) * (1 - inset / 0.06) + 0.87; const rx = qx * Math.cos(ang) - (qy - 0.87) * Math.sin(ang), ry = qx * Math.sin(ang) + (qy - 0.87) * Math.cos(ang); return [cxp + rx, 0.87 + ry]; });
    const fillP = pkt(0).map(([x, y]) => hipUV(x, y, true));
    g.save(); g.beginPath(); fillP.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    g.fillStyle = 'rgba(120,145,185,0.10)'; g.fill(); g.restore();
    strokePath(g, fillP, { color: 'rgba(25,38,62,0.5)', dash: [], width: 4, blur: 1.5 });
    strokePath(g, pkt(0.004).map(([x, y]) => hipUV(x, y, true)), { width: 2.4 });
    strokePath(g, pkt(0.0085).map(([x, y]) => hipUV(x, y, true)), { width: 2.4 });
    const tl = pkt(0.004); strokePath(g, [tl[0], tl[1]].map(([x, y]) => hipUV(x, y - 0.012, true)), { width: 2.4 });
  }
  // fly (J stitch) + center seams
  strokePath(g, path(s => [0.0, lerp(0.972, 0.70, s)], 10, false), { color: SEAM, dash: [], width: 3, blur: 1 });
  strokePath(g, path(s => s < 0.75 ? [0.022, lerp(0.972, 0.866, s / 0.75)] : [0.022 * Math.cos((s - 0.75) / 0.25 * PI / 2), 0.866 - 0.02 * Math.sin((s - 0.75) / 0.25 * PI / 2)], 24, false), { width: 2.5 });
  strokePath(g, path(s => [-0.0001, lerp(1.0, 0.66, s)], 10, true), { color: SEAM, dash: [], width: 3, blur: 1 });
  strokePath(g, path(s => [0.004, lerp(0.93, 0.66, s)], 10, true), { width: 2.2 });
  // soft wash: lighter front thighs
  for (const sd of [-1, 1]) {
    const [px, py] = hipUV(sd * 0.08, 0.74, false), rg = g.createRadialGradient(px, py, 0, px, py, 260);
    rg.addColorStop(0, 'rgba(170,195,225,0.22)'); rg.addColorStop(1, 'rgba(170,195,225,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
});
const denimMat = (map, nmap) => new THREE.MeshPhysicalMaterial({ map, normalMap: nmap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.9, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x9fb4d6) });
const hipMat = denimMat(hipTex, twill);
addMesh(gridSurface(46, 112, (t, u, v) => hipPoint(t, (u - 0.5) * 2 * PI, v)), hipMat);
{ // waistband (raised band sharing the hip canvas)
  const g = gridSurface(6, 128, (t, u, v) => { const phi = (u - 0.5) * 2 * PI, y = lerp(0.971, 1.004, t); const tt = (y - HIP.y0) / (HIP.y1 - HIP.y0); return hipPoint(tt, phi, v, 0.0032 * (1 - 0.6 * ss(0.7, 1, t)) * ss(0, 0.2, t) + 0.0006); });
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (lerp(0.971, 1.004, uv.getY(i)) - HIP.y0) / (HIP.y1 - HIP.y0));
  addMesh(g, hipMat);
  const plain = new THREE.MeshPhysicalMaterial({ color: 0x5d76a0, normalMap: twill, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9 });
  const loops = [];
  for (const phi of [Math.asin(0.052 / 0.1), -Math.asin(0.052 / 0.1), PI / 2, -PI / 2, PI, PI - 0.75, -PI + 0.75]) {
    const b = new THREE.BoxGeometry(0.010, 0.033, 0.0035); b.rotateY(phi);
    const p = hipPoint((0.986 - HIP.y0) / (HIP.y1 - HIP.y0), phi, new V3(), 0.0055); b.translate(p.x, 0.986, p.z); loops.push(b);
  }
  addMesh(mergeGeometries(loops), plain);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.003, 24).rotateX(PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9b36a, metalness: 1, roughness: 0.32 }));
  const bp = hipPoint((0.984 - HIP.y0) / (HIP.y1 - HIP.y0), 0, new V3(), 0.006); btn.position.set(0, 0.984, bp.z); body.add(btn);
}
// wide legs
const legTmp = new V3();
const legRx = spline1([[0.04,0.094],[0.07,0.094],[0.2,0.089],[0.4,0.084],[0.55,0.078],[0.68,0.074],[0.80,0.077]]);
const legBz = spline1([[0.04,0.160],[0.3,0.128],[0.55,0.100],[0.68,0.090],[0.80,0.100]]);
const legTex = canvasTex(1024, 1024, (g, W, H) => {
  denimBase(g, W, H, 21);
  const rg = g.createLinearGradient(0, 0, 0, H); rg.addColorStop(0, 'rgba(160,185,220,0.16)'); rg.addColorStop(0.5, 'rgba(160,185,220,0.08)'); rg.addColorStop(0.9, 'rgba(30,45,75,0.0)'); rg.addColorStop(1, 'rgba(30,45,75,0.18)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  for (const u of [0.25, 0.75]) {
    strokePath(g, [[u * W, 0], [u * W, H]], { color: 'rgba(170,190,220,0.35)', dash: [], width: 5, blur: 1.5 });
    strokePath(g, [[u * W + 4, 0], [u * W + 4, H]], { width: 2.2 });
  }
  for (const u of [0.375, 0.125]) { // centre front/back seams continuing from the hip into the crotch
    strokePath(g, [[u * W, 0], [u * W, 0.14 * H]], { color: SEAM, dash: [], width: 3, blur: 1 });
    strokePath(g, [[u * W + 4, 0], [u * W + 4, 0.12 * H]], { width: 2.2 });
  }
  for (const vv of [0.022, 0.032]) strokePath(g, [[0, (1 - vv) * H], [W, (1 - vv) * H]], { width: 2.4, dash: [6, 4] });
  strokePath(g, [[0, (1 - 0.036) * H], [W, (1 - 0.036) * H]], { color: SEAM, dash: [], width: 3, blur: 1.5 });
});
const legMat = denimMat(legTex, twillLeg); legMat.side = THREE.DoubleSide;
for (const sd of [-1, 1]) {
  const legGeo = gridSurface(80, 56, (t, u, v) => {
    const phi = (u - 0.5) * 2 * PI, cs = Math.cos(phi), sn = Math.sin(phi);
    const hemY = 0.064 + 0.008 * cs, y = lerp(hemY, HIP.y0, t);
    const fold = 1 + 0.028 * Math.sin(phi * 5 + y * 7 + sd) * ss(0.6, 0.1, y) + 0.018 * Math.sin(y * 85) * ss(0.22, 0.08, y) * Math.max(0, cs);
    const flare = 1 + 0.05 * ss(0.14, 0.064, y);
    // below the crotch: separate flared legs; above it the ring morphs into this leg's half of the hip section,
    // matching the hip shell exactly at HIP.y0 (shared boundary, no overlap)
    const k = ss(0.655, 0.745, y);
    const ex = sd * (0.131 - (y - 0.066) * 0.0633) + legRx(y) * fold * flare * sn, ez = cs * (cs > 0 ? 0.088 : legBz(y)) * fold * flare;
    if (k <= 0) return v.set(ex, y, ez);
    const tt = (y - HIP.y0) / (HIP.y1 - HIP.y0), pl = sd * phi, H = ph => hipPoint(tt, ph, legTmp);
    let hx, hz;
    if (pl >= 0) { H(pl <= PI / 2 ? lerp(PI / 6, PI / 2, pl / (PI / 2)) : lerp(PI / 2, 5 * PI / 6, (pl - PI / 2) / (PI / 2))); hx = legTmp.x; hz = legTmp.z; }
    else if (pl >= -PI / 4) { H(lerp(0, PI / 6, (pl + PI / 4) / (PI / 4))); hx = legTmp.x; hz = legTmp.z; }
    else if (pl >= -PI / 2) { H(0); hx = 0; hz = legTmp.z * (pl + PI / 2) / (PI / 4); }
    else if (pl >= -3 * PI / 4) { H(PI); hx = 0; hz = legTmp.z * -(pl + PI / 2) / (PI / 4); }
    else { H(lerp(PI, 5 * PI / 6, (pl + 3 * PI / 4) / (-PI / 4))); hx = legTmp.x; hz = legTmp.z; }
    return v.set(lerp(ex, sd * Math.abs(hx), k), y, lerp(ez, hz, k));
  });
  const lp = legGeo.attributes.position, visible = [];
  for (let i = 0; i < legGeo.index.count; i += 3) {
    const ids = [legGeo.index.getX(i), legGeo.index.getX(i+1), legGeo.index.getX(i+2)];
    if (!ids.every(id => Math.abs(lp.getX(id)) < 0.00001)) visible.push(...ids);
  }
  legGeo.setIndex(visible);
  if (sd < 0) { const uv = legGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
  addMesh(legGeo, legMat);
  const hem = [];
  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * 2 * PI - PI, cs = Math.cos(phi), y = 0.064 + 0.008 * cs + 0.002;
    const cx = sd * (0.131 - (y - 0.066) * 0.0633), fold = 1 + 0.028 * Math.sin(phi * 5 + y * 7 + sd) * ss(0.6, 0.1, y), fl = 1.05;
    hem.push(new V3(cx + legRx(y) * fold * fl * Math.sin(phi), y, cs * (cs > 0 ? 0.088 : legBz(y)) * fold * fl));
  }
  addMesh(taperedTube(hem, { segments: 96, radial: 6, closed: true, radius: () => 0.0035 }), legMat);
}

// --- sneakers ----------------------------------------------------------------------------
const shoeMat = new THREE.MeshPhysicalMaterial({ color: 0xf3e7dc, roughness: 0.6, sheen: 0.25, sheenColor: new THREE.Color(0xffffff) });
const soleMat = new THREE.MeshPhysicalMaterial({ color: 0xeee0d3, roughness: 0.7 });
const lineMat = new THREE.MeshStandardMaterial({ color: 0xc8a88e, roughness: 0.7 });
const contactMat = new THREE.MeshStandardMaterial({ color: 0xb1876e, roughness: 0.8 });
function shoeOutline(phi, sc) {
  const sn = Math.sin(phi), cs = Math.cos(phi), n = 2.6;
  const zn = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / n);
  const hw = 0.056 * (1 - 0.14 * ss(0.2, -1, zn));
  return [hw * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * sc, 0.14 * zn * sc, zn];
}
const soleSc = spline1([[0,0],[0.15,0.93],[0.3,1.0],[0.5,1.022],[0.72,1.0],[0.86,0.955],[1,0]]);
const soleY = spline1([[0,0],[0.15,0],[0.3,0.006],[0.5,0.018],[0.72,0.033],[0.86,0.038],[1,0.039]]);
const upSc = spline1([[0,0.965],[0.2,1.0],[0.45,0.93],[0.65,0.76],[0.85,0.45],[1,0]]);
const upY = spline1([[0,0.034],[0.2,0.05],[0.45,0.074],[0.65,0.090],[0.85,0.099],[1,0.102]]);
for (const sd of [-1, 1]) {
  const grp = new THREE.Group(); grp.position.set(sd * 0.150, 0, 0.030); grp.rotation.y = sd * 0.14; body.add(grp);
  const lift = zn => 0.012 * Math.pow(ss(0.55, 1.0, zn), 2) + 0.003 * ss(-0.7, -1, zn);
  addMesh(gridSurface(22, 56, (t, u, v) => { const phi = (u - 0.5) * 2 * PI, [x, z, zn] = shoeOutline(phi, soleSc(t)); return v.set(x, soleY(t) + lift(zn) * ss(0.2, 0.6, t) + lift(zn) * (1 - ss(0.2, 0.6, t)), z); }), soleMat, grp);
  addMesh(gridSurface(22, 56, (t, u, v) => { const phi = (u - 0.5) * 2 * PI, [x, z, zn] = shoeOutline(phi, upSc(t)); const hf = lerp(1.0, 0.62, ss(-0.3, 0.9, zn)); return v.set(x, 0.034 + (upY(t) - 0.034) * hf + lift(zn), z * (1 - 0.02 * t)); }), shoeMat, grp);
  const ring = (sc, y, R, mat) => { const pts = []; for (let i = 0; i < 64; i++) { const phi = (i / 64) * 2 * PI - PI, [x, z, zn] = shoeOutline(phi, sc); pts.push(new V3(x, y + lift(zn), z)); } addMesh(taperedTube(pts, { segments: 72, radial: 5, closed: true, radius: () => R }), mat, grp); };
  ring(1.0, 0.0365, 0.0019, lineMat);
  ring(0.975, 0.0035, 0.0022, contactMat);
  grp.traverse(mesh=>{mesh.userData.region='shoe';mesh.userData.side=sd;});
}

mark('body');

if (options.character === 'mara') {
  const apronMat = new THREE.MeshStandardMaterial({color:0xe6d9bc,roughness:.96,side:THREE.DoubleSide});
  addMesh(gridSurface(16,20,(t,u,v)=>{
    const y=lerp(.72,1.18,t),w=lerp(.14,.072,ss(.84,1.18,y)),x=(u-.5)*2*w;
    return v.set(x,y,.106+.01*Math.sin(u*Math.PI));
  }),apronMat);
  const strap=[];for(let i=0;i<=30;i++){const a=i/30*Math.PI;strap.push(new V3(Math.cos(a)*.071,1.18+Math.sin(a)*.08,.079));}
  addMesh(taperedTube(strap,{segments:30,radial:6,radius:()=>.007}),apronMat);
  const pocket=addMesh(new THREE.BoxGeometry(.11,.075,.004),apronMat);pocket.position.set(0,.89,.121);
}
if (options.character === 'claire') {
  const cardigan = new THREE.MeshPhysicalMaterial({color:0xdcb69e,normalMap:topRib,normalScale:new THREE.Vector2(.6,.6),roughness:1,sheen:.7,sheenColor:new THREE.Color(0xf5dfca),side:THREE.DoubleSide});
  const gold=new THREE.MeshStandardMaterial({color:0xd9b56b,metalness:.7,roughness:.4});
  for(const sd of [-1,1]) {
    const sleeve=addMesh(taperedTube([new V3(sd*.15,1.105,-.004),new V3(sd*.16,1.02,.01),new V3(sd*.18,.94,.02),new V3(sd*.184,.865,.03)],{segments:38,radial:16,radius:t=>.042+.008*Math.sin(t*23)}),cardigan);sleeve.userData={region:'arm',side:sd};
    addMesh(taperedTube([new V3(sd*.072,1.193,.052),new V3(sd*.079,1.246,-.014),new V3(sd*.076,1.202,-.077)],{segments:25,radial:8,radius:()=>.006}),topMat);
  }
  addMesh(gridSurface(18,40,(t,u,v)=>{const s=u*2-1;return v.set(s*.18,lerp(.80+.14*Math.abs(s),1.01+.08*Math.abs(s),t),-.13-.022*(1-s*s)-.006*Math.cos(u*40));}),cardigan);
  for(let i=0;i<4;i++){const button=addMesh(new THREE.SphereGeometry(.0038,12,8),gold);button.position.set(0,1.08+i*.033,.086);}
  const chain=[];for(let i=0;i<=30;i++){const s=i/30*2-1;chain.push(new V3(s*.045,1.237+Math.abs(s)*.067,.065-.017*Math.abs(s)));}
  addMesh(taperedTube(chain,{segments:36,radial:5,radius:()=>.0013}),gold);
  const medallion=addMesh(new THREE.CylinderGeometry(.011,.011,.003,24).rotateX(Math.PI/2),gold);medallion.position.set(0,1.229,.069);
}

  const bound = bindBody(body);
  if (options.male) for (const entry of bound) {
    const p=entry.positions;
    for(let i=0;i<p.length;i+=3) {
      const y=p[i+1],width=lerp(.88,1.52,ss(.72,1.20,y));
      p[i]*=width;
    }
  }
  const expressions={neutral:{smile:0,wink:0,blinkL:0,blinkR:0},happy:{smile:.85,wink:0,blinkL:0,blinkR:0},wink:{smile:.35,wink:.7,blinkL:1,blinkR:0}};
  let sit=0,walk=0,wave=0,phase=0,lastPose='',nextBlink=2.5,blinkStart=-10;
  function update(t=0,dt=.016,state={}) {
    const ease=state.still?1:1-Math.exp(-dt*9);
    sit+=((state.sitting?1:0)-sit)*ease;
    walk+=((state.walking?1:0)-walk)*ease;
    wave+=((state.wave?1:0)-wave)*ease;
    phase+=dt*10.2*walk;
    const posePhase=state.still?1.2:phase;
    const target=expressions[state.expression]||expressions.neutral;
    for(const k in face)face[k]+=(target[k]-face[k])*ease;
    if(t>nextBlink){blinkStart=t;nextBlink=t+3.2+rand()*2;}
    const bt=(t-blinkStart)/.20;
    applyFaceState(state.still?0:bt>=0&&bt<1?Math.sin(Math.PI*bt):0);
    headGroup.rotation.set(0,state.still?0:.018*Math.sin(t*.6),0);
    const seatHeight=state.seatHeight??.54;
    const poseKey=[sit.toFixed(3),walk.toFixed(3),wave.toFixed(3),seatHeight,walk>.002?posePhase.toFixed(3):'',wave>.002?t.toFixed(3):''].join(':');
    if(poseKey!==lastPose){
      lastPose=poseKey;
      const pose=poseMatrices({sit,walk,wave,phase:posePhase,time:t,seatHeight,male:options.male});
      applyPose(bound,pose);headGroup.position.y=HEAD_POS.y-pose.drop;
    }
  }
  update(0,0,{still:true});
  maya.name=options.name||'Maya';
  return {group:maya,update,head:headGroup,body,face,hair:hairMesh};
}
