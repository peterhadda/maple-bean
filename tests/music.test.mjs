import test from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES,trackAfter,INTEGRATION_NOTES} from '../music.js';

test('every category is either playable or has a documented integration note',()=>{
  for(const c of CATEGORIES){
    assert.ok(['procedural','local-files','unavailable'].includes(c.kind));
    if(c.kind==='unavailable')assert.equal(typeof INTEGRATION_NOTES[c.id],'string','missing integration note for '+c.id);
  }
});

test('trackAfter cycles forward and backward, wrapping around, and handles an empty list',()=>{
  const tracks=[{id:'a'},{id:'b'},{id:'c'}];
  assert.equal(trackAfter(tracks,'a',1).id,'b');
  assert.equal(trackAfter(tracks,'c',1).id,'a','forward wraps past the end');
  assert.equal(trackAfter(tracks,'a',-1).id,'c','backward wraps before the start');
  assert.equal(trackAfter(tracks,undefined,1).id,'a','no current track starts at the first');
  assert.equal(trackAfter([],'a',1),null);
});
