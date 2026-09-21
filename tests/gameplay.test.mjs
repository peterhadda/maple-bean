import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../economy.js';
import * as R from '../relationships.js';
import * as Shop from '../shop.js';
import * as Study from '../study.js';
import * as XO from '../games/xo.js';
import * as Mem from '../games/memory.js';
import * as Snake from '../games/snake.js';
import * as Chess from '../games/chess.js';
import * as Darts from '../games/darts.js';
import * as Cards from '../games/cards.js';

const seeded = (s = 7) => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
const day = new Date('2026-09-18T10:00:00');

test('study rewards only completed, real sessions and build streaks', () => {
  let s = E.defaultEconomy();
  const cancelled = E.awardStudy(s, { id: E.eventId(), minutes: 30, focusedSeconds: 900, completed: false }, day);
  assert.equal(cancelled.reward, null, 'cancelling pays nothing');
  const rushed = E.awardStudy(s, { id: E.eventId(), minutes: 30, focusedSeconds: 60, completed: true }, day);
  assert.equal(rushed.reward, null, 'a session that did not really last pays nothing');
  let r = E.awardStudy(s, { id: E.eventId(), minutes: 30, focusedSeconds: 1800, completed: true }, day);
  assert.equal(r.reward.coins, 75); assert.equal(r.reward.streakDays, 1); s = r.state;
  r = E.awardStudy(s, { id: E.eventId(), minutes: 60, focusedSeconds: 3600, completed: true }, day); assert.equal(r.reward.coins, 160); s = r.state;
  r = E.awardStudy(s, { id: E.eventId(), minutes: 30, focusedSeconds: 1800, completed: true }, day); assert.equal(r.reward.coins, 75 + 40, 'every third session earns a bonus'); s = r.state;
  for (let d = 1; d < 5; d++) s = E.awardStudy(s, { id: E.eventId(), minutes: 30, focusedSeconds: 1800, completed: true }, new Date(+day + d * 864e5)).state;
  assert.equal(s.streak.days, 5); assert.ok(s.unlocked.includes('study-scarf'), '5-day streak unlocks a cosmetic');
  assert.equal(E.streakView(s, new Date(+day + 7 * 864e5)), 0, 'a missed day resets the visible streak');
});

test('mini-game and activity rewards resist farming', () => {
  let s = E.defaultEconomy();
  const quick = E.awardGame(s, 'xo', { id: E.eventId(), result: 'win', moves: 2, seconds: 3 }, day);
  assert.equal(quick.reward.coins, 0);
  s = quick.state;
  let total = 0;
  for (let i = 0; i < 10; i++) { const r = E.awardGame(s, 'xo', { id: E.eventId(), result: 'win', moves: 7, seconds: 40 }, day); s = r.state; total += r.reward.coins; }
  assert.equal(total, 12 * (E.GAME_DAILY_CAP - 1), 'daily cap per game (the too-quick game still counted as played)');
  let w = E.awardOnce(E.defaultEconomy(), 'water', 'plant-a', day);
  assert.equal(w.reward.coins, 4);
  assert.equal(E.awardOnce(w.state, 'water', 'plant-a', day).reward, null, 'watering the same plant again pays nothing');
  assert.throws(() => E.spend(E.defaultEconomy(), 999), /Not enough/);
  const view = E.challengesView(w.state, day); assert.equal(view.find(c => c.id === 'water').progress, 1);
  assert.throws(() => E.claimChallenge(w.state, 'water', day), /Not finished/);
  assert.deepEqual(E.levelFor(0), { level: 1, into: 0, need: 100 }); assert.equal(E.levelFor(160).level, 2);
});

