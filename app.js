import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaya as createCharacter, loadCharacters } from './assets/characters/runtime.js';
import { polishMaterial, worldUV, addVisualDetails, refineCafe } from './assets/visual-world.js';
import { cast } from './characters.js';
import { isWalkable, findPath, moveOnFloor, followRoute } from './navigation.js';
import {menu,buyDrink,sipDrink,resident,updateResident} from './cafe-life.js';
import {createSteam,cupWorldPosition} from './effects.js';
import {verbFor,randomBrowseLine} from './interactions.js';
import {PRESET_MINUTES,createFocusTimer,tickFocusTimer,pauseFocusTimer,resumeFocusTimer,formatRemaining,formatMinutes,defaultStats,recordSession,statsForDisplay} from './focus.js';
import {CATEGORIES,createProceduralProvider,createLocalFilesProvider,trackAfter,INTEGRATION_NOTES} from './music.js';
import {createSequenceGame,attemptStep,GAMES} from './minigames.js';
import {deriveStatus,statusText,EMOTES,emoteEmoji} from './social.js';
import {readSaved,save,KEYS,defaultSettings} from './save.js';

const $=id=>document.getElementById(id), world=$('world');
const createMaya=options=>createCharacter({...options,detail:'game'});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
const persist=(key,value)=>save(key,value,()=>toast('Browser storage is unavailable. Export your notes before closing.'));
function download(data,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function failure(error){console.error(error);$('load-message').textContent='The café could not open. Start Cafe.cmd must be running, then reload this page.';}

let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(e){failure(e);throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.25:1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;world.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label','3D café. Use the destination buttons or WASD to walk.');renderer.domElement.tabIndex=0;
const scene=new THREE.Scene();scene.background=new THREE.Color('#d5d6bd');scene.fog=new THREE.Fog('#d5d6bd',45,95);
const camera=new THREE.PerspectiveCamera(42,1,.1,150);camera.position.set(22,22,28);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.1,0);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=2;controls.maxDistance=52;controls.update();
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.45;pmrem.dispose();
const ambient=new THREE.HemisphereLight(0xffedd2,0x819178,2.1);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffdfad,3.3);sun.position.set(-12,9,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.012;sun.shadow.bias=-.00008;sun.shadow.radius=3;
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.1,far:60});scene.add(sun);
const fill=new THREE.DirectionalLight(0xd7e8f7,1);fill.position.set(7,9,-7);scene.add(fill);
const lamps=[];
let visualDetails;
const obstructions=[];
for(const [x,z] of [[-7,-3],[-3,-3],[2,-3],[7,-3],[-7,3],[-3,3],[2,3],[7,3]]){const l=new THREE.PointLight(0xffc775,6,6,2);l.position.set(x,2.55,z);scene.add(l);lamps.push(l);}
const fire=new THREE.PointLight(0xff9347,8,5,2);fire.position.set(8.6,.65,-4);scene.add(fire);
new ResizeObserver(()=>{const w=world.clientWidth,h=world.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(world);

let layout, maya, session, network, mode='overview', route=[], destination=null, seated=null, nearest=null, drink=null, sips=0, waveUntil=0;
let wallet=readSaved('maple-bean-wallet',{coins:30,drink:null,sips:0}),sipUntil=0,talkingTo=null;
let settings=readSaved(KEYS.settings,defaultSettings());
if(!Number.isFinite(settings.volume)||settings.volume<0||settings.volume>100)settings.volume=defaultSettings().volume;
if(!['afternoon','evening','day'].includes(settings.lighting))settings.lighting=defaultSettings().lighting;
if(!Number.isInteger(wallet?.coins)||wallet.coins<0||wallet.coins>1000||!Number.isInteger(wallet.sips)||wallet.sips<0||wallet.sips>3||wallet.drink&&!Object.hasOwn(menu,wallet.drink))wallet={coins:30,drink:null,sips:0};
const regulars=[],occupiedSeats=new Set();
function updatePocket(){drink=wallet.drink;sips=wallet.sips;$('coins').textContent=wallet.coins+' café coins';$('drink').textContent=drink?'☕ '+drink+' · '+sips+' sips':'☕ Nothing to rush.';$('sip').hidden=!drink;persist('maple-bean-wallet',wallet);}
updatePocket();
const player=new THREE.Vector3(0,0,5.6), keys=new Set(), remote=new Map(), markers=[], beams=new THREE.Group();
const pointer=new THREE.Vector2(), ray=new THREE.Raycaster(), plane=new THREE.Plane(new THREE.Vector3(0,1,0),0), point=new THREE.Vector3();
let cameraTween=null, previousPlayer=player.clone();
const collisionGroup=new THREE.Group();collisionGroup.visible=false;scene.add(collisionGroup,beams);
const steam=createSteam(scene);
let chatBubble=null,chatBubbleClock=3+Math.random()*4,typingClock=0;
let focusTimer=null;
let focusStats=readSaved(KEYS.focusStats,defaultStats());
function saveFocusStats(){persist(KEYS.focusStats,focusStats);}
function renderFocusStats(){
  const view=statsForDisplay(focusStats);
  $('focus-stats').innerHTML=`<div><b>${formatMinutes(view.todayMinutes)}</b>Today's focus</div><div><b>${view.todaySessions}</b>Sessions</div><div><b>${view.streak}</b>Day streak</div>`;
}

let sessionDead=false;
async function api(data){
  const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,id:session?.id,token:session?.token})});
  const result=await response.json();
  if(response.status===401&&!sessionDead){sessionDead=true;toast('The café connection ended. Reload the page to reconnect with others.');}
  if(!response.ok)throw new Error(result.error||'The café connection was interrupted.');return result;
}
function label(text,position,className=''){
  const el=document.createElement('button');el.className='world-label '+className;el.textContent=text;$('labels').append(el);
  const marker={el,position};markers.push(marker);return marker;
}

