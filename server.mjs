import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isWalkable } from './navigation.js';
import { STATUS_IDS, EMOTE_IDS } from './social.js';

const root=fileURLToPath(new URL('.',import.meta.url));
const layout=JSON.parse(await readFile(path.join(root,'assets/layout.json'),'utf8'));
const peers=new Map(), clients=new Set();
const port=Number(process.env.PORT||4321), host=process.env.HOST||'127.0.0.1';
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const snapshot=()=>[...peers.values()].map(({token,lastChat,lastEmote,joinedAt,...p})=>p);
function broadcast(type,data){const event=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const c of clients)c.res.write(event);}
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(req.method==='GET'&&url.pathname==='/events'){
      const p=peers.get(url.searchParams.get('id'));
      if(!p||p.token!==url.searchParams.get('token'))return json(res,401,{error:'Join the café first.'});
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      const client={id:p.id,res};clients.add(client);res.write(`event: guests\ndata: ${JSON.stringify(snapshot())}\n\n`);
      req.on('close',()=>{clients.delete(client);peers.delete(p.id);broadcast('guests',snapshot());});return;
    }
    if(req.method==='POST'&&url.pathname==='/api'){
      // Browser origins must match this server; no cross-site write access.
      if(req.headers.origin && req.headers.origin!==url.origin)return json(res,403,{error:'Origin mismatch.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){json(res,413,{error:'Message too large.'});return;}}
      let data;try{data=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON.'});}
      if(data.action==='join'){
        if(peers.size>=16)return json(res,409,{error:'This playtest is full (16 guests).'});
        const name=typeof data.name==='string'?data.name.trim().slice(0,24):'Maya';
        if(!name||/[\x00-\x1f\x7f]/.test(name))return json(res,400,{error:'Use a name with 1–24 printable characters.'});
        const p={id:randomUUID(),token:randomUUID(),name,x:0,z:5.6,angle:Math.PI,seatId:null,status:'available',statusDetail:null,lastChat:0,lastEmote:0,joinedAt:Date.now()};peers.set(p.id,p);
        json(res,200,p);broadcast('guests',snapshot());return;
      }
      const p=peers.get(data.id);if(!p||p.token!==data.token)return json(res,401,{error:'Your session ended. Reload to rejoin.'});
      if(data.action==='rename'){
        const name=typeof data.name==='string'?data.name.trim():'';
        if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))return json(res,400,{error:'Use a name with 1–24 printable characters.'});p.name=name;
      }else if(data.action==='move'){
        if(!p.seatId&&isWalkable(data.x,data.z,layout)&&Number.isFinite(data.angle)){
          p.x=data.x;p.z=data.z;p.angle=data.angle;
        }
        if(STATUS_IDS.includes(data.status))p.status=data.status;
        p.statusDetail=typeof data.statusDetail==='string'?data.statusDetail.slice(0,40):null;
      }else if(data.action==='emote'){
        if(!EMOTE_IDS.includes(data.emote))return json(res,400,{error:'Unknown emote.'});
        if(Date.now()-p.lastEmote<750)return json(res,429,{error:'Give that a moment.'});p.lastEmote=Date.now();
        for(const c of clients){const other=peers.get(c.id);if(other&&Math.hypot(other.x-p.x,other.z-p.z)<=8)c.res.write(`event: emote\ndata: ${JSON.stringify({id:p.id,name:p.name,emote:data.emote})}\n\n`);}
      }else if(data.action==='sit'){
        const s=layout.stations.find(s=>s.id===data.seatId&&['seat','read','study'].includes(s.kind));
        if(!s||Math.hypot(p.x-s.approach[0],p.z-s.approach[1])>1.15)return json(res,409,{error:'Walk closer to the seat.'});
        if([...peers.values()].some(o=>o.id!==p.id&&o.seatId===s.id))return json(res,409,{error:'That seat is taken. Try another.'});
        p.seatId=s.id;p.x=s.x;p.z=s.z;p.angle=s.angle;
      }else if(data.action==='stand'){
        const s=layout.stations.find(s=>s.id===p.seatId);if(s){[p.x,p.z]=s.approach;}p.seatId=null;
      }else if(data.action==='chat'){
        const message=typeof data.text==='string'?data.text.trim():'';
        if(!message||message.length>160||/[\x00-\x1f\x7f]/.test(message))return json(res,400,{error:'Use 1–160 printable characters.'});
        if(Date.now()-p.lastChat<750)return json(res,429,{error:'Give your last message a moment.'});p.lastChat=Date.now();
        for(const c of clients){const other=peers.get(c.id);if(other&&Math.hypot(other.x-p.x,other.z-p.z)<=8)c.res.write(`event: chat\ndata: ${JSON.stringify({name:p.name,text:message,id:p.id})}\n\n`);}
      }else return json(res,400,{error:'Unknown café action.'});
      json(res,200,{ok:true,x:p.x,z:p.z,seatId:p.seatId});broadcast('guests',snapshot());return;
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
    const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root)||pathname.split('/').some(s=>s.startsWith('.'))||!['/index.html','/maya.html','/studio.js','/maya-character.js','/app.js','/navigation.js','/animation.js','/characters.js','/cafe-life.js','/effects.js','/interactions.js','/focus.js','/music.js','/minigames.js','/social.js','/save.js','/style.css','/favicon.svg'].includes(pathname)&&!pathname.startsWith('/assets/')&&!pathname.startsWith('/node_modules/three/'))return json(res,404,{error:'Not found.'});
    const info=await stat(file);if(!info.isFile())return json(res,404,{error:'Not found.'});
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:400,{error:'Could not load that request.'});else res.end();}
});
setInterval(()=>{
  for(const c of clients)c.res.write(': heartbeat\n\n');
  // A peer that joined but never opened /events (crashed tab, dropped connection) would
  // otherwise linger in `peers` forever, since removal only happens on SSE 'close'.
  const liveIds=new Set([...clients].map(c=>c.id));
  let changed=false;
  for(const [id,p] of peers)if(!liveIds.has(id)&&Date.now()-p.joinedAt>15000){peers.delete(id);changed=true;}
  if(changed)broadcast('guests',snapshot());
},15000).unref();
server.listen(port,host,()=>console.log(`Maple Bean is open: http://localhost:${port}\nCharacter studio: http://localhost:${port}/maya.html\nCtrl+C closes the local playtest.`));
