export default [{name:'01-blocked-npc-released',run:`
const originalFetch=window.fetch;window.qaResponses=[];window.fetch=async(...a)=>{const r=await originalFetch(...a);if(!r.ok)window.qaResponses.push(await r.clone().text());return r;};const c=cafe,st=c.layout.stations.find(s=>s.game==='xo'),n=c.npc('noah');c.cameraMode('walk');Object.assign(c.me,{x:st.seats[0].approach[0],z:st.seats[0].approach[1]});c.playerCtl.stop();Object.assign(n.life,{visible:true,scripted:false,phase:'idle',timer:100,seat:null,x:st.seats[1].approach[0],z:st.seats[1].approach[1]});n.ctl.scriptedBy=false;n.ctl.posture='stand';n.ctl.stop();
await c.startGame(st,n);if(!c.playing?.ctl)throw Error('Game did not start '+JSON.stringify(window.qaResponses));
const b=c.npc('claire'),s=n.ctl.seat,e=n.ctl.entry,dx=e.x-s.x,dz=e.z-s.z,len=Math.hypot(dx,dz);Object.assign(b.life,{visible:true,scripted:true,x:s.x+dx/len*.7,z:s.z+dz/len*.7});b.ctl.scriptedBy=true;b.ctl.stop();b.ctl.posture='stand';b.ctl.seat=null;b.ctl.sit=0;b.avatar.group.visible=true;
await c.leaveGame();const end=performance.now()+15000;while(n.ctl.scriptedBy&&performance.now()<end)await new Promise(requestAnimationFrame);
if(n.ctl.scriptedBy||n.ctl.seat||n.life.seat!==s||n.life.phase!=='seated')throw Error(JSON.stringify({scripted:n.ctl.scriptedBy,ctlSeat:n.ctl.seat?.id,lifeSeat:n.life.seat?.id,phase:n.life.phase}));
c.controls.dispatchEvent({type:'start'});c.controls.target.set(s.x,1,s.z);c.camera.position.set(s.x+3,3,s.z+3);c.controls.update();return {ctlSeat:n.ctl.seat,lifeSeat:n.life.seat.id,phase:n.life.phase,scripted:n.ctl.scriptedBy};
`}];