// Merge the static building by material: hundreds of floorboards and books become
// a few draws, while the editable Blender file keeps every original object.
function addCafe(root){
  root.updateMatrixWorld(true);const batches=new Map();
  refineCafe(root,scene);
  root.traverse(o=>{
    if(!o.isMesh||o.userData.replaced||/Broad_living_leaf|Plant_frond/.test(o.name))return;
    if(o.name==='Menu_welcome')o.matrixWorld.elements[13]-=.34;
    if(/Garden_backdrop/.test(o.name)){o.material=new THREE.MeshStandardMaterial({color:'#899578',roughness:1});}
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
    for(const a of Object.keys(geometry.attributes))if(!['position','normal'].includes(a))geometry.deleteAttribute(a);
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    worldUV(geometry);polishMaterial(o.material);
    const g=geometry.index?geometry.toNonIndexed():geometry;
    if(g!==geometry)geometry.dispose();
    const overhead=/Ceiling_beam/.test(o.name);
    const obstruction=/Left_plaster|Right_plaster|Maple_Bean_marquee|Pine_awning|Awning_valance|Entrance_door_jamb|Cream_window_upright|Window_slender_mullion/.test(o.name)?o.name:'';
    const mat=o.material,key=mat.uuid+overhead+obstruction;
    if(!batches.has(key))batches.set(key,{mat,parts:[],overhead,obstruction});batches.get(key).parts.push(g);
  });
  for(const {mat,parts,overhead,obstruction} of batches.values()){
    const geometry=mergeGeometries(parts),m=new THREE.Mesh(geometry,obstruction?mat.clone():mat);parts.forEach(g=>g.dispose());
    if(obstruction){geometry.computeBoundingBox();m.userData.sightBounds=geometry.boundingBox.clone().expandByScalar(.25);obstructions.push(m);}
    m.castShadow=true;m.receiveShadow=true;(overhead?beams:scene).add(m);
  }
}

function cameraMode(next){
  mode=next;document.body.classList.toggle('walking',mode==='walk');document.body.classList.toggle('floor-plan',mode==='plan');$('welcome').hidden=mode!=='overview';
  visualDetails?.update(performance.now()/1000,mode);
  for(const id of ['overview','walk','plan'])$(id).classList.toggle('selected',id===mode);
  const target=mode==='walk'?player.clone().add(new THREE.Vector3(0,1,0)):new THREE.Vector3(0,.15,0);
  const narrow=world.clientWidth<600;
  const position=mode==='walk'?player.clone().add(new THREE.Vector3(narrow?.4:2.4,narrow?1.9:2.1,narrow?3.2:3.6)):mode==='plan'?new THREE.Vector3(17,25,22).multiplyScalar(narrow?1.55:1):new THREE.Vector3(18,17,23).multiplyScalar(narrow?1.6:1);
  cameraTween={from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),target,t:0};
  controls.maxPolarAngle=mode==='plan'?.85:Math.PI*.48;controls.enablePan=mode!=='walk';controls.minDistance=mode==='walk'?1.8:10;controls.maxDistance=mode==='walk'?10:65;
  beams.visible=mode==='overview'&&$('show-beams').checked;previousPlayer.copy(player);
}
for(const id of ['overview','walk','plan'])$(id).onclick=()=>cameraMode(id);
const touchPad=document.createElement('div');touchPad.className='touch-pad';touchPad.setAttribute('aria-label','Walking controls');
for(const [code,glyph,title] of [['KeyW','↑','Walk forward'],['KeyA','←','Walk left'],['KeyS','↓','Walk backward'],['KeyD','→','Walk right']]){
  const b=document.createElement('button');b.textContent=glyph;b.setAttribute('aria-label',title);b.dataset.key=code;
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);route=[];destination=null;keys.add(code);};
  b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(code);touchPad.append(b);
}
world.append(touchPad);
$('enter').onclick=()=>{cameraMode('walk');blip('chime');};$('cafe-nav').onclick=()=>cameraMode('overview');

