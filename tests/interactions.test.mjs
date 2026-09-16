import test from 'node:test';
import assert from 'node:assert/strict';
import {verbFor,BROWSE_LINES,randomBrowseLine} from '../interactions.js';

test('contextual verbs cover every station kind, with a safe fallback',()=>{
  assert.equal(verbFor('seat').action,'Sit');
  assert.equal(verbFor('read').action,'Sit');
  assert.equal(verbFor('coffee').action,'Order');
  assert.equal(verbFor('study').action,'Sit');
  assert.equal(verbFor('talk').action,'Talk');
  assert.equal(verbFor('some-future-kind').action,'Talk','unknown kinds should fall back to talk, not crash');
});

test('browse lines are non-empty and reproducible with a given rng',()=>{
  assert.ok(BROWSE_LINES.length>1);
  assert.equal(randomBrowseLine(()=>0),BROWSE_LINES[0]);
  assert.equal(randomBrowseLine(()=>.999),BROWSE_LINES[BROWSE_LINES.length-1]);
  for(const line of BROWSE_LINES)assert.equal(typeof line,'string');
});
