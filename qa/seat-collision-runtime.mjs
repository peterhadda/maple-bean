export default [{name:'01-blocked-rise-safe',run:`
const c=cafe;const st=c.layout.stations.find(s=>s.kind==='seat');if(!st)throw Error('No seat');
for(const n of c.regulars){if(n.life){n.life.scripted=true;n.ctl.scriptedBy=true;n.ctl.stop();}}
c.playerCtl.stop();Object.assign(c.me,{x:st.x,z:st.z,angle:st.angle});Object.assign(c.playerCtl,{posture:'seated',sit:1,seat:st,entry:{x:st.x,z:st.z+1,front:true}});
const n=c.npc('noah');Object.assign(n.life,{x:st.x,z:st.z+.7,visible:true});n.avatar.group.visible=true;n.ctl.posture='stand';n.ctl.sit=0;n.ctl.seat=null;
c.cameraMode('walk');c.controls.target.set(st.x,1,st.z);c.camera.position.set(st.x+3,3,st.z+3);c.controls.update();
let min=99,done=false,result;const p=c.playerCtl.standUp().then(v=>{done=true;result=v});const until=performance.now()+20000;while(!done&&performance.now()<until){await new Promise(requestAnimationFrame);min=Math.min(min,Math.hypot(c.me.x-n.life.x,c.me.z-n.life.z));}if(!done)throw Error('Rise timeout');if(result!==false||c.playerCtl.posture!=='seated'||min<.499)throw Error(JSON.stringify({result,min,posture:c.playerCtl.posture}));window.blocker=n;c.controls.dispatchEvent({type:'start'});c.controls.target.set(st.x,1,st.z);c.camera.position.set(st.x+3,2.7,st.z+3);c.controls.update();c.renderer.render(c.scene,c.camera);return {result,min,posture:c.playerCtl.posture,seat:st.id};
`},{name:'02-clear-rise-completes',run:`
blocker.life.x+=2;const result=await cafe.playerCtl.standUp();if(!result||cafe.playerCtl.posture!=='stand')throw Error('Clear exit failed');return {result,posture:cafe.playerCtl.posture};
`}];