function openDialog(html){route=[];destination=null;keys.clear();$('dialog-content').innerHTML=html;$('dialog').showModal();}
$('dialog-close').onclick=()=>$('dialog').close();
$('dialog').addEventListener('close',()=>{talkingTo=null;renderer.domElement.focus();});
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}});
function focusRemainingMinutes(){return focusTimer?(focusTimer.totalSeconds-focusTimer.remaining)/60:0;}
function endFocusSession(record){
  if(!focusTimer)return;
  if(record){focusStats=recordSession(focusStats,focusRemainingMinutes());saveFocusStats();}
  focusTimer=null;document.body.classList.remove('focus-mode');$('focus-banner').hidden=true;$('focus').hidden=true;
  stopMusic();
  cameraMode('walk');
}
async function stand(){
  if(!seated)return;
  endFocusSession(true);
  try{const result=await api({action:'stand'});player.set(result.x,0,result.z);seated=null;previousPlayer.copy(player);$('browse').hidden=true;$('activity').textContent='Taking a little wander';}catch(e){toast(e.message);}
}
async function sitAt(station){
  const occupant=regulars.find(n=>n.life?.seat?.id===station.id);
  if(occupant?.life.phase==='seated'){toast('That seat is occupied. Try another.');return;}
  if(occupant){Object.assign(occupant.life,{seat:null,route:[],phase:'idle',timer:8,cup:false});}
  try{await api({action:'move',x:player.x,z:player.z,angle:maya.group.rotation.y});await api({action:'sit',seatId:station.id});seated=station;player.set(station.x,0,station.z);maya.group.rotation.y=station.angle;route=[];destination=null;$('browse').hidden=station.kind!=='read';$('activity').textContent=station.kind==='read'?'One more chapter…':station.kind==='study'?'Settling in to focus':'Settled in. No hurry.';toast(station.kind==='read'?'A quiet chapter, a warm cup. Press E or Esc to get up.':station.kind==='study'?'A quiet desk of your own. Press E or Esc to get up.':'Make yourself comfortable. Press E or Esc to stand.');}catch(e){toast(e.message);}
}
function orderDrink(){
  openDialog('<div class="eyebrow">FRESHLY MADE · '+wallet.coins+' CAFÉ COINS</div><h2>Your usual, or<br>something new?</h2><p>Choose a little comfort. Each drink has three sips.</p>'+Object.entries(menu).map(([name,price])=>'<button class="menu-item" data-order="'+name+'"><span>'+name+'</span><b>'+price+' coins ↗</b></button>').join('')+'<button class="secondary" id="refill-wallet">Refill playtest wallet to 30 coins</button>');
  $('refill-wallet').onclick=()=>{wallet.coins=30;updatePocket();$('dialog').close();toast('Playtest wallet refilled.');};
  document.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>{
    const name=b.dataset.order;
    if(wallet.drink)return toast('Finish your current drink first.');
    if(!Number.isInteger(wallet.coins)||wallet.coins<menu[name])return toast('Not enough café coins. Refill your playtest wallet at the counter.');
    renderCoffeeGame(name);
  });
}
function renderCoffeeGame(name){
  const spec=GAMES['coffee-making'];let game=createSequenceGame(spec.steps);
  openDialog('<div class="eyebrow">MAKING YOUR '+name.toUpperCase()+'</div><h2>'+spec.title+'</h2><p class="muted">Click each step in order.</p><div class="game-steps">'+spec.steps.map(s=>'<button data-step="'+s.id+'"><span>'+s.emoji+'</span>'+s.label+'</button>').join('')+'</div><p id="game-status" class="muted"></p>');
  document.querySelectorAll('.game-steps button').forEach(b=>b.onclick=()=>{
    const before=game.index;game=attemptStep(game,b.dataset.step);
    if(game.index>before){b.disabled=true;b.classList.add('done');}
    else{b.classList.add('miss');setTimeout(()=>b.classList.remove('miss'),300);}
    if(game.done){
      $('game-status').textContent='All set!';blip('cup');
      setTimeout(()=>{try{wallet=buyDrink(wallet,name);updatePocket();$('dialog').close();toast('Mara: “Here you go. Find your favourite spot.”');$('activity').textContent='A fresh '+name.toLowerCase()+' in hand';}catch(e){toast(e.message);}},550);
    }
  });
}
function talkTo(station){
  talkingTo=station.id;
  if(station.id==='noah'){
    openDialog('<div class="eyebrow">NOAH · A QUIET MOMENT</div><h2>Good ideas start here.</h2><p>“One more page, then a maple latte. I like studying here—the company makes the work feel lighter. You’re welcome to join me.”</p><div class="dialog-actions"><button id="noah-hello">Save me a seat</button><a class="secondary" href="/maya.html?character=noah">Meet Noah in the studio ↗</a></div>');
    $('noah-hello').onclick=()=>{$('dialog').close();toast('Noah: “Of course. Focus today, brighter tomorrow.”');};return;
  }
  if(station.id==='claire'){
    openDialog('<div class="eyebrow">CLAIRE · CREATIVE SOUL & COFFEE ENTHUSIAST</div><h2>A good day starts<br>with a little curiosity.</h2><p>“I brought my sketchbook. Something about this place makes ordinary afternoons feel like the start of a story. Want to keep me company?”</p><div class="dialog-actions"><button id="claire-hello">I’d love to</button><a class="secondary" href="/maya.html?character=claire">Meet Claire in the studio ↗</a></div>');
    $('claire-hello').onclick=()=>{waveUntil=performance.now()/1000+2.3;$('dialog').close();toast('Claire: “Perfect. I’ll save you a spot and a page.”');$('activity').textContent='A new friend in Maple Hollow';};return;
  }
  const mara=station.id==='mara';
  openDialog(`<div class="eyebrow">${mara?'MARA · YOUR NEIGHBOURHOOD BARISTA':'JULES · CAFÉ REGULAR'}</div><h2>${mara?'Welcome back, neighbour.':'There’s always room for one more.'}</h2><p>${mara?'“We made the café bigger, but the idea is the same: somewhere you can feel at home. What brings you in today?”':'“I was just thinking this table needs a good board-game night. Or we could put the world to rights over coffee.”'}</p><div class="dialog-actions"><button data-reply="quiet">A little peace and quiet</button><button data-reply="friends">Some good company</button></div>`);
  document.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>{waveUntil=performance.now()/1000+2.3;$('dialog').close();toast(b.dataset.reply==='quiet'?'“The reading nook has your name on it.”':'“Then you’re exactly where you should be.”');$('activity').textContent='Getting to know the neighbourhood';});
}
// Contextual interaction registry: what a station *kind* does when interacted
// with. Adding a new interactable kind (a study desk, a music corner) means
// adding a handler here, not another branch of an if/else chain.
const interactionHandlers={seat:sitAt,read:sitAt,study:sitAt,coffee:orderDrink,talk:talkTo};
async function interact(station=nearest){
  if(seated){await stand();return;}if(!station)return;
  if(Math.hypot(player.x-station.approach[0],player.z-station.approach[1])>1.15){goTo(station.id);return;}
  await (interactionHandlers[station.kind]||talkTo)(station);
}
$('interact-button').onclick=()=>interact();
async function goTo(id){
  if(!layout)return;if(seated){await stand();if(seated)return;}
  const station=layout.stations.find(s=>s.id===id);if(!station||station.unavailable){toast('They’ll be back in a little while.');return;}
  const path=findPath(player,{x:station.approach[0],z:station.approach[1]},layout);
  if(!path.length){toast('That route is tight. Walk closer and try again.');return;}
  destination=station;route=path;cameraMode('walk');$('activity').textContent='On the way · '+station.label;
}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goTo(b.dataset.go));
function showReaction(position,emoji){
  const el=document.createElement('div');el.className='world-label reaction';el.textContent=emoji;$('labels').append(el);
  const marker={el,position:position.clone()};markers.push(marker);
  setTimeout(()=>{el.remove();markers.splice(markers.indexOf(marker),1);},1800);
}
function sendEmote(id){
  if(id==='wave')waveUntil=performance.now()/1000+2.5;
  showReaction(player.clone().add(new THREE.Vector3(0,2.1,0)),emoteEmoji(id));
  api({action:'emote',emote:id}).catch(()=>{});
}
for(const e of EMOTES){if(e.id==='wave')continue;const b=document.createElement('button');b.textContent=e.emoji;b.title=e.label;$('emotes').append(b);b.onclick=()=>sendEmote(e.id);}
$('wave').onclick=()=>{sendEmote('wave');toast('A friendly hello!');};
$('sip').onclick=()=>{if(!drink||sipUntil)return;sipUntil=performance.now()/1000+1.7;$('sip').disabled=true;toast('A warm sip. Take your time.');};
$('browse').onclick=()=>{if(seated?.kind!=='read')return;toast(randomBrowseLine());};
let focusPreset=PRESET_MINUTES[0];
function openFocusPanel(){
  if(focusTimer){$('focus-setup').hidden=true;$('focus-active').hidden=false;$('focus').hidden=false;return;}
  if(seated?.kind!=='study')return;
  renderFocusStats();$('focus-setup').hidden=false;$('focus-active').hidden=true;
  document.querySelectorAll('#focus-presets button').forEach(b=>b.classList.toggle('selected',+b.dataset.min===focusPreset));
  $('focus-custom').value='';$('focus').hidden=false;
}
$('focus-open').onclick=openFocusPanel;
$('focus-banner').onclick=openFocusPanel;
$('focus-close').onclick=()=>$('focus').hidden=true;
document.querySelectorAll('#focus-presets button').forEach(b=>b.onclick=()=>{focusPreset=+b.dataset.min;$('focus-custom').value='';document.querySelectorAll('#focus-presets button').forEach(x=>x.classList.toggle('selected',x===b));});
$('focus-custom').oninput=()=>{if($('focus-custom').value)document.querySelectorAll('#focus-presets button').forEach(x=>x.classList.remove('selected'));};
$('focus-begin').onclick=()=>{
  const custom=+$('focus-custom').value;
  const minutes=custom>0?Math.min(180,custom):focusPreset;
  focusTimer=createFocusTimer(minutes);
  $('focus-setup').hidden=true;$('focus-active').hidden=false;$('focus-pause').textContent='Pause';
  activeCategory=null;$('music-status').textContent='';$('music-transport').hidden=true;$('music-volume-label').hidden=true;$('music-choose-files').hidden=true;
  document.querySelectorAll('#music-categories button').forEach(b=>b.classList.remove('selected'));
  document.body.classList.add('focus-mode');$('focus-banner').hidden=false;
  const behind=new THREE.Vector3(-Math.sin(maya.group.rotation.y),0,-Math.cos(maya.group.rotation.y));
  const camOffset=behind.multiplyScalar(1.9).add(new THREE.Vector3(0,1.75,0));
  cameraTween={from:camera.position.clone(),to:player.clone().add(camOffset),fromTarget:controls.target.clone(),target:player.clone().add(new THREE.Vector3(0,1.15,0)),t:0};
  controls.enablePan=false;
  toast('Focus session started. Stay as long as you need.');
};
$('focus-pause').onclick=()=>{
  if(!focusTimer)return;
  focusTimer=focusTimer.paused?resumeFocusTimer(focusTimer):pauseFocusTimer(focusTimer);
  $('focus-pause').textContent=focusTimer.paused?'Resume':'Pause';
};
$('focus-end').onclick=()=>{endFocusSession(true);toast('Session saved. Nicely done.');};

