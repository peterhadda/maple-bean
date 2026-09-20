import {findPath, followRoute, isWalkable, clearOfPeople} from './navigation.js';

// The Maple Bean menu. Prices are in Maple Coins; `cup` tints the drink surface.
export const menu={ 'Maple latte':5, 'Latte':4, 'Coffee':3, 'Matcha latte':5, 'Forest tea':3, 'Hot chocolate':4 };
export const DRINKS={
  'Maple latte':{emoji:'🍁',color:'#b98552',note:'Real maple, a little cinnamon'},
  'Latte':{emoji:'☕',color:'#c9a27c',note:'Silky and simple'},
  'Coffee':{emoji:'☕',color:'#3b2418',note:'Small-roaster drip, strong but kind'},
  'Matcha latte':{emoji:'🍵',color:'#8fb56a',note:'Whisked ceremonial matcha, oat milk'},
  'Forest tea':{emoji:'🫖',color:'#a86a3a',note:'Pine, rosehip and black tea'},
  'Hot chocolate':{emoji:'🍫',color:'#5c3726',note:'Thick, with a marshmallow'},
};
export const FAVOURITES={noah:'Maple latte',claire:'Matcha latte',jules:'Coffee',mara:'Maple latte'};
export function buyDrink(wallet,name){
  if(!Object.hasOwn(menu,name))throw new Error('Choose a drink from the menu.');
  if(wallet.drink)throw new Error('Finish your current drink first.');
  if(!Number.isInteger(wallet.coins)||wallet.coins<menu[name])throw new Error('Not enough café coins. Refill your playtest wallet at the counter.');
  return {coins:wallet.coins-menu[name],drink:name,sips:3};
}
export function sipDrink(wallet){
  if(!wallet.drink||wallet.sips<1)throw new Error('Order a drink first.');
  return {...wallet,sips:wallet.sips-1,drink:wallet.sips===1?null:wallet.drink};
}

// ---------------------------------------------------------------- seating choreography
// People never walk through a chair back: they step beside the chair and lower
// themselves onto it sideways, or turn and sit back onto a sofa approached from
// the front. `entryPoint` is where that final movement starts.
const facing=a=>({x:Math.sin(a),z:Math.cos(a)});
export function entryPoint(seat,seats=[],occupied=new Set()){
  const f=facing(seat.angle),ax=seat.approach[0]-seat.x,az=seat.approach[1]-seat.z;
  const front=ax*f.x+az*f.z;
  if(front>.3)return {x:seat.approach[0],z:seat.approach[1],front:true};
  const r={x:Math.cos(seat.angle),z:-Math.sin(seat.angle)};
  let side=ax*r.x+az*r.z;
  if(Math.abs(side)<.3){
    // Pick the side with more room from neighbouring seats (occupied ones count double).
    const room=s=>Math.min(9,...seats.filter(o=>o!==seat&&o.id!==seat.id).map(o=>Math.hypot(o.x-(seat.x+r.x*s*.5),o.z-(seat.z+r.z*s*.5))/(occupied.has(o.id)?2:1)));
    side=room(1)>=room(-1)?1:-1;
  }
  side=Math.sign(side);
  return {x:seat.x+r.x*side*.5-f.x*.12,z:seat.z+r.z*side*.5-f.z*.12,front:false};
}
export const smoothstep=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const SIT_SECONDS=1.0, STAND_SECONDS=.85;

// Seat motion sweeps people just like walking, but may cross the chair footprint.
function peopleStepClear(body, x, z, layout) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x-body.x,z-body.z)/.04));
  for (let i=1;i<=steps;i++) if (!clearOfPeople(body, body.x+(x-body.x)*i/steps, body.z+(z-body.z)*i/steps, layout)) return false;
  return true;
}
export function advanceSeatTransition(state, body, dt, from, to, duration, layout) {
  const motion = state.seatMotion ||= {t:0,blocked:0,retreating:false};
  const next = Math.max(0,Math.min(duration,motion.t+(motion.retreating?-dt:dt))), k=smoothstep(next/duration);
  const x=from.x+(to.x-from.x)*k,z=from.z+(to.z-from.z)*k;
  if (peopleStepClear(body,x,z,layout)) { body.x=x;body.z=z;motion.t=next;motion.blocked=0; }
  else { motion.blocked+=dt;if(motion.blocked>=1.5)motion.retreating=true; }
  const cancelled=motion.retreating&&motion.t<=0,done=motion.t>=duration||cancelled;
  const result={k:smoothstep(motion.t/duration),done,cancelled};
  if(done)delete state.seatMotion;
  return result;
}

