// Phase 2 prototype server. Deliberately separate from ../server.mjs so the
// production playtest (:4321) is never modified. Read-only: GET/HEAD only, no
// /api, no multiplayer. Root modules and assets are served from an allow-list
// so prototypes can import them without copying or patching them.
import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const phase2 = fileURLToPath(new URL('.', import.meta.url));
const root = path.resolve(phase2, '..');
const port = Number(process.env.PHASE2_PORT || 4322), host = process.env.HOST || '127.0.0.1';

// Production modules prototypes may import read-only (same set ../server.mjs exposes).
const ROOT_FILES = new Set(['/maya-character.js', '/animation.js', '/characters.js', '/navigation.js', '/cafe-life.js',
  '/effects.js', '/interactions.js', '/focus.js', '/music.js', '/minigames.js', '/social.js', '/save.js', '/favicon.svg']);
const ROOT_PREFIXES = ['/assets/', '/node_modules/three/', '/design-assets/'];
// Short prototype routes -> page directories inside phase2/.
export const ROUTES = {
  '/phase2': 'index.html',
  '/phase2/parity': 'lab/parity/index.html',
  '/phase2/cast': 'cast/index.html',
  '/phase2/render': 'render/index.html',
  '/phase2/home': 'home/index.html',
  '/phase2/create': 'create/index.html',
  '/phase2/study': 'study/index.html',
  '/phase2/barista': 'games/barista/index.html',
  '/phase2/bean-run': 'games/bean-run/index.html',
  '/phase2/latte': 'games/latte/index.html',
  '/phase2/icons': 'icons/index.html',
};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.ico': 'image/x-icon' };

export function resolveRequest(pathname) {
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (clean.split('/').some(s => s.startsWith('.'))) return null;
  if (ROUTES[clean]) return path.join(phase2, ROUTES[clean]);
  if (clean.startsWith('/phase2/')) {
    const file = path.resolve(phase2, '.' + clean.slice('/phase2'.length));
    return file.startsWith(phase2) ? file : null;
  }
  if (ROOT_FILES.has(clean) || ROOT_PREFIXES.some(p => clean.startsWith(p))) {
    const file = path.resolve(root, '.' + clean);
    return file.startsWith(root) && !file.startsWith(phase2) ? file : null;
  }
  return null;
}

const notFound = res => { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found.'); };
export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/') { res.writeHead(302, { Location: '/phase2' }); return res.end(); }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const file = resolveRequest(decodeURIComponent(url.pathname));
    if (!file || !mime[path.extname(file)]) return notFound(res);
    const info = await stat(file); if (!info.isFile()) return notFound(res);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch { if (!res.headersSent) notFound(res); else res.end(); }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, host, () => console.log(`Maple Bean Phase 2 prototypes: http://localhost:${port}/phase2\nProduction playtest stays on :4321 (node server.mjs).`));
}