// --- Focus music: see music.js for the provider architecture. -----------
let musicCtx=null,musicProviders=null,activeMusic=null,activeCategory=null,currentTrack=null,musicPlaying=false;
function ensureMusicSetup(){
  if(musicProviders)return;
  musicCtx=new AudioContext();const destination=musicCtx.createGain();destination.connect(musicCtx.destination);
  musicProviders={ambient:createProceduralProvider(musicCtx,destination),mine:createLocalFilesProvider($('music-audio'))};
}
for(const cat of CATEGORIES){const b=document.createElement('button');b.textContent=cat.name;b.dataset.cat=cat.id;$('music-categories').append(b);}
function stopMusic(){activeMusic?.stop();musicPlaying=false;$('music-play').textContent='▶';}
function selectMusicCategory(cat){
  stopMusic();activeCategory=cat;currentTrack=null;
  document.querySelectorAll('#music-categories button').forEach(b=>b.classList.toggle('selected',b.dataset.cat===cat.id));
  if(cat.kind==='unavailable'){
    $('music-status').textContent=INTEGRATION_NOTES[cat.id];$('music-transport').hidden=true;$('music-volume-label').hidden=true;$('music-choose-files').hidden=true;activeMusic=null;return;
  }
  ensureMusicSetup();
  $('music-transport').hidden=false;$('music-volume-label').hidden=false;
  activeMusic=cat.kind==='procedural'?musicProviders.ambient:musicProviders.mine;
  activeMusic.setVolume(+$('music-volume').value/100);
  if(cat.kind==='local-files'){$('music-choose-files').hidden=false;$('music-status').textContent=activeMusic.tracks.length?activeMusic.tracks.length+' file(s) ready.':'Choose audio files from your computer to begin.';}
  else{$('music-choose-files').hidden=true;$('music-status').textContent='Ready to play: '+activeMusic.tracks[0].title;}
}
$('music-choose-files').onclick=()=>$('music-file-picker').click();
$('music-file-picker').onchange=e=>{musicProviders.mine.setFiles(e.target.files);currentTrack=null;musicPlaying=false;$('music-play').textContent='▶';$('music-status').textContent=e.target.files.length+' file(s) ready.';};
$('music-play').onclick=()=>{
  if(!activeMusic)return;
  if(musicPlaying){activeMusic.pause();musicPlaying=false;$('music-play').textContent='▶';return;}
  if(!currentTrack){currentTrack=trackAfter(activeMusic.tracks,undefined,1);if(!currentTrack){toast('Choose a file first.');return;}activeMusic.play(currentTrack);}
  else activeMusic.resume();
  musicPlaying=true;$('music-play').textContent='⏸';$('music-status').textContent='Now playing: '+currentTrack.title;
};
$('music-next').onclick=()=>{
  if(!activeMusic)return;const next=trackAfter(activeMusic.tracks,currentTrack?.id,1);if(!next)return;
  currentTrack=next;activeMusic.play(currentTrack);musicPlaying=true;$('music-play').textContent='⏸';$('music-status').textContent='Now playing: '+currentTrack.title;
};
$('music-prev').onclick=()=>{
  if(!activeMusic)return;const prev=trackAfter(activeMusic.tracks,currentTrack?.id,-1);if(!prev)return;
  currentTrack=prev;activeMusic.play(currentTrack);musicPlaying=true;$('music-play').textContent='⏸';$('music-status').textContent='Now playing: '+currentTrack.title;
};
$('music-volume').oninput=()=>{activeMusic?.setVolume(+$('music-volume').value/100);settings.volume=+$('music-volume').value;persist(KEYS.settings,settings);};
document.querySelectorAll('#music-categories button').forEach(b=>b.onclick=()=>selectMusicCategory(CATEGORIES.find(c=>c.id===b.dataset.cat)));

