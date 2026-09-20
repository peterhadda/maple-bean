import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {poseMatrices,WALK_STRIDE} from '../character-kit/pose.js';
import {createBodyPoser} from './body-pose.js';
const assets=new Map(),loader=new GLTFLoader();let instance=0;
// Preserve the original character kit's soft skin response under the café lights.
function softenSkin(gltf){
 gltf.scene.traverse(o=>{if(!o.isMesh||o.material.name!=='Skin'||o.material.userData.softSkin)return;const m=o.material;m.userData.softSkin=true;
 m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
void RE_Direct_MapleSkin(const in IncidentLight directLight,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){
 RE_Direct_Physical(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
 float nl=dot(geometryNormal,directLight.direction);float band=saturate((nl+.45)/1.45)-saturate(nl);
 reflectedLight.directDiffuse+=directLight.color*vec3(.85,.42,.30)*band*BRDF_Lambert(material.diffuseColor);
}
#undef RE_Direct
#define RE_Direct RE_Direct_MapleSkin`);};m.customProgramCacheKey=()=> 'maple-soft-skin';m.needsUpdate=true;
 });return gltf;
}
export async function loadCharacters(ids=['maya','claire','mara','jules','noah']){
 await Promise.all(ids.map(async id=>{if(!assets.has(id))assets.set(id,Promise.all([loader.loadAsync(`/assets/characters/${id}.glb?v=maple-final-20260919`).then(softenSkin),loader.loadAsync(`/assets/characters/${id}-lod.glb?v=maple-final-20260919`).then(softenSkin)]).catch(error=>{assets.delete(id);throw error;}));await assets.get(id);}));
 for(const id of ids)assets.set(id,await assets.get(id));
}
// Calibrated against the approved cast sheet; one transform keeps eyes, hair and face registered.
export const HEAD_SCALE=.90;
const EXPRESSION_STRENGTH={smile:.75,happy:.7,curious:.7,surprised:.65,focused:.7,laughing:.7,listening:.7,wink:1};
export function blendExpressions(face,expression,dt,still=false){
 const amount=still?1:1-Math.exp(-Math.max(0,Number.isFinite(dt)?dt:0)*5);
 let sum=0;
 for(const [name,strength]of Object.entries(EXPRESSION_STRENGTH)){
  const current=Number.isFinite(face[name])?Math.max(0,face[name]):0;
  face[name]=current+((expression===name?strength:0)-current)*amount;sum+=face[name];
 }
 if(sum>1)for(const name of Object.keys(EXPRESSION_STRENGTH))face[name]/=sum;
 return face;
}
const translate=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
const pivot=(rotation,p)=>translate(p.x,p.y,p.z).multiply(rotation).multiply(translate(-p.x,-p.y,-p.z));
const clean=n=>n.replaceAll('.','');
// Small shared props the cast can hold or wear. Cheap primitives, one material each.
export const TWO_HANDED=new Set(['type','read','write','ears','stretch','arcade','cheer','aim','throw','reach']);
let propKit=null;
function props(){
 if(propKit)return propKit;
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.55});
 const book=new THREE.Group();
 const cover=new THREE.Mesh(new THREE.BoxGeometry(.19,.008,.14),mat('#7c4a33'));
 const pages=new THREE.Mesh(new THREE.BoxGeometry(.18,.014,.13),mat('#f2e8d4'));pages.position.y=.009;book.add(cover,pages);
 const pen=new THREE.Mesh(new THREE.CylinderGeometry(.0035,.0025,.13,8),mat('#304c40'));
 const dart=new THREE.Group();const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.004,.002,.12,8).rotateX(Math.PI/2),mat('#b7814e'));
 const flight=new THREE.Mesh(new THREE.ConeGeometry(.014,.035,4).rotateX(-Math.PI/2).translate(0,0,-.07),mat('#c24c3c'));dart.add(shaft,flight);
 const phones=new THREE.Group();const phoneMat=mat('#2f3b35'),padMat=mat('#c9a27a');
 const band=new THREE.Mesh(new THREE.TorusGeometry(.172,.011,8,28,Math.PI),phoneMat);band.scale.set(1,1.42,1);phones.add(band);
 for(const s of [-1,1]){const cup=new THREE.Mesh(new THREE.CylinderGeometry(.047,.047,.034,20).rotateZ(Math.PI/2),phoneMat);cup.position.set(s*.168,0,0);const pad=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.012,20).rotateZ(Math.PI/2),padMat);pad.position.set(s*.148,0,0);phones.add(cup,pad);}
 const can=new THREE.Group();const canMat=mat('#6f8f7a');const body=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.13,18),canMat);
 const spout=new THREE.Mesh(new THREE.CylinderGeometry(.008,.012,.2,8).rotateX(Math.PI/2.6).translate(0,.04,.12),canMat);
 const grip=new THREE.Mesh(new THREE.TorusGeometry(.045,.008,6,14,Math.PI).rotateY(Math.PI/2).translate(0,.065,-.01),canMat);can.add(body,spout,grip);
 const glasses=new THREE.Group();const frame=mat('#3a2a22');
 for(const x of [-.060,.060]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.035,.0035,8,24),frame);ring.position.set(x,0,0);glasses.add(ring);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.033,20),new THREE.MeshStandardMaterial({color:'#e8f1f2',transparent:true,opacity:.18,roughness:.05}));lens.position.set(x,0,.001);glasses.add(lens);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.0028,.0028,.12,6).rotateX(Math.PI/2),frame);arm.position.set(Math.sign(x)*.095,.004,-.058);glasses.add(arm);}
 const bridge=new THREE.Mesh(new THREE.TorusGeometry(.025,.003,6,10,Math.PI),frame);bridge.position.set(0,.004,0);glasses.add(bridge);
 const beret=new THREE.Group();const felt=mat('#8d3b32');const crown=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),felt);crown.scale.set(.13,.04,.125);beret.add(crown);
 const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.004,.006,.02,6),felt);stalk.position.y=.04;beret.add(stalk);
 const leaf=new THREE.Group();const shape=new THREE.Shape();for(let i=0;i<=10;i++){const a=i/10*Math.PI*2,r=i%2?.012:.026;shape[i?'lineTo':'moveTo'](Math.sin(a)*r,Math.cos(a)*r);}
 const leafMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:false}),mat('#c4622d'));leaf.add(leafMesh);
 const scarf=new THREE.Group();const knit=new THREE.MeshStandardMaterial({color:'#b0654a',roughness:.95});const wrap=new THREE.Mesh(new THREE.TorusGeometry(.08,.03,10,28),knit);wrap.rotation.x=Math.PI/2;wrap.scale.set(1,1.05,.8);scarf.add(wrap);
 const tail=new THREE.Mesh(new THREE.BoxGeometry(.075,.24,.03),knit);tail.position.set(.045,-.13,.07);tail.rotation.z=.12;scarf.add(tail);scarf.userData.knit=knit;
 return propKit={book,pen,dart,phones,can,glasses,beret,'leaf-clip':leaf,scarf};
}
// A ceramic café cup with a tinted drink surface (matcha reads green, coffee dark).
export function makeCup(){
 const cup=new THREE.Group(),ceramic=new THREE.MeshStandardMaterial({color:'#f3ead9',roughness:.35});
 const profile=[[0,-.039],[.025,-.039],[.028,-.036],[.0345,.034],[.035,.037],[.034,.039],[.0325,.038],[.0318,.034],[.0255,-.032],[.023,-.034],[0,-.034]].map(([x,y])=>new THREE.Vector2(x,y));
 const body=new THREE.Mesh(mergeGeometries([new THREE.LatheGeometry(profile,24),new THREE.TorusGeometry(.021,.005,8,16).translate(.037,0,0)].map(g=>{g.deleteAttribute('uv');return g.index?g.toNonIndexed():g;})),ceramic);
 body.material.side=THREE.DoubleSide;
 const liquid=new THREE.Mesh(mergeGeometries([new THREE.CircleGeometry(.0318,24).rotateX(-Math.PI/2),new THREE.TorusGeometry(.031,.0008,6,24).rotateX(Math.PI/2)].map(g=>g.toNonIndexed())).translate(0,.028,0),new THREE.MeshStandardMaterial({color:'#b98552',roughness:.2}));
 body.castShadow=true;cup.add(body,liquid);cup.userData.liquid=liquid;return cup;
}
// Recolours regions of the outfit while keeping the knit/denim texture: the new
// colour is scaled by each texel's brightness relative to the authored base colour.
// Regions come from bind-space height, which every cast outfit shares.
export function clothingTintRegion(name){
 if(!name.includes(' reference '))return null;
 return /cardigan|hoodie|sweatshirt/i.test(name)?'top':/cargo|denim/i.test(name)?'bottom':null;
}
function installTint(material,uniforms,colors={}){
 const lin=hex=>{const c=new THREE.Color(hex);return .2126*c.r+.7152*c.g+.0722*c.b;};
 const kind=material.name==='Hair'?'hair':'cloth';
 const region=clothingTintRegion(material.name);
 for(const k of kind==='hair'?['hair']:['top','bottom','shoes'])uniforms[k]=uniforms[k]||{on:{value:0},color:{value:new THREE.Color('#ffffff')}};
 const base={top:lin(colors.top??0xf4e6d9),bottom:lin(colors.denim??0x6179a0),shoes:lin(0xf3e7dc),hair:Math.max(.02,lin(colors.hair??0x22140e))};
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,renderer){
  previous?.call(this,shader,renderer);
  const names=Object.keys(uniforms).filter(k=>kind==='hair'?k==='hair':k!=='hair');
  for(const k of names){shader.uniforms['tint_'+k]=uniforms[k].color;shader.uniforms['tintOn_'+k]=uniforms[k].on;}
  shader.vertexShader='varying vec3 vBindPos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBindPos=position;');
  const decl=names.map(k=>`uniform vec3 tint_${k};uniform float tintOn_${k};`).join('\n');
  const body=kind==='hair'
   ?`{float l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,tint_hair*clamp(l/${base.hair.toFixed(4)},.35,2.2),tintOn_hair);}`
   :`{float l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
     float shoe=1.-step(.125,vBindPos.y);float top=max(step(1.0,vBindPos.y),step(.155,abs(vBindPos.x))*step(.87,vBindPos.y))*(1.-shoe);float bottom=(1.-shoe)*(1.-top);
     ${region==='top'?'shoe=0.;top=1.;bottom=0.;':region==='bottom'?'shoe=0.;top=0.;bottom=1.;':''}
     vec3 c=diffuseColor.rgb;
     c=mix(c,tint_top*clamp(l/${base.top.toFixed(4)},.2,1.3),tintOn_top*top);
     c=mix(c,tint_bottom*clamp(l/${base.bottom.toFixed(4)},.2,1.6),tintOn_bottom*bottom);
     c=mix(c,tint_shoes*clamp(l/${base.shoes.toFixed(4)},.2,1.3),tintOn_shoes*shoe);
     diffuseColor.rgb=c;}`;
  shader.fragmentShader='varying vec3 vBindPos;\n'+decl+'\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+body);
 };
 const key=material.customProgramCacheKey?.bind(material);
 material.customProgramCacheKey=()=>(key?key():'')+'|tint-'+kind+'-'+(region||'position');
 material.needsUpdate=true;
}
export function makeProp(name){const p=props()[name].clone();p.traverse(o=>{if(o.isMesh)o.castShadow=true;});return p;}
export function createMaya(options={}){
 const id=options.character||'maya',source=assets.get(id);
 if(!Array.isArray(source))throw new Error(`Character ${id} has not finished loading`);
 const group=new THREE.Group();group.name=options.name||id;const lod=new THREE.LOD();group.add(lod);const rigs=[];
 for(const [index,gltf]of source.entries()){
  const model=clone(gltf.scene);model.updateMatrixWorld(true);const bones=[],morphs=[],world=new Map();
  model.traverse(o=>{if(o.isBone){o.matrixAutoUpdate=false;bones.push(o);world.set(o,o.matrixWorld.clone());}if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.morphTargetDictionary)morphs.push(o);}});
  rigs.push({model,bones,morphs,rest:world,parents:new Map(bones.map(b=>[b,b.parent.matrixWorld.clone()]))});lod.addLevel(model,index?7:0);
 }
 const find=name=>rigs[0].bones.find(b=>clean(b.name)===clean(name));
 const head=find('head'),body=rigs[0].model,hair=body.getObjectByName('Hair_geometry');
 // Authored face shaping moves the eyeballs away from the original rig pivots.
 // Rotate each globe about its final centre so looking around cannot pull it out.
 const eyeBounds={L:new THREE.Box3(),R:new THREE.Box3()},point=new THREE.Vector3();
 body.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.material.name!=='Eyes')return;
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++)for(let j=0;j<4;j++){
   if(skinWeight.getComponent(i,j)<=.5)continue;
   const name=clean(mesh.skeleton.bones[skinIndex.getComponent(i,j)].name),box=eyeBounds[name.slice(3)];
   if(/^eye[LR]$/.test(name)&&box)box.expandByPoint(point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
  }
 });
 const eyePivots=Object.fromEntries(Object.entries(eyeBounds).map(([tag,box])=>[tag,box.isEmpty()?new THREE.Vector3().setFromMatrixPosition(rigs[0].rest.get(find('eye'+tag))):box.getCenter(new THREE.Vector3())]));
 const fingerRest={};for(const b of rigs[0].bones){const n=clean(b.name);if(/finger|thumb/.test(n))fingerRest[n]=new THREE.Vector3().setFromMatrixPosition(rigs[0].rest.get(b));}
 const eyeMat=(()=>{let m;body.traverse(o=>{if(o.isMesh&&o.material.name==='Eyes')m=o.material;});return m;})();
 const cup=makeCup();cup.visible=false;group.add(cup);
 const kit=props(),held={};for(const [name,proto]of Object.entries(kit)){const p=proto.clone();p.visible=false;p.traverse(o=>{if(o.isMesh)o.castShadow=true;});group.add(p);held[name]=p;}
 const offset=(options.phaseOffset||0)+(instance++)*.731;let phase=offset,blinkAt=3+offset,blinkStart=-10,gazeAt=0,gazeX=0,gazeY=0;
 const face={},blend={sit:0,walk:0,sip:0};let seed=[...id].reduce((s,c)=>s+c.charCodeAt(0),29)+instance*991;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 options.colors=options.colors||{};
 const poser=createBodyPoser({male:!!options.male,rand,fingerRest});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const wristRest={[-1]:new THREE.Vector3(-(options.male?.180:.191),.785,.03),[1]:new THREE.Vector3(options.male?.180:.191,.785,.03)};
 let last=null;const lastPosition=new THREE.Vector2();
 // ---- player customization (only instances created with {customizable:true})
 const worn=[],tintUniforms={},appearanceUniforms={skin:{value:new THREE.Color(1,1,1)},eyes:{value:new THREE.Color(1,1,1)},eyeTint:{value:0}};
 if(options.customizable){
  for(const rig of rigs)rig.model.traverse(o=>{if(!o.isMesh||!['Skin','Eyes'].includes(o.material.name))return;
   o.material=o.material.clone();const material=o.material,kind=material.name==='Skin'?'skin':'eyes',previous=material.onBeforeCompile;
   material.onBeforeCompile=function(shader,renderer){previous?.call(this,shader,renderer);shader.uniforms.appearanceTint=appearanceUniforms[kind];shader.uniforms.eyeTint=appearanceUniforms.eyeTint;
    shader.fragmentShader='uniform vec3 appearanceTint; uniform float eyeTint;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+(kind==='skin'?'diffuseColor.rgb*=appearanceTint;':'float chroma=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));float irisLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,appearanceTint*clamp(irisLight*2.5,.08,1.3),smoothstep(.04,.18,chroma)*eyeTint);'));
   };material.customProgramCacheKey=()=> 'maple-appearance-v2-'+kind;material.needsUpdate=true;
  });
  for(const rig of rigs)rig.model.traverse(o=>{if(o.isMesh&&(['Wardrobe','Hair','Accessories'].includes(o.material.name)||o.material.name.includes(' reference '))){o.material=o.material.clone();installTint(o.material,tintUniforms,options.colors);}});
 }
 function setAppearance({skin=null,eyes=null}={}){
  if(!options.customizable)return;
  const base=new THREE.Color(options.colors.skin??0xeeb092),target=new THREE.Color(skin??options.colors.skin??0xeeb092);
  appearanceUniforms.skin.value.setRGB(target.r/Math.max(.01,base.r),target.g/Math.max(.01,base.g),target.b/Math.max(.01,base.b));
  appearanceUniforms.eyes.value.set(eyes??'#ffffff'); appearanceUniforms.eyeTint.value = eyes && eyes !== '#ffffff' ? 1 : 0;
 }
 function setTints({top=null,bottom=null,shoes=null,hair=null}={}){
  for(const [k,v]of Object.entries({top,bottom,shoes,hair})){const u=tintUniforms[k];if(!u)continue;u.on.value=v?1:0;if(v)u.color.value.set(v);}
 }
 function setHairStyle(from){
  for(const [i,rig]of rigs.entries()){
   let own=null;rig.model.traverse(o=>{if(o.isSkinnedMesh&&o.name==='Hair_geometry'&&!o.userData.swapped)own=o;});
   const stale=[];rig.model.traverse(o=>{if(o.userData.swapped)stale.push(o);});for(const o of stale)o.parent.remove(o);
   if(own)own.visible=from===id||!from;
   if(!from||from===id)continue;
   const src=assets.get(from)?.[i];if(!src)continue;
   let hairSrc;src.scene.traverse(o=>{if(o.isSkinnedMesh&&o.material.name==='Hair'&&o.name==='Hair_geometry')hairSrc=o;});if(!hairSrc)continue;
   const byName=new Map(rig.bones.map(b=>[clean(b.name),b]));
   const mesh=new THREE.SkinnedMesh(hairSrc.geometry,own?own.material:hairSrc.material.clone());mesh.userData.swapped=true;mesh.castShadow=true;mesh.frustumCulled=false;
   (own?.parent||rig.model).add(mesh);
   mesh.bind(new THREE.Skeleton(hairSrc.skeleton.bones.map(b=>byName.get(clean(b.name))),hairSrc.skeleton.boneInverses.map(m=>m.clone())),own?own.bindMatrix:hairSrc.bindMatrix);
  }
 }
 function setAccessories(list=[]){
  for(const w of worn)group.remove(w.mesh);worn.length=0;
  for(const {prop,color}of list){const k=props()[prop];if(!k)continue;const mesh=k.clone();if(prop==='scarf'){mesh.traverse(o=>{if(o.isMesh)o.material=o.material.clone();});if(color)mesh.traverse(o=>{if(o.isMesh)o.material.color.set(color);});}mesh.traverse(o=>{if(o.isMesh)o.castShadow=true;});group.add(mesh);worn.push({prop,mesh});}
 }
 const WORN={glasses:[new THREE.Vector3(0,1.438,.16),new THREE.Euler(0,0,0)],beret:[new THREE.Vector3(.012,1.675,.035),new THREE.Euler(-.2,0,.28)],'leaf-clip':[new THREE.Vector3(.118,1.585,.058),new THREE.Euler(0,.9,.3)],scarf:[new THREE.Vector3(0,1.255,.004),new THREE.Euler(0,0,0)]};
 function update(t=0,dt=.016,state={}){
  const still=!!state.still,k=still?1:1-Math.exp(-dt*9);
  if(state.sitAmount!==undefined)blend.sit=THREE.MathUtils.clamp(state.sitAmount,0,1);else blend.sit+=(+!!state.sitting-blend.sit)*k;
  for(const [name,target]of Object.entries({walk:+!!state.walking,sip:state.sipping?1:0}))blend[name]+=(target-blend[name])*k;
  const {sit,walk,sip}=blend;
  // Travel drives cadence, so slow NPCs and fast players plant the same feet.
  const distance=state.walkDistance??Math.hypot(group.position.x-lastPosition.x,group.position.z-lastPosition.y);
  if(state.walking&&!still&&distance<1)phase+=distance*Math.PI/(2*WALK_STRIDE);
  lastPosition.set(group.position.x,group.position.z);
  const pose=poseMatrices({sit,walk,phase:still?1.2:phase,time:t,seatHeight:state.seatHeight??.54});
  if(t>blinkAt&&!still){blinkStart=t;blinkAt=t+2.8+rand()*3.5;}
  const bt=(t-blinkStart)/.18,blink=state.blink===undefined?(!still&&bt>=0&&bt<1?Math.sin(bt*Math.PI):0):THREE.MathUtils.clamp(state.blink,0,1);
  if(t>gazeAt&&!still){gazeX=(rand()-.5)*.12;gazeY=(rand()-.5)*.045;gazeAt=t+1.4+rand()*3;}
  blendExpressions(face,state.expression,dt,still);
  const lookLocal=state.lookTarget?group.worldToLocal(new THREE.Vector3().copy(state.lookTarget)):null;
  // Legacy callers pass `studying`; seated study defaults to typing at the desk.
  const activity=state.activity||(state.studying&&sit>.5?'type':null);
  const solved=poser.solve({t,dt,still,root:pose.root,sit,walk,phase:still?1.2:phase,state:{...state,activity,lookTarget:lookLocal}});
  const headMotion=solved.head.clone().multiply(pivot(new THREE.Matrix4().makeScale(HEAD_SCALE,HEAD_SCALE,HEAD_SCALE),new THREE.Vector3(0,1.39,0)));
  const motion={root:pose.root,hips:pose.root.clone().multiply(pose.pelvis),spine:solved.spine,chest:solved.chest,neck:solved.neck,head:headMotion,jaw:headMotion,...solved.fingers};
  for(const [i,tag,side]of [[0,'L',-1],[1,'R',1]]){
   motion['thigh'+tag]=pose.legs[i].thigh;motion['shin'+tag]=pose.legs[i].shin;motion['foot'+tag]=pose.legs[i].foot;
   const arm=solved.arms[side];motion['upper'+tag]=arm.upper;motion['lower'+tag]=arm.lower;motion['hand'+tag]=arm.hand;
   let gx=still||reduced?0:gazeX,gy=still||reduced?0:gazeY;
   if(lookLocal){gx=THREE.MathUtils.clamp(Math.atan2(lookLocal.x,lookLocal.z)*.35,-.2,.2);gy=THREE.MathUtils.clamp((1.48-lookLocal.y)*.12,-.1,.1);}
   motion['eye'+tag]=headMotion.clone().multiply(pivot(new THREE.Matrix4().makeRotationY(gx).multiply(new THREE.Matrix4().makeRotationX(gy)),eyePivots[tag]));
  }
  for(const rig of rigs){
   const desired=new Map();
   for(const bone of rig.bones)desired.set(bone,(motion[clean(bone.name)]||pose.root).clone().multiply(rig.rest.get(bone)));
   for(const bone of rig.bones){const parent=desired.get(bone.parent)||rig.parents.get(bone);bone.matrix.copy(parent).invert().multiply(desired.get(bone));bone.matrixWorldNeedsUpdate=true;}
   for(const mesh of rig.morphs)for(const [name,index]of Object.entries(mesh.morphTargetDictionary)){mesh.morphTargetInfluences[index]=name==='blink.L'||name==='blink.R'?blink:name==='wink'?(face.wink||0)*(1-blink):(face[name]||0);}
  }
  // Props follow the hand that holds them; the cup stays upright until a sip tilts it.
  const handAt=(side,point)=>point.clone().applyMatrix4(side>0?motion.handR:motion.handL);
  const palm=(side,along,out,fwd=0)=>wristRest[side].clone().add(new THREE.Vector3(-side*out,-along,fwd));
  cup.visible=!!state.cup&&!state.cupDown&&!TWO_HANDED.has(activity);if(state.cupColor)cup.userData.liquid.material.color.set(state.cupColor);
  if(cup.visible){cup.position.copy(handAt(1,palm(1,.05,.047,.004)));cup.rotation.set(-1.05*sip,Math.PI/2,0);}
  for(const p of Object.values(held))p.visible=false;
  const act=state.activity,q=solved.arms[-1].handQ;
  if(act==='write'){const p=held.pen;p.visible=true;p.position.copy(handAt(-1,palm(-1,.055,.012,.01)));p.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.5));}
  if(act==='aim'){const p=held.dart;p.visible=true;p.position.copy(handAt(-1,palm(-1,.06,.01,.012)));p.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));}
  if(act==='water'){const p=held.can;p.visible=true;p.position.copy(handAt(-1,palm(-1,.05,.06,0))).add(new THREE.Vector3(0,-.07,0));p.rotation.set(.5,0,0);}
  if(act==='read'){const b=held.book;b.visible=true;const l=handAt(1,palm(1,.04,.02)),r=handAt(-1,palm(-1,.04,.02));b.position.copy(l).add(r).multiplyScalar(.5).add(new THREE.Vector3(0,.03,.01));b.rotation.set(-.95,0,0);}
  if(state.headphones==='head'){const h=held.phones;h.visible=true;h.position.set(0,1.445,.005).applyMatrix4(headMotion);h.quaternion.setFromRotationMatrix(solved.head);h.scale.setScalar(HEAD_SCALE);}
  else if(state.headphones==='hands'){const h=held.phones;h.visible=true;const l=handAt(1,palm(1,.03,-.01)),r=handAt(-1,palm(-1,.03,-.01));h.position.copy(l).add(r).multiplyScalar(.5);h.quaternion.setFromRotationMatrix(solved.head);h.scale.setScalar(HEAD_SCALE);}
  for(const w of worn){const [pos,rot]=WORN[w.prop];const m=(w.prop==='scarf'?solved.chest:headMotion).clone().multiply(new THREE.Matrix4().makeRotationFromEuler(rot).setPosition(pos));m.decompose(w.mesh.position,w.mesh.quaternion,w.mesh.scale);}
  group.position.y=still||reduced?0:Math.sin(t*1.45+offset)*.0025*(1-walk)*(1-sit);
  group.updateMatrixWorld(true);
  last=solved;
 }
 update(0,0,{still:true});
 return {group,update,head,body,face,hair,skinning:'gpu',setAppearance,setTints,setHairStyle,setAccessories,
  // World-space wrist of one hand (side -1 = the character's right hand).
  handWorld(side=-1){const b=find('hand'+(side>0?'R':'L'));return b?new THREE.Vector3().setFromMatrixPosition(b.matrixWorld):group.position.clone();},
  get idle(){return last?.idle;}};
}
