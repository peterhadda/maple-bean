import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3,Euler} from 'three';
import {createBodyPoser,handQuaternion} from '../assets/characters/body-pose.js';
const base={dt:1/60,root:new Matrix4(),sit:0,walk:0,phase:0};
test('sipping brings the tilted cup rim to the authored mouth height for both body rigs',()=>{
 for(const male of [false,true]){
  const p=createBodyPoser({male,rand:()=>.5}).solve({...base,t:0,still:true,state:{cup:true,sipping:true}});
  // Runtime cup attachment and authored lip landmarks, in character space.
  const center=new Vector3((male?.180:.191)-.047,.735,.034).applyMatrix4(p.arms[1].hand);
  const lip=new Vector3(0,male?1.384:1.378,.13).applyMatrix4(p.head);let nearest=Infinity;
  for(let i=0;i<64;i++){
   const a=i/64*Math.PI*2,rim=new Vector3(.035*Math.cos(a),.039,.035*Math.sin(a)).applyEuler(new Euler(-1.05,Math.PI/2,0)).add(center);
   nearest=Math.min(nearest,rim.distanceTo(lip));
  }
  assert.ok(nearest<.015,`cup stopped below lips: ${nearest}`);
 }
});
test('both hand bases remain valid when palm and fingers are parallel',()=>{
 for(const side of [-1,1])for(const dir of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]){
  const q=handQuaternion(side,dir,dir);assert.ok(Math.abs(q.length()-1)<1e-9);
  assert.ok(new Vector3(0,-1,0).applyQuaternion(q).distanceTo(dir)<1e-8);
 }
});
test('all cast wrists turn smoothly between opposing activity poses and darts clear the face',()=>{
 for(const id of ['maya','claire','mara','noah','jules']){
  const p=createBodyPoser({male:['noah','jules'].includes(id),rand:()=>.5});let prev=p.solve({...base,t:0,still:true,state:{}}),t=0;
  for(const state of [{wave:true},{},{activity:'stretch'},{cup:true},{cup:true,sipping:true},{activity:'type'},{activity:'reach',reach:{x:-.14,y:.92,z:.3}},{activity:'aim'},{activity:'throw'},{}]){
   for(let i=0;i<90;i++){
    const next=p.solve({...base,t:t+=1/60,state});
    for(const side of [-1,1]){
     assert.ok(prev.arms[side].handQ.angleTo(next.arms[side].handQ)<.87,`${id}: wrist snapped`);
     assert.ok(next.arms[side].hand.elements.every(Number.isFinite));
    }prev=next;
   }
   if(state.activity==='aim')assert.ok(prev.arms[-1].wrist.x<-.19,`${id}: aiming hand obscures eye`);
  }
 }
});

test('open finger roots overlap the tapered palm instead of floating below it',()=>{
 for(const male of [false,true]){
  const fingerRest={};for(const side of [-1,1])for(let i=0;i<4;i++){
   const tag=side<0?'L':'R',x=side*(male?.180:.191),z=.03+(1.5-i)*.0098*1.12;
   fingerRest[`finger${i}${tag}`]=new Vector3(x-side*.0005*Math.abs(i-1.5),.761-.030*1.12,z);
   fingerRest[`finger${i}${tag}Tip`]=fingerRest[`finger${i}${tag}`].clone().add(new Vector3(-side*.0035,-[.053,.059,.056,.045][i]*1.12*.54,.0006*(1.5-i)));
  }
  const p=createBodyPoser({male,rand:()=>.5,fingerRest}).solve({...base,t:0,still:true,state:{wave:true}});
  for(let i=0;i<4;i++){
   const point=fingerRest[`finger${i}L`].clone().applyMatrix4(p.fingers[`finger${i}L`]).applyMatrix4(p.arms[-1].hand.clone().invert());
   const x=-(male?.180:.191)+.001;
   const distance=((point.x-x)/(.0115*1.12))**2+((point.y-.761)/(.037*1.12))**2+((point.z-.03)/(.0205*1.12))**2;
   assert.ok(distance<1,`finger ${i} root is detached: ${distance}`);
  }
 }
});
