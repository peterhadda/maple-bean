import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveStatus,statusText,STATUS_META,STATUS_IDS,EMOTES,EMOTE_IDS,emoteEmoji} from '../social.js';

test('status derivation prioritizes focus, then music, then seat/drink state',()=>{
  assert.equal(deriveStatus({focusActive:true,focusDetail:'32 min remaining',musicPlaying:true,seated:true,stationKind:'study',hasDrink:true}).id,'focus','focus wins over everything else');
  assert.equal(deriveStatus({musicPlaying:true,seated:true,stationKind:'seat',hasDrink:true}).id,'music');
  assert.equal(deriveStatus({seated:true,stationKind:'study'}).id,'studying');
  assert.equal(deriveStatus({seated:true,stationKind:'seat'}).id,'relaxing');
  assert.equal(deriveStatus({hasDrink:true}).id,'drinking');
  assert.equal(deriveStatus({}).id,'available');
});

test('every status id used by deriveStatus has display metadata',()=>{
  const cases=[{focusActive:true},{musicPlaying:true},{seated:true,stationKind:'study'},{seated:true,stationKind:'seat'},{hasDrink:true},{}];
  for(const c of cases)assert.ok(STATUS_META[deriveStatus(c).id],'missing STATUS_META for '+deriveStatus(c).id);
  assert.equal(STATUS_IDS.length,Object.keys(STATUS_META).length);
});

test('statusText renders an emoji, label, and optional detail',()=>{
  assert.equal(statusText('drinking'),'☕ Drinking Coffee');
  assert.equal(statusText('focus','32 min remaining'),'📚 Focusing — 32 min remaining');
  assert.equal(statusText('not-a-real-status'),'🟢 Available','unknown status ids fall back safely');
});

test('emote registry is small, unique, and looked up by id',()=>{
  assert.equal(new Set(EMOTE_IDS).size,EMOTE_IDS.length);
  assert.ok(EMOTES.length<=6,'keep the emote set small per the brief');
  assert.equal(emoteEmoji('wave'),'👋');
  assert.equal(emoteEmoji('not-real'),'👋','unknown emote ids fall back rather than rendering nothing');
});
