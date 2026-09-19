import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {poseMatrices} from '../character-kit/pose.js';
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
 await Promise.all(ids.map(async id=>{if(!assets.has(id))assets.set(id,Promise.all([loader.loadAsync(`/assets/characters/${id}.glb`).then(softenSkin),loader.loadAsync(`/assets/characters/${id}-lod.glb`).then(softenSkin)]).catch(error=>{assets.delete(id);throw error;}));await assets.get(id);}));
 for(const id of ids)assets.set(id,await assets.get(id));
}
const translate=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
const pivot=(rotation,p)=>translate(p.x,p.y,p.z).multiply(rotation).multiply(translate(-p.x,-p.y,-p.z));
const clean=n=>n.replaceAll('.','');
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
 const eyeMat=(()=>{let m;body.traverse(o=>{if(o.isMesh&&o.material.name==='Eyes')m=o.material;});return m;})();
 const cupParts=[new THREE.CylinderGeometry(.035,.028,.078,16),new THREE.TorusGeometry(.021,.005,6,12).translate(.037,0,0),new THREE.CircleGeometry(.028,16).rotateX(-Math.PI/2).translate(0,.039,0)];
 cupParts.forEach((g,i)=>{const uv=g.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,i===2?.5:.015,i===2?.5:.015);});
 const cup=new THREE.Mesh(mergeGeometries(cupParts.map(g=>g.toNonIndexed())),eyeMat);cup.visible=false;cup.castShadow=true;group.add(cup);
 const offset=(options.phaseOffset||0)+(instance++)*.731;let phase=offset,blinkAt=3+offset,blinkStart=-10,gazeAt=0,gazeX=0,gazeY=0;
 const face={},blend={sit:0,walk:0,wave:0,sip:0,study:0};let seed=[...id].reduce((s,c)=>s+c.charCodeAt(0),29)+instance*991;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function update(t=0,dt=.016,state={}){
  const still=!!state.still,k=still?1:1-Math.exp(-dt*9),wide=options.male?1.34:1;
  for(const [name,target]of Object.entries({sit:+!!state.sitting,walk:+!!state.walking,wave:+!!state.wave&&!state.cup?1:0,sip:state.sipping?1:state.cup?.22:0,study:+!!state.studying}))blend[name]+=(target-blend[name])*k;
  const {sit,walk,wave,sip,study}=blend;phase+=dt*10.2*walk;
  const pose=poseMatrices({sit,walk,wave:0,sip:0,study,phase:still?1.2:phase,time:t,seatHeight:state.seatHeight??.54});
  if(t>blinkAt&&!still){blinkStart=t;blinkAt=t+2.8+rand()*3.5;}
  const bt=(t-blinkStart)/.18,blink=state.blink===undefined?(!still&&bt>=0&&bt<1?Math.sin(bt*Math.PI):0):THREE.MathUtils.clamp(state.blink,0,1);
  if(t>gazeAt&&!still){gazeX=(rand()-.5)*.12;gazeY=(rand()-.5)*.045;gazeAt=t+1.4+rand()*3;}
  const expressions=['smile','happy','curious','surprised','focused','laughing','listening','wink'];
  for(const name of expressions)face[name]=THREE.MathUtils.lerp(face[name]||0,state.expression===name?1:0,k);
  const headAngle=still||reduced?0:.022*Math.sin(t*.58+phase);
  const motion={root:pose.root,hips:pose.root.clone().multiply(pose.pelvis),spine:pose.root,chest:pose.root,neck:pose.root};
  const headMotion=pose.root.clone().multiply(pivot(new THREE.Matrix4().makeRotationY(headAngle).multiply(new THREE.Matrix4().makeRotationX(study*.055)),new THREE.Vector3(0,1.39,0)));
  motion.head=headMotion;motion.jaw=headMotion;
  for(const [i,tag,side]of [[0,'L',-1],[1,'R',1]]){
   motion['thigh'+tag]=pose.legs[i].thigh;motion['shin'+tag]=pose.legs[i].shin;motion['foot'+tag]=pose.legs[i].foot;
   const raised=side>0?wave:0,drink=side>0?sip:0,swing=-Math.cos(phase+(side<0?Math.PI:0))*.24*walk*(1-sit)-.10*sit-.35*study*sit;
   const shoulder=new THREE.Matrix4().makeRotationZ(side*.65*raised+1.2*drink).multiply(new THREE.Matrix4().makeRotationX(swing*(1-drink)-.425*drink));
   const upper=pose.root.clone().multiply(pivot(shoulder,new THREE.Vector3(side*.128*wide,1.222,-.02)));
   const elbow=new THREE.Matrix4().makeRotationZ(side*(2.12+.15*Math.sin(t*7))*raised).multiply(new THREE.Matrix4().makeRotationX((-.40*sit-.12*walk*(1-sit))*(1-drink)-2.225*drink)).multiply(new THREE.Matrix4().makeRotationY(side*1.25*raised));
   motion['upper'+tag]=upper;motion['lower'+tag]=upper.clone().multiply(pivot(elbow,new THREE.Vector3(side*(options.male?.201:.16),1.035,0)));motion['hand'+tag]=motion['lower'+tag];
   if(drink>0){
    const shoulderPoint=new THREE.Vector3(side*.128*wide,1.222,-.02),elbowPoint=new THREE.Vector3(side*(options.male?.201:.16),1.035,0),wristPoint=new THREE.Vector3(side*(options.male?.180:.191),.785,.03);
    const grip=new THREE.Vector3(0,-.032,.037),handRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.55);
    const target=new THREE.Vector3(.025,1.40748-.034,.150).sub(grip.clone().applyQuaternion(handRotation));
    const direction=target.clone().sub(shoulderPoint),distance=direction.length(),upperLength=elbowPoint.distanceTo(shoulderPoint),lowerLength=wristPoint.distanceTo(elbowPoint);direction.normalize();
    const along=(upperLength**2-lowerLength**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,upperLength**2-along**2));
    const bend=new THREE.Vector3(side*.8,-.6,.25);bend.addScaledVector(direction,-bend.dot(direction)).normalize();const elbowTarget=shoulderPoint.clone().addScaledVector(direction,along).addScaledVector(bend,height);
    const upperRotation=new THREE.Quaternion().setFromUnitVectors(elbowPoint.clone().sub(shoulderPoint).normalize(),elbowTarget.clone().sub(shoulderPoint).normalize());
    const lowerRotation=new THREE.Quaternion().setFromUnitVectors(wristPoint.clone().sub(elbowPoint).normalize(),target.clone().sub(elbowTarget).normalize());
    const full={['upper'+tag]:translate(...shoulderPoint).multiply(new THREE.Matrix4().makeRotationFromQuaternion(upperRotation)).multiply(translate(...shoulderPoint.clone().negate())),['lower'+tag]:translate(...elbowTarget).multiply(new THREE.Matrix4().makeRotationFromQuaternion(lowerRotation)).multiply(translate(...elbowPoint.clone().negate())),['hand'+tag]:translate(...target).multiply(new THREE.Matrix4().makeRotationFromQuaternion(handRotation)).multiply(translate(...wristPoint.clone().negate()))};
    for(const [name,matrix]of Object.entries(full)){const p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),p2=new THREE.Vector3(),q2=new THREE.Quaternion();motion[name].decompose(p,q,scale);pose.root.clone().multiply(matrix).decompose(p2,q2,new THREE.Vector3());motion[name].compose(p.lerp(p2,drink),q.slerp(q2,drink),scale);}
   }
   let gx=still||reduced?0:gazeX,gy=still||reduced?0:gazeY;
   if(state.lookTarget){const target=group.worldToLocal(new THREE.Vector3().copy(state.lookTarget));gx=THREE.MathUtils.clamp(Math.atan2(target.x,target.z),-.2,.2);gy=THREE.MathUtils.clamp((1.48-target.y)*.12,-.1,.1);}
   motion['eye'+tag]=headMotion.clone().multiply(pivot(new THREE.Matrix4().makeRotationY(gx).multiply(new THREE.Matrix4().makeRotationX(gy)),new THREE.Vector3(side*.052,1.476,.065)));
  }
  for(const rig of rigs){
   const desired=new Map();
   for(const bone of rig.bones){
    const name=clean(bone.name);let m=motion[name];
    if(!m&&/finger|thumb/.test(name)){
     const tag=name.includes('L')?'L':'R',rest=rig.rest.get(bone),p=new THREE.Vector3().setFromMatrixPosition(rest);
     const curl=state.cup&&tag==='R'?.85:state.gesture==='phone'||state.gesture==='book'?.5:study?.24+.07*Math.sin(t*3+name.length):.07;
     const baseName=name.endsWith('Tip')?name.slice(0,-3):name;const parentMotion=name.endsWith('Tip')?(motion[baseName]||motion['hand'+tag]):motion['hand'+tag];m=parentMotion.clone().multiply(pivot(new THREE.Matrix4().makeRotationX(-curl),p));motion[name]=m;
    }
    desired.set(bone,(m||pose.root).clone().multiply(rig.rest.get(bone)));
   }
   for(const bone of rig.bones){const parent=desired.get(bone.parent)||rig.parents.get(bone);bone.matrix.copy(parent).invert().multiply(desired.get(bone));bone.matrixWorldNeedsUpdate=true;}
   for(const mesh of rig.morphs)for(const [name,index]of Object.entries(mesh.morphTargetDictionary)){mesh.morphTargetInfluences[index]=name==='blink.L'||name==='blink.R'?blink:(face[name]||0);}
  }
  cup.visible=!!state.cup;cup.position.set(options.male?.180:.191,.753,.067).applyMatrix4(motion.handR);cup.quaternion.setFromRotationMatrix(motion.handR);
  group.position.y=still||reduced?0:Math.sin(t*1.45+offset)*.0025*(1-walk);
  group.updateMatrixWorld(true);
 }
 update(0,0,{still:true});return {group,update,head,body,face,hair,skinning:'gpu'};
}
