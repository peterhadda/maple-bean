// Smooth the exported rig's centre seam and pelvis-to-spine transition.
import fs from 'node:fs';const smooth=(a,b,v)=>{let t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
fs.mkdirSync('qa/expansion/characters/hip-continuity-source',{recursive:true});
for(const id of ['maya','claire','mara','jules','noah'])for(const suffix of ['','-lod']){
 const file=`assets/characters/${id}${suffix}.glb`,src=`qa/expansion/characters/hip-continuity-source/${id}${suffix}.glb`;if(!fs.existsSync(src))fs.copyFileSync(file,src);const bytes=fs.readFileSync(src),n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(n+28),seen=new Set();const acc=i=>{let a=j.accessors[i],v=j.bufferViews[a.bufferView];return{a,v,o:(v.byteOffset||0)+(a.byteOffset||0)}};let count=0;
 for(const node of j.nodes){if(node.mesh===undefined||node.skin===undefined)continue;const names=j.skins[node.skin].joints.map(i=>j.nodes[i].name.replaceAll('.',''));for(const p of j.meshes[node.mesh].primitives){if(seen.has(p.attributes.POSITION))continue;seen.add(p.attributes.POSITION);const pa=acc(p.attributes.POSITION),ji=acc(p.attributes.JOINTS_0),we=acc(p.attributes.WEIGHTS_0),sz=ji.a.componentType===5121?1:2,read=sz===1?'readUInt8':'readUInt16LE',write=sz===1?'writeUInt8':'writeUInt16LE';
 for(let i=0;i<pa.a.count;i++){const po=pa.o+i*(pa.v.byteStride||12),x=bin.readFloatLE(po),y=bin.readFloatLE(po+4);if(y<.66||y>=1.0)continue;const jo=ji.o+i*(ji.v.byteStride||4*sz),wo=we.o+i*(we.v.byteStride||16);let eligible=true;for(let k=0;k<4;k++)if(bin.readFloatLE(wo+k*4)>.00001&&!['hips','spine','chest','thighL','thighR'].includes(names[bin[read](jo+k*sz)]))eligible=false;if(!eligible)continue;
 let values;if(y<.88){const h=smooth(.74,.88,y),r=smooth(-.048,.048,x);values=[['thighL',(1-h)*(1-r)],['thighR',(1-h)*r],['hips',h]];}else{const s=smooth(.88,1.0,y),c=smooth(.94,1.2,y);values=[['hips',1-s],['spine',s*(1-c)],['chest',s*c]];}
 for(let k=0;k<4;k++){const [name,w]=values[k]||['hips',0];bin[write](names.indexOf(name),jo+k*sz);bin.writeFloatLE(w,wo+k*4)}count++;
 }
 }}fs.writeFileSync(file,bytes);console.log(id+suffix,count);
}
