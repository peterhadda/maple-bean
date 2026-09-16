import test from 'node:test';
import assert from 'node:assert/strict';
import {createSequenceGame,attemptStep,GAMES} from '../minigames.js';

test('sequence game advances only on the correct next step, in order',()=>{
  let g=createSequenceGame(GAMES['coffee-making'].steps);
  assert.equal(g.index,0);assert.equal(g.done,false);
  g=attemptStep(g,'coffee'); // wrong - cup comes first
  assert.equal(g.index,0);assert.equal(g.mistakes,1,'a wrong step does not advance, just counts as a mistake');
  g=attemptStep(g,'cup');assert.equal(g.index,1);
  g=attemptStep(g,'coffee');assert.equal(g.index,2);
  g=attemptStep(g,'milk');assert.equal(g.index,3);
  g=attemptStep(g,'flavor');assert.equal(g.index,4);
  assert.equal(g.done,false);
  g=attemptStep(g,'serve');assert.equal(g.index,5);assert.equal(g.done,true);
});

test('a finished game ignores further attempts',()=>{
  let g=createSequenceGame(GAMES['coffee-making'].steps);
  for(const s of g.steps)g=attemptStep(g,s.id);
  assert.equal(g.done,true);
  const before=g;
  g=attemptStep(g,'cup');
  assert.deepEqual(g,before,'no state change once done');
});

test('every registered game has a non-empty, uniquely-keyed step list',()=>{
  for(const [id,game] of Object.entries(GAMES)){
    assert.ok(game.steps.length>1,id+' needs more than one step to be a sequence');
    const ids=game.steps.map(s=>s.id);
    assert.equal(new Set(ids).size,ids.length,id+' has duplicate step ids');
  }
});
