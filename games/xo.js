// Tic-tac-toe (XO). Cells 0..8, row-major. 'X' always starts.
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function createXO(first = 'X') { return { board: Array(9).fill(null), turn: first, winner: null, line: null, moves: 0 }; }
export function winnerOf(board) {
  for (const l of LINES) { const [a, b, c] = l; if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: l }; }
  return board.every(Boolean) ? { winner: 'draw', line: null } : null;
}
export function play(game, cell) {
  if (game.winner) throw new Error('The game is over.');
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || game.board[cell]) throw new Error('Pick an empty square.');
  const board = game.board.slice(); board[cell] = game.turn;
  const w = winnerOf(board);
  return { board, turn: game.turn === 'X' ? 'O' : 'X', winner: w?.winner || null, line: w?.line || null, moves: game.moves + 1 };
}
function minimax(board, me, turn, depth) {
  const w = winnerOf(board);
  if (w) return w.winner === 'draw' ? 0 : w.winner === me ? 10 - depth : depth - 10;
  let best = turn === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) if (!board[i]) {
    board[i] = turn; const v = minimax(board, me, turn === 'X' ? 'O' : 'X', depth + 1); board[i] = null;
    best = turn === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}
// skill 0..1: chance of choosing the best move instead of a random legal one,
// so friendly regulars are beatable but still play sensibly.
export function bestMove(game, skill = .75, rng = Math.random) {
  const empty = game.board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
  if (!empty.length) return null;
  if (rng() > skill) return empty[Math.floor(rng() * empty.length)];
  let best = -Infinity, choice = empty[0];
  for (const i of empty) {
    const b = game.board.slice(); b[i] = game.turn;
    const v = minimax(b, game.turn, game.turn === 'X' ? 'O' : 'X', 1);
    if (v > best) { best = v; choice = i; }
  }
  return choice;
}
