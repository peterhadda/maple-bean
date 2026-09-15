import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaya } from './maya-character.js';
import { cast } from './characters.js';
import { isWalkable, findPath } from './navigation.js';

const $=id=>document.getElementById(id), world=$('world');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function readSaved(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{toast('Browser storage is unavailable. Export your notes before closing.');}}
function download(data,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function failure(error){console.error(error);$('load-message').textContent='The café could not open. Start Cafe.cmd must be running, then reload this page.';}

let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(e){failure(e);throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;world.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label','3D café. Use the destination buttons or WASD to walk.');renderer.domElement.tabIndex=0;
const scene=new THREE.Scene();scene.background=new THREE.Color('#d5d6bd');scene.fog=new THREE.Fog('#d5d6bd',45,95);
const camera=new THREE.PerspectiveCamera(42,1,.1,150);camera.position.set(22,22,28);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.1,0);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=2;controls.maxDistance=52;controls.update();
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.45;pmrem.dispose();
const ambient=new THREE.HemisphereLight(0xffedd2,0x819178,2.1);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffdfad,3.3);sun.position.set(-9,17,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=3;
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.1,far:60});scene.add(sun);
const fill=new THREE.DirectionalLight(0xd7e8f7,1);fill.position.set(7,9,-7);scene.add(fill);
const lamps=[];
for(const [x,z] of [[-7,-3],[-3,-3],[2,-3],[7,-3],[-7,3],[-3,3],[2,3],[7,3]]){const l=new THREE.PointLight(0xffc775,6,6,2);l.position.set(x,2.55,z);scene.add(l);lamps.push(l);}
const fire=new THREE.PointLight(0xff9347,8,5,2);fire.position.set(8.6,.65,-4);scene.add(fire);
new ResizeObserver(()=>{const w=world.clientWidth,h=world.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(world);

let layout, maya, session, network, mode='overview', route=[], destination=null, seated=null, nearest=null, drink=null, sips=0, waveUntil=0;
const player=new THREE.Vector3(0,0,5.6), keys=new Set(), remote=new Map(), markers=[], beams=new THREE.Group();
const pointer=new THREE.Vector2(), ray=new THREE.Raycaster(), plane=new THREE.Plane(new THREE.Vector3(0,1,0),0), point=new THREE.Vector3();
let cameraTween=null, previousPlayer=player.clone();
const collisionGroup=new THREE.Group();collisionGroup.visible=false;scene.add(collisionGroup,beams);

async function api(data){
  const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,id:session?.id,token:session?.token})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'The café connection was interrupted.');return result;
}
function label(text,position,className=''){
  const el=document.createElement('button');el.className='world-label '+className;el.textContent=text;$('labels').append(el);
  const marker={el,position};markers.push(marker);return marker;
}

// Merge the static building by material: hundreds of floorboards and books become
// a few draws, while the editable Blender file keeps every original object.
function addCafe(root){
  root.updateMatrixWorld(true);const batches=new Map();
  root.traverse(o=>{
    if(!o.isMesh)return;
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
    for(const a of Object.keys(geometry.attributes))if(!['position','normal'].includes(a))geometry.deleteAttribute(a);
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    const g=geometry.index?geometry.toNonIndexed():geometry;
    if(g!==geometry)geometry.dispose();
    const overhead=/Ceiling_beam|Pendant_cord|Pendant_shade|Pendant_warm_diffuser/.test(o.name);
    const mat=o.material,key=mat.uuid+overhead;
    if(!batches.has(key))batches.set(key,{mat,parts:[],overhead});batches.get(key).parts.push(g);
  });
  for(const {mat,parts,overhead} of batches.values()){
    const geometry=mergeGeometries(parts),m=new THREE.Mesh(geometry,mat);parts.forEach(g=>g.dispose());
    m.castShadow=true;m.receiveShadow=true;(overhead?beams:scene).add(m);
  }
}

