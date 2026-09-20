const sleep = 'const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const until=async(fn,ms=18000)=>{const t=performance.now();while(!fn()&&performance.now()-t<ms)await sleep(100);if(!fn())throw Error("condition timed out");};';
export default [
{name:'01-social-public-counter',run:sleep+`
 const c=cafe; c.cameraMode('walk'); Object.assign(c.me,{x:-4.7,z:-2.5}); c.playerCtl.stop();
 c.talkTo(c.npc('mara')); await until(()=>!document.getElementById('chatbox').hidden);
 const gap=Math.hypot(c.me.x-c.npc('mara').ctl.x,c.me.z-c.npc('mara').ctl.z);
 if(c.me.z < -3.9 || gap<.7)throw Error('unsafe bar approach');
 await sleep(1700); return {position:[c.me.x,c.me.z],gap,chat:c.chat.npc};`},
{name:'02-gift-needs-arrival',run:sleep+`
 cafe.chat.close(); Object.assign(cafe.me,{x:0,z:5.6}); const before=cafe.econ.coins;
 await cafe.useTarget({type:'npc',id:'mara'}); [...document.querySelectorAll('#npc-menu button')].find(b=>b.textContent.includes('cookie')).click();
 await sleep(100); if(cafe.econ.coins!==before)throw Error('remote gift paid immediately');
 cafe.playerCtl.stop(); await sleep(200); if(cafe.econ.coins!==before)throw Error('cancelled gift paid');
 return {before,after:cafe.econ.coins,script:cafe.script};`},
{name:'03-focus-controls',run:sleep+`
 const seat=cafe.seat('study-room-1'); Object.assign(cafe.me,{x:seat.approach[0],z:seat.approach[1]}); cafe.playerCtl.stop();
 cafe.studyAt(seat); await until(()=>cafe.state.posture==='seated'); cafe.beginFocus(seat,null);
 await until(()=>document.querySelector('[data-min="25"]')); document.querySelector('[data-min="25"]').click();
 await until(()=>cafe.focus?.stage==='study'); document.getElementById('focus-pause').click();
 const a=document.getElementById('focus-timer').textContent; await sleep(1300); const b=document.getElementById('focus-timer').textContent;
 if(a!==b)throw Error('paused focus advances'); document.getElementById('focus-pause').click();
 document.getElementById('focus-music-open').click();
 return {timer:b,buttons:[...document.querySelectorAll('#focus-hud button')].map(b=>b.textContent),music:!document.getElementById('focus-music').hidden,id:cafe.focus.id};`},
{name:'04-focus-cancel-no-reward',run:sleep+`
 const before=cafe.econ.coins; cafe.endFocus(false); await until(()=>!cafe.focus);
 if(cafe.econ.coins!==before)throw Error('cancelled focus rewarded');
 return {before,after:cafe.econ.coins};`},
];

