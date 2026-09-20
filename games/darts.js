// Darts scored from where the dart actually lands on a standard board.
// Board-local coordinates in metres: +x right, +y up, centre (0,0).
// Radii follow a regulation board (inner bull 6.35 mm ... double ring 170 mm).
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const RINGS = { innerBull: .00635, outerBull: .0159, tripleIn: .099, tripleOut: .107, doubleIn: .162, doubleOut: .170 };

export function scoreAt(x, y) {
  const r = Math.hypot(x, y);
  if (r <= RINGS.innerBull) return { points: 50, label: 'Bullseye!', ring: 'bull' };
  if (r <= RINGS.outerBull) return { points: 25, label: 'Outer bull', ring: 'outer-bull' };
  if (r > RINGS.doubleOut) return { points: 0, label: 'Missed the board', ring: 'miss' };
  // 20 sits at the top; sectors are 18° wide and run clockwise.
  const angle = (Math.atan2(x, y) * 180 / Math.PI + 360 + 9) % 360;
  const sector = SECTORS[Math.floor(angle / 18)];
  if (r >= RINGS.tripleIn && r <= RINGS.tripleOut) return { points: sector * 3, label: 'Triple ' + sector, ring: 'triple', sector };
  if (r >= RINGS.doubleIn) return { points: sector * 2, label: 'Double ' + sector, ring: 'double', sector };
  return { points: sector, label: String(sector), ring: 'single', sector };
}
// Aim wobble: a smooth figure-eight sway whose size shrinks with focus (holding
// steady) and grows with power errors. The throw lands exactly where the sway
// is when released, plus a small seeded scatter.
export function aimPoint(t, steadiness = .5) {
  const amp = .085 * (1.15 - steadiness);
  return { x: amp * Math.sin(t * 1.9) + amp * .35 * Math.sin(t * 4.3), y: amp * .8 * Math.sin(t * 2.6 + 1) };
}
export function throwDart(aim, power, rng = Math.random) {
  // power 0..1; 0.5 is ideal. Too soft drops low, too hard lifts high.
  const drop = (.5 - power) * .16, scatter = .012;
  const x = aim.x + (rng() - .5) * scatter, y = aim.y - drop + (rng() - .5) * scatter;
  return { x, y, ...scoreAt(x, y) };
}
// A match: each player throws 3 darts per round for 3 rounds; highest total wins.
export function createDarts(players = 2) { return { round: 1, rounds: 3, turn: 0, dart: 0, totals: Array(players).fill(0), throws: [], done: false }; }
export function recordThrow(game, hit) {
  if (game.done) throw new Error('The match is over.');
  const totals = game.totals.slice(); totals[game.turn] += hit.points;
  let { round, turn, dart } = game; dart++;
  if (dart >= 3) { dart = 0; turn = (turn + 1) % totals.length; if (turn === 0) round++; }
  const done = round > game.rounds;
  return { ...game, totals, round: Math.min(round, game.rounds), turn, dart, done, throws: [...game.throws, { player: game.turn, ...hit }] };
}
export function dartsWinner(game) { if (!game.done) return null; const [a, b] = game.totals; return a === b ? 'draw' : a > b ? 0 : 1; }
