export default [
{name:'01-snake-at-machine',run:`
 const c=cafe,st=c.layout.stations.find(s=>s.game==='snake');c.cameraMode('walk');Object.assign(c.me,{x:st.approach[0],z:st.approach[1]});c.playerCtl.stop();
 await c.startGame(st,null);await new Promise(r=>setTimeout(r,1700));
 if(!c.playing?.ctl)throw Error('Snake did not launch');
 return {game:c.state.playing,position:[c.me.x,c.me.z],approach:st.approach,activity:c.playerCtl.activity,hud:!document.getElementById('game-hud').hidden};`},
{name:'02-return-from-game',run:`
 const before=cafe.econ.coins;await cafe.leaveGame();await new Promise(r=>setTimeout(r,1400));
 if(cafe.playing)throw Error('game did not end');if(cafe.econ.coins!==before)throw Error('leaving paid rewards');
 return {coins:before,posture:cafe.state.posture,hud:document.getElementById('game-hud').hidden};`},
{name:'03-settled-social-camera',run:`
 Object.assign(cafe.me,{x:-4.7,z:-2.5});cafe.playerCtl.stop();await cafe.talkTo(cafe.npc('mara'));await new Promise(r=>setTimeout(r,1700));
 return {chat:cafe.chat.npc,position:[cafe.me.x,cafe.me.z]};`}
];
