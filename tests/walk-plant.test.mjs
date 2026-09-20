import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {poseMatrices,WALK_STRIDE} from '../assets/character-kit/pose.js';
test('planted foot holds its floor position at NPC and player travel speeds',()=>{
 for(const speed of [.95,1.75]){
  const positions=[];
  for(let t=0;t<2*WALK_STRIDE/speed;t+=.01){
   const phase=Math.PI+t*speed*Math.PI/(2*WALK_STRIDE);
   const pose=poseMatrices({walk:1,phase});
   const foot=new Vector3(.085,.04,0).applyMatrix4(pose.legs[1].foot);
   positions.push(foot.z+t*speed);
   assert.ok(Math.abs(foot.y-.04)<.0001,'planted foot floats or sinks');
  }
  assert.ok(Math.max(...positions)-Math.min(...positions)<.001,'foot slides during planted step');
 }
});
