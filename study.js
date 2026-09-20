// Study Mode choreography: which physical study action a character performs at
// a given moment of a focus session. Deterministic and event-shaped (a script
// of logical steps with durations), never a random per-frame shuffle, so the
// body always looks busy with one believable task at a time.
export const SESSION_PRESETS = [25, 30, 60];

// Entering: sit → headphones picked up → on → laptop opened → typing.
export const ENTER_STEPS = [
  { id: 'pickup', activity: 'reach', seconds: .9, headphones: 'desk' },
  { id: 'phones-on', activity: 'ears', seconds: 1.3, headphones: 'hands' },
  { id: 'open-laptop', activity: 'reach', seconds: 1.0, headphones: 'head' },
];
export const EXIT_STEPS = [
  { id: 'close-laptop', activity: 'reach', seconds: 1.0, headphones: 'head' },
  { id: 'phones-off', activity: 'ears', seconds: 1.2, headphones: 'hands' },
  { id: 'set-down', activity: 'reach', seconds: .8, headphones: 'desk' },
];

// The loop inside a session. `sip` becomes `think` when there is no drink.
export const STUDY_LOOP = [
  ['type', 75], ['read', 50], ['write', 45], ['sip', 5], ['type', 65], ['think', 9],
  ['read', 40], ['adjust', 3], ['write', 40], ['type', 55], ['sip', 5], ['read', 45],
];
const LOOP_SECONDS = STUDY_LOOP.reduce((a, [, s]) => a + s, 0);
export const STRETCH_EVERY = 20 * 60, STRETCH_SECONDS = 6;

// A glance at a study partner, only for Study Together, and only between tasks.
export function studyActivityAt(elapsed, { offset = 0, hasDrink = false, partner = false } = {}) {
  if (elapsed > STRETCH_EVERY) {
    const into = elapsed % STRETCH_EVERY;
    if (into < STRETCH_SECONDS) return { activity: 'stretch', until: elapsed - into + STRETCH_SECONDS };
  }
  let t = (elapsed + offset) % LOOP_SECONDS;
  for (const [name, seconds] of STUDY_LOOP) {
    if (t < seconds) {
      let activity = name === 'adjust' ? 'ears' : name === 'sip' ? (hasDrink ? 'sip' : 'think') : name;
      if (partner && name === 'think') activity = 'glance';
      return { activity, until: elapsed + (seconds - t) };
    }
    t -= seconds;
  }
  return { activity: 'type', until: elapsed + 1 };
}

// A focus clock that counts real elapsed time (so the tab can sit in the
// background while you actually study) and excludes pauses.
export function createFocusClock(minutes, nowMs) {
  return { minutes, startedAt: nowMs, pausedAt: null, pausedMs: 0 };
}
export function focusElapsed(clock, nowMs) {
  const end = clock.pausedAt ?? nowMs;
  return Math.max(0, (end - clock.startedAt - clock.pausedMs) / 1000);
}
export function focusRemaining(clock, nowMs) { return Math.max(0, clock.minutes * 60 - focusElapsed(clock, nowMs)); }
export const pauseClock = (c, nowMs) => c.pausedAt !== null ? c : { ...c, pausedAt: nowMs };
export const resumeClock = (c, nowMs) => c.pausedAt !== null ? { ...c, pausedMs: c.pausedMs + Math.max(0, nowMs - c.pausedAt), pausedAt: null } : c;
