import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMaya } from './maya-character.js';
import { cast } from './characters.js';
const stage=document.querySelector('#stage'), q=()=>new URLSearchParams(location.hash.slice(1));
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.NeutralToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(26,1,.04,40),controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.minDistance=.55;controls.maxDistance=8;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.42;pmrem.dispose();
const characterId=new URLSearchParams(location.search).get('character')||'maya', character=cast[characterId]||cast.maya;
const maya=createMaya(character);scene.add(maya.group);
document.title=character.name+' · Maple Hollow';document.querySelector('.maya').textContent=character.name;
document.querySelector('#loading .lt').textContent=character.name+' is getting ready…';
if(!['maya','claire'].includes(character.character))document.querySelector('.meta').textContent='Maple Hollow resident';
const castLabel=document.createElement('label');castLabel.style.cssText='font-size:12px;color:#526043';castLabel.textContent='Character ';
const castSelect=document.createElement('select');castSelect.setAttribute('aria-label','Character');castSelect.style.cssText='padding:8px 12px;border-radius:6px;border:1px solid #d5d5c4;background:#fffaf2;color:#304c40';
for(const [id,c] of Object.entries(cast)){const option=document.createElement('option');option.value=id;option.textContent=c.name;option.selected=id===character.character;castSelect.append(option);}
castSelect.onchange=()=>location.href='/maya.html?character='+castSelect.value+location.hash;castLabel.append(castSelect);document.querySelector('#side .brand').after(castLabel);
for(const sw of document.querySelectorAll('.sw')){const name=sw.textContent.trim().toLowerCase(),value=character.colors[name==='jeans'?'denim':name];if(value!==undefined)sw.querySelector('i').style.background='#'+value.toString(16).padStart(6,'0');}
scene.add(new THREE.HemisphereLight(0xfff3e5,0xd8c7b4,1.7));
const key=new THREE.DirectionalLight(0xfff0df,2.6);key.position.set(2,4,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.006;key.shadow.bias=-.0002;
Object.assign(key.shadow.camera,{left:-1,right:1,top:2,bottom:-.2,near:.1,far:12});scene.add(key);
const rim=new THREE.DirectionalLight(0xe3ebff,1.3);rim.position.set(-2,3,-3);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.006;scene.add(ground);
const views={front:[0,4.6,.885],34:[35,4.6,.885],side:[90,4.6,.885],back:[180,4.6,.885],face:[14,1.36,1.505],profile:[90,1.36,1.505]};
let pose=q().get('pose')||'idle';
const chair=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x9e784f,roughness:.8}),fabric=new THREE.MeshStandardMaterial({color:0x607b66,roughness:1});
function chairPart(w,h,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;chair.add(m);}
chairPart(.58,.12,.55,0,.48,-.08,fabric);chairPart(.58,.65,.10,0,.78,-.34,fabric);for(const x of [-.22,.22])for(const z of [-.28,.12])chairPart(.05,.43,.05,x,.22,z,wood);scene.add(chair);chair.visible=false;
const group=document.createElement('div');group.className='group';group.innerHTML='<span>Pose</span><button data-p="idle">Idle</button><button data-p="walk">Walk</button><button data-p="sit">Sit</button><button data-p="wave">Wave</button>';document.querySelector('#stage > .hud:last-child').append(group);
group.querySelectorAll('button').forEach(b=>b.onclick=()=>{pose=b.dataset.p;group.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));});
function hash(){const params=q(),v=views[params.get('view')]||views.front;controls.target.set(0,v[2],.03);camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(v[0]*Math.PI/180)*v[1],.035*v[1],Math.cos(v[0]*Math.PI/180)*v[1]));controls.update();document.querySelectorAll('#views button').forEach(b=>b.classList.toggle('on',b.dataset.v===(params.get('view')||'front')));document.querySelectorAll('#exprs button').forEach(b=>b.classList.toggle('on',b.dataset.e===(params.get('expr')||'neutral')));}
document.querySelectorAll('[data-v],[data-e]').forEach(b=>b.onclick=()=>{const params=q();params.set(b.dataset.v?'view':'expr',b.dataset.v||b.dataset.e);location.hash=params.toString();});
addEventListener('hashchange',hash);hash();
new ResizeObserver(()=>{const h=Math.max(220,stage.clientHeight-(document.body.classList.contains('bare')?0:130));renderer.setSize(stage.clientWidth,h);camera.aspect=stage.clientWidth/h;camera.updateProjectionMatrix();}).observe(stage);
let last=0;
renderer.setAnimationLoop(ms=>{const dt=Math.min((ms-last)/1000,.05);last=ms;const still=q().get('still')==='1';maya.update(still?0:ms/1000,dt,{still,expression:q().get('expr'),walking:pose==='walk',sitting:pose==='sit',wave:pose==='wave',seatHeight:.54});chair.visible=pose==='sit';controls.update();renderer.render(scene,camera);document.querySelector('#loading').classList.add('done');window.__ready=true;});
window.mayaStudio={maya,renderer,scene,camera,setPose(value){pose=value;}};
