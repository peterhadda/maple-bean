// Maple Coins, XP and rewards. Pure functions over a plain JSON state so the
// rules can be unit tested and the save format stays inspectable. Every number
// lives in systems/rewards.js (TUNING); this file applies it.
//
// Anti-farming principles (audit: qa/expansion/economy/AUDIT.md):
// - Study pays only completed sessions whose planned minutes were really
//   focused (pauses excluded); ending early pays nothing; a daily study-coin
//   cap stops AFK farming; sessions under 10 minutes earn XP only.
// - Mini-games pay for a real game (minimum moves and duration), 6 paid games
//   per game per day and a daily games-coin cap; after that, XP only.
// - Social and café activities pay once per target per day, never per click.
// - Every paying event has an idempotency key in `state.ledger`, so one
//   completed event can never pay twice (double calls, double clicks, retries).
// - The café day only moves forward: winding the clock back never reopens caps.
import { TUNING, eventId, eventKey, ledgerHas, ledgerAdd, pruneLedger, capCoins } from './systems/rewards.js';
export { TUNING, eventId };

export const ECONOMY_VERSION = 2;
export const START_COINS = TUNING.startCoins;
export const MIN_REWARD_MINUTES = TUNING.study.minCountedMinutes;
export const GAME_DAILY_CAP = TUNING.games.perGameDaily;
export const GAME_REWARDS = TUNING.games.rules;
export const ONCE_A_DAY = TUNING.once;

