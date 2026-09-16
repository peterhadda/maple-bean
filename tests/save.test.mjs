import test from 'node:test';
import assert from 'node:assert/strict';
import {KEYS,defaultSettings} from '../save.js';

test('every save key is namespaced so it cannot collide with another site',()=>{
  for(const key of Object.values(KEYS))assert.ok(key.startsWith('maple-bean-'),key+' is not namespaced');
  assert.equal(new Set(Object.values(KEYS)).size,Object.values(KEYS).length,'duplicate storage keys');
});

test('default settings are a complete, valid starting point',()=>{
  const s=defaultSettings();
  assert.ok(s.volume>=0&&s.volume<=100);
  assert.ok(['afternoon','evening','day'].includes(s.lighting));
});