test('relationships progress with cooldowns and gate the optional crush', () => {
  let b = R.defaultBond(), t = 1e12;
  assert.equal(R.levelOf(0).id, 'stranger');
  let g = R.gain(b, 'chat', t); b = g.bond; assert.equal(g.gained, 2);
  assert.equal(R.gain(b, 'chat', t + 1000).gained, 0, 'chat cooldown');
  assert.throws(() => R.setCrush('claire', b, true), /friend/);
  for (let i = 0; i < 40; i++) { t += 4e6; b = R.gain(b, ['study-together', 'game', 'hangout', 'gift'][i % 4], t).bond; }
  assert.equal(R.levelOf(b.points).id, 'close');
  assert.equal(R.canCrush('mara', b), false, 'staff at work are not crush options');
  b = R.setCrush('claire', b, true); assert.ok(R.crushLabel(b));
});

test('wardrobe purchases persist ownership and equip only owned items', () => {
  let w = Shop.defaultWardrobe(), e = { ...E.defaultEconomy(), coins: 200 };
  assert.ok(Shop.validWardrobe(w));
  // The starter tier — everything the café already had — comes with the
  // account, so it can be worn straight away without spending anything.
  assert.ok(w.owned.includes('top-maple'));
  assert.equal(Shop.equip(w, 'top-maple').equipped.top, 'top-maple');
  assert.throws(() => Shop.buy(w, e, 'top-maple'), /already/);
  // Premium pieces still have to be bought.
  assert.throws(() => Shop.equip(w, 'top-plum'), /Buy/);
  ({ wardrobe: w, economy: e } = Shop.buy(w, e, 'top-plum')); assert.equal(e.coins, 150);
  assert.throws(() => Shop.buy(w, e, 'top-plum'), /already/);
  w = Shop.equip(w, 'top-plum'); assert.equal(Shop.lookFor(w).top, '#7d4f6b');
  assert.throws(() => Shop.buy(w, e, 'study-scarf'), /Earned/);
  w = Shop.equip(w, 'study-scarf', ['study-scarf']); assert.equal(Shop.lookFor(w).props[0].prop, 'scarf');
});

test('study choreography is a logical, deterministic sequence', () => {
  const seen = []; let last = null;
  for (let t = 0; t < 600; t += 1) { const a = Study.studyActivityAt(t, { hasDrink: true }).activity; if (a !== last) seen.push(a); last = a; }
  assert.deepEqual(seen.slice(0, 5), ['type', 'read', 'write', 'sip', 'type']);
  assert.ok(seen.length < 20, 'activities hold for tens of seconds, not a few frames');
  assert.equal(Study.studyActivityAt(Study.STRETCH_EVERY + 1).activity, 'stretch');
  assert.equal(Study.studyActivityAt(100, { hasDrink: false }).activity === 'sip', false);
  let c = Study.createFocusClock(30, 0); c = Study.pauseClock(c, 60000); c = Study.resumeClock(c, 120000);
  assert.equal(Study.focusElapsed(c, 180000), 120, 'pauses do not count as focus');
});

test('XO detects wins and the regular never misses a forced block at full skill', () => {
  let g = XO.createXO();
  for (const c of [0, 3, 1, 4, 2]) g = XO.play(g, c);
  assert.equal(g.winner, 'X'); assert.deepEqual(g.line, [0, 1, 2]);
  assert.throws(() => XO.play(g, 8), /over/);
  let h = XO.play(XO.play(XO.createXO(), 0), 4); h = XO.play(h, 1);
  assert.equal(XO.bestMove(h, 1), 2, 'O blocks the top row');
});

