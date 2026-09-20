// Chess rules with full legal move generation: castling, en passant,
// promotion, check, checkmate, stalemate, the 50-move rule and bare kings.
// Squares 0..63 in FEN order (0 = a8, 63 = h1). Uppercase = white.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const FILES = 'abcdefgh';
export const squareName = i => FILES[i % 8] + (8 - Math.floor(i / 8));
const isWhite = p => p && p === p.toUpperCase();
const colorOf = p => p ? (isWhite(p) ? 'w' : 'b') : null;
const rc = i => [Math.floor(i / 8), i % 8];
const at = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1;

export function createChess(fen = START) {
  const board = [];
  for (const ch of fen.split(' ')[0]) { if (ch === '/') continue; if (/\d/.test(ch)) board.push(...Array(+ch).fill(null)); else board.push(ch); }
  return { board, turn: 'w', castling: { K: true, Q: true, k: true, q: true }, ep: -1, halfmove: 0, fullmove: 1, history: [] };
}
function attacked(board, sq, by) {
  const [r, c] = rc(sq);
  const pawnDir = by === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) { const i = at(r + pawnDir, c + dc); if (i >= 0 && board[i] === (by === 'w' ? 'P' : 'p')) return true; }
  for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const i = at(r + dr, c + dc); if (i >= 0 && board[i] === (by === 'w' ? 'N' : 'n')) return true; }
  for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const i = at(r + dr, c + dc); if (i >= 0 && board[i] === (by === 'w' ? 'K' : 'k')) return true;
  }
  const slide = (dirs, kinds) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (at(rr, cc) >= 0) {
        const p = board[at(rr, cc)];
        if (p) { if (colorOf(p) === by && kinds.includes(p.toLowerCase())) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  };
  return slide([[1, 0], [-1, 0], [0, 1], [0, -1]], 'rq') || slide([[1, 1], [1, -1], [-1, 1], [-1, -1]], 'bq');
}
export function inCheck(state, color = state.turn) {
  const king = state.board.indexOf(color === 'w' ? 'K' : 'k');
  return king >= 0 && attacked(state.board, king, color === 'w' ? 'b' : 'w');
}
function pseudoMoves(state) {
  const { board, turn } = state, moves = [];
  const add = (from, to, extra = {}) => moves.push({ from, to, piece: board[from], capture: board[to] || extra.capture || null, ...extra });
  board.forEach((p, from) => {
    if (!p || colorOf(p) !== turn) return;
    const [r, c] = rc(from), kind = p.toLowerCase();
    if (kind === 'p') {
      const dir = turn === 'w' ? -1 : 1, startRow = turn === 'w' ? 6 : 1, lastRow = turn === 'w' ? 0 : 7;
      const one = at(r + dir, c);
      const push = (to, extra = {}) => { if (rc(to)[0] === lastRow) for (const promo of ['q', 'r', 'b', 'n']) add(from, to, { ...extra, promo }); else add(from, to, extra); };
      if (one >= 0 && !board[one]) { push(one); const two = at(r + 2 * dir, c); if (r === startRow && !board[two]) add(from, two, { double: true }); }
      for (const dc of [-1, 1]) {
        const to = at(r + dir, c + dc); if (to < 0) continue;
        if (board[to] && colorOf(board[to]) !== turn) push(to);
        if (to === state.ep) add(from, to, { enPassant: true, capture: turn === 'w' ? 'p' : 'P' });
      }
    } else if (kind === 'n' || kind === 'k') {
      const steps = kind === 'n' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dr, dc] of steps) { const to = at(r + dr, c + dc); if (to >= 0 && colorOf(board[to]) !== turn) add(from, to); }
      if (kind === 'k') {
        const enemy = turn === 'w' ? 'b' : 'w', home = turn === 'w' ? 60 : 4;
        if (from === home && !attacked(board, home, enemy)) {
          const [kSide, qSide] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
          if (state.castling[kSide] && !board[home + 1] && !board[home + 2] && !attacked(board, home + 1, enemy) && !attacked(board, home + 2, enemy)) add(from, home + 2, { castle: 'k' });
          if (state.castling[qSide] && !board[home - 1] && !board[home - 2] && !board[home - 3] && !attacked(board, home - 1, enemy) && !attacked(board, home - 2, enemy)) add(from, home - 2, { castle: 'q' });
        }
      }
    } else {
      const dirs = kind === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : kind === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (at(rr, cc) >= 0) { const to = at(rr, cc); if (board[to]) { if (colorOf(board[to]) !== turn) add(from, to); break; } add(from, to); rr += dr; cc += dc; }
      }
    }
  });
  return moves;
}
export function applyMove(state, m) {
  const board = state.board.slice(), turn = state.turn;
  board[m.to] = m.promo ? (turn === 'w' ? m.promo.toUpperCase() : m.promo) : board[m.from]; board[m.from] = null;
  if (m.enPassant) board[m.to + (turn === 'w' ? 8 : -8)] = null;
  if (m.castle) { const rookFrom = m.castle === 'k' ? m.to + 1 : m.to - 2, rookTo = m.castle === 'k' ? m.to - 1 : m.to + 1; board[rookTo] = board[rookFrom]; board[rookFrom] = null; }
  const castling = { ...state.castling };
  for (const sq of [m.from, m.to]) { if (sq === 60) castling.K = castling.Q = false; if (sq === 4) castling.k = castling.q = false; if (sq === 63) castling.K = false; if (sq === 56) castling.Q = false; if (sq === 7) castling.k = false; if (sq === 0) castling.q = false; }
  return { board, turn: turn === 'w' ? 'b' : 'w', castling, ep: m.double ? (m.from + m.to) / 2 : -1,
    halfmove: m.capture || m.piece.toLowerCase() === 'p' ? 0 : state.halfmove + 1, fullmove: state.fullmove + (turn === 'b' ? 1 : 0), history: [...state.history, m] };
}
export function legalMoves(state) { return pseudoMoves(state).filter(m => !inCheck(applyMove(state, m), state.turn)); }
export function move(state, from, to, promo = 'q') {
  const m = legalMoves(state).find(x => x.from === from && x.to === to && (!x.promo || x.promo === promo));
  if (!m) throw new Error('That piece can’t move there.');
  return { state: applyMove(state, m), move: m };
}
export function status(state) {
  const moves = legalMoves(state);
  if (!moves.length) return inCheck(state) ? { over: true, result: 'checkmate', winner: state.turn === 'w' ? 'b' : 'w' } : { over: true, result: 'stalemate', winner: null };
  if (state.halfmove >= 100) return { over: true, result: 'fifty-move rule', winner: null };
  const left = state.board.filter(Boolean);
  if (left.length === 2 || (left.length === 3 && left.some(p => 'nbNB'.includes(p)))) return { over: true, result: 'insufficient material', winner: null };
  return { over: false, check: inCheck(state) };
}

