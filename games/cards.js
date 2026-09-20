// Maple Eights: two-player Crazy Eights. Match the top card's suit or rank;
// an 8 is wild and names a new suit. Draw one card if you cannot play (then you
// may play it, or pass). First to empty their hand wins.
export const SUITS = ['♥', '♦', '♣', '♠'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export function deck() { return SUITS.flatMap(s => RANKS.map(r => ({ rank: r, suit: s, id: r + s }))); }
function shuffle(a, rng) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function createEights(rng = Math.random) {
  let pile = shuffle(deck(), rng);
  const hands = [pile.slice(0, 7), pile.slice(7, 14)]; pile = pile.slice(14);
  let i = pile.findIndex(c => c.rank !== '8'); const top = pile[i]; pile = [...pile.slice(0, i), ...pile.slice(i + 1)];
  return { hands, pile, discard: [top], suit: top.suit, turn: 0, drew: false, winner: null, moves: 0 };
}
export const top = g => g.discard[g.discard.length - 1];
export const canPlay = (g, card) => card.rank === '8' || card.suit === g.suit || card.rank === top(g).rank;
export function playCard(g, cardId, suit) {
  if (g.winner !== null) throw new Error('The round is over.');
  const hand = g.hands[g.turn], card = hand.find(c => c.id === cardId);
  if (!card) throw new Error('That card is not in your hand.');
  if (!canPlay(g, card)) throw new Error('Match the suit or the number — or play an 8.');
  if (card.rank === '8' && !SUITS.includes(suit)) throw new Error('Choose a suit for your 8.');
  const hands = g.hands.map((h, i) => i === g.turn ? h.filter(c => c.id !== cardId) : h);
  const winner = hands[g.turn].length ? null : g.turn;
  return { ...g, hands, discard: [...g.discard, card], suit: card.rank === '8' ? suit : card.suit, turn: winner === null ? 1 - g.turn : g.turn, drew: false, winner, moves: g.moves + 1 };
}
export function draw(g, rng = Math.random) {
  if (g.drew) throw new Error('You already drew — play it or pass.');
  let pile = g.pile, discard = g.discard;
  if (!pile.length) { if (discard.length <= 1) return { ...g, drew: true }; pile = shuffle(discard.slice(0, -1), rng); discard = [top(g)]; }
  const hands = g.hands.map((h, i) => i === g.turn ? [...h, pile[0]] : h);
  return { ...g, hands, pile: pile.slice(1), discard, drew: true, moves: g.moves + 1 };
}
export function pass(g) {
  if (!g.drew) throw new Error('Draw a card before passing.');
  return { ...g, turn: 1 - g.turn, drew: false };
}
// The regular plays a matching non-eight first, saves 8s, names their longest suit.
export function npcTurn(g, rng = Math.random) {
  const hand = g.hands[g.turn], playable = hand.filter(c => canPlay(g, c));
  const normal = playable.filter(c => c.rank !== '8');
  if (normal.length) return { type: 'play', card: normal[Math.floor(rng() * normal.length)] };
  if (playable.length) {
    const counts = SUITS.map(s => hand.filter(c => c.suit === s && c.rank !== '8').length);
    return { type: 'play', card: playable[0], suit: SUITS[counts.indexOf(Math.max(...counts))] };
  }
  return g.drew ? { type: 'pass' } : { type: 'draw' };
}
