import test from 'node:test';
import assert from 'node:assert/strict';
import {createFocusTimer,tickFocusTimer,pauseFocusTimer,resumeFocusTimer,formatRemaining,formatMinutes,defaultStats,recordSession,statsForDisplay} from '../focus.js';

test('focus timer counts down, pauses, and finishes at zero',()=>{
  let t=createFocusTimer(25);
  assert.equal(t.totalSeconds,1500);assert.equal(t.remaining,1500);assert.equal(t.done,false);
  t=tickFocusTimer(t,60);assert.equal(t.remaining,1440);
  t=pauseFocusTimer(t);const before=t.remaining;
  t=tickFocusTimer(t,60);assert.equal(t.remaining,before,'paused timer must not tick');
  t=resumeFocusTimer(t);
  t=tickFocusTimer(t,1440);assert.equal(t.remaining,0);assert.equal(t.done,true);
  t=tickFocusTimer(t,60);assert.equal(t.remaining,0,'finished timer never goes negative');
});

test('remaining time and minutes format for the countdown and stats display',()=>{
  assert.equal(formatRemaining(1500),'25:00');
  assert.equal(formatRemaining(65),'1:05');
  assert.equal(formatRemaining(-5),'0:00');
  assert.equal(formatMinutes(45),'45m');
  assert.equal(formatMinutes(92),'1h 32m');
});

test('session stats accumulate per day and track a daily streak',()=>{
  let stats=defaultStats();
  const day1=new Date('2026-03-05T10:00:00Z');
  stats=recordSession(stats,25,day1);
  assert.equal(stats.todayMinutes,25);assert.equal(stats.todaySessions,1);assert.equal(stats.streak,1);
  stats=recordSession(stats,45,day1);
  assert.equal(stats.todayMinutes,70);assert.equal(stats.todaySessions,2);assert.equal(stats.streak,1,'same-day sessions do not bump the streak');
  const day2=new Date('2026-03-06T09:00:00Z');
  stats=recordSession(stats,60,day2);
  assert.equal(stats.todayMinutes,60);assert.equal(stats.todaySessions,1);assert.equal(stats.streak,2,'consecutive day extends the streak');
  const day4=new Date('2026-03-08T09:00:00Z');
  stats=recordSession(stats,25,day4);
  assert.equal(stats.streak,1,'a skipped day resets the streak');
  assert.equal(stats.totalSessions,4);
  const tooShort=recordSession(stats,0.2,day4);
  assert.deepEqual(tooShort,stats,'sub-minute sessions are not recorded');
});

test('display view zeroes today after midnight without mutating storage',()=>{
  const stats={lastDay:'2026-03-05',todayMinutes:70,todaySessions:2,totalSessions:2,streak:1};
  const sameDay=statsForDisplay(stats,new Date('2026-03-05T23:00:00Z'));
  assert.equal(sameDay.todayMinutes,70);
  const nextDay=statsForDisplay(stats,new Date('2026-03-06T09:00:00Z'));
  assert.equal(nextDay.todayMinutes,0);assert.equal(nextDay.streak,1,'streak survives until a day is actually skipped');
  const skipped=statsForDisplay(stats,new Date('2026-03-08T09:00:00Z'));
  assert.equal(skipped.streak,0,'a fully skipped day shows the streak as broken');
});