test('memory pairs score, misses pass the turn, the regular uses what it saw', () => {
  let g = Mem.createMemory(seeded());
  const [a, b] = [0, g.cards.findIndex((c, i) => i > 0 && c.symbol === g.cards[0].symbol)];
  g = Mem.settle(Mem.flip(Mem.flip(g, a), b)); assert.equal(g.scores[0], 1); assert.equal(g.turn, 0);
  const miss = g.cards.findIndex(c => c.matched === null), other = g.cards.findIndex(c => c.matched === null && c.symbol !== g.cards[miss].symbol);
  g = Mem.settle(Mem.flip(Mem.flip(g, miss), other)); assert.equal(g.turn, 1);
  const seen = new Set([miss, other, ...g.cards.filter(c => c.symbol === g.cards[miss].symbol).map(c => c.id)]);
  const first = Mem.npcPick(g, seen, 1); g = Mem.flip(g, first);
  const second = Mem.npcPick(g, seen, 1); assert.equal(g.cards[second].symbol, g.cards[first].symbol, 'perfect recall finds the pair');
});

test('snake grows on beans, ignores reversals and ends on walls', () => {
  let s = Snake.createSnake(8, 6, seeded());
  s = { ...s, food: [s.body[0][0] + 1, s.body[0][1]] };
  s = Snake.step(s, seeded()); assert.equal(s.score, 1); assert.equal(s.body.length, 4);
  assert.equal(Snake.turn(s, 'left').queued.length, 0, 'cannot reverse');
  for (let i = 0; i < 10 && !s.over; i++) s = Snake.step({ ...s, food: [0, 0] });
  assert.ok(s.over);
});

test('chess generates legal moves (perft), mates and special moves', () => {
  const perft = (st, d) => d === 0 ? 1 : Chess.legalMoves(st).reduce((n, m) => n + perft(Chess.applyMove(st, m), d - 1), 0);
  const start = Chess.createChess();
  assert.equal(perft(start, 1), 20); assert.equal(perft(start, 2), 400); assert.equal(perft(start, 3), 8902);
  const kiwi = Chess.createChess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R');
  assert.equal(perft(kiwi, 1), 48, 'castling, pins and en passant setup (Kiwipete)'); assert.equal(perft(kiwi, 2), 2039);
  let g = Chess.createChess(); const sq = n => (8 - +n[1]) * 8 + Chess.FILES.indexOf(n[0]);
  for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) g = Chess.move(g, sq(f), sq(t)).state;
  assert.deepEqual(Chess.status(g), { over: true, result: 'checkmate', winner: 'b' }, "fool's mate");
  const ai = Chess.chooseMove(Chess.createChess('6k1/5ppp/8/8/8/8/5PPP/R5K1'), { jitter: 0 });
  assert.equal(Chess.squareName(ai.to), 'a8', 'the regular spots a back-rank mate');
});

test('darts score comes from the landing point', () => {
  assert.equal(Darts.scoreAt(0, 0).points, 50);
  assert.equal(Darts.scoreAt(0, .103).points, 60, 'triple 20 at the top');
  assert.equal(Darts.scoreAt(0, -.166).points, 6, 'double 3 at the bottom');
  assert.equal(Darts.scoreAt(.3, 0).points, 0);
  const hit = Darts.throwDart({ x: 0, y: .103 }, .5, () => .5); assert.equal(hit.points, 60);
  let g = Darts.createDarts(); for (let i = 0; i < 18; i++) g = Darts.recordThrow(g, { points: i < 9 ? 20 : 5 });
  assert.equal(g.done, true); assert.equal(Darts.dartsWinner(g), 0);
});

test('maple eights follows matching, wild eights and drawing', () => {
  let g = Cards.createEights(seeded(3));
  assert.equal(g.hands[0].length, 7); assert.notEqual(Cards.top(g).rank, '8');
  const bad = g.hands[0].find(c => !Cards.canPlay(g, c));
  if (bad) assert.throws(() => Cards.playCard(g, bad.id), /Match/);
  for (let turns = 0; turns < 400 && g.winner === null; turns++) {
    const a = Cards.npcTurn(g, seeded(turns));
    g = a.type === 'play' ? Cards.playCard(g, a.card.id, a.suit) : a.type === 'draw' ? Cards.draw(g) : Cards.pass(g);
  }
  assert.notEqual(g.winner, null, 'a game between two regulars finishes');
});
