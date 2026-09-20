import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMaya,loadCharacters} from '../assets/characters/runtime.js';
import {cast} from '../characters.js';
import * as Shop from '../shop.js';
import {readSaved,save} from '../save.js';
export const PROFILE_KEY='maple-bean-avatar';
export const SKINS=['#f3d5bd','#eeb092','#dfaa87','#c88d68','#a56e4b','#895d43','#68432f','#4c3022'];
export const EYES=['#ffffff','#b6d6fb','#96c690','#d7b278','#bfa2d3'];
export function normalizeProfile(p={}){
 return {base:Object.hasOwn(cast,p?.base)?p.base:'maya',skin:SKINS.includes(p?.skin)?p.skin:null,eyes:EYES.includes(p?.eyes)?p.eyes:null,name:typeof p?.name==='string'?p.name.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,24):''};
}
export const readProfile=()=>normalizeProfile(readSaved(PROFILE_KEY,{}));
export function applyProfile(avatar,profile){avatar.setAppearance?.(normalizeProfile(profile));}
export function allowedWardrobe(w,unlocked=[]){
 const clean=Shop.defaultWardrobe();if(!Shop.validWardrobe(w))return clean;
 clean.owned=[...new Set([...clean.owned,...w.owned])];
 for(const [slot,id] of Object.entries(w.equipped))if(clean.owned.includes(id)||unlocked.includes(id))clean.equipped[slot]=id;
 return clean;
}
export function createCreator({getWardrobe,getUnlocked=()=>[],onSave}){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/systems/creator.css';document.head.append(style);
 const dialog=document.createElement('dialog');dialog.id='character-creator';dialog.setAttribute('aria-labelledby','creator-title');
 dialog.innerHTML=`<header><div><h1 id="creator-title">Create your character</h1><p>Make yourself at home. Change your look anytime.</p></div><button data-close aria-label="Close character creator">Close ×</button></header><div class="creator-layout"><section class="creator-preview"><div class="creator-stage"></div><div class="creator-camera"><button data-rotate="-1" aria-label="Rotate left">↶</button><button data-rotate="1" aria-label="Rotate right">↷</button><button data-zoom="face">Face</button><button data-zoom="upper">Upper body</button><button data-zoom="full" aria-pressed="true">Full body</button></div><p>Drag to turn · Your live café character</p></section><section class="creator-card"><nav aria-label="Character creation steps"></nav><div class="creator-fields"></div><p class="creator-error" role="alert"></p><footer><button data-back>← Back</button><button data-next>Continue →</button></footer></section></div>`;
 document.body.append(dialog);const q=s=>dialog.querySelector(s),stage=q('.creator-stage'),fields=q('.creator-fields');
 let profile,wardrobe,step=0,avatar,render,controls,scene,camera,frame=0,previous=0,loadVersion=0,zoom='full',focusBefore;
 const steps=['Base & face','Skin & eyes','Hair','Clothing','Name & preview'];
 function dress(){if(!avatar)return;const look=Shop.lookFor(wardrobe);avatar.setTints({top:look.top,bottom:look.bottom,shoes:look.shoes,hair:look.hairColor});avatar.setHairStyle(wardrobe.equipped.hair==='hair-bun'?profile.base:look.hair);avatar.setAccessories(look.props);applyProfile(avatar,profile);}
 function disposeAvatar(){if(!avatar)return;scene.remove(avatar.group);const materials=new Set();avatar.group.traverse(o=>{if(o.isMesh&&['Wardrobe','Hair','Accessories','Skin','Eyes'].includes(o.material?.name))materials.add(o.material);});materials.forEach(m=>m.dispose());avatar=null;}
 async function model(){const version=++loadVersion;await loadCharacters();if(version!==loadVersion||!dialog.open)return;disposeAvatar();avatar=createMaya({...cast[profile.base],customizable:true});scene.add(avatar.group);dress();}
 function frameCamera(mode){zoom=mode;const target=mode==='face'?1.48:mode==='upper'?1.2:.86,distance=mode==='face'?.65:mode==='upper'?1.35:2.85;camera.position.set(0,target,distance);controls.target.set(0,target,0);controls.update();dialog.querySelectorAll('[data-zoom]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zoom===mode)));}
 function startPreview(){
  scene=new THREE.Scene();render=new THREE.WebGLRenderer({antialias:true,alpha:true});render.setPixelRatio(Math.min(devicePixelRatio,1.5));render.toneMapping=THREE.ACESFilmicToneMapping;render.toneMappingExposure=1.22;stage.append(render.domElement);
  camera=new THREE.PerspectiveCamera(38,1,.02,20);controls=new OrbitControls(camera,render.domElement);controls.enablePan=false;controls.enableZoom=false;controls.minPolarAngle=Math.PI*.38;controls.maxPolarAngle=Math.PI*.6;
  scene.add(new THREE.HemisphereLight('#fff3db','#9e8263',2.2));const key=new THREE.DirectionalLight('#fff0db',3.2);key.position.set(-3,5,4);scene.add(key);const fill=new THREE.DirectionalLight('#e2ebff',1.4);fill.position.set(3,2,-2);scene.add(fill);
  frameCamera('full');previous=performance.now();const loop=t=>{if(!dialog.open)return;const w=stage.clientWidth,h=stage.clientHeight;if(render.domElement.width!==Math.round(w*render.getPixelRatio())||render.domElement.height!==Math.round(h*render.getPixelRatio())){render.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}avatar?.update(t/1000,Math.min(.05,(t-previous)/1000),{expression:'smile'});previous=t;controls.update();render.render(scene,camera);frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
 }
 function button(label,selected,action,color){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(selected));if(color){b.className='creator-swatch';b.style.setProperty('--swatch',color);b.title=label;b.setAttribute('aria-label',label);}b.onclick=action;return b;}
 function section(title){const h=document.createElement('h3');h.textContent=title;fields.append(h);const list=document.createElement('div');list.className='creator-options';fields.append(list);return list;}
 function items(slot,title){const list=section(title);for(const item of Shop.CATALOG.filter(i=>i.slot===slot)){const owned=wardrobe.owned.includes(item.id)||getUnlocked().includes(item.id);const b=button(item.name+(owned?'':` · ${item.price??'Earn'}${item.price!==null?' coins':''}`),wardrobe.equipped[slot]===item.id,()=>{wardrobe=Shop.equip(wardrobe,item.id,getUnlocked());dress();paint();});b.disabled=!owned;if(!owned)b.title='Unlock in the café shop';list.append(b);}}
 function paint(){
  const nav=q('nav');nav.replaceChildren();steps.forEach((s,i)=>nav.append(button(`${i+1}. ${s}`,i===step,()=>{step=i;paint();})));
  fields.replaceChildren();const eyebrow=document.createElement('p');eyebrow.className='creator-eyebrow';eyebrow.textContent=`STEP ${step+1} OF ${steps.length}`;const title=document.createElement('h2');title.textContent=steps[step];fields.append(eyebrow,title);
  if(step===0){const intro=document.createElement('p');intro.textContent='Choose an authored base and face. Your own character can share a style with the regulars.';fields.append(intro);const list=section('Presentation & face');for(const [id,c]of Object.entries(cast))list.append(button(c.name+' base',profile.base===id,()=>{profile.base=id;profile.skin=null;model().catch(error);paint();}));const p=document.createElement('p');p.className='creator-note';p.textContent='Each base keeps its original face, proportions and outfit silhouette. Individual face sculpting is not available yet.';fields.append(p);}
  if(step===1){const list=section('Skin tone');list.append(button('Original',profile.skin===null,()=>{profile.skin=null;dress();paint();}));SKINS.forEach((color,i)=>list.append(button('Tone '+(i+1),profile.skin===color,()=>{profile.skin=color;dress();paint();},color)));const eyes=section('Eye colour');EYES.forEach((color,i)=>eyes.append(button(['Original','Blue','Green','Hazel','Violet'][i],profile.eyes===color||(!profile.eyes&&i===0),()=>{profile.eyes=color;dress();paint();},color)));}
  if(step===2){items('hair','Hairstyle');items('hairColor','Hair colour');}
  if(step===3){for(const [slot,title]of [['top','Top'],['bottom','Bottom'],['shoes','Shoes'],['eyes','Glasses'],['head','Accessories'],['neck','Scarves']])items(slot,title);}
  if(step===2||step===3){const p=document.createElement('p');p.className='creator-note';p.textContent='Your owned wardrobe is ready to wear. Earn Maple Coins in the café to unlock more styles in the shop. Original choices retain your selected base’s authored outfit and hair.';fields.append(p);}
  if(step===4){const label=document.createElement('label');label.textContent='What should we call you?';const input=document.createElement('input');input.id='creator-name';input.maxLength=24;input.autocomplete='nickname';input.value=profile.name;input.placeholder='Your name';input.oninput=()=>{profile.name=input.value;q('.creator-error').textContent='';};label.append(input);fields.append(label);const note=document.createElement('p');note.textContent='Looking good. Your appearance and name will be saved on this device.';fields.append(note);}
  q('[data-back]').disabled=step===0;q('[data-next]').textContent=step===4?'Enter Maple Bean':'Continue →';
 }
 function error(e){q('.creator-error').textContent=e.message||'Could not load your preview. Please try again.';}
 function close(){loadVersion++;cancelAnimationFrame(frame);dialog.close();disposeAvatar();controls?.dispose();render?.dispose();stage.replaceChildren();focusBefore?.focus();}
 q('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});q('[data-back]').onclick=()=>{step--;paint();};
 q('[data-next]').onclick=async()=>{if(step<4){step++;paint();return;}const next=normalizeProfile(profile);if(!next.name){q('.creator-error').textContent='Choose a name before entering the café.';q('input').focus();return;}const b=q('[data-next]');b.disabled=true;try{const selected=allowedWardrobe(wardrobe,getUnlocked());await onSave(next,selected);let failed=false;save(PROFILE_KEY,next,()=>failed=true);if(failed)throw new Error('Your browser could not save this look. Please enable local storage.');close();}catch(e){error(e);}finally{b.disabled=false;}};
 dialog.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>frameCamera(b.dataset.zoom));dialog.querySelectorAll('[data-rotate]').forEach(b=>b.onclick=()=>{if(avatar)avatar.group.rotation.y+=Number(b.dataset.rotate)*Math.PI/4;});
 return {open(value=readProfile()){if(dialog.open)return;profile=normalizeProfile(value);wardrobe=allowedWardrobe(getWardrobe(),getUnlocked());step=0;focusBefore=document.activeElement;dialog.showModal();try{startPreview();paint();model().catch(error);}catch(e){error(e);}},close,get isOpen(){return dialog.open;}};
}
