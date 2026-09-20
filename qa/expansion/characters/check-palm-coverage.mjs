// Actual indexed palm surfaces and finger-root vertices, evaluated in an open pose.
import fs from 'node:fs';
import {Matrix4,Vector3,Ray} from 'three';
import {createBodyPoser} from '../../../assets/characters/body-pose.js';
const dir=process.argv[2]||'assets/characters';const results=[];
for(const id of ['maya','claire','mara','jules','noah'])for(const suffix of ['','-lod']){
 const b=fs.readFileSync(`${dir}/${id}${suffix}.glb`),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(n+28);
 const acc=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView];return{a,v,o:(v.byteOffset||0)+(a.byteOffset||0)}};
 const fingerRest={};
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const tag=side<0?'L':'R',x=side*(['jules','noah'].includes(id)?.180:.191),z=.03+(1.5-i)*.0098*1.12;
  fingerRest[`finger${i}${tag}`]=new Vector3(x-side*.0005*Math.abs(i-1.5),.761-.030*1.12,z);
  fingerRest[`finger${i}${tag}Tip`]=fingerRest[`finger${i}${tag}`].clone().add(new Vector3(-side*.0035,-[.053,.059,.056,.045][i]*1.12*.54,.0006*(1.5-i)));
 }

 for(const node of j.nodes){
  if(node.mesh===undefined||node.skin===undefined)continue;
  const names=j.skins[node.skin].joints.map(i=>j.nodes[i].name.replaceAll('.',''));
  for(const p of j.meshes[node.mesh].primitives){
   if(j.materials[p.material]?.name!=='Skin')continue;
   const pa=acc(p.attributes.POSITION),ji=acc(p.attributes.JOINTS_0),we=acc(p.attributes.WEIGHTS_0),ia=acc(p.indices);
   const sz=ia.a.componentType===5125?4:2,read=sz===4?'readUInt32LE':'readUInt16LE',jsz=ji.a.componentType===5121?1:2,jread=jsz===1?'readUInt8':'readUInt16LE';
   const pts=Array.from({length:pa.a.count},(_,i)=>new Vector3(...[0,4,8].map(k=>bin.readFloatLE(pa.o+i*(pa.v.byteStride||12)+k))));
   const weight=(i,name)=>{let w=0;for(let q=0;q<4;q++)if(names[bin[jread](ji.o+i*(ji.v.byteStride||4*jsz)+q*jsz)]===name)w+=bin.readFloatLE(we.o+i*(we.v.byteStride||16)+q*4);return w};
   const tris={L:[],R:[]},used=new Set();
   for(let k=0;k<ia.a.count;k+=3){const t=[0,1,2].map(q=>bin[read](ia.o+(k+q)*sz));t.forEach(i=>used.add(i));for(const tag of ['L','R'])if(t.every(i=>weight(i,'hand'+tag)>.99&&pts[i].y<.805&&pts[i].y>.71))tris[tag].push(t.map(i=>pts[i]));}
   if(tris.L.length<20)continue;
   for(const [tag,side] of [['L',-1],['R',1]])for(const shape of ['open','fist','grip']){
   const pose=createBodyPoser({male:['jules','noah'].includes(id),rand:()=>.5,fingerRest}).solve({t:0,dt:0,still:true,root:new Matrix4(),sit:0,walk:0,phase:0,state:{wave:true,handShape:shape}});
   for(let f=0;f<4;f++){
    const roots=[...used].filter(i=>weight(i,`finger${f}${tag}`)>.99),top=Math.max(...roots.map(i=>pts[i].y));
    const ring=roots.filter(i=>pts[i].y>top-.003),inverse=pose.arms[side].hand.clone().invert();let inside=0;
    for(const i of ring){
     const point=pts[i].clone().applyMatrix4(pose.fingers[`finger${f}${tag}`]).applyMatrix4(inverse);
     const ray=new Ray(point,new Vector3(1,.371,.237).normalize()),hit=new Vector3(),dist=[];
     for(const tri of tris[tag])if(ray.intersectTriangle(...tri,false,hit)){const d=point.distanceTo(hit);if(d>1e-7&&!dist.some(v=>Math.abs(v-d)<1e-6))dist.push(d);}
     if(dist.length%2)inside++;
    }
    results.push({id:id+suffix,side:tag,shape,finger:f,inside,total:ring.length,ratio:inside/ring.length});
   }
  }
 }
}
}
const failures=results.filter(r=>r.ratio<1);console.log(JSON.stringify({checks:results.length,failures},null,2));if(process.argv.includes('--assert')&&failures.length)process.exitCode=1;
