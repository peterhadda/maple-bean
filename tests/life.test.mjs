import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buyDrink,sipDrink,resident,updateResident} from '../cafe-life.js';
import {isWalkable} from '../navigation.js';
import {poseMatrices} from '../animation.js';
import {Vector3} from 'three';

test('purchase, ownership, funds and three sips',()=>{
  let w=buyDrink({coins:30,drink:null,sips:0},'Maple latte');
  assert.equal(w.coins,25);assert.equal(w.sips,3);
  assert.throws(()=>buyDrink(w,'Forest tea'),/Finish/);
  assert.throws(()=>buyDrink({coins:0},'Maple latte'),/Not enough/);
  assert.throws(()=>buyDrink({coins:30},'unknown'),/menu/);
  for(let i=0;i<3;i++)w=sipDrink(w);
  assert.equal(w.drink,null);assert.equal(w.sips,0);assert.equal(w.coins,25);
  assert.throws(()=>sipDrink(w),/Order/);
  const p=poseMatrices({sip:1});
  const hand=new Vector3(.192,.75,.07).applyMatrix4(p.arms[1].lower);
  const rim=hand.clone().add(new Vector3(0,.043,0).applyAxisAngle(new Vector3(1,0,0),-.4));
  assert.ok(rim.distanceTo(new Vector3(0,1.352,.14))<.055,'cup rim must meet the mouth');
});

test('staggered customers order, sit, drink, leave and return without crossing furniture',()=>{
  const layout=JSON.parse(readFileSync(new URL('../assets/layout.json',import.meta.url)));
  const people=[resident('jules',3,-.2,25),resident('claire',-3.1,1,12)];
  const seen=people.map(()=>new Set()),player={x:-9,z:0};
  for(let step=0;step<6000;step++){
    const occupied=new Set(['sofa']);for(const n of people)if(n.seat)occupied.add(n.seat.id);
    for(const [i,n] of people.entries()){
      updateResident(n,.1,layout,occupied,player);seen[i].add(n.phase);if(n.sipping)seen[i].add('drinking');
      if(n.seat){assert.notEqual(n.seat.id,'sofa');occupied.add(n.seat.id);}
      if(n.phase!=='seated')assert.ok(isWalkable(n.x,n.z,layout),`${n.id} walked through furniture in ${n.phase}`);
    }
    if(people.every(n=>n.seat))assert.notEqual(people[0].seat.id,people[1].seat.id);
  }
  for(const phases of seen)for(const phase of ['to-counter','ordering','to-seat','seated','drinking','leaving','away'])assert.ok(phases.has(phase),`missing phase ${phase}`);
  const n=people[0],before={x:n.x,z:n.z,timer:n.timer};updateResident(n,1,layout,new Set(),player,true);
  assert.deepEqual({x:n.x,z:n.z,timer:n.timer},before,'conversation should pause the routine');
});
