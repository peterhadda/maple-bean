// Classic Nokia-style Snake on a small grid. Walls end the run (like the
// original), eating a bean grows the snake by one and scores a point.
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
export function createSnake(w = 16, h = 12, rng = Math.random) {
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const s = { w, h, body: [[cx, cy], [cx - 1, cy], [cx - 2, cy]], dir: 'right', queued: [], food: null, score: 0, over: false, ticks: 0 };
  s.food = placeFood(s, rng); return s;
}
export function placeFood(s, rng = Math.random) {
  const free = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (!s.body.some(([a, b]) => a === x && b === y)) free.push([x, y]);
  return free.length ? free[Math.floor(rng() * free.length)] : null;
}
// Up to two queued turns so quick taps are not lost, never reversing into yourself.
export function turn(s, dir) {
  if (!DIRS[dir]) return s;
  const last = s.queued.length ? s.queued[s.queued.length - 1] : s.dir;
  if (dir === last || dir === opposite[last] || s.queued.length >= 2) return s;
  return { ...s, queued: [...s.queued, dir] };
}
export function step(s, rng = Math.random) {
  if (s.over) return s;
  const [dir, ...queued] = s.queued.length ? s.queued : [s.dir];
  const [dx, dy] = DIRS[dir], [hx, hy] = s.body[0], head = [hx + dx, hy + dy];
  const eating = s.food && head[0] === s.food[0] && head[1] === s.food[1];
  const body = [head, ...s.body.slice(0, eating ? s.body.length : -1)];
  const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= s.w || head[1] >= s.h;
  const hitSelf = body.slice(1).some(([x, y]) => x === head[0] && y === head[1]);
  if (hitWall || hitSelf) return { ...s, dir, queued: [], over: true };
  const next = { ...s, body, dir, queued, score: s.score + (eating ? 1 : 0), ticks: s.ticks + 1 };
  if (eating) next.food = placeFood(next, rng);
  if (!next.food) next.over = true;
  return next;
}
export const tickSeconds = s => Math.max(.075, .16 - s.score * .004);