const typing=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable||$('dialog').open;
addEventListener('keydown',e=>{
  if(e.code==='Escape'){keys.clear();route=[];destination=null;if(!$('dialog').open)stand();return;}
  if(typing())return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);route=[];destination=null;if(mode!=='walk')cameraMode('walk');if(seated)stand();}
  if(e.code==='KeyE'&&!e.repeat)interact();
  if(e.code==='KeyR'&&!e.repeat)$('sip').click();
  if(e.code==='KeyB'&&!e.repeat)$('browse').click();
  if(e.code==='KeyF'&&!e.repeat)sendEmote('wave');
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
  sun.intensity=evening?.16:mode==='day'?3.3:3.7;ambient.intensity=evening?.5:mode==='day'?1.4:.72;fill.intensity=evening?.15:.5;scene.environmentIntensity=evening?.18:.3;
  sun.color.set(mode==='day'?0xfff1dc:0xffd29b);
  lamps.forEach(l=>l.intensity=evening?18:12);fire.intensity=evening?16:6;renderer.toneMappingExposure=evening?1.2:1.1;
  scene.background.set(evening?'#444e47':'#c8cbb6');scene.fog.color.copy(scene.background);
  settings.lighting=mode;persist(KEYS.settings,settings);
};
$('lighting').value=settings.lighting;$('lighting').dispatchEvent(new Event('change'));
$('music-volume').value=settings.volume;
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
// Short, subtle one-off cues layered on top of the ambience loop. No-ops until the
// player turns sound on, same as the rest of the café's audio.
function blip(kind){
  if(!audio||!audio.on)return;
  const context=audio.context,now=context.currentTime,gain=context.createGain();gain.connect(context.destination);
  if(kind==='tick'){
    const o=context.createOscillator();o.type='square';o.frequency.value=2200+Math.random()*400;o.connect(gain);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.012,now+.002);gain.gain.exponentialRampToValueAtTime(.0001,now+.03);
    o.start(now);o.stop(now+.04);return;
  }
  const notes=kind==='cup'?[[880,0],[1320,.05]]:kind==='chime'?[[988,0],[1319,.09],[1568,.18]]:[[660,0]];
  gain.gain.setValueAtTime(0,now);
  for(const [hz,at] of notes){
    const o=context.createOscillator();o.type='sine';o.frequency.value=hz;o.connect(gain);
    gain.gain.setValueAtTime(0,now+at);gain.gain.linearRampToValueAtTime(.05,now+at+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+at+.35);
    o.start(now+at);o.stop(now+at+.4);
  }
}
$('photo').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)download(blob,'Maple-Bean-'+Date.now()+'.png','image/png');});toast('A little memory, saved.');};