function cameraMode(next){
  mode=next;document.body.classList.toggle('walking',mode==='walk');$('welcome').hidden=mode!=='overview';
  for(const id of ['overview','walk','plan'])$(id).classList.toggle('selected',id===mode);
  const target=mode==='walk'?player.clone().add(new THREE.Vector3(0,1,0)):new THREE.Vector3(0,.15,0);
  const position=mode==='walk'?player.clone().add(new THREE.Vector3(3.7,3.5,5)):mode==='plan'?new THREE.Vector3(0,28,.02):new THREE.Vector3(22,22,28);
  cameraTween={from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),target,t:0};
  controls.maxPolarAngle=mode==='plan'?.10:Math.PI*.48;controls.enablePan=mode!=='walk';controls.minDistance=mode==='walk'?1.8:10;controls.maxDistance=mode==='walk'?14:52;
  beams.visible=mode!=='plan'&&$('show-beams').checked;previousPlayer.copy(player);
}
for(const id of ['overview','walk','plan'])$(id).onclick=()=>cameraMode(id);
$('enter').onclick=()=>cameraMode('walk');$('cafe-nav').onclick=()=>cameraMode('overview');

function openDialog(html){route=[];destination=null;keys.clear();$('dialog-content').innerHTML=html;$('dialog').showModal();}
$('dialog-close').onclick=()=>$('dialog').close();
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}});
async function stand(){
  if(!seated)return;
  try{const result=await api({action:'stand'});player.set(result.x,0,result.z);seated=null;previousPlayer.copy(player);$('activity').textContent='Taking a little wander';}catch(e){toast(e.message);}
}
async function interact(station=nearest){
  if(seated){await stand();return;}if(!station)return;
  if(Math.hypot(player.x-station.approach[0],player.z-station.approach[1])>1.15){goTo(station.id);return;}
  if(station.kind==='seat'||station.kind==='read'){
    try{await api({action:'move',x:player.x,z:player.z,angle:maya.group.rotation.y});await api({action:'sit',seatId:station.id});seated=station;player.set(station.x,0,station.z);maya.group.rotation.y=station.angle;route=[];destination=null;$('activity').textContent=station.kind==='read'?'One more chapter…':'Settled in. No hurry.';toast(station.kind==='read'?'A quiet chapter, a warm cup. Press E or Esc to get up.':'Make yourself comfortable. Press E or Esc to stand.');}catch(e){toast(e.message);}
  }else if(station.kind==='coffee'){
    openDialog('<div class="eyebrow">FRESHLY MADE · ON THE HOUSE FOR PLAYTESTING</div><h2>Your usual, or<br>something new?</h2><p>Mara has the kettle on. Choose a little comfort.</p><button class="menu-item" data-order="Maple latte"><span>Maple latte<small>Espresso · steamed milk · a little maple</small></span><b>Try it ↗</b></button><button class="menu-item" data-order="Forest tea"><span>Forest tea<small>Herbal · warming · unhurried</small></span><b>Try it ↗</b></button><button class="menu-item" data-order="Hot chocolate"><span>Hot chocolate<small>Dark cocoa · vanilla · soft milk foam</small></span><b>Try it ↗</b></button>');
    document.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>{drink=b.dataset.order;sips=3;$('drink').textContent='☕ '+drink;$('sip').hidden=false;$('dialog').close();toast('Mara: “Here you go. Find your favourite spot.”');$('activity').textContent='A fresh '+drink.toLowerCase()+' in hand';});
  }else{
    if(station.id==='claire'){
      openDialog('<div class="eyebrow">CLAIRE · CREATIVE SOUL & COFFEE ENTHUSIAST</div><h2>A good day starts<br>with a little curiosity.</h2><p>“I brought my sketchbook. Something about this place makes ordinary afternoons feel like the start of a story. Want to keep me company?”</p><div class="dialog-actions"><button id="claire-hello">I’d love to</button><a class="secondary" href="/maya.html?character=claire">Meet Claire in the studio ↗</a></div>');
      $('claire-hello').onclick=()=>{waveUntil=performance.now()/1000+2.3;$('dialog').close();toast('Claire: “Perfect. I’ll save you a spot and a page.”');$('activity').textContent='A new friend in Maple Hollow';};return;
    }
    const mara=station.id==='mara';
    openDialog(`<div class="eyebrow">${mara?'MARA · YOUR NEIGHBOURHOOD BARISTA':'JULES · CAFÉ REGULAR'}</div><h2>${mara?'Welcome back, neighbour.':'There’s always room for one more.'}</h2><p>${mara?'“We made the café bigger, but the idea is the same: somewhere you can feel at home. What brings you in today?”':'“I was just thinking this table needs a good board-game night. Or we could put the world to rights over coffee.”'}</p><div class="dialog-actions"><button data-reply="quiet">A little peace and quiet</button><button data-reply="friends">Some good company</button></div>`);
    document.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>{waveUntil=performance.now()/1000+2.3;$('dialog').close();toast(b.dataset.reply==='quiet'?'“The reading nook has your name on it.”':'“Then you’re exactly where you should be.”');$('activity').textContent='Getting to know the neighbourhood';});
  }
}
$('interact-button').onclick=()=>interact();
async function goTo(id){
  if(!layout)return;if(seated){await stand();if(seated)return;}
  const station=layout.stations.find(s=>s.id===id);if(!station)return;
  const path=findPath(player,{x:station.approach[0],z:station.approach[1]},layout);
  if(!path.length){toast('That route is tight. Walk closer and try again.');return;}
  destination=station;route=path;cameraMode('walk');$('activity').textContent='On the way · '+station.label;
}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goTo(b.dataset.go));
$('wave').onclick=()=>{waveUntil=performance.now()/1000+2.5;toast('A friendly hello!');};
$('sip').onclick=()=>{if(!drink)return;waveUntil=performance.now()/1000+1.4;sips--;toast(sips?'A warm sip. Take your time.':'Last sip. That hit the spot.');if(!sips){drink=null;$('drink').textContent='☕ A lovely little pause.';$('sip').hidden=true;}};

