import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Mesh, BufferGeometry, Float32BufferAttribute } from 'three';
import { poseMatrices, applyPose } from '../animation.js';

test('feet stay on the floor when seated, and planted steps do not penetrate it',()=>{
  for(const seatHeight of [.44,.54,.585]){
    const p=poseMatrices({sit:1,seatHeight});
    for(const leg of p.legs){
      const sole=new Vector3(.15,0,.03).applyMatrix4(leg.foot);
      assert.ok(Math.abs(sole.y)<.0001,`seated sole is ${sole.y} above floor`);
      const up=new Vector3(0,1,0).transformDirection(leg.foot);assert.ok(up.y>.9999,'foot tilts through the floor');
    }
  }
  for(let phase=0;phase<Math.PI*2;phase+=.1){
    const p=poseMatrices({walk:1,phase});
    for(const leg of p.legs){const sole=new Vector3(.15,0,.03).applyMatrix4(leg.foot);assert.ok(sole.y>=-.001&&sole.y<.10);}
  }
  const before=poseMatrices({walk:1,phase:.5}),after=poseMatrices({walk:1,phase:1});
  const ankle=p=>new Vector3(.085,.04,0).applyMatrix4(p.legs[1].foot);
  assert.ok(ankle(after).z>ankle(before).z,'the lifted foot must swing forward');
  const mid=poseMatrices({walk:1,phase:Math.PI/2});
  assert.ok(mid.drop<.01,'mid-step must rise out of the crouch');
  const hip=new Vector3(-.085,.8,0).applyMatrix4(mid.root);
  const planted=new Vector3(-.085,.04,0).applyMatrix4(mid.legs[0].foot);
  assert.ok(hip.distanceTo(planted)>.75,'the support leg must nearly straighten');
  const pelvisAt=phase=>{
    const p=poseMatrices({walk:1,phase});
    return new Vector3(0,.8,0).applyMatrix4(p.root).applyMatrix4(p.pelvis);
  };
  assert.ok(pelvisAt(Math.PI/2).x<-.02&&pelvisAt(Math.PI*1.5).x>.02,'hips must shift toward each supporting leg');
  const resting=poseMatrices({walk:1,sit:1});
  assert.deepEqual(new Vector3(.1,.8,0).applyMatrix4(resting.pelvis),new Vector3(.1,.8,0),'seated hips must not sway');
});

test('low fingers follow the arm instead of leg motion, and poses never accumulate drift',()=>{
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([.18,.68,.04],3));geometry.setAttribute('normal',new Float32BufferAttribute([0,0,1],3));
  const mesh=new Mesh(geometry),entry={mesh,region:'arm',side:1,positions:geometry.attributes.position.array.slice(),normals:geometry.attributes.normal.array.slice()};
  applyPose([entry],poseMatrices({wave:1}));assert.ok(geometry.attributes.position.getY(0)>1.25,'waving hand did not rise');
  const wave=geometry.attributes.position.array.slice();for(let i=0;i<30;i++)applyPose([entry],poseMatrices({wave:1}));assert.deepEqual(geometry.attributes.position.array,wave);
  applyPose([entry],poseMatrices());assert.ok(Math.abs(geometry.attributes.position.getY(0)-.68)<.001,'hand did not return to bind pose');
  applyPose([entry],poseMatrices({sit:1}));assert.ok(geometry.attributes.position.getY(0)>.5,'fingers followed the feet when sitting');
});
