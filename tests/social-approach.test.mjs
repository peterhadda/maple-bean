import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { socialSpot, socialArrived } from '../systems/social-approach.js';
const layout=JSON.parse(readFileSync(new URL('../assets/layout.json',import.meta.url)));
test('social arrivals stay on the public side of the bar and separate overlapping actors',()=>{
  const mara={x:-4.7,z:-5.75}, start={x:0,z:5.6};
  const spot=socialSpot(start,mara,layout,true);
  assert.ok(spot); assert.equal(spot.z,-3.7); assert.ok(socialArrived(spot,mara,spot,true));
  assert.equal(socialArrived(start,mara,spot,true),false);
  const target={x:0,z:1}; const apart=socialSpot(target,target,layout);
  assert.ok(apart); assert.ok(socialArrived(apart,target,apart));
  assert.equal(socialArrived(target,target,apart),false);
  const blocked={...layout,obstacles:[{x:0,z:0,w:100,d:100}]};
  assert.equal(socialSpot(start,mara,blocked,true),null);
});