const typing=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable||$('dialog').open;
addEventListener('keydown',e=>{
  if(e.code==='Escape'){keys.clear();route=[];destination=null;if(!$('dialog').open)stand();return;}
  if(typing())return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);route=[];destination=null;if(mode!=='walk')cameraMode('walk');if(seated)stand();}
  if(e.code==='KeyE'&&!e.repeat)interact();
  if(e.code==='KeyF'&&!e.repeat)waveUntil=performance.now()/1000+2.5;
});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>keys.clear());
let down=null;
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};renderer.domElement.focus();});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||e.button!==0||seated||!layout)return;
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
  if(ray.ray.intersectPlane(plane,point)&&isWalkable(point.x,point.z,layout)){route=findPath(player,point,layout);destination=null;if(mode!=='walk')cameraMode('walk');}
});
controls.addEventListener('start',()=>{cameraTween=null;});

$('lighting').onchange=()=>{
  const mode=$('lighting').value,evening=mode==='evening';
  sun.intensity=evening?.16:mode==='day'?3.6:3.3;ambient.intensity=evening?.6:2.1;fill.intensity=evening?.15:1;scene.environmentIntensity=evening?.18:.45;
  lamps.forEach(l=>l.intensity=evening?24:6);fire.intensity=evening?20:8;renderer.toneMappingExposure=evening?1.4:1.25;
  scene.background.set(evening?'#444e47':'#d5d6bd');scene.fog.color.copy(scene.background);
};
let audio=null;
$('sound').onclick=async()=>{
  if(!audio){
    const context=new AudioContext(),gain=context.createGain();gain.gain.value=.022;gain.connect(context.destination);
    for(const hz of [130.81,164.81,196,246.94]){const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=hz;g.gain.value=.15;o.connect(g).connect(gain);o.start();}
    const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.025)/1.02;data[i]=last;}
    const noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;noise.connect(gain);noise.start();audio={context,on:true};
  }else{audio.on=!audio.on;await audio.context[audio.on?'resume':'suspend']();}
  $('sound').textContent=audio.on?'♪ Sound on':'♪ Sound off';$('sound').setAttribute('aria-pressed',String(audio.on));
};
$('photo').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)download(blob,'Maple-Bean-'+Date.now()+'.png','image/png');});toast('A little memory, saved.');};

