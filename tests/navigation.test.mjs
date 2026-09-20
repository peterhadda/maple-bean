import test from 'node:test';
import assert from 'node:assert/strict';
import {moveOnFloor,findPath,followRoute} from '../navigation.js';

test('movement sweeps furniture instead of tunneling across it on delayed frames',()=>{
  const layout={width:10,depth:10,obstacles:[{x:0,z:0,w:.05,d:8}]};
  const body={x:-1,z:0};
  moveOnFloor(body,2,0,layout);
  assert.ok(body.x<-.265,'thin obstacle must stop the swept movement');
  moveOnFloor(body,NaN,Infinity,layout);
  assert.ok(Number.isFinite(body.x)&&Number.isFinite(body.z));
  assert.deepEqual(findPath({x:NaN,z:0},{x:1,z:0},layout),[]);
  const route=findPath({x:-1,z:0},{x:1,z:0},layout);
  assert.ok(route.some(p=>Math.abs(p.z)>=4.24),'route must go around the wall');
});

test('live people stop routes and a blocked walker detours without overlap',()=>{
  const body={x:-2,z:0},other={x:0,z:0};
  const layout={width:10,depth:10,obstacles:[],people:[body,other]};
  const route=findPath(body,{x:2,z:0},layout);
  for(let i=0;i<1500&&route.length;i++){
    followRoute(body,route,.02,1,layout);
    assert.ok(Math.hypot(body.x-other.x,body.z-other.z)>=.49999);
  }
  assert.equal(route.length,0,'stationary people should be routed around');
  assert.ok(Math.hypot(body.x-2,body.z)<.05);
  body.x=.1;body.z=0;moveOnFloor(body,.1,0,layout);
  assert.ok(body.x>.1,'an overlapping spawn can move out instead of locking');
});
