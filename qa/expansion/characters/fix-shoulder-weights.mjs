import fs from 'node:fs';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
for(const id of ['maya','claire','mara','jules','noah'])for(const suffix of ['','-lod']){
 const file=`assets/characters/${id}${suffix}.glb`,bytes=fs.readFileSync(file),n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(n+28),seen=new Set();
 const acc=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView];return {a,v,off:(v.byteOffset||0)+(a.byteOffset||0)}};
 let changed=0;for(const node of j.nodes){if(node.mesh===undefined||node.skin===undefined)continue;const bones=j.skins[node.skin].joints.map(k=>j.nodes[k].name.replaceAll('.',''));for(const p of j.meshes[node.mesh].primitives){
 if(seen.has(p.attributes.POSITION)||!['Skin','Wardrobe'].includes(j.materials[p.material]?.name))continue;seen.add(p.attributes.POSITION);const pos=acc(p.attributes.POSITION),ji=acc(p.attributes.JOINTS_0),we=acc(p.attributes.WEIGHTS_0),sz=ji.a.componentType===5121?1:2,read=sz===1?'readUInt8':'readUInt16LE',write=sz===1?'writeUInt8':'writeUInt16LE';
 for(let i=0;i<pos.a.count;i++){const o=pos.off+i*(pos.v.byteStride||12),x=bin.readFloatLE(o),y=bin.readFloatLE(o+4),width=['noah','jules'].includes(id)?1.34:1;if(y<1.03||y>1.28||Math.abs(x)<.02*width||Math.abs(x)>.23*width)continue;const jo=ji.off+i*(ji.v.byteStride||4*sz),wo=we.off+i*(we.v.byteStride||16),upper=bones.indexOf('upper'+(x<0?'L':'R')),chest=bones.indexOf('chest'),values=[];let total=0;for(let k=0;k<4;k++){const bone=bin[read](jo+k*sz),w=bin.readFloatLE(wo+k*4);if(bone===upper||bone===chest)total+=w;else if(w>0)values.push([bone,w]);}if(total<.1)continue;
 const a=smooth(.105*width,.20*width,Math.abs(x)),blend=smooth(1.03,1.11,y)*(1-smooth(1.24,1.28,y));let old=0;for(let k=0;k<4;k++)if(bin[read](jo+k*sz)===upper)old+=bin.readFloatLE(wo+k*4);const u=old*(1-blend)+total*a*blend;values.push([upper,u],[chest,total-u]);if(values.length>4)continue;while(values.length<4)values.push([0,0]);for(let k=0;k<4;k++){bin[write](values[k][0],jo+k*sz);bin.writeFloatLE(values[k][1],wo+k*4);}changed++;
 }
 }}fs.writeFileSync(file,bytes);console.log(id+suffix,changed);
}