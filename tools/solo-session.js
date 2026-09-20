// Private hosted solo mode. Local multiplayer continues to use server.mjs.
import {PERSONAS, NPC_IDS, offlineReply, intentOf} from './npc-brain.js';
let player, onGroup=()=>{}, onLeave=()=>{};
const groups=new Map();
const view=g=>({...g,members:[{id:player.id,name:player.name,kind:'guest'}],npcs:g.npcs.map(id=>({id,name:PERSONAS[id].name,kind:'npc'}))});
export function connectSolo(update,leave){onGroup=update;onLeave=leave;}
export async function soloApi(data,layout){
 const seat=id=>{const [sid,n]=String(id||'').split('#');const s=layout.stations.find(s=>s.id===sid);return n===undefined?s:s?.seats?.[+n];};
 if(data.action==='join'){player={id:crypto.randomUUID(),name:String(data.name||'Maya').slice(0,24),x:0,z:8.3,angle:Math.PI,seatId:null};return {...player};}
 if(!player)throw Error('Enter the café first.');
 switch(data.action){
  case 'rename':player.name=String(data.name||'Maya').slice(0,24);break;
  case 'move':Object.assign(player,{x:data.x,z:data.z,angle:data.angle});break;
  case 'sit':{const s=seat(data.seatId);if(!s)throw Error('Seat not found.');Object.assign(player,{seatId:data.seatId,x:s.x,z:s.z,angle:s.angle});break;}
  case 'stand':{const s=seat(player.seatId);if(s?.approach)[player.x,player.z]=s.approach;player.seatId=null;break;}
  case 'npc-chat':return {reply:offlineReply(data.npc,data.text,{...data.context,playerName:player.name}),source:'offline',intent:intentOf(data.text)};
  case 'groups':return {groups:[...groups.values()].map(view),ai:'off'};
  case 'group-create':{const g={id:crypto.randomUUID(),name:String(data.name).slice(0,32),owner:player.id,npcs:[],messages:[]};groups.set(g.id,g);return {ok:true,group:view(g)};}
  case 'group-invite':{const g=groups.get(data.groupId);if(!g)throw Error('Group not found.');if(NPC_IDS.includes(data.npc)&&!g.npcs.includes(data.npc))g.npcs.push(data.npc);onGroup(view(g));break;}
  case 'group-leave':groups.delete(data.groupId);onLeave(data.groupId);break;
  case 'group-message':{const g=groups.get(data.groupId);if(!g)throw Error('Group not found.');g.messages.push({from:player.id,name:player.name,text:data.text,invite:data.invite,at:Date.now()});for(const id of g.npcs.slice(0,1))g.messages.push({npc:id,name:PERSONAS[id].name,text:offlineReply(id,data.text,{playerName:player.name}),at:Date.now()});g.messages=g.messages.slice(-60);onGroup(view(g));break;}
  case 'chat':throw Error('Nearby multiplayer chat is available in the desktop café.');
  case 'emote':break;
  default:throw Error('Unknown café action.');
 }
 return {ok:true,x:player.x,z:player.z,seatId:player.seatId};
}
