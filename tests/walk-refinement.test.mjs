import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {poseMatrices} from '../assets/character-kit/pose.js';
import {createBodyPoser} from '../assets/characters/body-pose.js';

function sample(male,phase,state={},sit=0){
 const legs=poseMatrices({walk:1,phase,sit});
 const body=createBodyPoser({male,rand:()=>.5}).solve({t:0,dt:1/60,still:true,root:legs.root,sit,walk:1,phase,state});
 return {legs,body};
}

test('walking arms counter-swing their own leg on both cast rigs',()=>{
 for(const male of [false,true])for(const phase of [0,.6,1.1,2,2.7,Math.PI,3.7,4.2,5.1,5.7]){
  const {legs,body}=sample(male,phase);
  for(const [index,side] of [[0,-1],[1,1]]){
   const foot=new Vector3(side*.085,.04,0).applyMatrix4(legs.legs[index].foot);
   const wrist=body.arms[side].wrist;
   assert.ok(foot.z*(wrist.z-.035)<0,`same-side arm follows foot: male=${male}, phase=${phase}, side=${side}`);
   assert.ok(Math.abs(wrist.z-.035)<.12,'arm exceeds relaxed walking arc');
  }
 }
});

test('walking arm correction preserves cup targets and seated hands',()=>{
 for(const male of [false,true])for(const [state,sit,sides] of [[{cup:true},0,[1]],[{},1,[-1,1]],[{activity:'read'},1,[-1,1]]]){
  const a=sample(male,0,state,sit).body,b=sample(male,Math.PI,state,sit).body;
  for(const side of sides){
   assert.ok(a.arms[side].wrist.distanceTo(b.arms[side].wrist)<1e-9);
   assert.ok(a.arms[side].handQ.angleTo(b.arms[side].handQ)<1e-7);
  }
 }
});
