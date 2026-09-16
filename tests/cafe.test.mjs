import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWalkable, findPath } from '../navigation.js';

const layout=JSON.parse(readFileSync(new URL('../assets/layout.json',import.meta.url)));
test('expanded café destinations are reachable without crossing furniture',()=>{
  const start={x:0,z:5.6};assert.ok(isWalkable(start.x,start.z,layout));
  assert.equal(layout.area,280);assert.equal(layout.originalArea,120);assert.equal(layout.originalObjects,112);
  for(const s of layout.stations){
    assert.ok(isWalkable(...s.approach,layout),`${s.id}: approach overlaps furniture`);
    const path=findPath(start,{x:s.approach[0],z:s.approach[1]},layout);
    assert.ok(path.length,`${s.id}: no route from entrance`);
    let prev=start;
    for(const p of path){
      for(let t=0;t<=1;t+=.1)assert.ok(isWalkable(prev.x+(p.x-prev.x)*t,prev.z+(p.z-prev.z)*t,layout),`${s.id}: path clips furniture`);
      prev=p;
    }
  }
  assert.equal(isWalkable(NaN,0,layout),false);assert.equal(isWalkable(0,Infinity,layout),false);
  assert.equal(isWalkable(11,0,layout),false);
  assert.equal(isWalkable(-3.4,-4.8,layout),false);
  assert.deepEqual(findPath(start,{x:-3.4,z:-4.8},layout),[]);
  assert.ok(isWalkable(0,8.5,layout),'entrance path must be accessible');
  assert.ok(findPath({x:0,z:8.5},start,layout).length,'must be able to enter from outside');
  assert.ok(findPath(start,{x:0,z:8.5},layout).length,'must be able to leave through the doorway');
  assert.equal(isWalkable(1.3,7,layout),false,'door jamb must block walking');
  assert.equal(isWalkable(4,7,layout),false,'windows must not be walkable');
  for(const s of layout.stations.filter(s=>s.id.startsWith('window-'))){
    assert.ok(Math.sin(s.angle)>.99,'window seats must face their table to the right');
  }
  const glb=readFileSync(new URL('../assets/cafe.glb',import.meta.url));
  const nodes=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString()).nodes;
  const tables=[[6.7,-3.55],[4,2],[-3.1,5.5],[8,5.5],[-7.4,-1.8],[.6,-1.8],[7.1,2.0],[8.5,2.0]];
  const chairs=nodes.filter(n=>/^Chair (upholstered )?seat(?:\.|$)/.test(n.name));
  assert.equal(chairs.length,16);
  for(const chair of chairs){
    const back=nodes.find(n=>n.name===chair.name.replace('upholstered seat','curved back').replace('Chair seat','Chair back'));
    const [x,,z]=chair.translation;
    const table=tables.reduce((a,b)=>Math.hypot(b[0]-x,b[1]-z)<Math.hypot(a[0]-x,a[1]-z)?b:a);
    assert.ok((x-back.translation[0])*(table[0]-x)+(z-back.translation[2])*(table[1]-z)>0,`${chair.name}: exported chair faces away from its table`);
  }
});

test('local social playtest validates chat, names and seat reservations',async()=>{
  const base=process.env.CAFE_TEST_URL||'http://127.0.0.1:4321';
  const request=async(data,session)=>{const response=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,...session&&{id:session.id,token:session.token}})});return {status:response.status,data:await response.json()};};
  const a=(await request({action:'join',name:'QA Guest A'})).data,b=(await request({action:'join',name:'QA Guest B'})).data;
  const abortA=new AbortController(),abortB=new AbortController();
  // Attach event streams so these disposable guests are removed on disconnect.
  const eventA=await fetch(`${base}/events?id=${a.id}&token=${a.token}`,{signal:abortA.signal});
  const eventB=await fetch(`${base}/events?id=${b.id}&token=${b.token}`,{signal:abortB.signal});
  try{
    assert.equal((await request({action:'chat',text:'x'.repeat(161)},a)).status,400);
    assert.equal((await request({action:'rename',name:''},a)).status,400);
    assert.equal((await request({action:'move',x:-3.4,z:-4.8,angle:0},a)).data.z,5.6);
    assert.equal((await request({action:'move',x:0,z:8.5,angle:0},a)).data.z,8.5);
    assert.equal((await request({action:'move',x:1.3,z:7,angle:0},a)).data.z,8.5);
    assert.equal((await request({action:'move',x:0,z:5.6,angle:0},a)).data.z,5.6);
    const seat=layout.stations.find(s=>s.id==='sofa');
    assert.equal((await request({action:'sit',seatId:seat.id},a)).status,409);
    for(const p of [a,b])await request({action:'move',x:seat.approach[0],z:seat.approach[1],angle:0},p);
    assert.equal((await request({action:'sit',seatId:seat.id},a)).status,200);
    assert.equal((await request({action:'sit',seatId:seat.id},b)).status,409);
    assert.equal((await request({action:'stand'},a)).data.seatId,null);
    assert.equal((await request({action:'sit',seatId:seat.id},b)).status,200);
    assert.equal((await request({action:'chat',text:'Playtest hello'},a)).status,200);
    assert.equal((await request({action:'chat',text:'Again'},a)).status,429);
    assert.equal((await fetch(base+'/original/maya.html')).status,404);
    assert.equal((await request({action:'move',x:seat.x,z:seat.z,angle:0,status:'studying'},a)).status,200);
    assert.equal((await request({action:'emote',emote:'not-a-real-emote'},a)).status,400);
    assert.equal((await request({action:'emote',emote:'wave'},a)).status,200);
    assert.equal((await request({action:'emote',emote:'wave'},a)).status,429,'emotes are rate limited like chat');
  }finally{abortA.abort();abortB.abort();await eventA.body.cancel().catch(()=>{});await eventB.body.cancel().catch(()=>{});}
});
