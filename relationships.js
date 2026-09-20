// Friendships with the café regulars. Points grow through real shared time and
// are rate-limited per kind, so repeating one action cannot fast-forward a bond.
export const LEVELS = [
  { id: 'stranger', label: 'Stranger', min: 0 },
  { id: 'acquaintance', label: 'Acquaintance', min: 20 },
  { id: 'friend', label: 'Friend', min: 60 },
  { id: 'close', label: 'Close Friend', min: 130 },
];
// Crush is optional, only for regulars who are guests (not staff at work), and
// only once you are already friends. It never replaces the friendship track.
export const CRUSH_ELIGIBLE = ['claire', 'noah', 'jules'];
export const GAINS = {
  chat: { points: 2, cooldown: 20, daily: 12 },
  question: { points: 2, cooldown: 20, daily: 8 },
  hangout: { points: 6, cooldown: 300, daily: 3 },
  game: { points: 6, cooldown: 60, daily: 5 },
  'study-together': { points: 12, cooldown: 600, daily: 3 },
  gift: { points: 8, cooldown: 3600, daily: 1 },
  compliment: { points: 3, cooldown: 120, daily: 3 },
};

export function defaultBond() { return { points: 0, crush: 0, crushOn: false, last: {}, day: null, today: {}, memory: [] }; }
export function levelOf(points) { let l = LEVELS[0]; for (const x of LEVELS) if (points >= x.min) l = x; return l; }
export function nextLevel(points) { return LEVELS.find(x => x.min > points) || null; }

export function gain(bond, kind, nowMs = Date.now()) {
  const rule = GAINS[kind];
  if (!rule) throw new Error('Unknown interaction.');
  const day = new Date(nowMs).toDateString();
  const b = { ...bond, last: { ...bond.last }, today: bond.day === day ? { ...bond.today } : {}, day };
  if (nowMs - (b.last[kind] || 0) < rule.cooldown * 1000 || (b.today[kind] || 0) >= rule.daily) return { bond: b, gained: 0 };
  const before = levelOf(b.points);
  b.points += rule.points; b.last[kind] = nowMs; b.today[kind] = (b.today[kind] || 0) + 1;
  if (b.crushOn) b.crush = Math.min(100, b.crush + Math.round(rule.points / 2));
  const after = levelOf(b.points);
  return { bond: b, gained: rule.points, levelUp: after.id !== before.id ? after : null };
}
export function canCrush(id, bond) { return CRUSH_ELIGIBLE.includes(id) && levelOf(bond.points).min >= LEVELS[2].min; }
export function setCrush(id, bond, on) {
  if (on && !canCrush(id, bond)) throw new Error('Get to know them as a friend first.');
  return { ...bond, crushOn: !!on };
}
export function crushLabel(bond) {
  if (!bond.crushOn) return null;
  return bond.crush >= 60 ? 'Sweet on each other' : bond.crush >= 25 ? 'A little flustered' : 'A quiet crush';
}
// A few remembered facts help the NPC's replies feel continuous.
export function remember(bond, fact) {
  const memory = [fact, ...(bond.memory || []).filter(m => m !== fact)].slice(0, 8);
  return { ...bond, memory };
}