export const dayKey = (now = new Date()) => {
  const d = new Date(now); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function defaultEconomy() {
  return { v: ECONOMY_VERSION, coins: START_COINS, xp: 0, day: null, today: {}, streak: { days: 0, lastDay: null, sessions: 0 }, activity: { days: 0, lastDay: null, best: 0 }, unlocked: [], ledger: {}, history: [] };
}
// Levels grow gently: 100 XP for level 2, then +60 per level.
export function levelFor(xp) { let level = 1, need = 100, left = xp; while (left >= need) { left -= need; level++; need += 60; } return { level, into: left, need }; }

// A new café day starts when the calendar moves forward. A clock set backwards
// stays in the latest day already seen, so caps and once-a-day flags never reopen.
function roll(state, now) {
  const day = dayKey(now);
  if (state.day === day || (state.day && day < state.day)) return { ...state, today: { ...state.today } };
  return { ...state, day, today: {}, ledger: pruneLedger(state.ledger, day) };
}
function pay(state, coins, xp, reason, now, category) {
  const earned = state.today.earned || {}, today = category ? { ...state.today, earned: { ...earned, [category]: (earned[category] || 0) + coins } } : state.today;
  const history = [{ reason, coins, xp, at: +now }, ...(state.history || [])].slice(0, TUNING.historyLength);
  return { ...state, today, coins: Math.min(TUNING.maxCoins, state.coins + coins), xp: state.xp + xp, history };
}
export function spend(state, price) {
  if (!Number.isInteger(price) || price < 0) throw new Error('Invalid price.');
  if (state.coins < price) throw new Error('Not enough Maple Coins yet.');
  return { ...state, coins: state.coins - price };
}

// ---------------------------------------------------------------- daily activity streak
// The first completed activity of each café day extends the streak; from day 2
// on it pays a small bonus (TUNING.streak), folded into that activity's reward.
function markActive(state, now) {
  const day = state.day, a = { days: 0, lastDay: null, best: 0, ...(state.activity || {}) };
  if (a.lastDay === day || ledgerHas(state, eventKey.streak(day))) return { state, bonus: null };
  a.days = a.lastDay && daysBetween(a.lastDay, day) === 1 ? a.days + 1 : 1; a.lastDay = day; a.best = Math.max(a.best || 0, a.days);
  let s = ledgerAdd({ ...state, activity: a }, eventKey.streak(day), day);
  if (a.days < 2) return { state: s, bonus: null };
  const T = TUNING.streak, coins = Math.min(T.maxCoins, T.base + T.perDay * (a.days - 2));
  s = pay(s, coins, T.xp, 'Café streak · day ' + a.days, now, 'streak');
  return { state: s, bonus: { id: 'activity-streak', label: '🔥 ' + a.days + '-day café streak', coins, xp: T.xp, days: a.days } };
}
function finish(s, reward, now) {
  const { state, bonus } = markActive(s, now);
  if (!bonus) return { state, reward };
  return { state, reward: { ...reward, coins: reward.coins + bonus.coins, xp: reward.xp + bonus.xp, streak: bonus, bonuses: [...(reward.bonuses || []), bonus] } };
}
export function activityStreakView(state, now = new Date()) {
  const a = state.activity; if (!a?.lastDay) return 0;
  return daysBetween(a.lastDay, dayKey(now)) > 1 ? 0 : a.days;
}

// ---------------------------------------------------------------- study
export function studyReward(minutes) {
  const T = TUNING.study;
  for (const t of T.tiers) if (minutes >= t.minutes) return t.perMinute ? { coins: Math.round(minutes * t.perMinute.coins), xp: Math.round(minutes * t.perMinute.xp) } : { coins: t.coins, xp: t.xp };
  return { coins: 0, xp: Math.round(minutes * T.shortXpPerMinute) };
}
// `session` = {id, minutes (planned), focusedSeconds (real elapsed, excluding pauses), completed}
export function awardStudy(state, session, now = new Date()) {
  let s = roll(state, now);
  const T = TUNING.study, focused = session.focusedSeconds / 60, key = eventKey.study(session.id);
  if (typeof session.id !== 'string' || !session.id || !session.completed || !Number.isFinite(session.minutes) || !(session.minutes > 0) || !Number.isFinite(focused) || focused < session.minutes * T.completion) return { state: s, reward: null };
  if (ledgerHas(s, key)) return { state: s, reward: null, duplicate: true };
  s = ledgerAdd(s, key, s.day);
  const base = studyReward(session.minutes), bonuses = [], counted = session.minutes >= T.minCountedMinutes;
  let coins = base.coins; const xp = base.xp, day = s.day, streak = { ...s.streak };
  if (counted) {
    if (streak.lastDay !== day) { streak.days = streak.lastDay && daysBetween(streak.lastDay, day) === 1 ? streak.days + 1 : 1; streak.lastDay = day; }
    streak.sessions = (streak.sessions || 0) + 1;
    s.today.studySessions = (s.today.studySessions || 0) + 1;
    if (s.today.studySessions === T.sessionBonus.nth) { coins += T.sessionBonus.coins; bonuses.push({ id: 'three-sessions', label: T.sessionBonus.nth + ' sessions bonus', coins: T.sessionBonus.coins }); }
  }
  let unlocked = s.unlocked || [];
  if (streak.days >= T.streakUnlock.days && !unlocked.includes(T.streakUnlock.item)) { unlocked = [...unlocked, T.streakUnlock.item]; bonuses.push({ id: 'five-day', label: T.streakUnlock.days + '-day streak: Scholar’s scarf unlocked' }); }
  // Minutes count up to the planned length (a backgrounded tab can overshoot).
  s = { ...s, streak, unlocked, today: { ...s.today, studyMinutes: (s.today.studyMinutes || 0) + Math.round(Math.min(focused, session.minutes)) } };
  const cap = capCoins(s, 'study', coins);
  if (cap.capped) bonuses.push({ id: 'cap', label: 'Daily study coins reached — XP still counts' });
  s = pay(s, cap.paid, xp, 'Focus session', now, 'study');
  const reward = { coins: cap.paid, xp, streakDays: streak.days, bonuses, ...(cap.capped && { capped: true }) };
  return counted ? finish(s, reward, now) : { state: s, reward };
}
export function streakView(state, now = new Date()) {
  const s = state.streak || { days: 0, lastDay: null };
  if (!s.lastDay) return 0;
  return daysBetween(s.lastDay, dayKey(now)) > 1 ? 0 : s.days;
}

// ---------------------------------------------------------------- mini-games
// `id` identifies one played game; the same id never pays twice.
export function awardGame(state, game, { result, moves = 0, seconds = 0, score = 0, id } = {}, now = new Date()) {
  let s = roll(state, now);
  const G = TUNING.games, rule = G.rules[game];
  if (!rule) throw new Error('Unknown game.');
  if (typeof id !== 'string' || !id || !Number.isFinite(seconds) || seconds < 0 || !Number.isInteger(moves) || moves < 0 || !Number.isInteger(score) || score < 0 || (game !== 'snake' && !['win', 'draw', 'loss'].includes(result))) return { state: s, reward: { coins: 0, xp: 0, note: 'Incomplete game result.' } };
  const key = eventKey.game(id);
  if (ledgerHas(s, key)) return { state: s, reward: { coins: 0, xp: 0, note: 'Already counted.' }, duplicate: true };
  s = ledgerAdd(s, key, s.day);
  const played = s.today['games:' + game] || 0;
  s.today['games:' + game] = played + 1; s.today.gamesPlayed = (s.today.gamesPlayed || 0) + 1; s.today.gamesCounted = s.today.gamesCounted || 0;
  if (seconds < rule.minSeconds || (rule.minMoves && moves < rule.minMoves)) return { state: s, reward: { coins: 0, xp: 0, note: 'Too quick to count — play a full game for coins.' } };
  s.today.gamesCounted++;
  if (played >= G.perGameDaily) return finish(pay(s, 0, G.afterCapXp, game + ' · for fun', now, 'games'), { coins: 0, xp: G.afterCapXp, note: 'Daily game rewards reached. Just for fun now!' }, now);
  const coins = game === 'snake' ? Math.min(rule.max, score * rule.perPoint) : rule[result] ?? 0;
  const xp = Math.round(coins * G.xpPerCoin) + G.xpBase, cap = capCoins(s, 'games', coins);
  s = pay(s, cap.paid, xp, game + ' · ' + (result || score), now, 'games');
  return finish(s, { coins: cap.paid, xp, ...(cap.capped && { capped: true, note: 'Daily game coins reached — XP still counts.' }) }, now);
}

// ---------------------------------------------------------------- café & social, once per target per day
export function awardOnce(state, kind, target, now = new Date()) {
  let s = roll(state, now);
  const rule = TUNING.once[kind];
  if (!rule) throw new Error('Unknown activity.');
  if (typeof target !== 'string' || !target.trim()) return { state: s, reward: null };
  const flag = kind + ':' + target, key = eventKey.once(kind, target, s.day);
  if (s.today[flag] || ledgerHas(s, key)) return { state: s, reward: null };
  s.today.counts = { ...(s.today.counts || {}), [kind]: ((s.today.counts || {})[kind] || 0) + 1 };
  s.today[flag] = true; s = ledgerAdd(s, key, s.day);
  const cap = capCoins(s, rule.category, rule.coins);
  s = pay(s, cap.paid, rule.xp, kind, now, rule.category);
  return finish(s, { coins: cap.paid, xp: rule.xp, ...(cap.capped && { capped: true }) }, now);
}

// ---------------------------------------------------------------- ordering at the counter
// Mara's "first one's on the house" is honoured once a day, only for a player
// who cannot afford the drink.
export function freeDrinkAvailable(state, cheapest, now = new Date()) { const s = roll(state, now); return s.coins < cheapest && !s.today.freeDrink; }
export function chargeOrder(state, { drink, price, free = false }, now = new Date()) {
  let s = roll(state, now);
  if (!Number.isInteger(price) || price < 0) throw new Error('Invalid price.');
  const onHouse = !!free && !s.today.freeDrink && s.coins < price;
  if (!onHouse) s = spend(s, price);
  const n = (s.today.orders || 0) + 1, orderId = s.day + '#' + n;
  s = ledgerAdd({ ...s, today: { ...s.today, orders: n, ...(onHouse && { freeDrink: true }) } }, 'order:' + orderId, s.day);
  s.history = [{ reason: String(drink) + (onHouse ? ' · on the house' : ''), coins: onHouse ? 0 : -price, xp: 0, at: +now }, ...(s.history || [])].slice(0, TUNING.historyLength);
  return { state: s, orderId, free: onHouse };
}
// Helping Mara make your own paid order: once per order, a few times a day.
export function awardHelp(state, orderId, now = new Date()) {
  let s = roll(state, now);
  const T = TUNING.help, key = eventKey.help(orderId);
  if (!orderId || !ledgerHas(s, 'order:' + orderId) || ledgerHas(s, key) || (s.today.helps || 0) >= T.daily) return { state: s, reward: null };
  s = ledgerAdd(s, key, s.day); s.today.helps = (s.today.helps || 0) + 1;
  return { state: pay(s, 0, T.xp, 'Helped Mara', now, 'cafe'), reward: { coins: 0, xp: T.xp } };
}

// ---------------------------------------------------------------- daily challenges
const PROGRESS = {
  focus: s => s.today.studyMinutes || 0,
  games: s => s.today.gamesCounted ?? s.today.gamesPlayed ?? 0,
  water: s => Object.keys(s.today).filter(k => k.startsWith('water:')).length,
  friends: s => Object.keys(s.today).filter(k => k.startsWith('chat:')).length,
};
export const CHALLENGES = TUNING.challenges.map(c => ({ ...c, progress: PROGRESS[c.id] || (() => 0) }));
export function challengesView(state, now = new Date()) {
  const s = roll(state, now);
  return CHALLENGES.map(c => ({ id: c.id, label: c.label, target: c.target, coins: c.coins, progress: Math.min(c.target, c.progress(s)), claimed: !!s.today['claimed:' + c.id] }));
}
export function claimChallenge(state, id, now = new Date()) {
  let s = roll(state, now);
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) throw new Error('Unknown challenge.');
  const key = eventKey.challenge(id, s.day);
  if (s.today['claimed:' + id] || ledgerHas(s, key)) return { state: s, reward: null, duplicate: true };
  if (c.progress(s) < c.target) throw new Error('Not finished yet.');
  s.today['claimed:' + id] = true; s = ledgerAdd(s, key, s.day);
  return { state: pay(s, c.coins, c.coins, 'Daily: ' + c.label, now, 'challenge'), reward: { coins: c.coins, xp: c.coins } };
}
// What each capped category has paid today, for the profile and QA.
export function dailySummary(state, now = new Date()) {
  const s = roll(state, now), earned = s.today.earned || {};
  return Object.fromEntries(Object.entries(TUNING.dailyCoinCap).map(([k, cap]) => [k, { earned: earned[k] || 0, cap }]));
}

