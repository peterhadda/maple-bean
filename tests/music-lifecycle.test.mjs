import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralProvider, createLocalFilesProvider } from '../music.js';
import { createFocusClock, pauseClock, resumeClock, focusElapsed } from '../study.js';
test('music keeps chosen volume across playback/pause and surfaces local decode failures', async () => {
  const gains=[]; const ctx={currentTime:0,createGain(){ const g={gain:{value:0,linearRampToValueAtTime(v){this.value=v},cancelScheduledValues(){},setValueAtTime(v){this.value=v}},connect(){return this},disconnect(){}};gains.push(g);return g;},createOscillator(){return {frequency:{},connect(){return this},start(){},stop(){}}}};
  const p=createProceduralProvider(ctx,{});p.setVolume(.2);p.play(p.tracks[0]);assert.equal(gains[0].gain.value,.12);p.pause();p.setVolume(.3);assert.equal(gains[0].gain.value,0);p.resume();assert.equal(gains[0].gain.value,.18);
  const local=createLocalFilesProvider({play:()=>Promise.reject(new Error('decode')),pause(){},removeAttribute(){}});await assert.rejects(local.play({url:'blob:bad'}),/decode/);
  const clock=pauseClock(createFocusClock(25,0),0);assert.equal(focusElapsed(clock,60000),0);assert.equal(focusElapsed(resumeClock(clock,60000),61000),1);
});
