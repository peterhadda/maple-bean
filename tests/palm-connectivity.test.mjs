import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('all cast finger-root surfaces stay inside their palm in open, fist and grip poses, both sides and LODs',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const output=execFileSync(process.execPath,['qa/expansion/characters/check-palm-coverage.mjs','assets/characters'],{cwd:root,encoding:'utf8'});
 const report=JSON.parse(output);
 assert.equal(report.checks,240);
 assert.deepEqual(report.failures,[],JSON.stringify(report.failures));
});
