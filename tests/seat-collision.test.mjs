import test from 'node:test';
import assert from 'node:assert/strict';
import {Actor} from '../activities.js';
function seated(){
 const body={x:0,z:0,angle:0},guest={x:0,z:.7,visible:true};
 const layout={width:10,depth:10,obstacles:[],people:[body,guest]},actor=new Actor(body,layout);
 actor.posture='seated';actor.sit=1;actor.seat={id:'chair',x:0,z:0,angle:0,approach:[0,1]};actor.entry={x:0,z:1,front:true};
 return {body,guest,actor};
}
function tick(f,n){for(let i=0;i<n;i++){f.actor.update(.025);assert.ok(Math.hypot(f.body.x-f.guest.x,f.body.z-f.guest.z)>=.4999,'seat transition overlaps a guest');}}
test('blocked chair exit returns to seated without passing through a guest',async()=>{
 const f=seated();let result;f.actor.standUp().then(ok=>result=ok);tick(f,320);await Promise.resolve();
 assert.equal(result,false);assert.equal(f.actor.posture,'seated');assert.equal(f.actor.seat.id,'chair');assert.ok(Math.hypot(f.body.x,f.body.z)<.03);
});
test('transient chair-exit blocker clears and standing completes naturally',async()=>{
 const f=seated();let result;f.actor.standUp().then(ok=>result=ok);tick(f,16);f.guest.x=2;tick(f,160);await Promise.resolve();
 assert.equal(result,true);assert.equal(f.actor.posture,'stand');assert.equal(f.actor.seat,null);assert.ok(Math.abs(f.body.z-1)<.03);
});
import {resident, updateResident, STAND_SECONDS} from '../cafe-life.js';
test('ambient regulars do not slide through people when leaving a chair',()=>{
 const n=resident('noah',0,0,0),guest={x:0,z:.7,visible:true};
 const seat={id:'chair',kind:'seat',x:0,z:0,angle:0,approach:[0,1]};
 Object.assign(n,{phase:'standing-up',timer:STAND_SECONDS,seat,entry:{x:0,z:1,front:true},sit:1});
 const layout={width:10,depth:10,obstacles:[],people:[n,guest],stations:[seat,{kind:'coffee',approach:[3,3]}]};
 for(let i=0;i<320;i++){
  updateResident(n,.025,layout,new Set(),guest);
  assert.ok(Math.hypot(n.x-guest.x,n.z-guest.z)>=.4999,'ambient standing-up overlaps player');
 }
 assert.equal(n.phase,'seated');assert.equal(n.seat.id,'chair');
});
test('a blocked sitting transition returns to its entry and releases the seat',async()=>{
 const f=seated();f.body.z=1;f.guest.z=.3;f.actor.posture='stand';f.actor.seat=null;f.actor.sit=0;
 const seat={id:'chair',x:0,z:0,angle:0,approach:[0,1]};
 let result;f.actor.sitOn(seat).then(ok=>result=ok);await Promise.resolve();tick(f,320);await Promise.resolve();await Promise.resolve();
 assert.equal(result,false);assert.equal(f.actor.posture,'stand');assert.equal(f.actor.seat,null);assert.equal(f.actor.reservedSeat,null);assert.ok(Math.abs(f.body.z-1)<.03);
});
test('standing during lowering preserves motion continuity and resolves both callers',async()=>{
 const f=seated();f.guest.x=3;f.body.z=1;f.actor.posture='stand';f.actor.seat=null;f.actor.sit=0;
 const seat={id:'chair',x:0,z:0,angle:0,approach:[0,1]};let sitResult,standResult;
 f.actor.sitOn(seat).then(v=>sitResult=v);await Promise.resolve();
 for(let i=0;i<12;i++)f.actor.update(.025);
 const before=f.actor.sit;assert.ok(before>0&&before<.5);f.actor.standUp().then(v=>standResult=v);
 f.actor.update(.025);assert.ok(Math.abs(f.actor.sit-before)<.05,'standing request snaps the lowering pose');
 for(let i=0;i<160;i++){const prev=f.actor.sit;f.actor.update(.025);assert.ok(Math.abs(f.actor.sit-prev)<.06);await Promise.resolve();}
 assert.notEqual(sitResult,undefined,'original sit caller hangs');assert.equal(standResult,true);assert.equal(f.actor.posture,'stand');assert.equal(f.actor.seat,null);
});
test('a blocked ambient chair sidestep releases its reservation and retries a route',()=>{
 const n=resident('noah',0,0,0),guest={x:0,z:.5,visible:true};
 Object.assign(n,{phase:'sidling-out',seat:{id:'chair',approach:[0,1]},entry:{x:0,z:0},sit:0});
 const layout={width:24,depth:30,obstacles:[],people:[n,guest],stations:[{kind:'coffee',approach:[3,3]}]};
 for(let i=0;i<65;i++)updateResident(n,.025,layout,new Set(),guest);
 assert.notEqual(n.phase,'sidling-out');assert.equal(n.seat,null);assert.equal(n.entry,null);
 assert.ok(Math.hypot(n.x-guest.x,n.z-guest.z)>=.4999);
});