// ---------------------------------------------------------------- ambient regulars
export function resident(id,x,z,delay){return {id,x,z,angle:0,phase:'idle',timer:delay,route:[],seat:null,entry:null,sit:0,cup:false,drink:null,sipping:false,walking:false,visible:true,visits:0,talking:false,studying:false,waitForService:false,served:false};}
// Local ambience only: reuse the café's pathfinding and movement, with staggered waits.
export function updateResident(n,dt,layout,occupied,player,talking=false){
  n.walking=false;n.sipping=false;n.talking=talking;
  n.studying=n.phase==='seated'&&['read','study'].includes(n.seat?.kind);
  if(talking||n.scripted)return;
  const coffee=layout.stations.find(s=>s.kind==='coffee');
  function go(target,next){n.route=findPath(n,target,layout);if(!n.route.length){n.timer=3;return false;}n.phase=next;return true;}
  const turnTo=(a,rate)=>{const d=Math.atan2(Math.sin(a-n.angle),Math.cos(a-n.angle));n.angle+=d*Math.min(1,dt*rate);};
  // Final, choreographed steps between an entry point and the seat itself.
  if(n.phase==='sidling'||n.phase==='sidling-out'){
    const to=n.phase==='sidling'?n.entry:{x:n.seat.approach[0],z:n.seat.approach[1]};
    const dx=to.x-n.x,dz=to.z-n.z,d=Math.hypot(dx,dz),step=Math.min(d,.8*dt);
    if(d>.02){
      const x=n.x+dx/d*step,z=n.z+dz/d*step;
      if(peopleStepClear(n,x,z,layout)){n.x=x;n.z=z;n.walking=true;n.sidlingBlocked=0;turnTo(Math.atan2(dx,dz),8);}
      else{n.sidlingBlocked=(n.sidlingBlocked||0)+dt;if(n.sidlingBlocked>=1.5){const leaving=n.phase==='sidling-out';n.seat=null;n.entry=null;n.phase='idle';n.timer=3;n.sidlingBlocked=0;if(leaving)go({x:0,z:8.5},'leaving');}}
      return;
    }
    n.sidlingBlocked=0;delete n.seatMotion;
    if(n.phase==='sidling'){n.phase='sitting-down';n.timer=SIT_SECONDS;}
    else{n.seat=null;n.entry=null;go({x:0,z:8.5},'leaving');}
    return;
  }
  if(n.phase==='sitting-down'||n.phase==='standing-up'){
    const sitting=n.phase==='sitting-down',duration=sitting?SIT_SECONDS:STAND_SECONDS;
    const [from,to]=sitting?[n.entry,n.seat]:[n.seat,n.entry];
    const motion=advanceSeatTransition(n,n,dt,from,to,duration,layout);turnTo(n.seat.angle,10);
    n.sit=sitting?motion.k:1-motion.k;
    if(!motion.done)return;
    if(motion.cancelled){
      if(sitting){n.phase='idle';n.timer=3;n.seat=null;n.entry=null;n.sit=0;}
      else{n.phase='seated';n.sit=1;n.timer=3;}
    }else if(sitting){n.phase='seated';n.sit=1;n.timer=22+(n.id==='claire'?13:0);n.x=n.seat.x;n.z=n.seat.z;n.angle=n.seat.angle;}
    else{n.sit=0;n.phase='sidling-out';}
    return;
  }
  if(n.route.length){
    // Shared movement handles people and can reroute around them. Keep the
    // legacy caller's player guard only when no live occupancy list exists.
    if(!layout.people&&Math.hypot(n.x-player.x,n.z-player.z)<.55)return;
    const x=n.x,z=n.z;followRoute(n,n.route,dt,.95,layout);
    n.walking=Math.hypot(n.x-x,n.z-z)>.0001;
    n.stalledFor=n.walking||!n.route.length?0:(n.stalledFor||0)+dt;
    if(n.stalledFor>8){n.route=[];n.seat=null;n.entry=null;n.phase='idle';n.timer=3;n.stalledFor=0;return;}
    if(n.walking)turnTo(Math.atan2(n.x-x,n.z-z),7);
    if(n.route.length)return;
    if(n.phase==='to-counter'){n.phase='ordering';n.timer=4+n.visits%3;n.angle=Math.PI;n.served=false;n.drink=FAVOURITES[n.id]||'Latte';}
    else if(n.phase==='to-seat'){n.entry=entryPoint(n.seat,layout.stations.filter(s=>['seat','read','study'].includes(s.kind)),occupied);n.phase='sidling';}
    else if(n.phase==='leaving'){n.phase='away';n.timer=12+(n.id==='claire'?9:0);n.visible=false;n.cup=false;n.drink=null;}
    return;
  }
  n.timer-=dt;
  if(n.phase==='seated'){n.sipping=n.cup&&n.timer>2&&n.timer%8<1.8;if(n.timer>0)return;n.phase='standing-up';delete n.seatMotion;n.timer=STAND_SECONDS;n.cup=false;return;}
  if(n.phase==='ordering'){
    // Wait at the counter until the barista hands the drink over (when a
    // barista is on shift), otherwise pick it up after a short wait.
    if(n.waitForService&&!n.served)return;
    if(!n.waitForService&&n.timer>0)return;
    const seats=layout.stations.filter(s=>['seat','read','study'].includes(s.kind)&&!occupied.has(s.id));
    const seat=(n.id==='noah'&&seats.find(s=>s.kind==='study'))||seats[(n.visits+(n.id==='claire'?3:0))%seats.length];
    if(!seat){n.timer=4;return;}
    n.cup=true;if(go({x:seat.approach[0],z:seat.approach[1]},'to-seat'))n.seat=seat;
    return;
  }
  if(n.timer>0)return;
  if(n.phase==='idle'||n.phase==='away'){
    if(n.phase==='away'){
      const spawn=[0,.8,-.8].map(x=>({x,z:8.4})).find(s=>isWalkable(s.x,s.z,layout)&&!(layout.people||[]).some(p=>p!==n&&p.visible!==false&&Math.hypot(p.x-s.x,p.z-s.z)<.65));
      if(!spawn){n.timer=1;return;}n.x=spawn.x;n.z=spawn.z;
    }
    n.visible=true;n.visits++;
    go({x:coffee.approach[0]+((n.visits+n.id.length)%3-1)*.7,z:coffee.approach[1]+.25},'to-counter');
  }
}