// A friendly two-ply opponent: material + a little centre and development.
const VALUE = { p: 100, n: 310, b: 320, r: 500, q: 900, k: 0 };
function evaluate(board) {
  let score = 0;
  board.forEach((p, i) => {
    if (!p) return; const [r, c] = rc(i), sign = isWhite(p) ? 1 : -1, k = p.toLowerCase();
    let v = VALUE[k];
    const centre = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
    if (k === 'n' || k === 'b') v += centre * 6;
    if (k === 'p') v += (isWhite(p) ? 6 - r : r - 1) * 5 + (c > 1 && c < 6 ? centre * 3 : 0);
    score += sign * v;
  });
  return score;
}
function search(state, depth, alpha, beta) {
  const moves = legalMoves(state);
  if (!moves.length) return inCheck(state) ? -100000 - depth : 0;
  if (depth === 0) return (state.turn === 'w' ? 1 : -1) * evaluate(state.board);
  for (const m of moves) { const v = -search(applyMove(state, m), depth - 1, -beta, -alpha); if (v >= beta) return beta; if (v > alpha) alpha = v; }
  return alpha;
}
export function chooseMove(state, { depth = 2, jitter = 25, rng = Math.random } = {}) {
  const moves = legalMoves(state);
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const v = -search(applyMove(state, m), depth - 1, -Infinity, Infinity) + (rng() - .5) * jitter;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
