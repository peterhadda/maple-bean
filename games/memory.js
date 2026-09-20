// Memory cards: pairs of café symbols on a 4×4 grid. Players take turns; a
// match scores and plays again, a miss passes the turn.
export const SYMBOLS = ['☕', '🍵', '🥐', '🍁', '🧁', '📚', '🌿', '🎵'];
export function shuffled(list, rng = Math.random) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function createMemory(rng = Math.random, pairs = 8) {
  const cards = shuffled([...SYMBOLS.slice(0, pairs), ...SYMBOLS.slice(0, pairs)], rng).map((symbol, i) => ({ id: i, symbol, matched: null }));
  return { cards, open: [], turn: 0, scores: [0, 0], moves: 0, done: false, lastResult: null };
}
// Returns the next state. Two open cards resolve on the second flip; call
// `settle` after the players have seen them to turn a miss face-down again.
export function flip(game, index) {
  if (game.done) throw new Error('The game is over.');
  const card = game.cards[index];
  if (!card || card.matched !== null || game.open.includes(index)) throw new Error('Choose a face-down card.');
  if (game.open.length >= 2) throw new Error('Wait for the cards to settle.');
  const open = [...game.open, index];
  if (open.length < 2) return { ...game, open, lastResult: null };
  const [a, b] = open, match = game.cards[a].symbol === game.cards[b].symbol;
  const cards = game.cards.map(c => (match && (c.id === a || c.id === b)) ? { ...c, matched: game.turn } : c);
  const scores = game.scores.slice(); if (match) scores[game.turn]++;
  const done = cards.every(c => c.matched !== null);
  return { ...game, cards, open, scores, moves: game.moves + 1, done, lastResult: match ? 'match' : 'miss' };
}
export function settle(game) {
  if (game.open.length < 2) return game;
  return { ...game, open: [], turn: game.lastResult === 'match' ? game.turn : 1 - game.turn };
}
export function winner(game) { if (!game.done) return null; const [a, b] = game.scores; return a === b ? 'draw' : a > b ? 0 : 1; }
// A regular's memory: remembers each seen card with probability `recall`.
export function npcPick(game, seen, recall = .6, rng = Math.random) {
  const hidden = game.cards.filter(c => c.matched === null && !game.open.includes(c.id));
  const known = hidden.filter(c => seen.has(c.id) && rng() < recall);
  if (game.open.length === 1) {
    const first = game.cards[game.open[0]];
    const pair = known.find(c => c.symbol === first.symbol);
    if (pair) return pair.id;
  } else {
    for (const c of known) { const other = known.find(d => d.id !== c.id && d.symbol === c.symbol); if (other) return c.id; }
  }
  const unseen = hidden.filter(c => !seen.has(c.id));
  const pool = unseen.length ? unseen : hidden;
  return pool[Math.floor(rng() * pool.length)].id;
}
