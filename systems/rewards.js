// Maple Bean rewards: the ONE place every payout number lives, plus the event
// ledger that makes each completed event pay exactly once and the per-category
// daily coin caps. Pure data + pure helpers over the economy state (see
// economy.js, which applies these rules). No DOM, no storage.
//
// Principles
// - Coins come from meaningful, completed activity (a finished focus session,
//   a real game, a first chat of the day), never from repeated clicks.
// - Every paying event carries an idempotency key; the ledger refuses a key it
//   has already paid:  study:<sessionId> · game:<gameId> · help:<orderId> ·
//   <kind>:<target>@<day> (once-a-day activities) · challenge:<id>@<day> · streak@<day>.
// - Each category has a daily coin cap; once reached, play continues for XP.
// - The café day only moves forward: winding the clock back never reopens a day.
//
// To retune the economy, edit TUNING only. Tests: tests/economy-ledger.test.mjs.
export const TUNING = {
  startCoins: 30,
  maxCoins: 99999,
  ledgerDays: 3,              // how long paid event keys are remembered
  historyLength: 30,          // recent payouts kept for the profile / audits

  // Daily coin caps per category. XP is not capped (it is bounded by real time).
  dailyCoinCap: { study: 400, games: 200, social: 60, cafe: 30 },

  // Focus sessions: pays by *planned* minutes, only when the session completed
  // and at least `completion` of the planned minutes were really focused.
  study: {
    completion: .98,
    minCountedMinutes: 10,    // shorter sessions: XP only, no streak, no bonus
    shortXpPerMinute: 1,
    tiers: [                  // first matching tier (highest minutes first)
      { minutes: 60, coins: 160, xp: 140 },
      { minutes: 45, coins: 120, xp: 100 },
      { minutes: 25, coins: 75, xp: 70 },
      { minutes: 10, perMinute: { coins: 2, xp: 2 } },   // 10 min → 20 coins + 20 Focus XP
    ],
    sessionBonus: { nth: 3, coins: 40 },                  // once a day, on the 3rd counted session
    streakUnlock: { days: 5, item: 'study-scarf' },       // Scholar's Scarf
  },

  // Mini-games: a real game (min moves + min seconds) pays by result; each game
  // pays at most `perGameDaily` times a day, then only `afterCapXp`.
  games: {
    perGameDaily: 6, afterCapXp: 2, xpPerCoin: .8, xpBase: 2,
    rules: {
      xo: { win: 12, draw: 6, loss: 3, minMoves: 5, minSeconds: 12 },
      memory: { win: 18, draw: 10, loss: 6, minMoves: 8, minSeconds: 20 },
      snake: { perPoint: 2, max: 40, minSeconds: 10 },
      chess: { win: 45, draw: 25, loss: 12, minMoves: 12, minSeconds: 60 },
      darts: { win: 20, draw: 10, loss: 6, minMoves: 6, minSeconds: 20 },
      cards: { win: 18, draw: 9, loss: 5, minMoves: 6, minSeconds: 20 },
    },
  },

  // Once per target per day (per plant, per regular, per drink kind).
  once: {
    water: { coins: 4, xp: 6, category: 'cafe' },
    order: { coins: 0, xp: 5, category: 'cafe' },            // first cup of each drink kind today
    chat: { coins: 5, xp: 8, category: 'social' },
    hangout: { coins: 8, xp: 12, category: 'social' },
    'study-together': { coins: 5, xp: 20, category: 'social' },
  },

  // Helping Mara make your own paid order: once per order, a few times a day.
  help: { xp: 6, daily: 5 },

  // Daily challenges (progress rules live in economy.js, keyed by id).
  challenges: [
    { id: 'focus', label: 'Focus for 30 minutes', target: 30, coins: 30 },
    { id: 'games', label: 'Play 2 mini-games', target: 2, coins: 20 },
    { id: 'water', label: 'Water 3 plants', target: 3, coins: 15 },
    { id: 'friends', label: 'Chat with 2 regulars', target: 2, coins: 15 },
  ],

  // Daily activity streak: the first completed activity of each day extends it;
  // from day 2 on it pays base + perDay × (days − 2), up to maxCoins.
  streak: { base: 5, perDay: 2, maxCoins: 15, xp: 10 },

  // Sinks (prices set by the economy; menu drink prices live in cafe-life.js).
  prices: { gift: 8 },
};

// ------------------------------------------------------------------ event ids & keys
let counter = 0;
export function eventId(now = Date.now()) { return now.toString(36) + '-' + (counter++).toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
export const eventKey = {
  study: id => 'study:' + id,
  game: id => 'game:' + id,
  help: orderId => 'help:' + orderId,
  once: (kind, target, day) => kind + ':' + target + '@' + day,
  challenge: (id, day) => 'challenge:' + id + '@' + day,
  streak: day => 'streak@' + day,
};

// ------------------------------------------------------------------ ledger (state.ledger = { key: day })
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const ledgerHas = (state, key) => !!(state.ledger && Object.hasOwn(state.ledger, key));
export function ledgerAdd(state, key, day) { return { ...state, ledger: { ...(state.ledger || {}), [key]: day } }; }
export function pruneLedger(ledger = {}, day) {
  const out = {};
  for (const [k, d] of Object.entries(ledger)) if (typeof d === 'string' && !(daysBetween(d, day) > TUNING.ledgerDays)) out[k] = d;
  return out;
}

// ------------------------------------------------------------------ daily caps (state.today.earned = { category: coins })
export function capLeft(state, category) {
  const cap = TUNING.dailyCoinCap[category];
  if (cap === undefined) return Infinity;
  return Math.max(0, cap - ((state.today?.earned || {})[category] || 0));
}
// Clamp `coins` to what the category may still pay today.
export function capCoins(state, category, coins) { const paid = Math.max(0, Math.min(coins, capLeft(state, category))); return { paid, capped: paid < coins }; }
