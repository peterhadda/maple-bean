import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isWalkable } from './navigation.js';
import { STATUS_IDS, EMOTE_IDS } from './social.js';
import { PERSONAS, NPC_IDS, offlineReply, systemPrompt, cleanHistory, intentOf } from './npc-brain.js';
import { createStore, checkEmail, checkPassword, checkHandle } from './accounts.mjs';
import Anthropic from '@anthropic-ai/sdk';

// NPC replies come from Claude when credentials are configured (ANTHROPIC_API_KEY,
// ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile); otherwise, or if a call
// fails, the regular answers from their offline persona lines.
let claude=null,aiState='unknown';
function claudeClient(){if(aiState==='off')return null;if(!claude){try{claude=new Anthropic({timeout:20000,maxRetries:1});aiState='on';}catch{aiState='off';}}return claude;}
async function npcReply(npc,text,history,ctx){
  const client=claudeClient();
  if(client){
    try{
      const response=await client.beta.messages.create({
        model:'claude-opus-5',max_tokens:1024,
        betas:['server-side-fallback-2026-07-01'],fallbacks:'default',
        output_config:{effort:'low'},
        system:systemPrompt(npc,ctx),
        messages:[...cleanHistory(history),{role:'user',content:text}],
      });
      if(response.stop_reason!=='refusal'){
        const reply=response.content.filter(b=>b.type==='text').map(b=>b.text).join(' ').trim();
        if(reply)return {reply:reply.slice(0,600),source:'claude'};
      }
    }catch(error){
      if(error instanceof Anthropic.AuthenticationError||error instanceof Anthropic.PermissionDeniedError){aiState='off';console.warn('NPC chat: Claude credentials unavailable, using offline replies.');}
      else console.warn('NPC chat: Claude call failed ('+(error.status||error.name)+'), using an offline reply.');
    }
  }
  return {reply:offlineReply(npc,text,ctx),source:'offline'};
}
const groups=new Map();
const groupView=g=>({id:g.id,name:g.name,owner:g.owner,members:[...g.members].map(id=>({id,name:peers.get(id)?.name||'Guest',kind:'guest'})),npcs:g.npcs.map(id=>({id,name:PERSONAS[id].name,kind:'npc'})),messages:g.messages.slice(-60)});
function sendTo(id,type,data){const event=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const c of clients)if(c.id===id)c.res.write(event);}
function pushGroup(g){for(const id of g.members)sendTo(id,'group',groupView(g));}
function leaveGroups(id){for(const g of groups.values()){if(g.members.delete(id)){if(!g.members.size)groups.delete(g.id);else{if(g.owner===id)g.owner=[...g.members][0];pushGroup(g);}}}}
const cleanText=t=>typeof t==='string'?t.trim():'';
const printable=t=>!/[\x00-\x1f\x7f]/.test(t);

const root=fileURLToPath(new URL('.',import.meta.url));
// Reloaded when the file changes so environment re-exports don't need a restart.
const layoutPath=path.join(root,'assets/layout.json');
let layout=JSON.parse(await readFile(layoutPath,'utf8')),layoutMtime=(await stat(layoutPath)).mtimeMs;
setInterval(async()=>{try{const m=(await stat(layoutPath)).mtimeMs;if(m!==layoutMtime){layout=JSON.parse(await readFile(layoutPath,'utf8'));layoutMtime=m;console.log('layout.json reloaded');}}catch{}},2000).unref();
const peers=new Map(), clients=new Set();
const port=Number(process.env.PORT||4321), host=process.env.HOST||'127.0.0.1';

// ---------------------------------------------------------------- accounts
// The service the Figma sign-in journey is designed against. Local only: a
// JSON file beside the café, never served as a static asset.
const accounts=await createStore(path.join(root,'.data/accounts.json'));
const local=['127.0.0.1','::1','localhost'].includes(host);
// A coarse brake on password guessing: attempts per client address, decaying.
const attempts=new Map();
function tooManyAttempts(key){
  const now=Date.now(),a=attempts.get(key);
  if(!a||now-a.at>15*60000){attempts.set(key,{n:1,at:now});return false;}
  a.n++;a.at=now;return a.n>12;
}
const forgetAttempts=key=>attempts.delete(key);
setInterval(()=>{const cut=Date.now()-15*60000;for(const [k,a] of attempts)if(a.at<cut)attempts.delete(k);},60000).unref();

