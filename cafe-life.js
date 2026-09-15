import {findPath, followRoute} from './navigation.js';

export const menu={ 'Maple latte':5, 'Forest tea':3, 'Hot chocolate':4 };
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

export function resident(id,x,z,delay){return {id,x,z,angle:0,phase:'idle',timer:delay,route:[],seat:null,cup:false,sipping:false,walking:false,visible:true,visits:0};}
// Local ambience only: reuse the café's pathfinding and movement, with staggered waits.
export function updateResident(n,dt,layout,occupied,player,talking=false){
  n.walking=false;n.sipping=false;
  if(talking)return;
  const coffee=layout.stations.find(s=>s.kind==='coffee');
  function go(target,next){n.route=findPath(n,target,layout);if(!n.route.length){n.timer=3;return false;}n.phase=next;return true;}
  if(n.route.length){
    if(Math.hypot(n.x-player.x,n.z-player.z)<.55)return;
    const x=n.x,z=n.z;followRoute(n,n.route,dt,.95,layout);
    n.walking=Math.hypot(n.x-x,n.z-z)>.0001;
    if(n.walking){const a=Math.atan2(n.x-x,n.z-z),d=Math.atan2(Math.sin(a-n.angle),Math.cos(a-n.angle));n.angle+=d*Math.min(1,dt*7);}
    if(n.route.length)return;
    if(n.phase==='to-counter'){n.phase='ordering';n.timer=4+n.visits%3;n.angle=Math.PI;}
    else if(n.phase==='to-seat'){n.phase='seated';n.timer=22+(n.id==='claire'?13:0);n.x=n.seat.x;n.z=n.seat.z;n.angle=n.seat.angle;}
    else if(n.phase==='leaving'){n.phase='away';n.timer=12+(n.id==='claire'?9:0);n.visible=false;n.cup=false;}
    return;
  }
  n.timer-=dt;
  if(n.phase==='seated'){n.sipping=n.timer>2&&n.timer%8<1.8;if(n.timer>0)return;n.x=n.seat.approach[0];n.z=n.seat.approach[1];n.seat=null;n.cup=false;go({x:0,z:8.5},'leaving');return;}
  if(n.timer>0)return;
  if(n.phase==='idle'||n.phase==='away'){
    n.visible=true;n.visits++;go({x:coffee.approach[0],z:coffee.approach[1]},'to-counter');
  }else if(n.phase==='ordering'){
    const seats=layout.stations.filter(s=>['seat','read'].includes(s.kind)&&!occupied.has(s.id));
    const seat=seats[(n.visits+(n.id==='claire'?3:0))%seats.length];
    if(!seat){n.timer=4;return;}
    n.cup=true;if(go({x:seat.approach[0],z:seat.approach[1]},'to-seat'))n.seat=seat;
  }
}