let notes=readSaved('maple-bean-notes',[]);if(!Array.isArray(notes))notes=[];
function showNotes(){
  $('note-count').textContent=notes.length;$('notes').replaceChildren();
  notes.forEach((note,i)=>{const el=document.createElement('article');el.className='note';const small=document.createElement('small');small.textContent=note.kind+' · '+new Date(note.date).toLocaleDateString();const p=document.createElement('p');p.textContent=note.text;const button=document.createElement('button');button.textContent='Delete note';button.onclick=()=>{notes.splice(i,1);persist('maple-bean-notes',notes);showNotes();};el.append(small,p,button);$('notes').append(el);});
}
showNotes();$('review-open').onclick=()=>{$('review').hidden=!$('review').hidden;$('chat').hidden=true;keys.clear();};$('review-close').onclick=()=>$('review').hidden=true;
$('note-form').onsubmit=e=>{e.preventDefault();const text=$('note-text').value.trim();if(!text)return;notes.push({kind:$('note-kind').value,text,date:new Date().toISOString(),position:{x:+player.x.toFixed(2),z:+player.z.toFixed(2)},camera:camera.position.toArray(),lighting:$('lighting').value});persist('maple-bean-notes',notes);$('note-text').value='';showNotes();toast('Saved in your playtest notebook.');};
$('export-notes').onclick=()=>download(JSON.stringify({project:'Maple Bean expanded café',date:new Date().toISOString(),notes},null,2),'Maple-Bean-playtest-notes.json','application/json');
$('show-collisions').onchange=()=>collisionGroup.visible=$('show-collisions').checked;
$('show-beams').onchange=()=>beams.visible=mode==='overview'&&$('show-beams').checked;
$('chat-toggle').onclick=()=>{$('chat').hidden=!$('chat').hidden;$('review').hidden=true;keys.clear();if(!$('chat').hidden)$('chat-input').focus();};$('chat-close').onclick=()=>$('chat').hidden=true;
function chatLine(name,text){const line=document.createElement('p');line.className='chat-line';const b=document.createElement('b');b.textContent=name;line.append(b,document.createTextNode(text));$('chat-messages').append(line);if($('chat-messages').children.length>80)$('chat-messages').firstChild.remove();$('chat-messages').scrollTop=$('chat-messages').scrollHeight;}
$('chat-form').onsubmit=async e=>{e.preventDefault();try{await api({action:'chat',text:$('chat-input').value});$('chat-input').value='';}catch(e){toast(e.message);}};
$('rename').onclick=()=>{openDialog('<div class="eyebrow">PULL UP A CHAIR</div><h2>What should we call you?</h2><form id="name-form"><input id="name-input" maxlength="24" required aria-label="Your guest name"><button class="primary">Save name</button></form>');$('name-input').value=session?.name||'Maya';$('name-form').onsubmit=async e=>{e.preventDefault();const name=$('name-input').value.trim();try{await api({action:'rename',name});session.name=name;$('player-name').textContent=name;persist('maple-bean-name',name);$('dialog').close();}catch(e){toast(e.message);}};};

function connect(){
  network=new EventSource(`/events?id=${session.id}&token=${session.token}`);
  network.addEventListener('guests',e=>{
    const guests=JSON.parse(e.data),ids=new Set();occupiedSeats.clear();for(const g of guests)if(g.seatId)occupiedSeats.add(g.seatId);$('guest-count').textContent=`${guests.length} ${guests.length===1?'guest':'guests'} in the café`;
    for(const guest of guests){if(guest.id===session.id)continue;ids.add(guest.id);let item=remote.get(guest.id);
      if(!item){const avatar=createMaya(cast.maya),marker=label(guest.name,new THREE.Vector3(guest.x,1.95,guest.z),'guest');item={avatar,marker,data:guest,waveUntil:0};scene.add(avatar.group);avatar.group.position.set(guest.x,0,guest.z);remote.set(guest.id,item);}item.data=guest;item.marker.el.textContent=guest.name+(guest.status?' · '+statusText(guest.status,guest.statusDetail):'');
    }
    for(const [id,item] of remote)if(!ids.has(id)){scene.remove(item.avatar.group);item.marker.el.remove();markers.splice(markers.indexOf(item.marker),1);remote.delete(id);}
  });
  network.addEventListener('chat',e=>{const data=JSON.parse(e.data);chatLine(data.name,data.text);if($('chat').hidden&&data.id!==session.id)toast(data.name+': '+data.text);});
  network.addEventListener('emote',e=>{
    const data=JSON.parse(e.data);if(data.id===session.id)return;
    const item=remote.get(data.id);if(!item)return;
    if(data.emote==='wave')item.waveUntil=performance.now()/1000+2.5;
    showReaction(item.avatar.group.position.clone().add(new THREE.Vector3(0,2.1,0)),emoteEmoji(data.emote));
    if($('chat').hidden)toast(data.name+' '+emoteEmoji(data.emote));
  });
  network.onerror=()=>{$('guest-count').textContent='Connection interrupted';if(sessionDead)network.close();};
}