let notes=readSaved('maple-bean-notes',[]);if(!Array.isArray(notes))notes=[];
function showNotes(){
  $('note-count').textContent=notes.length;$('notes').replaceChildren();
  notes.forEach((note,i)=>{const el=document.createElement('article');el.className='note';const small=document.createElement('small');small.textContent=note.kind+' · '+new Date(note.date).toLocaleDateString();const p=document.createElement('p');p.textContent=note.text;const button=document.createElement('button');button.textContent='Delete note';button.onclick=()=>{notes.splice(i,1);save('maple-bean-notes',notes);showNotes();};el.append(small,p,button);$('notes').append(el);});
}
showNotes();$('review-open').onclick=()=>{$('review').hidden=!$('review').hidden;$('chat').hidden=true;keys.clear();};$('review-close').onclick=()=>$('review').hidden=true;
$('note-form').onsubmit=e=>{e.preventDefault();const text=$('note-text').value.trim();if(!text)return;notes.push({kind:$('note-kind').value,text,date:new Date().toISOString(),position:{x:+player.x.toFixed(2),z:+player.z.toFixed(2)},camera:camera.position.toArray(),lighting:$('lighting').value});save('maple-bean-notes',notes);$('note-text').value='';showNotes();toast('Saved in your playtest notebook.');};
$('export-notes').onclick=()=>download(JSON.stringify({project:'Maple Bean expanded café',date:new Date().toISOString(),notes},null,2),'Maple-Bean-playtest-notes.json','application/json');
$('show-collisions').onchange=()=>collisionGroup.visible=$('show-collisions').checked;
$('show-beams').onchange=()=>beams.visible=mode!=='plan'&&$('show-beams').checked;
$('chat-toggle').onclick=()=>{$('chat').hidden=!$('chat').hidden;$('review').hidden=true;keys.clear();if(!$('chat').hidden)$('chat-input').focus();};$('chat-close').onclick=()=>$('chat').hidden=true;
function chatLine(name,text){const line=document.createElement('p');line.className='chat-line';const b=document.createElement('b');b.textContent=name;line.append(b,document.createTextNode(text));$('chat-messages').append(line);if($('chat-messages').children.length>80)$('chat-messages').firstChild.remove();$('chat-messages').scrollTop=$('chat-messages').scrollHeight;}
$('chat-form').onsubmit=async e=>{e.preventDefault();try{await api({action:'chat',text:$('chat-input').value});$('chat-input').value='';}catch(e){toast(e.message);}};
$('rename').onclick=()=>{openDialog('<div class="eyebrow">PULL UP A CHAIR</div><h2>What should we call you?</h2><form id="name-form"><input id="name-input" maxlength="24" required aria-label="Your guest name"><button class="primary">Save name</button></form>');$('name-input').value=session?.name||'Maya';$('name-form').onsubmit=async e=>{e.preventDefault();const name=$('name-input').value.trim();try{await api({action:'rename',name});session.name=name;$('player-name').textContent=name;save('maple-bean-name',name);$('dialog').close();}catch(e){toast(e.message);}};};

