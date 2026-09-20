// Ad-hoc visual probe: node qa/shoot.mjs <out-dir> <script.js>
// The script file exports an array of {name, run} steps; `run` is a string evaluated
// in the page (async allowed) before a screenshot named `name` is captured.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [out, scriptPath, w='1280', h='800'] = process.argv.slice(2);
const steps = (await import(pathToFileURL(path.resolve(scriptPath)).href)).default;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: process.env.GL==='soft'?['--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader']:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--no-sandbox'] });
try {
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('response', r => { if(r.status()>=400)console.log('HTTPFAIL',r.status(),r.url()); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
if (process.env.CHARACTER_ASSETS || process.env.HEAD_SCALE_TRIAL) await page.route('**/assets/characters/*.glb', route => route.fulfill({path:path.resolve(process.env.CHARACTER_ASSETS || 'assets/characters',path.basename(new URL(route.request().url()).pathname)),contentType:'model/gltf-binary'}));
if(process.env.HEAD_SCALE_TRIAL){
 const headScale=Number(process.env.HEAD_SCALE_TRIAL);if(!Number.isFinite(headScale)||headScale<.6||headScale>1)throw Error('Invalid isolated head trial');
 await page.route('**/assets/characters/runtime.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('assets/characters/runtime.js','utf8').replace(/export const HEAD_SCALE=[.\d]+;/,`export const HEAD_SCALE=${headScale};`)}));
}
await page.goto(process.env.CAFE_URL || 'http://127.0.0.1:4321/', { waitUntil: 'domcontentloaded' });
if (!process.env.NOREADY) await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }); else await page.waitForTimeout(8000);
if(process.env.HEAD_SCALE_TRIAL){const active=await page.evaluate(async()=> (await import('/assets/characters/runtime.js')).HEAD_SCALE);if(active!==Number(process.env.HEAD_SCALE_TRIAL))throw Error('Head trial interception was not active');}
const authoredRig=await page.evaluate(()=>{const c=window.cafe,actors=[c?.maya,...(c?.regulars||[]).map(n=>n.avatar)];return actors.every(a=>{let found=false;a?.group?.traverse(o=>{if(o.isSkinnedMesh)found=true;});return found;});});
if(!authoredRig){await browser.close();throw Error('QA rejected procedural fallback: authored skinned character assets did not load');}
for (const step of steps) {
  const result = await page.evaluate(`(async()=>{${step.run}})()`).catch(e => 'ERR ' + e.message);
  if (result !== undefined) console.log(step.name, JSON.stringify(result));
  if (step.shot !== false) await page.screenshot({ path: path.join(out, step.name + '.png'), timeout: 90000 });
}
console.log('errors', JSON.stringify(errors, null, 1));
} finally { await browser.close(); }