try{
  [layout]=await Promise.all([fetch('/assets/layout.json').then(r=>r.json()),new GLTFLoader().loadAsync('/assets/cafe.glb').then(g=>addCafe(g.scene)),loadCharacters()]);
  visualDetails=addVisualDetails(scene,layout);
  layout.stations.push({id:'noah',label:'Meet Noah',kind:'talk',x:7.1,z:3.4,approach:[7.1,3.4],angle:Math.PI});
  $('load-message').textContent='Maya is getting ready…';await new Promise(r=>setTimeout(r,30));
  maya=createMaya(cast.maya);scene.add(maya.group);maya.group.rotation.y=Math.PI;
  for(const o of layout.obstacles){const mesh=new THREE.Mesh(new THREE.BoxGeometry(o.w+.48,.12,o.d+.48),new THREE.MeshBasicMaterial({color:0xd06b4c,wireframe:true}));mesh.position.set(o.x,.10,o.z);collisionGroup.add(mesh);}
  for(const station of layout.stations){
    const marker=label(station.kind==='coffee'?'☕ The coffee bar':station.id==='sofa'?'The living room':station.id==='reading'?'The reading nook':station.kind==='study'?'📚 Study desk':station.kind==='talk'?cast[station.id]?.name||'Guest':'Take a seat',new THREE.Vector3(station.x,station.kind==='talk'?2.05:1.3,station.z));marker.station=station;marker.el.onclick=()=>goTo(station.id);
  }
  for(const [id,x,z,angle] of [['mara',-4.7,-5.75,0],['jules',3,-.2,-.7],['claire',-3.1,1.0,.35],['noah',7.1,3.4,Math.PI]]){
    $('load-message').textContent=`${cast[id].name} is pulling up a chair…`;
    await new Promise(resolve=>setTimeout(resolve,30));
    const actor=createMaya({...cast[id],phaseOffset:id==='claire'?2.3:4.7});actor.group.position.set(x,0,z);actor.group.rotation.y=angle;scene.add(actor.group);regulars.push({id,actor,life:id==='mara'?null:resident(id,x,z,id==='claire'?12:25),clock:0});
  }
  session=await api({action:'join',name:readSaved('maple-bean-name','Maya')});$('player-name').textContent=session.name;connect();
  cameraMode('overview');
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
      }else if(route.length){const before=player.clone();followRoute(player,route,dt,1.75,layout);direction.copy(player).sub(before);moving=direction.lengthSq()>.000001;if(moving){const angle=Math.atan2(direction.x,direction.z),diff=Math.atan2(Math.sin(angle-maya.group.rotation.y),Math.cos(angle-maya.group.rotation.y));maya.group.rotation.y+=diff*Math.min(1,dt*12);}direction.set(0,0,0);if(!route.length&&destination){const s=destination;destination=null;interact(s);}}
      if(direction.lengthSq()>.0001){direction.normalize();const speed=1.75*dt;
        moveOnFloor(player,direction.x*speed,direction.z*speed,layout);
        moving=player.distanceToSquared(previousPlayer)>.000001;
        if(moving){const angle=Math.atan2(direction.x,direction.z),diff=Math.atan2(Math.sin(angle-maya.group.rotation.y),Math.cos(angle-maya.group.rotation.y));maya.group.rotation.y+=diff*Math.min(1,dt*12);$('activity').textContent='A little wander through the café';}
      }
    }
    maya.group.position.copy(player);maya.update(t,dt,{cup:!!drink,sipping:sipUntil>t,walking:moving,sitting:!!seated,seatHeight:seated?.seatHeight??.54,wave:t<waveUntil,expression:seated||t<waveUntil?'happy':'neutral'});
    if(sipUntil&&t>=sipUntil){wallet=sipDrink(wallet);sipUntil=0;$('sip').disabled=false;updatePocket();toast(drink?'A little pause. '+sips+' sips left.':'Last sip. That hit the spot.');}
    const occupied=new Set(occupiedSeats);if(seated)occupied.add(seated.id);for(const n of regulars)if(n.life?.seat)occupied.add(n.life.seat.id);
    for(const n of regulars){
      n.clock+=dt;const a=n.actor,l=n.life;
      if(l){updateResident(l,dt,layout,occupied,player,talkingTo===n.id);if(l.seat)occupied.add(l.seat.id);a.group.position.set(l.x,0,l.z);a.group.rotation.y=l.angle;a.group.visible=l.visible;
        const station=layout.stations.find(s=>s.id===n.id);station.x=l.x;station.z=l.z;station.approach=l.seat?[...l.seat.approach]:[l.x,l.z];station.unavailable=!l.visible;
        const marker=markers.find(m=>m.station===station);marker.position.set(l.x,2.05,l.z);
      }
      // Cap background character deformation at 15 Hz; player input stays every frame.
      if(n.clock>=1/15){a.update(t+(n.id==='claire'?2.3:4.7),n.clock,{walking:l?.walking,sitting:l?.phase==='seated',studying:l?.studying,seatHeight:l?.seat?.seatHeight??.54,cup:l?.cup,sipping:l?.sipping,wave:!l&&t%17<1.4,expression:n.id==='noah'?'neutral':'happy'});n.clock=0;}
    }
    steam.update(dt,[
      {position:cupWorldPosition(player.x,player.z,maya.group.rotation.y),active:!!drink},
      ...regulars.filter(n=>n.life?.cup&&n.life.visible).map(n=>({position:cupWorldPosition(n.life.x,n.life.z,n.life.angle),active:true}))
    ]);
    // A brief, occasional "💬" over two regulars chatting nearby. Cheap DOM label,
    // no new geometry, and throttled so the café stays cozy rather than busy.
    chatBubbleClock-=dt;
    if(chatBubbleClock<=0){
      chatBubbleClock=6+Math.random()*6;
      const idle=regulars.filter(n=>n.life&&!n.life.talking&&['seated','idle'].includes(n.life.phase));
      outer: for(const a of idle)for(const b of idle)if(a!==b&&Math.hypot(a.life.x-b.life.x,a.life.z-b.life.z)<2.2){
        if(chatBubble){chatBubble.el.remove();markers.splice(markers.indexOf(chatBubble),1);}
        const el=document.createElement('div');el.className='world-label guest';el.textContent='💬';$('labels').append(el);
        chatBubble={el,position:new THREE.Vector3((a.life.x+b.life.x)/2,2.15,(a.life.z+b.life.z)/2)};
        markers.push(chatBubble);
        setTimeout(()=>{if(chatBubble?.el===el){el.remove();markers.splice(markers.indexOf(chatBubble),1);chatBubble=null;}},4000);
        break outer;
      }
    }
    for(const item of remote.values()){
      const d=item.data,avatar=item.avatar,old=avatar.group.position.clone();avatar.group.position.x=THREE.MathUtils.damp(avatar.group.position.x,d.x,12,dt);avatar.group.position.z=THREE.MathUtils.damp(avatar.group.position.z,d.z,12,dt);avatar.group.rotation.y=d.angle;avatar.update(t,dt,{sitting:!!d.seatId,seatHeight:layout.stations.find(s=>s.id===d.seatId)?.seatHeight??.54,walking:old.distanceTo(avatar.group.position)>.003,wave:t<item.waveUntil,expression:t<item.waveUntil?'happy':'neutral'});item.marker.position.copy(avatar.group.position).add(new THREE.Vector3(0,1.95,0));
    }
    if(cameraTween){const a=cameraTween;a.t=Math.min(1,a.t+dt/(reduced?.01:1.1));const k=a.t*a.t*(3-2*a.t);camera.position.lerpVectors(a.from,a.to,k);controls.target.lerpVectors(a.fromTarget,a.target,k);if(a.t===1)cameraTween=null;}
    else if(mode==='walk'){const delta=player.clone().sub(previousPlayer);camera.position.add(delta);controls.target.add(delta);}
    previousPlayer.copy(player);controls.update();
    // Fade shell pieces only when they intersect the actual player sightline.
    const sight=new THREE.Ray(camera.position,controls.target.clone().sub(camera.position).normalize());
    const hit=new THREE.Vector3(),distance=camera.position.distanceTo(controls.target);
    for(const mesh of obstructions){const blocked=mode==='walk'&&sight.intersectBox(mesh.userData.sightBounds,hit)&&camera.position.distanceTo(hit)<distance-.25;mesh.material.transparent=!!blocked;mesh.material.opacity=blocked?.12:1;mesh.material.depthWrite=!blocked;}
    visualDetails.update(t,mode);
    nearest=null;let best=1.2;
    for(const s of layout.stations){if(s.unavailable)continue;const d=Math.hypot(player.x-s.approach[0],player.z-s.approach[1]);if(d<best){best=d;nearest=s;}}
    const verb=nearest&&verbFor(nearest.kind);
    $('interaction').hidden=!seated&&!nearest||mode!=='walk';$('interaction-text').textContent=seated?'Stay as long as you like.':nearest?.kind==='talk'?'Talk to '+cast[nearest.id].name:verb?.prompt;$('interact-button').textContent=seated?'Stand up':verb?.action;
    $('focus-open').hidden=seated?.kind!=='study';$('focus-open').textContent=focusTimer?'View focus session':'Start focus session';
    if(focusTimer){
      focusTimer=tickFocusTimer(focusTimer,dt);
      $('focus-time').textContent=formatRemaining(focusTimer.remaining);
      $('focus-banner-text').textContent='📚 Focusing · '+formatRemaining(focusTimer.remaining)+' remaining';
      if(!focusTimer.paused){typingClock-=dt;if(typingClock<=0){typingClock=.15+Math.random()*3;blip('tick');}}
      if(focusTimer.done){endFocusSession(true);toast('Focus session complete. Nicely done.');}
    }
    for(const marker of markers){
      projected.copy(marker.position).project(camera);const s=marker.station;
      const zone=s&&(['coffee','read','talk'].includes(s.kind)||s.id==='study-0'||s.id==='sofa');
      const show=!s||(mode==='plan'||mode==='overview'?zone:camera.position.distanceTo(marker.position)<8);
      marker.el.hidden=!!s?.unavailable||!show||projected.z>1||projected.z< -1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1;
      marker.el.style.left=(projected.x*.5+.5)*world.clientWidth+'px';marker.el.style.top=(-projected.y*.5+.5)*world.clientHeight+'px';marker.el.classList.toggle('near',!!s&&s===nearest);
    }
    fire.intensity=($('lighting').value==='evening'?20:8)*(1+.045*Math.sin(t*6)+.02*Math.sin(t*11));
    renderer.render(scene,camera);frameCount++;
    const myStatus=deriveStatus({seated:!!seated,stationKind:seated?.kind,focusActive:!!focusTimer,focusDetail:focusTimer?formatRemaining(focusTimer.remaining)+' remaining':null,musicPlaying,hasDrink:!!drink});
    if(ms-lastNetwork>200&&!sending&&!sessionDead){lastNetwork=ms;sending=true;api({action:'move',x:player.x,z:player.z,angle:maya.group.rotation.y,status:myStatus.id,statusDetail:myStatus.detail}).catch(()=>{}).finally(()=>sending=false);}
    if(ms-lastStats>1500){$('stats').textContent=`${Math.round(frameCount*1000/(ms-lastStats))} fps · ${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k triangles. 280 m², expanded from 120 m².`;frameCount=0;lastStats=ms;}
    window.__ready=true;
  });
  $('loading').style.opacity=0;setTimeout(()=>$('loading').hidden=true,550);
  window.cafe={scene,camera,controls,renderer,maya,regulars,layout,player,goTo,interact,stand,cameraMode,get state(){return {mode,seated:seated?.id,route:route.length,drink,session:session?.id,remote:remote.size};}};
}catch(e){failure(e);}