function connect(){
  network=new EventSource(`/events?id=${session.id}&token=${session.token}`);
  network.addEventListener('guests',e=>{
    const guests=JSON.parse(e.data),ids=new Set();$('guest-count').textContent=`${guests.length} ${guests.length===1?'guest':'guests'} in the café`;
    for(const guest of guests){if(guest.id===session.id)continue;ids.add(guest.id);let item=remote.get(guest.id);
      if(!item){const avatar=createMaya(cast.maya),marker=label(guest.name,new THREE.Vector3(guest.x,1.95,guest.z),'guest');item={avatar,marker,data:guest};scene.add(avatar.group);avatar.group.position.set(guest.x,0,guest.z);remote.set(guest.id,item);}item.data=guest;item.marker.el.textContent=guest.name;
    }
    for(const [id,item] of remote)if(!ids.has(id)){scene.remove(item.avatar.group);item.marker.el.remove();markers.splice(markers.indexOf(item.marker),1);remote.delete(id);}
  });
  network.addEventListener('chat',e=>{const data=JSON.parse(e.data);chatLine(data.name,data.text);if($('chat').hidden&&data.id!==session.id)toast(data.name+': '+data.text);});
  network.onerror=()=>{$('guest-count').textContent='Connection interrupted';};
}

try{
  [layout]=await Promise.all([fetch('/assets/layout.json').then(r=>r.json()),new GLTFLoader().loadAsync('/assets/cafe.glb').then(g=>addCafe(g.scene))]);
  $('load-message').textContent='Maya is getting ready…';await new Promise(r=>setTimeout(r,30));
  maya=createMaya(cast.maya);scene.add(maya.group);maya.group.rotation.y=Math.PI;
  for(const o of layout.obstacles){const mesh=new THREE.Mesh(new THREE.BoxGeometry(o.w+.48,.12,o.d+.48),new THREE.MeshBasicMaterial({color:0xd06b4c,wireframe:true}));mesh.position.set(o.x,.10,o.z);collisionGroup.add(mesh);}
  for(const station of layout.stations){
    const marker=label(station.kind==='coffee'?'☕ The coffee bar':station.id==='sofa'?'The living room':station.id==='reading'?'The reading nook':station.kind==='talk'?cast[station.id]?.name||'Guest':'Take a seat',new THREE.Vector3(station.x,station.kind==='talk'?2.05:1.3,station.z));marker.station=station;marker.el.onclick=()=>goTo(station.id);
  }
  const regulars=[];
  for(const [id,x,z,angle] of [['mara',-4.7,-3.3,0],['jules',3,-.2,-.7],['claire',-3.1,1.0,.35]]){
    $('load-message').textContent=`${cast[id].name} is pulling up a chair…`;
    await new Promise(resolve=>setTimeout(resolve,30));
    const actor=createMaya(cast[id]);actor.group.position.set(x,0,z);actor.group.rotation.y=angle;scene.add(actor.group);regulars.push(actor);
  }
  session=await api({action:'join',name:readSaved('maple-bean-name','Maya')});$('player-name').textContent=session.name;connect();
  let last=performance.now(),lastNetwork=0,lastStats=0,frameCount=0;
  const direction=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),projected=new THREE.Vector3();
  let sending=false;
  renderer.setAnimationLoop(ms=>{
    const dt=Math.min(.04,(ms-last)/1000),t=ms/1000;last=ms;direction.set(0,0,0);let moving=false;
    if(!seated&&!$('dialog').open){
      if(keys.size){
        camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,new THREE.Vector3(0,1,0));
        if(keys.has('KeyW')||keys.has('ArrowUp'))direction.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))direction.sub(forward);
        if(keys.has('KeyD')||keys.has('ArrowRight'))direction.add(right);if(keys.has('KeyA')||keys.has('ArrowLeft'))direction.sub(right);
      }else if(route.length){const p=route[0];direction.set(p.x-player.x,0,p.z-player.z);if(direction.length()<.09){route.shift();direction.set(0,0,0);if(!route.length&&destination){const s=destination;destination=null;interact(s);}}}
      if(direction.lengthSq()>.0001){direction.normalize();const speed=1.75*dt;
        if(isWalkable(player.x+direction.x*speed,player.z,layout))player.x+=direction.x*speed;
        if(isWalkable(player.x,player.z+direction.z*speed,layout))player.z+=direction.z*speed;
        moving=player.distanceToSquared(previousPlayer)>.000001;
        if(moving){const angle=Math.atan2(direction.x,direction.z),diff=Math.atan2(Math.sin(angle-maya.group.rotation.y),Math.cos(angle-maya.group.rotation.y));maya.group.rotation.y+=diff*Math.min(1,dt*12);$('activity').textContent='A little wander through the café';}
      }
    }
    maya.group.position.copy(player);maya.update(t,dt,{walking:moving,sitting:!!seated,seatHeight:seated?.seatHeight??.54,wave:t<waveUntil,expression:seated||t<waveUntil?'happy':'neutral'});
    for(const npc of regulars)npc.update(t,dt,{expression:'happy'});
    for(const item of remote.values()){
      const d=item.data,avatar=item.avatar,old=avatar.group.position.clone();avatar.group.position.x=THREE.MathUtils.damp(avatar.group.position.x,d.x,12,dt);avatar.group.position.z=THREE.MathUtils.damp(avatar.group.position.z,d.z,12,dt);avatar.group.rotation.y=d.angle;avatar.update(t,dt,{sitting:!!d.seatId,seatHeight:layout.stations.find(s=>s.id===d.seatId)?.seatHeight??.54,walking:old.distanceTo(avatar.group.position)>.003});item.marker.position.copy(avatar.group.position).add(new THREE.Vector3(0,1.95,0));
    }
    if(cameraTween){const a=cameraTween;a.t=Math.min(1,a.t+dt/(reduced?.01:1.1));const k=a.t*a.t*(3-2*a.t);camera.position.lerpVectors(a.from,a.to,k);controls.target.lerpVectors(a.fromTarget,a.target,k);if(a.t===1)cameraTween=null;}
    else if(mode==='walk'){const delta=player.clone().sub(previousPlayer);camera.position.add(delta);controls.target.add(delta);}
    previousPlayer.copy(player);controls.update();
    nearest=null;let best=1.2;
    for(const s of layout.stations){const d=Math.hypot(player.x-s.approach[0],player.z-s.approach[1]);if(d<best){best=d;nearest=s;}}
    $('interaction').hidden=!seated&&!nearest||mode!=='walk';$('interaction-text').textContent=seated?'Stay as long as you like.':nearest?.label||'';$('interact-button').textContent=seated?'Stand up':nearest?.kind==='coffee'?'See menu':nearest?.kind==='talk'?'Say hello':'Take a seat';
    for(const marker of markers){
      projected.copy(marker.position).project(camera);const s=marker.station;
      const show=!s||mode==='plan'||mode==='overview'?(!s||['coffee','read','talk'].includes(s.kind)||s.id==='sofa'):camera.position.distanceTo(marker.position)<8;
      marker.el.hidden=!show||projected.z>1||projected.z< -1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1;
      marker.el.style.left=(projected.x*.5+.5)*world.clientWidth+'px';marker.el.style.top=(-projected.y*.5+.5)*world.clientHeight+'px';marker.el.classList.toggle('near',!!s&&s===nearest);
    }
    fire.intensity=($('lighting').value==='evening'?20:8)*(1+.045*Math.sin(t*6)+.02*Math.sin(t*11));
    renderer.render(scene,camera);frameCount++;
    if(ms-lastNetwork>200&&!sending){lastNetwork=ms;sending=true;api({action:'move',x:player.x,z:player.z,angle:maya.group.rotation.y}).catch(()=>{}).finally(()=>sending=false);}
    if(ms-lastStats>1500){$('stats').textContent=`${Math.round(frameCount*1000/(ms-lastStats))} fps · ${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k triangles. 280 m², expanded from 120 m².`;frameCount=0;lastStats=ms;}
    window.__ready=true;
  });
  $('loading').style.opacity=0;setTimeout(()=>$('loading').hidden=true,550);
  window.cafe={scene,camera,renderer,maya,layout,player,goTo,interact,stand,cameraMode,get state(){return {mode,seated:seated?.id,route:route.length,drink,session:session?.id,remote:remote.size};}};
}catch(e){failure(e);}
