import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'), pub=path.join(root,'web-release/out');
const glb=file=>{const b=fs.readFileSync(file);assert.equal(b.readUInt32LE(0),0x46546c67);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
for(const id of ['maya','claire','noah','mara','jules'])for(const lod of ['','-lod']){
 const before=glb(path.join(root,`assets/characters/${id}${lod}.glb`));
 const after=glb(path.join(pub,`assets/characters/${id}${lod}.glb`));
 const joints=j=>new Set(j.skins.flatMap(s=>s.joints.map(i=>j.nodes[i].name)));
 assert.deepEqual([...joints(after)].sort(),[...joints(before)].sort(),id+' skeleton');
 const morphs=j=>new Set(j.meshes.flatMap(m=>m.extras?.targetNames||[]));
 for(const k of morphs(before))assert.ok(morphs(after).has(k),id+' lost '+k);
 for(const m of after.meshes)assert.ok(!m.weights?.some(w=>w!==0),id+' nonneutral expression');
 for(const m of ['Skin','Eyes','Hair'])assert.ok(after.materials.some(x=>x.name===m),id+' material '+m);
 assert.ok(!after.nodes.some(n=>n.name==='Icosphere'),id+' helper leaked');
}
assert.equal(fs.readFileSync(path.join(root,'assets/visual-world.js'),'utf8'),fs.readFileSync(path.join(pub,'assets/visual-world.js'),'utf8'),'Detailed cafe must remain exact');
const {soloApi,connectSolo}=await import('../web-release/out/solo-session.js');
const layout=JSON.parse(fs.readFileSync(path.join(pub,'assets/layout.json')));
const player=await soloApi({action:'join',name:'Preview'},layout);assert.equal(player.name,'Preview');
const seat=layout.stations.find(s=>s.kind==='seat'&&s.approach&&!s.seats);assert.ok(seat);
assert.equal((await soloApi({action:'sit',seatId:seat.id},layout)).seatId,seat.id);
assert.equal((await soloApi({action:'stand'},layout)).seatId,null);
const reply=await soloApi({action:'npc-chat',npc:'claire',text:'Hello',context:{}},layout);assert.ok(reply.reply);
const {group}=await soloApi({action:'group-create',name:'Coffee'},layout);let update;connectSolo(g=>update=g,()=>{});
await soloApi({action:'group-invite',groupId:group.id,npc:'claire'},layout);assert.equal(update.npcs[0].id,'claire');
console.log('PASS: 10 character skeleton/morph/material exports; exact cafe details; solo join, sit, stand, NPC chat and group interactions.');
