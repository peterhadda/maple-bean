import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../economy.js';

test('completed rewards are finite, replay-safe and survive a saved reload', () => {
  const now = new Date('2026-09-19T12:00:00');
  const session = { id: 'focus-1', minutes: 25, focusedSeconds: 1500, completed: true };
  let s = E.awardStudy(E.defaultEconomy(), session, now).state;
  s = E.migrateEconomy(JSON.parse(JSON.stringify(s)));
  const replay = E.awardStudy(s, session, now);
  assert.equal(replay.duplicate, true); assert.equal(replay.state.coins, s.coins);
  for (const invalid of [{...session,id:undefined}, {...session,focusedSeconds:NaN}, {...session,minutes:Infinity}]) {
    assert.equal(E.awardStudy(s, invalid, now).reward, null);
  }
  const game = { id:'game-1', result:'win', moves:7, seconds:40 };
  s = E.awardGame(s, 'xo', game, now).state;
  assert.equal(E.awardGame(s, 'xo', game, now).duplicate, true);
  for (const invalid of [{...game,id:undefined}, {...game,seconds:NaN}, {...game,result:'bogus'}]) {
    const r = E.awardGame(s,'xo',invalid,now); assert.equal(r.reward.coins,0); assert.equal(r.reward.xp,0);
  }
  assert.equal(E.awardGame(s,'snake',{id:'bad-score',seconds:20,score:NaN},now).reward.coins,0);
  const once = E.awardOnce(s,'chat','maya',now);
  const twice = E.awardOnce(once.state,'chat','maya',now);
  assert.equal(twice.reward,null); assert.equal(twice.state.today.counts.chat,1);
  assert.equal(E.awardOnce(twice.state,'chat','maya',new Date(+now-864e5)).reward,null);
  const order = E.chargeOrder(s,{drink:'Coffee',price:4},now);
  const help = E.awardHelp(order.state,order.orderId,now);
  assert.equal(help.reward.xp,E.TUNING.help.xp); assert.equal(E.awardHelp(help.state,order.orderId,now).reward,null);
  assert.equal(E.awardHelp(help.state,'fake-order',now).reward,null);
});
