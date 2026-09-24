import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Environment art shared with the Unreal edition (scripts/export-env-glb.py -> assets/env/*.glb).
// Plants are instanced per species; props are baked and merged per material. Placements follow
// mb_unreal_engine/Scripts/env_dress.py (UE cm -> metres, UE yaw -> -rotation.y); every indoor piece sits
// on an existing layout.json obstacle (or the one added for the lounge floor lamp).
const loader = new GLTFLoader();
const files = Promise.all(['plants', 'props'].map(n => loader.loadAsync(`/assets/env/${n}.glb`)));
files.catch(() => {});

// Source café pieces the new art replaces (GLTFLoader names: spaces -> _, dots dropped).
const HIDE = /^(Plant_pot|Terracotta_plant_pot|Potting_soil|Garden_tree_trunk|Maple_Hollow_tree_canopy|Hanging_planter|Planter_cord|Table_ceramic_vase|Vase_sprig|Broad_living_leaf|Plant_frond|Espresso_machine|Machine_front|Portafilter|Cup_ready_for_espresso|Pastry_display_base|Display_canopy|Display_rear|Maple_bun|Sofa_(upholstered_base|generous_back|rounded_arm|cushion)|Linen_throw_pillow|Armchair_(arm|back|cushion|seat))/;
const deg = Math.PI / 180;

// [species, x, y, z, yaw°, scale]
const FIXED_PLANTS = [
 // Small pots from the former visual-details pass: shelf trailers and table succulents.
 ['PothosShelf', 6.35, 1.755, -6.6, 20, .62], ['PothosShelf', 7.65, 1.755, -6.6, 200, .7],
 ['Succulent', 6.5, 2.555, -6.6, 0, 1.6], ['PothosShelf', 7.4, 2.555, -6.6, 90, .62],
 ['Succulent', 13.6, .775, -1.95, 40, 1.4], ['Succulent', -2.8, .86, 5.5, 10, 1.5], ['Succulent', 4, .88, 2, 70, 1.7],
 ['Succulent', 6.7, .45, -3.55, 0, 1.5], ['Succulent', 7.1, .77, 2, 120, 1.2],
 // Hanging pothos near the shopfront windows and over the study desks (env_plants.py EXTRA).
 ['PothosHanging', -8.3, 3.45, 6.2, 0, 1], ['PothosHanging', -4.3, 3.5, 6.2, 70, 1], ['PothosHanging', 4.3, 3.45, 6.2, 140, 1],
 ['PothosHanging', 8.3, 3.5, 6.2, 210, 1], ['PothosHanging', 12, 3.45, -5.75, 30, 1], ['PothosHanging', 15.1, 3.5, -5.75, 160, 1],
 // Entrance planters outside the shopfront, clear of the 2.48 m path.
 ['Monstera', -2.2, 0, 7.75, 30, .7], ['FiddleLeafFig', 2.2, 0, 7.75, 120, .85],
];
// [prop, x, y, z, yaw°, upholstery]
const PROPS = [
 ['SofaLong', 6.7, 0, -5.52, 0, 'sage'], ['Sofa', -6.8, 0, 2.58, 0, 'cinnamon'],
 ['Armchair', 11.14, 0, 1.42, -153, 'cinnamon'], ['Armchair', 16.26, 0, 1.42, 153, 'cinnamon'],
 ['EspressoMachine', -7.06, 1.06, -4.92, 0], ['Grinder', -6.4, 1.06, -4.78, -10], ['PastryCase', -1.9, 1.05, -4.82, 0],
 ['CupSaucer', -4.3, 1.05, -4.52, 20], ['CupSaucer', -4.7, 1.05, -4.58, -30], ['CupSaucer', -5.6, 1.05, -5.2, 0],
 ['FloorLamp', 4.55, 0, -6.35, 0],
 ['Bench', -4.5, 0, 9, 0], ['Bench', 4.5, 0, 9, 0], ['BikeRack', 8.6, 0, 9.05, 0],
 ['StreetLamp', -10.6, 0, 9, 0], ['StreetLamp', 10.6, 0, 9, 0], ['SandwichBoard', -2.5, 0, 8.7, 18],
];
const COLORS = { Terracotta: '#b0674a', Cream: '#e2d6c0', Soil: '#34241a', Bark: '#6e5440', Cord: '#aa8c64', Wood: '#a8784a',
 DarkWood: '#4a3222', Pillow: '#e6dcc8', Iron: '#2a2d2a', Black: '#1c1c1e', Steel: '#bebec2', Paint: '#2f4f3e', Ceramic: '#ece6da',
 Coffee: '#3a2214', VC: '#ffffff', Brass: '#b08d57', Glass: '#e6f3ed', Shade: '#f0dcbc', LampGlass: '#ffd696', PrintSandwich: '#ffffff' };
const UPHOLSTERY = { sage: '#86977a', cinnamon: '#9a5536' };

const spots = [];
// Called for every source mesh; records where the replaced pots/trunks/vases/shelves stood.
export function claimSourceMesh(o) {
 if (/^Wall_shelf/.test(o.name)) {
  const b = new THREE.Box3().setFromObject(o);
  spots.push(['PothosShelf', b.max.x - .16, b.max.y, (b.min.z + b.max.z) / 2, spots.length * 67, .62]);
  return false;
 }
 if (!HIDE.test(o.name)) return false;
 const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), r = (b.max.x - b.min.x) / 2, yaw = spots.length * 53;
 if (/^(Plant_pot|Terracotta_plant_pot)/.test(o.name)) {
  const sp = ['FiddleLeafFig', 'SnakePlant', 'Monstera'][spots.length % 3], lib = { FiddleLeafFig: .2, Monstera: .24, SnakePlant: .16 }[sp];
  spots.push([sp, c.x, b.min.y, c.z, yaw, THREE.MathUtils.clamp(r / lib, .75, sp === 'Monstera' ? .85 : 1.1)]);
 } else if (/^Garden_tree_trunk/.test(o.name)) spots.push([spots.length % 2 ? 'TreeTall' : 'TreeRound', c.x, 0, c.z, yaw, 1 + .08 * (spots.length % 3)]);
 else if (/^Table_ceramic_vase/.test(o.name)) spots.push(['Succulent', c.x, b.min.y, c.z, yaw, 1.4]);
 else if (/^Hanging_planter/.test(o.name)) spots.push(['PothosHanging', c.x, c.y, c.z, yaw, 1]);
 o.userData.replaced = true; o.visible = false;
 return true;
}

function material(src, key, upholstery) {
 const slot = src.name.replace(/\.\d+$|\d+$/, '').replace(/^MB_/, '');
 const m = new THREE.MeshStandardMaterial({ name: 'Env ' + slot, color: UPHOLSTERY[upholstery] && slot === 'Upholstery' ? UPHOLSTERY[upholstery] : COLORS[slot] || '#b8b0a0', roughness: .7, vertexColors: true });
 if (src.map) m.map = src.map;
 if (slot === 'Foliage') Object.assign(m, { alphaTest: .4, side: THREE.DoubleSide, roughness: .62, color: new THREE.Color(key.startsWith('Tree') ? '#9fb880' : '#ffffff') });
 if (/Steel|Brass/.test(slot)) Object.assign(m, { metalness: .7, roughness: .3 });
 if (slot === 'Glass') Object.assign(m, { transparent: true, opacity: .22, depthWrite: false, roughness: .1 });
 if (slot === 'Coffee' || slot === 'Ceramic') m.roughness = .2;
 if (slot === 'LampGlass' || slot === 'Shade') Object.assign(m, { name: `Env ${slot} warm light`, emissive: new THREE.Color('#ffc078'), emissiveIntensity: 1.1 });
 return m;
}
const clean = g => {
 g = g.clone();
 for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) g.deleteAttribute(a);
 const n = g.attributes.position.count;
 if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
 if (!g.attributes.color || g.attributes.color.itemSize !== 3) {
  const src = g.attributes.color, col = new Float32Array(n * 3).fill(1);
  if (src) for (let i = 0; i < n; i++) col.set([src.getX(i), src.getY(i), src.getZ(i)], i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
 } else if (g.attributes.color.normalized || !(g.attributes.color.array instanceof Float32Array)) {
  const src = g.attributes.color, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([src.getX(i), src.getY(i), src.getZ(i)], i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
 }
 if (!g.index) g.setIndex([...Array(n).keys()]);
 return g;
};
const partsOf = root => { const out = []; root.updateMatrixWorld(true); root.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
const byName = gltf => new Map(gltf.scene.children.map(o => [o.name, o]));
const matrixOf = (x, y, z, yaw, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw * deg), new THREE.Vector3(s, s, s));

// Resolves once every plant and prop is in the scene; failures leave the café playable.
export async function placeEnvArt(scene) {
 let plants, props;
 try { [plants, props] = (await files).map(byName); } catch (e) { console.warn('Environment art unavailable:', e.message); return; }
 const group = new THREE.Group(); group.name = 'Maple Bean environment art'; scene.add(group);
 // Plants: one InstancedMesh per species primitive, sharing materials across species slots.
 const bySpecies = new Map();
 for (const s of [...spots, ...FIXED_PLANTS]) { if (!bySpecies.has(s[0])) bySpecies.set(s[0], []); bySpecies.get(s[0]).push(s); }
 const leafDepth = new Map();
 for (const [sp, list] of bySpecies) {
  const src = plants.get(sp); if (!src) continue;
  for (const part of partsOf(src)) {
   const mat = material(part.material, sp), mesh = new THREE.InstancedMesh(clean(part.geometry).applyMatrix4(part.matrixWorld), mat, list.length);
   list.forEach(([, x, y, z, yaw, s], i) => mesh.setMatrixAt(i, matrixOf(x, y, z, yaw, s)));
   mesh.name = `Env plant ${sp}`; mesh.castShadow = true; mesh.receiveShadow = true;
   if (mat.map && mat.alphaTest) {
    if (!leafDepth.has(mat.map)) leafDepth.set(mat.map, new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: .4 }));
    mesh.customDepthMaterial = leafDepth.get(mat.map);
   }
   mesh.computeBoundingSphere(); group.add(mesh);
  }
 }
 // Props: bake world transforms and merge per material (one draw per material across all props).
 const merged = new Map();
 for (const [name, x, y, z, yaw, upholstery] of PROPS) {
  const src = props.get(name); if (!src) continue;
  for (const part of partsOf(src)) {
   const slot = part.material.name.replace(/\.\d+$|\d+$/, '') + (/Upholstery/.test(part.material.name) ? upholstery || '' : '');
   if (!merged.has(slot)) merged.set(slot, { mat: material(part.material, name, upholstery), geos: [] });
   merged.get(slot).geos.push(clean(part.geometry).applyMatrix4(new THREE.Matrix4().multiplyMatrices(matrixOf(x, y, z, yaw), part.matrixWorld)));
  }
 }
 for (const { mat, geos } of merged.values()) {
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat); geos.forEach(g => g.dispose());
  mesh.name = 'Env props ' + mat.name.slice(4); mesh.castShadow = !mat.transparent; mesh.receiveShadow = true; group.add(mesh);
 }
 return group;
}
