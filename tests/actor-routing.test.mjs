import test from 'node:test';
import assert from 'node:assert/strict';
import {Actor} from '../activities.js';
test('blocked actors resolve false without teleporting, and normal routes still arrive',async()=>{
 const body={x:0,z:0,angle:0},layout={width:6,depth:6,obstacles:[]};const actor=new Actor(body,layout);
 const blocked=actor.goTo(2,0);layout.obstacles.push({x:0,z:0,w:1,d:1});for(let i=0;i<240;i++)actor.update(.04);assert.equal(await blocked,false);assert.equal(body.x,0);assert.equal(actor.walking,false);
 layout.obstacles=[];const arrived=actor.goTo(2,0);for(let i=0;i<240;i++)actor.update(.04);assert.equal(await arrived,true);assert.ok(Math.abs(body.x-2)<.05);
});

test('seat is reserved while approaching and released on blocked failure',async()=>{
 const body={x:0,z:0,angle:0},layout={width:6,depth:6,obstacles:[]};const actor=new Actor(body,layout),seat={id:'chair',x:2,z:0,approach:[1.5,0],angle:0};
 const seating=actor.sitOn(seat);assert.equal(actor.reservedSeat,seat);layout.obstacles.push({x:0,z:0,w:1,d:1});for(let i=0;i<240;i++)actor.update(.04);assert.equal(await seating,false);assert.equal(actor.reservedSeat,null);
});


test('new movement cannot slide a seated or transitioning actor across the room',async()=>{
 const body={x:0,z:0,angle:0},actor=new Actor(body,{width:6,depth:6,obstacles:[]});
 for(const posture of ['seated','sitting','rising']){
  actor.posture=posture;
  assert.equal(await actor.goTo(2,0),false);assert.equal(await actor.stepTo(2,0),false);actor.push(1,0);
  assert.equal(body.x,0);assert.equal(actor.route.length,0);
 }
});
