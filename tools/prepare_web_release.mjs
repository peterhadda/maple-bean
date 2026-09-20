// Isolated phone-accessible release; never replace the local multiplayer server.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'), dest=path.join(root,'web-release/out');
fs.mkdirSync(dest,{recursive:true});
for(const name of fs.readdirSync(root)) if(/\.(js|html|css|svg)$/.test(name)) fs.copyFileSync(path.join(root,name),path.join(dest,name));
for(const folder of ['assets','games','systems','design-assets']) fs.cpSync(path.join(root,folder),path.join(dest,folder),{recursive:true,filter:p=>!(/\.(blend\d*|pyc)$/.test(p)||p.includes(path.sep+'source'+path.sep)||p.endsWith(path.sep+'source'))});
fs.cpSync(path.join(root,'node_modules/three/build'),path.join(dest,'vendor/three/build'),{recursive:true});
fs.cpSync(path.join(root,'node_modules/three/examples/jsm'),path.join(dest,'vendor/three/examples/jsm'),{recursive:true});
for(const name of fs.readdirSync(dest).filter(n=>n.endsWith('.html'))){const p=path.join(dest,name);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('/node_modules/three/','/vendor/three/'));}
let app=fs.readFileSync(path.join(dest,'app.js'),'utf8');
const begin=app.indexOf('async function api(data) {'),end=app.indexOf('\n// ------------------------------------------------------------------ world labels',begin);
if(begin<0||end<0)throw Error('Network integration anchor changed');
app="import { soloApi, connectSolo } from './solo-session.js';\n"+app.slice(0,begin)+"async function api(data) { return soloApi(data, layout); }\n"+app.slice(end);
app=app.replace('function connect() {',"function connect() { connectSolo(group => messenger.upsert(group), id => messenger.remove(id)); $('guest-count').textContent = '(solo café)'; return; ");
if(!app.includes('connectSolo(group'))throw Error('Connection integration anchor changed');
fs.writeFileSync(path.join(dest,'app.js'),app);
fs.copyFileSync(path.join(root,'tools/solo-session.js'),path.join(dest,'solo-session.js'));
console.log('Prepared isolated web release with existing café geometry and touch controls.');
