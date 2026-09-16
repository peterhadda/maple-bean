// FocusTimer + lightweight session stats. Pure functions only, so the
// countdown and streak math can be unit tested without a browser or a clock.
export const PRESET_MINUTES = [25, 45, 60];

export function createFocusTimer(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  return { totalSeconds, remaining: totalSeconds, paused: false, done: false };
}
export function tickFocusTimer(timer, dt) {
  if (timer.paused || timer.done) return timer;
  const remaining = Math.max(0, timer.remaining - dt);
  return { ...timer, remaining, done: remaining <= 0 };
}
export const pauseFocusTimer = timer => ({ ...timer, paused: true });
export const resumeFocusTimer = timer => ({ ...timer, paused: false });
export function formatRemaining(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}
export function formatMinutes(totalMinutes) {
  const m = Math.round(totalMinutes);
  if (m < 60) return m + 'm';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

// A session only counts toward stats once it actually completes or the player
// chooses to end it having focused a meaningful stretch (avoids a 2-second
// "session" polluting a streak).
const MIN_COUNTED_MINUTES = 1;

export function defaultStats() {
  return { lastDay: null, todayMinutes: 0, todaySessions: 0, totalSessions: 0, streak: 0 };
}
export function recordSession(stats, minutesFocused, now = new Date()) {
  if (minutesFocused < MIN_COUNTED_MINUTES) return stats;
  const day = now.toISOString().slice(0, 10);
  const next = { ...stats };
  if (next.lastDay === day) {
    next.todayMinutes += minutesFocused;
    next.todaySessions += 1;
  } else {
    const wasYesterday = next.lastDay && (Date.parse(day) - Date.parse(next.lastDay)) === 86400000;
    next.streak = wasYesterday ? next.streak + 1 : 1;
    next.lastDay = day;
    next.todayMinutes = minutesFocused;
    next.todaySessions = 1;
  }
  next.totalSessions += 1;
  return next;
}
// Stats read on a later day than lastDay should show 0 for "today" without
// mutating storage - a session recompute, not a background job.
export function statsForDisplay(stats, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  if (stats.lastDay === day) return stats;
  const brokeStreak = stats.lastDay && (Date.parse(day) - Date.parse(stats.lastDay)) > 86400000;
  return { ...stats, todayMinutes: 0, todaySessions: 0, streak: brokeStreak ? 0 : stats.streak };
}
