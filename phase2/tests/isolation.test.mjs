import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveRequest } from '../server.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root }).toString().trim();
const outside = ['--', '.', ':(exclude)phase2', ':(exclude)design-assets'];

test('phase 2 never changes production files (tracked or new) outside phase2/ and design-assets/', () => {
  assert.equal(git('rev-parse', 'pre-phase-2^{commit}').length, 40, 'backup tag pre-phase-2 must exist');
  assert.equal(git('diff', '--name-only', 'pre-phase-2', ...outside), '', 'production files differ from pre-phase-2');
  assert.equal(git('ls-files', '--others', '--exclude-standard', ...outside), '', 'new files were added outside phase2/');
});

test('prototype server only exposes phase2 files and the read-only production allow-list', () => {
  assert.match(resolveRequest('/phase2'), /phase2[\\/]index\.html$/);
  assert.match(resolveRequest('/phase2/barista'), /games[\\/]barista[\\/]index\.html$/);
  assert.match(resolveRequest('/assets/layout.json'), /assets[\\/]layout\.json$/);
  assert.match(resolveRequest('/maya-character.js'), /maya-character\.js$/);
  for (const blocked of ['/server.mjs', '/app.js', '/package.json', '/original/maya.html', '/phase2/../server.mjs',
    '/phase2/.git/config', '/.git/config', '/assets/../server.mjs', '/MapleBeanExpanded.blend'])
    assert.equal(resolveRequest(blocked), null, blocked + ' must not be served');
});