// The look the café renders for a guest. Kept small and validated so one
// browser can never push arbitrary data into everybody else's scene.
const HEX=/^#[0-9a-f]{6}$/i;
const tint=v=>typeof v==='string'&&HEX.test(v)?v.toLowerCase():null;
const CAST_IDS=['maya','mara','jules','claire','noah'];
const PROP_IDS=['glasses','beret','leaf-clip','scarf'];
function cleanAppearance(a){
  if(!a||typeof a!=='object')return null;
  return {
    base:CAST_IDS.includes(a.base)?a.base:'maya',
    hair:CAST_IDS.includes(a.hair)?a.hair:'maya',
    skin:tint(a.skin),eyes:tint(a.eyes),hairColor:tint(a.hairColor),
    top:tint(a.top),bottom:tint(a.bottom),shoes:tint(a.shoes),
    props:Array.isArray(a.props)?a.props.filter(p=>p&&PROP_IDS.includes(p.prop)).slice(0,4).map(p=>({prop:p.prop,color:tint(p.color)})):[],
  };
}
// Seat ids are station ids, or "stationId#n" for the n-th seat at a game table.
function seatOf(id){const [sid,n]=String(id||'').split('#');const st=layout.stations.find(s=>s.id===sid&&['seat','read','study','game'].includes(s.kind));return st&&(n!==undefined?st.seats?.[+n]:st.seats?null:st);}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
// `account` stays server-side: other guests learn that someone is a member,
// never which account they are.
const snapshot=()=>[...peers.values()].map(({token,lastChat,lastEmote,lastNpc,lastGroup,lastLook,joinedAt,account,...p})=>p);
function broadcast(type,data){const event=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const c of clients)c.res.write(event);}
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const PUBLIC=new Set(['/index.html','/login.html','/maya.html','/studio.js','/maya-character.js','/app.js','/navigation.js','/animation.js','/characters.js','/cafe-life.js','/effects.js','/interactions.js','/focus.js','/music.js','/minigames.js','/social.js','/save.js','/style.css','/favicon.svg',
  '/economy.js','/study.js','/relationships.js','/shop.js','/npc-brain.js','/world.js','/hud.js','/activities.js','/camera-director.js','/wardrobe.js','/game-scenes.js','/messenger.js']);
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(req.method==='GET'&&url.pathname==='/events'){
      const p=peers.get(url.searchParams.get('id'));
      if(!p||p.token!==url.searchParams.get('token'))return json(res,401,{error:'Join the café first.'});
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      const client={id:p.id,res};clients.add(client);res.write(`event: guests\ndata: ${JSON.stringify(snapshot())}\n\n`);
      req.on('close',()=>{clients.delete(client);peers.delete(p.id);leaveGroups(p.id);broadcast('guests',snapshot());});return;
    }
    if(req.method==='POST'&&url.pathname==='/account'){
      if(req.headers.origin && req.headers.origin!==url.origin)return json(res,403,{error:'Origin mismatch.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>8192){json(res,413,{error:'That request is too large.'});return;}}
      let data;try{data=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON.'});}
      const who=req.socket.remoteAddress||'unknown';
      try{
        if(data.action==='sign-up'){
          const handle=checkHandle(data.handle);if(handle.error)return json(res,400,{error:handle.error,field:'handle'});
          const email=checkEmail(data.email);if(email.error)return json(res,400,{error:email.error,field:'email'});
          const password=checkPassword(data.password);if(password.error)return json(res,400,{error:password.error,field:'password'});
          const result=await accounts.signUp({email:email.email,password:password.password,handle:handle.handle});
          console.log('New Maple Bean account: '+result.account.email);
          return json(res,200,result);
        }
        if(data.action==='log-in'){
          if(tooManyAttempts(who))return json(res,429,{error:'Too many attempts. Wait a few minutes, then try again.'});
          const email=checkEmail(data.email);if(email.error)return json(res,400,{error:email.error,field:'email'});
          if(typeof data.password!=='string'||!data.password)return json(res,400,{error:'Add your password.',field:'password'});
          const result=await accounts.logIn({email:email.email,password:data.password});
          forgetAttempts(who);
          return json(res,200,result);
        }
        if(data.action==='resume'){
          const account=await accounts.resume(data.id,data.token);
          if(!account)return json(res,401,{error:'That session has ended. Log in again.'});
          return json(res,200,{account:accounts.view(account)});
        }
        if(data.action==='log-out'){
          await accounts.logOut(data.id,data.token);
          return json(res,200,{ok:true});
        }
        if(data.action==='profile'){
          const account=await accounts.resume(data.id,data.token);
          if(!account)return json(res,401,{error:'That session has ended. Log in again.'});
          const patch={};
          if(data.handle!==undefined){const handle=checkHandle(data.handle);if(handle.error)return json(res,400,{error:handle.error,field:'handle'});patch.handle=handle.handle;}
          if(data.avatar!==undefined)patch.avatar=data.avatar===null?null:cleanAppearance(data.avatar);
          if(data.wardrobe!==undefined)patch.wardrobe=data.wardrobe;
          if(data.onboarded!==undefined)patch.onboarded=data.onboarded;
          if(data.tutorialDone!==undefined)patch.tutorialDone=data.tutorialDone;
          const view=await accounts.saveProfile(account.id,patch);
          // The name follows the account, so anyone already in the café sees it change.
          for(const peer of peers.values())if(peer.account===account.id&&view.handle)peer.name=view.handle;
          broadcast('guests',snapshot());
          return json(res,200,{account:view});
        }
        if(data.action==='check-name'){
          const handle=checkHandle(data.handle);if(handle.error)return json(res,200,{ok:false,error:handle.error});
          const me=data.id&&data.token?await accounts.resume(data.id,data.token):null;
          return json(res,200,accounts.handleTaken(handle.handle,me?.id)?{ok:false,error:'Someone already goes by that name. Try another.'}:{ok:true});
        }
        if(data.action==='forgot'){
          if(tooManyAttempts(who))return json(res,429,{error:'Too many attempts. Wait a few minutes, then try again.'});
          const email=checkEmail(data.email);if(email.error)return json(res,400,{error:email.error,field:'email'});
          const reset=await accounts.startReset(email.email);
          // No mail provider here. On a local playtest hand the link back so a
          // password can actually be reset; anywhere else it only gets logged.
          const link=reset?`/login.html?account=${encodeURIComponent(reset.accountId)}&reset=${encodeURIComponent(reset.token)}`:null;
          if(link)console.log('Password reset for '+email.email+': http://localhost:'+port+link);
          return json(res,200,{ok:true,...(local&&link?{link}:{})});
        }
        if(data.action==='reset'){
          const password=checkPassword(data.password);if(password.error)return json(res,400,{error:password.error,field:'password'});
          const account=await accounts.finishReset(data.id,data.reset,password.password);
          const token=await accounts.startSession(account.id);
          return json(res,200,{account,token});
        }
        return json(res,400,{error:'Unknown account action.'});
      }catch(error){
        return json(res,error.status||400,{error:error.message||'Something went wrong at the counter.',...(error.field?{field:error.field}:{})});
      }
    }
    if(req.method==='POST'&&url.pathname==='/api'){
      // Browser origins must match this server; no cross-site write access.
      if(req.headers.origin && req.headers.origin!==url.origin)return json(res,403,{error:'Origin mismatch.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>16384){json(res,413,{error:'Message too large.'});return;}}
      let data;try{data=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON.'});}
      if(data.action==='join'){
        if(peers.size>=16)return json(res,409,{error:'This playtest is full (16 guests).'});
        // A signed-in guest joins as their account: the café uses the saved
        // handle, so a member's name cannot be typed by somebody else.
        const account=data.accountId&&data.accountToken?await accounts.resume(data.accountId,data.accountToken):null;
        if(account){
          // One seat per account — a second tab replaces the first rather than
          // putting two copies of the same person in the room.
          for(const [id,other] of peers)if(other.account===account.id){peers.delete(id);leaveGroups(id);for(const c of clients)if(c.id===id){c.res.write(`event: replaced\ndata: {}\n\n`);c.res.end();}}
        }
        const name=account?.handle||(typeof data.name==='string'?data.name.trim().slice(0,24):'Maya');
        if(!name||/[\x00-\x1f\x7f]/.test(name))return json(res,400,{error:'Use a name with 1–24 printable characters.'});
        // Spawn on the pavement outside the door, on the free spot furthest from anyone already there.
        const spawn=[[0,8.3],[0.9,8.5],[-0.9,8.5],[0.9,7.9],[-0.9,7.9],[0,7.7]].map(([x,z])=>({x,z,gap:Math.min(9,...[...peers.values()].map(o=>Math.hypot(o.x-x,o.z-z)))})).sort((a,b)=>b.gap-a.gap)[0];
        const p={id:randomUUID(),token:randomUUID(),name,member:!!account,account:account?.id||null,
          appearance:cleanAppearance(data.appearance)||cleanAppearance(account?.avatar),
          x:spawn.x,z:spawn.z,angle:Math.PI,seatId:null,status:'available',statusDetail:null,
          lastChat:0,lastEmote:0,lastNpc:0,lastGroup:0,lastLook:0,joinedAt:Date.now()};
        peers.set(p.id,p);
        json(res,200,{...p,account:undefined});broadcast('guests',snapshot());return;
      }
      const p=peers.get(data.id);if(!p||p.token!==data.token)return json(res,401,{error:'Your session ended. Reload to rejoin.'});
      if(data.action==='rename'){
        const name=typeof data.name==='string'?data.name.trim():'';
        if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))return json(res,400,{error:'Use a name with 1–24 printable characters.'});
        // A member's name is their account handle, so renaming has to clear
        // the same uniqueness check the creator uses.
        if(p.account){
          const handle=checkHandle(name);if(handle.error)return json(res,400,{error:handle.error});
          if(accounts.handleTaken(handle.handle,p.account))return json(res,409,{error:'Someone already goes by that name. Try another.'});
          try{await accounts.saveProfile(p.account,{handle:handle.handle});}catch(e){return json(res,e.status||400,{error:e.message});}
          p.name=handle.handle;
        }else p.name=name;
      }else if(data.action==='look'){
        // Changing your look in the café: every other browser redresses you.
        if(Date.now()-p.lastLook<600)return json(res,429,{error:'Give that a moment.'});p.lastLook=Date.now();
        const appearance=cleanAppearance(data.appearance);
        if(!appearance)return json(res,400,{error:'That look could not be read.'});
        p.appearance=appearance;
        if(p.account)accounts.saveProfile(p.account,{avatar:appearance}).catch(()=>{});
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
        const s=seatOf(data.seatId);
        if(!s||!s.approach||Math.hypot(p.x-s.approach[0],p.z-s.approach[1])>1.15)return json(res,409,{error:'Walk closer to the seat.'});
        if([...peers.values()].some(o=>o.id!==p.id&&o.seatId===data.seatId))return json(res,409,{error:'That seat is taken. Try another.'});
        p.seatId=data.seatId;p.x=s.x;p.z=s.z;p.angle=s.angle;
      }else if(data.action==='stand'){
        const s=seatOf(p.seatId);if(s?.approach){[p.x,p.z]=s.approach;}p.seatId=null;
      }else if(data.action==='chat'){
        const message=typeof data.text==='string'?data.text.trim():'';
        if(!message||message.length>160||/[\x00-\x1f\x7f]/.test(message))return json(res,400,{error:'Use 1–160 printable characters.'});
        if(Date.now()-p.lastChat<750)return json(res,429,{error:'Give your last message a moment.'});p.lastChat=Date.now();
        for(const c of clients){const other=peers.get(c.id);if(other&&Math.hypot(other.x-p.x,other.z-p.z)<=8)c.res.write(`event: chat\ndata: ${JSON.stringify({name:p.name,text:message,id:p.id})}\n\n`);}
      }else if(data.action==='npc-chat'){
        const npc=data.npc,text=cleanText(data.text);
        if(!NPC_IDS.includes(npc))return json(res,400,{error:'Unknown regular.'});
        if(!text||text.length>280||!printable(text))return json(res,400,{error:'Use 1–280 printable characters.'});
        if(Date.now()-p.lastNpc<1200)return json(res,429,{error:'Give them a moment to reply.'});p.lastNpc=Date.now();
        const c=data.context||{};
        const ctx={activity:cleanText(c.activity).slice(0,80),timeOfDay:cleanText(c.timeOfDay).slice(0,30),levelLabel:cleanText(c.levelLabel).slice(0,30),level:cleanText(c.level).slice(0,20),crush:!!c.crush,playerName:p.name,
          memory:Array.isArray(c.memory)?c.memory.filter(m=>typeof m==='string').map(m=>m.slice(0,60)).slice(0,8):[],recent:Array.isArray(c.recent)?c.recent.filter(m=>typeof m==='string').slice(0,4):[]};
        const result=await npcReply(npc,text,data.history,ctx);
        return json(res,200,{...result,intent:intentOf(text)});
      }else if(data.action==='group-create'){
        const name=cleanText(data.name).slice(0,32);
        if(!name||!printable(name))return json(res,400,{error:'Give the group a name.'});
        if([...groups.values()].filter(g=>g.owner===p.id).length>=4)return json(res,409,{error:'You can own up to 4 groups.'});
        const g={id:randomUUID(),name,owner:p.id,members:new Set([p.id]),npcs:[],messages:[{system:true,text:p.name+' created “'+name+'”.',at:Date.now()}]};groups.set(g.id,g);pushGroup(g);return json(res,200,{ok:true,group:groupView(g)});
      }else if(data.action==='group-invite'){
        const g=groups.get(data.groupId);if(!g||!g.members.has(p.id))return json(res,404,{error:'Group not found.'});
        if(NPC_IDS.includes(data.npc)){if(!g.npcs.includes(data.npc)){g.npcs.push(data.npc);g.messages.push({system:true,text:PERSONAS[data.npc].name+' joined the group.',at:Date.now()});}}
        else{const other=peers.get(data.guest);if(!other)return json(res,404,{error:'That guest has left the café.'});if(g.members.size>=12)return json(res,409,{error:'Groups hold up to 12 guests.'});if(!g.members.has(other.id)){g.members.add(other.id);g.messages.push({system:true,text:other.name+' was added by '+p.name+'.',at:Date.now()});}}
        pushGroup(g);return json(res,200,{ok:true});
      }else if(data.action==='group-leave'){
        const g=groups.get(data.groupId);if(g)g.messages.push({system:true,text:p.name+' left.',at:Date.now()});
        leaveGroups(p.id);sendTo(p.id,'group-left',{id:data.groupId});return json(res,200,{ok:true});
      }else if(data.action==='group-message'){
        const g=groups.get(data.groupId);if(!g||!g.members.has(p.id))return json(res,404,{error:'Group not found.'});
        const text=cleanText(data.text);if(!text||text.length>280||!printable(text))return json(res,400,{error:'Use 1–280 printable characters.'});
        if(Date.now()-p.lastGroup<700)return json(res,429,{error:'Give your last message a moment.'});p.lastGroup=Date.now();
        const inv=data.invite,invite=inv&&['study','play','hangout'].includes(inv.kind)?{kind:inv.kind,place:cleanText(inv.place).slice(0,40),label:cleanText(inv.label).slice(0,60)}:null;
        g.messages.push({from:p.id,name:p.name,text,invite,at:Date.now()});if(g.messages.length>120)g.messages.splice(0,g.messages.length-120);pushGroup(g);
        // Regulars in the group chime in now and then (always when named), in character.
        const addressed=g.npcs.filter(id=>text.toLowerCase().includes(PERSONAS[id].name.toLowerCase()));
        const responders=addressed.length?addressed:g.npcs.filter(()=>Math.random()<.4).slice(0,1);
        for(const npc of responders){
          const history=g.messages.slice(-9,-1).filter(m=>!m.system).map(m=>m.npc===npc?{role:'assistant',content:m.text}:{role:'user',content:m.name+': '+m.text});
          const levels=data.levels&&typeof data.levels==='object'?data.levels:{};
          setTimeout(()=>npcReply(npc,p.name+': '+text,history,{activity:'chatting in the group chat “'+g.name+'”',playerName:p.name,levelLabel:cleanText(levels[npc]).slice(0,30)||'Acquaintance'}).then(({reply})=>{
            if(!groups.has(g.id))return;g.messages.push({npc,name:PERSONAS[npc].name,text:reply,at:Date.now()});pushGroup(g);
          }),900+Math.random()*1400);
        }
        return json(res,200,{ok:true});
      }else if(data.action==='groups'){
        return json(res,200,{groups:[...groups.values()].filter(g=>g.members.has(p.id)).map(groupView),ai:aiState});
      }else return json(res,400,{error:'Unknown café action.'});
      json(res,200,{ok:true,x:p.x,z:p.z,seatId:p.seatId});broadcast('guests',snapshot());return;
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
    // The front door is the sign-in journey; the café itself lives at /cafe.
    const raw=decodeURIComponent(url.pathname);
    const pathname=raw==='/'?'/login.html':raw==='/cafe'||raw==='/cafe/'?'/index.html':raw;
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root)||pathname.split('/').some(s=>s.startsWith('.'))||!PUBLIC.has(pathname)&&!/^\/(assets|games|systems)\//.test(pathname)&&!pathname.startsWith('/node_modules/three/'))return json(res,404,{error:'Not found.'});
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
// A local playtest server should complain and keep serving, not exit and sign
// everyone out. Node's default for an unhandled rejection is to kill it.
process.on('unhandledRejection',error=>console.warn('Unhandled rejection (café still open):',error?.message||error));
server.listen(port,host,()=>console.log(`Maple Bean is open: http://localhost:${port}\nThe café itself: http://localhost:${port}/cafe\nCtrl+C closes the local playtest.`));
