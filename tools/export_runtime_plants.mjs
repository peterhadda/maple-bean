// Export the existing runtime plant algorithms without replacing their geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const source=fs.readFileSync('assets/visual-world.js','utf8');
const audit=JSON.parse(fs.readFileSync('refinement/audit.json','utf8'));
const context=new Proxy({}, {get:()=>()=>{}});
const document={createElement:()=>({getContext:()=>context})};
const organic=source.slice(source.indexOf('function addOrganicPlants('),source.indexOf('// Small, deterministic surface maps'));
const broad=source.slice(source.indexOf('export function broadLeafGeometry('),source.indexOf('export function addVisualDetails(')).replace('export ','');
const scene=new THREE.Scene();
const plants=audit.filter(o=>/^(Plant pot|Terracotta plant pot)/.test(o.name)).map(o=>({x:o.loc[0],y:o.loc[2]+o.dim[2]/2-.025,z:-o.loc[1],r:o.dim[0]/2}));
new Function('THREE','mergeGeometries','document','scene','plants',broad+organic+'\naddOrganicPlants(scene,plants);')(THREE,mergeGeometries,document,scene,plants);
const crowns=audit.filter(o=>/Maple Hollow tree canopy/.test(o.name)).map(o=>({p:new THREE.Vector3(o.loc[0],o.loc[2],-o.loc[1]),s:new THREE.Vector3(o.dim[0]/2,o.dim[2]/2,o.dim[1]/2)}));
const canopy=source.slice(source.indexOf(' const canopyGeo='),source.indexOf('function addOrganicPlants')).trim().replace(/}\s*$/,'');
new Function('THREE','scene','crowns','V',canopy)(THREE,scene,crowns,THREE.Vector3);
const records=[];
scene.traverse(o=>{
 if(!o.isMesh||o.isInstancedMesh&&!o.count)return;
 const g=o.geometry,m=o.material,record={name:o.name||'Organic stems',position:Array.from(g.attributes.position.array),index:g.index?Array.from(g.index.array):null,uv:g.attributes.uv?Array.from(g.attributes.uv.array):null,color:g.attributes.color?Array.from(g.attributes.color.array):null,material:{color:m.color.toArray(),roughness:m.roughness,veins:!!m.map},instances:[]};
 for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
  const matrix=new THREE.Matrix4(),color=new THREE.Color(1,1,1);
  if(o.isInstancedMesh){o.getMatrixAt(i,matrix);if(o.instanceColor)o.getColorAt(i,color);}else matrix.copy(o.matrixWorld);
  record.instances.push({matrix:matrix.toArray(),color:color.toArray()});
 }
 records.push(record);
});
assert(plants.length>0);assert.equal(records[0].instances.length,plants.length*35);assert.equal(records[0].position.length,65*3);
fs.writeFileSync('refinement/runtime_plants.json',JSON.stringify({source:'assets/visual-world.js: addOrganicPlants + broadLeafGeometry + layered crowns',plants:plants.length,crowns:crowns.length,records}));
console.log(JSON.stringify({plants:plants.length,crowns:crowns.length,meshes:records.length,instances:records.reduce((s,r)=>s+r.instances.length,0)}));