// ---------------------------------------------------------------- save validation & migration
export function validEconomy(e) {
  return e && Number.isInteger(e.coins) && e.coins >= 0 && e.coins <= TUNING.maxCoins && Number.isFinite(e.xp) && e.xp >= 0 && typeof e.today === 'object' && e.streak && Array.isArray(e.unlocked);
}
// Repair any saved economy (v1, v2, partly corrupted or missing) into the
// current shape field by field. A readable coin balance is never discarded.
// `validUnlocks` (reward-only item ids) filters tampered unlocks.
export function migrateEconomy(raw, { legacyWallet = null, validUnlocks = null } = {}) {
  const d = defaultEconomy(), e = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : null, num = v => typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  const int = (v, hi) => Number.isFinite(num(v)) ? Math.min(hi, Math.max(0, Math.floor(num(v)))) : null, day = v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? v : null;
  let coins = int(e.coins, TUNING.maxCoins);
  if (coins === null) { const w = legacyWallet?.coins; coins = Number.isInteger(w) && w >= 0 && w <= 1000 ? Math.max(d.coins, w) : d.coins; }
  const st = obj(e.streak) || {}, ac = obj(e.activity) || {}, ledger = {};
  for (const [k, v] of Object.entries(obj(e.ledger) || {})) if (day(v)) ledger[k] = v;
  const unlocked = Array.isArray(e.unlocked) ? [...new Set(e.unlocked.filter(id => typeof id === 'string' && (!validUnlocks || validUnlocks.includes(id))))] : [];
  return {
    v: ECONOMY_VERSION, coins, xp: int(e.xp, 1e9) ?? 0, day: day(e.day), today: day(e.day) && obj(e.today) ? e.today : {},
    streak: { days: int(st.days, 1e5) ?? 0, lastDay: day(st.lastDay), sessions: int(st.sessions, 1e7) ?? 0 },
    activity: { days: int(ac.days, 1e5) ?? 0, lastDay: day(ac.lastDay), best: int(ac.best, 1e5) ?? 0 },
    unlocked, ledger, history: Array.isArray(e.history) ? e.history.filter(obj).slice(0, TUNING.historyLength) : [],
  };
}
