import fs from 'node:fs';
for(const id of ['maya','claire','mara','jules','noah'])for(const suffix of ['','-lod']){
 const path=`assets/characters/${id}${suffix}.glb`,b=fs.readFileSync(path),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(n+28),seen=new Set();let changed=0;
 const acc=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView];return {a,v,off:(v.byteOffset||0)+(a.byteOffset||0)}};
 for(const node of j.nodes){if(node.mesh===undefined||node.skin===undefined)continue;const bones=j.skins[node.skin].joints.map(k=>j.nodes[k].name.replaceAll('.',''));for(const p of j.meshes[node.mesh].primitives){
 if(seen.has(p.attributes.POSITION))continue;seen.add(p.attributes.POSITION);
 const pos=acc(p.attributes.POSITION),ji=acc(p.attributes.JOINTS_0),we=acc(p.attributes.WEIGHTS_0),js=ji.a.componentType===5121?1:2,jread=js===1?'readUInt8':'readUInt16LE',jwrite=js===1?'writeUInt8':'writeUInt16LE';
 if(we.a.componentType!==5126)throw Error('Unexpected packed weights');
 for(let i=0;i<pos.a.count;i++){const o=pos.off+i*(pos.v.byteStride||12),x=bin.readFloatLE(o),y=bin.readFloatLE(o+4);if(y>.825||y<.72||Math.abs(x)<.14)continue;
 const jo=ji.off+i*(ji.v.byteStride||4*js),wo=we.off+i*(we.v.byteStride||16),tag=x<0?'L':'R',lower=bones.indexOf('lower'+tag),hand=bones.indexOf('hand'+tag),weights=[];let amount=0;
 for(let k=0;k<4;k++){const joint=bin[jread](jo+k*js),w=bin.readFloatLE(wo+k*4);if(joint===lower){const t=Math.max(0,Math.min(1,(y-.785)/.04)),take=w*(1-t*t*(3-2*t));amount+=take;weights.push([joint,w-take]);}else weights.push([joint,w]);}
 if(amount<=.00001)continue;let h=weights.find(v=>v[0]===hand);if(h)h[1]+=amount;else {const empty=weights.findIndex(v=>v[1]<.00001);if(empty<0)throw Error('No free skin influence');weights[empty]=[hand,amount];}
 for(let k=0;k<4;k++){bin[jwrite](weights[k][0],jo+k*js);bin.writeFloatLE(weights[k][1],wo+k*4);}changed++;
 }
 }}fs.writeFileSync(path,b);console.log(id+suffix,changed);
}