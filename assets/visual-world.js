import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Dress the existing furniture and pots in place; their collision footprints stay intact.
export function refineCafe(root,scene){
 const parts=new Map(),plants=[],crowns=[],V=THREE.Vector3;
 const oak=new THREE.MeshStandardMaterial({color:'#997047',roughness:.72});
 const seam=new THREE.MeshStandardMaterial({color:'#869273',roughness:1});
 const brass=new THREE.MeshStandardMaterial({color:'#bc955b',metalness:.7,roughness:.3});
 const steel=new THREE.MeshStandardMaterial({color:'#a0a19a',metalness:.8,roughness:.24});
 const dark=new THREE.MeshStandardMaterial({color:'#28342b',roughness:.64});
 const porcelain=new THREE.MeshStandardMaterial({color:'#f0e5cc',roughness:.3});
 const add=(g,mat,matrix)=>{if(matrix)g.applyMatrix4(matrix);if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}for(const n of Object.keys(g.attributes))if(!['position','normal','uv'].includes(n))g.deleteAttribute(n);if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!parts.has(mat))parts.set(mat,[]);parts.get(mat).push(g);};
 const tube=(pts,r,mat,matrix,closed=false)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new V(...p)),closed),Math.max(12,pts.length*4),r,5,closed),mat,matrix);
 const pill=(w,h,z,mat,matrix)=>{const pts=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*2;pts.push([Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.35)*w,Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.35)*h,z]);}tube(pts,.003,mat,matrix,true);};
 root.traverse(o=>{
  if(!o.isMesh)return;
  if(/Maple_Hollow_tree_canopy/.test(o.name)){const b=new THREE.Box3().setFromObject(o);crowns.push({p:b.getCenter(new V()),s:b.getSize(new V()).multiplyScalar(.5)});o.userData.replaced=true;}
  if(/^(Plant_pot|Terracotta_plant_pot)/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),r=(b.max.x-b.min.x)/2,h=b.max.y-b.min.y;
   plants.push({x:c.x,y:b.max.y-.025,z:c.z,r});o.userData.replaced=true;
   const profile=[[r*.73,0],[r*.76,.025],[r*.95,h*.88],[r,h*.94],[r,h],[r*.86,h],[r*.85,h*.9]].map(([x,y])=>new THREE.Vector2(x,y));
   add(new THREE.LatheGeometry(profile,32).translate(c.x,b.min.y,c.z),o.material);
   add(new THREE.CircleGeometry(r*.87,24).rotateX(-Math.PI/2).translate(c.x,b.max.y-.028,c.z),dark);
  }
  if(/^Maple_bun/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),r=(b.max.x-b.min.x)/2;o.userData.replaced=true;
   add(new THREE.SphereGeometry(1,20,12).scale(r,.065,r).translate(c.x,b.min.y+.055,c.z),oak);
   const spiral=[];for(let i=0;i<=54;i++){const t=i/54,a=t*Math.PI*5;spiral.push([c.x+Math.cos(a)*r*t*.86,b.max.y+.006-.035*t*t,c.z+Math.sin(a)*r*t*.86]);}tube(spiral,.004,porcelain);
  }
  if(/Chair_curved_back/.test(o.name)){
   o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+.14*x*x+.022*Math.cos(y*4));}o.geometry.computeVertexNormals();
   pill(.257,.247,.075,seam,o.matrixWorld);
   for(const x of [-.12,.12])add(new THREE.SphereGeometry(.013,8,6).scale(1,1,.4).translate(x,.05,.089),seam,o.matrixWorld);
  }
  if(/Sofa_generous_back/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),width=b.max.x-b.min.x;
   for(let i=0;i<3;i++){
    const m=new THREE.Matrix4().makeTranslation(c.x+(i-1)*(width-.3)/3,c.y+.015,c.z+.12);
    const cushion=new THREE.SphereGeometry(1,24,16),p=cushion.attributes.position;
    for(let n=0;n<p.count;n++)for(const [k,s]of [[0,(width-.4)/6],[1,.36],[2,.11]])p.setComponent(n,k,Math.sign(p.getComponent(n,k))*Math.pow(Math.abs(p.getComponent(n,k)),.4)*s);
    cushion.computeVertexNormals();add(cushion,o.material,m);pill((width-.47)/6,.315,.067,seam,m);
   }
  }
  if(/Linen_throw_pillow/.test(o.name))pill(.169,.18,.096,oak,o.matrixWorld);
  if(/Pendant_shade/.test(o.name)){
   const profile=[[.045,.14],[.09,.132],[.17,.102],[.24,.052],[.29,-.026],[.335,-.126],[.335,-.14],[.32,-.14],[.28,-.033],[.23,.04],[.16,.09],[.08,.119],[.045,.126]].map(p=>new THREE.Vector2(...p));
   // Source shade is a Blender cylinder rotated into Y-up; replace in world space.
   const c=new THREE.Box3().setFromObject(o).getCenter(new V());o.visible=false;o.userData.replaced=true;
   add(new THREE.LatheGeometry(profile,32).translate(c.x,c.y,c.z),brass);
  }
 });
 // Folded throw draped over the existing lounge arm.
 const blanket=new THREE.BufferGeometry(),p=[],uv=[],ix=[];
 for(let i=0;i<=24;i++)for(let j=0;j<=12;j++){const t=i/24,u=j/12; p.push(4.97+u*.52,.89-.54*Math.pow(Math.max(0,(t-.33)/.67),1.2)+.017*Math.sin(u*31+t*3),-5.77+t*.95);uv.push(u,t);}
 for(let i=0;i<24;i++)for(let j=0;j<12;j++){const a=i*13+j;ix.push(a,a+13,a+1,a+1,a+13,a+14);}blanket.setAttribute('position',new THREE.Float32BufferAttribute(p,3));blanket.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));blanket.setIndex(ix);blanket.computeVertexNormals();add(blanket,new THREE.MeshStandardMaterial({color:'#cfb28e',map:surface('fabric'),roughness:1,side:THREE.DoubleSide}));
 // Espresso group: controls, portafilters, cup rail and a ribbed drip tray.
 add(new THREE.BoxGeometry(.77,.31,.017).translate(-6.9,1.38,-4.688),steel);
 for(const x of [-7.13,-6.7]){
  add(new THREE.CylinderGeometry(.051,.051,.013,20).rotateX(Math.PI/2).translate(x,1.43,-4.673),dark);
  add(new THREE.CircleGeometry(.04,20).translate(x,1.43,-4.665),porcelain);
  tube([[x-.018,1.414,-4.658],[x+.01,1.45,-4.658]],.002,dark);
  tube([[x,1.32,-4.69],[x,1.27,-4.63],[x,1.25,-4.57]],.019,steel);
  tube([[x,1.27,-4.65],[x+.11,1.27,-4.53]],.016,dark);
  add(new THREE.CylinderGeometry(.037,.026,.055,16).translate(x,1.115,-4.58),porcelain);
 }
 for(let i=0;i<11;i++)add(new THREE.BoxGeometry(.005,.009,.21).translate(-7.24+i*.068,1.079,-4.59),steel);
 tube([[-7.3,1.64,-4.73],[-7.3,1.69,-4.73],[-6.5,1.69,-4.73],[-6.5,1.64,-4.73]],.008,brass);
 const glass=new THREE.MeshPhysicalMaterial({color:'#e6f3ed',transparent:true,opacity:.16,roughness:.12,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
 add(new THREE.PlaneGeometry(1.40,.46).translate(-1.9,1.42,-4.395),glass);
 for(const x of [-2.6,-1.2])tube([[x,1.18,-4.40],[x,1.66,-4.40],[x,1.66,-5.18]],.012,brass);
 for(const [mat,geos]of parts){const mesh=new THREE.Mesh(mergeGeometries(geos),mat);mesh.name='Refined café details';mesh.castShadow=mat!==glass;mesh.receiveShadow=true;scene.add(mesh);geos.forEach(g=>g.dispose());}
 addOrganicPlants(scene,plants);
 const canopyGeo=new THREE.SphereGeometry(1,12,8),canopyMat=new THREE.MeshStandardMaterial({color:'#8fba69',roughness:.94});
 const canopies=new THREE.InstancedMesh(canopyGeo,canopyMat,crowns.length*13),d=new THREE.Object3D();let k=0;
 crowns.forEach(({p,s},c)=>{for(let i=0;i<13;i++){const y=1-2*(i+.5)/13,a=i*2.399,r=Math.sqrt(1-y*y);d.position.copy(p).add(new V(Math.cos(a)*r*s.x*.68,y*s.y*.64,Math.sin(a)*r*s.z*.68));d.rotation.set(i*.3,c*.4,i*.17);d.scale.copy(s).multiply(new V(.48,.48,.48));d.updateMatrix();canopies.setMatrixAt(k,d.matrix);canopies.setColorAt(k,new THREE.Color().setHSL(.24+(i%3)*.015,.30,.34+(i%4)*.024));k++;}});canopies.castShadow=true;canopies.receiveShadow=true;canopies.name='Layered Maple Hollow tree crowns';scene.add(canopies);
}

function addOrganicPlants(scene,plants){
 const leaf=broadLeafGeometry();leaf.translate(0,1,0);leaf.scale(.42,.5,1);
 const p=leaf.attributes.position,col=[];for(let i=0;i<p.count;i++){const t=p.getY(i),edge=Math.abs(p.getX(i));const k=.8+.18*t-.10*edge;col.push(k,k*1.025,k*.91);}leaf.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#e6ecdd';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#b7c3a3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(64,0);ctx.lineTo(64,128);for(let i=12;i<126;i+=17){ctx.moveTo(64,i);ctx.lineTo(8,i-22);ctx.moveTo(64,i);ctx.lineTo(120,i-22);}ctx.stroke();const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.MeshStandardMaterial({map,color:'#9bc38e',vertexColors:true,side:THREE.DoubleSide,roughness:.78});
 const stems=[],leaves=[],up=new THREE.Vector3(0,1,0),dummy=new THREE.Object3D();
 plants.forEach((pot,pi)=>{
  const R=pot.r/.25,base=new THREE.Vector3(pot.x,pot.y,pot.z);
  for(let b=0;b<5;b++){
   const a=b*2.399+pi*1.7,h=R*(.92+(b%3)*.27),spread=R*(.22+(b%2)*.1);
   const curve=new THREE.CatmullRomCurve3([base,base.clone().add(new THREE.Vector3(Math.cos(a)*.06*R,h*.33,Math.sin(a)*.06*R)),base.clone().add(new THREE.Vector3(Math.cos(a)*spread,h,Math.sin(a)*spread))]);
   stems.push(new THREE.TubeGeometry(curve,12,.012*R,5));
   for(let j=0;j<7;j++){
    const t=.25+j*.105,anchor=curve.getPoint(t),ang=a+j*2.38,young=1-t*.47,len=R*(.31+(j%3)*.07)*young;
    const direction=new THREE.Vector3(Math.cos(ang),.28+(j%3)*.25,Math.sin(ang)).normalize(),tip=anchor.clone().addScaledVector(direction,.08*R);
    stems.push(new THREE.TubeGeometry(new THREE.LineCurve3(anchor,tip),1,.004*R,4));leaves.push({p:tip,d:direction,len,roll:(j%3-1)*.4,tint:pi*7+b*3+j});
   }
  }
 });
 const mesh=new THREE.InstancedMesh(leaf,mat,leaves.length);mesh.name='Organic layered foliage';
 leaves.forEach((l,i)=>{dummy.position.copy(l.p);dummy.quaternion.setFromUnitVectors(up,l.d);dummy.rotateY(l.roll);dummy.scale.set(l.len*(.8+(i%3)*.12),l.len,l.len);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.235+(l.tint%4)*.011,.33,.34+(l.tint%5)*.025));});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 if(stems.length){const g=mergeGeometries(stems),m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#59653b',roughness:.95}));m.castShadow=true;scene.add(m);stems.forEach(g=>g.dispose());}
 // A tiny shared vertex sway keeps foliage alive without changing its footprint.
 mat.onBeforeCompile=s=>{s.uniforms.leafTime={value:0};mat.userData.shader=s;s.vertexShader='uniform float leafTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += .018 * position.y * position.y * sin(leafTime + position.y * 3.0);');};
 mesh.onBeforeRender=()=>{if(mat.userData.shader)mat.userData.shader.uniforms.leafTime.value=matchMedia('(prefers-reduced-motion: reduce)').matches?0:performance.now()*.00065;};
}

// Small, deterministic surface maps shared across the entire room.
const maps=new Map();
function surface(kind){
 if(maps.has(kind))return maps.get(kind);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d'),data=ctx.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const grain=Math.sin(x*.19+Math.sin(y*.025)*2+Math.sin(y*.071)*.8);
  const weave=Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2);
  const noise=Math.sin(x*127.1+y*311.7)*43758.5453%1;
  const v=kind==='wood'?242+grain*3+noise:kind==='fabric'?246+weave*2+noise:247+noise*2;
  const i=(y*256+x)*4;data.data.set([v,v,v,255],i);
 }
 ctx.putImageData(data,0,0);
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 maps.set(kind,texture);return texture;
}
export function polishMaterial(mat){
 if(mat.userData.polished)return;
 mat.userData.polished=true;
 const n=mat.name;
 if(/oak|plank/i.test(n)){mat.map=surface('wood');mat.roughness=.64;}
 else if(/velvet|upholstery|linen/i.test(n)){mat.map=surface('fabric');mat.roughness=.98;}
 else if(/plaster|limestone|terracotta/i.test(n)){mat.map=surface('plaster');mat.roughness=.91;mat.bumpMap=mat.map;mat.bumpScale=.004;}
 else if(/brass/i.test(n)){mat.metalness=.68;mat.roughness=.32;}
 else if(/foliage/i.test(n)){mat.color.set('#416d38');mat.roughness=.76;}
 if(/warm light/i.test(n))mat.emissiveIntensity=1.2;
 mat.needsUpdate=true;
}
export function worldUV(g){
 const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
  uv[i*2]=(nx>ny&&nx>nz?p.getZ(i):p.getX(i))*1.7;
  uv[i*2+1]=(ny>nx&&ny>nz?p.getZ(i):p.getY(i))*1.7;
 }
 g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}
export function broadLeafGeometry(){
 const p=[],uv=[],indices=[];
 for(let i=0;i<=12;i++)for(let j=0;j<=4;j++){
  const t=i/12,u=j/4*2-1,w=Math.pow(Math.sin(t*Math.PI),.8);
  p.push(u*w*1.45,t*2-1,(1-u*u)*.06*w+Math.sin(t*Math.PI)*.05-.10*t*t);uv.push(j/4,t);
 }
 for(let i=0;i<12;i++)for(let j=0;j<4;j++){const a=i*5+j;indices.push(a,a+1,a+5,a+1,a+6,a+5);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function addVisualDetails(scene,layout){
 const group=new THREE.Group();group.name='Maple Bean visual details';scene.add(group);
 const materials={wood:new THREE.MeshStandardMaterial({color:'#a97546',roughness:.65}),brass:new THREE.MeshStandardMaterial({color:'#bd965c',metalness:.65,roughness:.35}),soil:new THREE.MeshStandardMaterial({color:'#33271f',roughness:1}),clay:new THREE.MeshStandardMaterial({color:'#bb7256',roughness:.9}),paper:new THREE.MeshStandardMaterial({color:'#eee0c7',roughness:.94}),ink:new THREE.MeshStandardMaterial({color:'#304c40',roughness:.8})};
 const box=(name,pos,size,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 function poster(x,y,z,w,h,title,subtitle){
  const c=document.createElement('canvas');c.width=512;c.height=640;const ctx=c.getContext('2d');
  ctx.fillStyle='#eee1cb';ctx.fillRect(0,0,512,640);ctx.strokeStyle='#b18c61';ctx.lineWidth=3;ctx.strokeRect(24,24,464,592);
  ctx.fillStyle='#304c40';ctx.textAlign='center';ctx.font='48px Georgia';title.split('|').forEach((s,i)=>ctx.fillText(s,256,180+i*64));
  ctx.font='18px sans-serif';ctx.fillText(subtitle,256,510);ctx.font='48px Georgia';ctx.fillStyle='#b16f4f';ctx.fillText('♡',256,566);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  box('Oak framed wall art',[x,y,z],[w+.10,h+.10,.065],materials.wood);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:1}));m.position.set(x,y,z+.038);group.add(m);
 }
 poster(2.75,2.30,-6.82,.72,1.15,'Good|Coffee|Brighter|Days','MAPLE BEAN');
 poster(8.5,2.57,-6.82,.85,1.10,'Stay a|little|longer.','COFFEE · PEOPLE · STORIES');
 // Shelves and foliage add depth to the bare wall over the lounge.
 for(const y of [1.72,2.52])box('Floating oak shelf',[7.1,y,-6.6],[1.95,.065,.34],materials.wood);
 const pots=[[-2.8,.86,5.5,.18],[4,.88,2,.22],[6.7,.45,-3.55,.18],[7.1,.77,2,.12],[6.35,1.76,-6.6,.2],[7.65,1.76,-6.6,.24],[6.5,2.56,-6.6,.20],[7.4,2.56,-6.6,.18]];
 const leaves=[],stems=[];
 for(const [x,y,z,s]of pots){
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(s*.46,s*.33,s*.75,16),materials.clay);pot.position.set(x,y+s*.375,z);pot.castShadow=true;group.add(pot);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(s*.41,s*.41,.007,16),materials.soil);soil.position.set(x,y+s*.755,z);group.add(soil);
  for(let i=0;i<9;i++){
   const a=i*2.399,top=new THREE.Vector3(x+Math.cos(a)*s*.7,y+s*(1.5+(i%3)*.3),z+Math.sin(a)*s*.7);
   const base=new THREE.Vector3(x,y+s*.72,z),mid=base.clone().lerp(top,.6);stems.push([base,top,s]);
   leaves.push({p:top,a,s,tilt:.6+(i%3)*.2});leaves.push({p:mid,a:a+1,s:s*.7,tilt:1});
  }
 }
 const leafGeo=broadLeafGeometry(),leafMat=new THREE.MeshStandardMaterial({color:'#507341',roughness:.78,side:THREE.DoubleSide});
 const leafMesh=new THREE.InstancedMesh(leafGeo,leafMat,leaves.length),dummy=new THREE.Object3D();
 leaves.forEach((l,i)=>{dummy.position.copy(l.p);dummy.rotation.set(l.tilt,l.a,.35);dummy.scale.set(l.s*.3,l.s*.65,l.s*.3);dummy.updateMatrix();leafMesh.setMatrixAt(i,dummy.matrix);leafMesh.setColorAt(i,new THREE.Color().setHSL(.23+(i%4)*.012,.32,.40+(i%5)*.023));});leafMesh.castShadow=true;leafMesh.receiveShadow=true;group.add(leafMesh);
 const stemMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),leafMat,stems.length);
 stems.forEach(([a,b,s],i)=>{dummy.position.copy(a).lerp(b,.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());dummy.scale.set(s*.025,a.distanceTo(b),s*.025);dummy.updateMatrix();stemMesh.setMatrixAt(i,dummy.matrix);});group.add(stemMesh);
 // Contact shadows remain cheap: one shared radial texture, one instanced draw.
 const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),gr=ctx.createRadialGradient(32,32,5,32,32,32);gr.addColorStop(0,'rgba(39,26,16,.25)');gr.addColorStop(.55,'rgba(39,26,16,.12)');gr.addColorStop(1,'rgba(39,26,16,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);
 const shadowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const contact=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),shadowMat,layout.obstacles.length);
 layout.obstacles.forEach((o,i)=>{dummy.position.set(o.x,.008,o.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(o.w+ .35,o.d+.35,1);dummy.updateMatrix();contact.setMatrixAt(i,dummy.matrix);});group.add(contact);
 // Laptop open on the existing study desk; the base is part of the source GLB.
 const lid=box('Open study laptop',[8.45,.905,2.06],[.28,.22,.013],materials.ink);lid.rotation.x=-.18;
 const screen=box('Laptop screen',[8.45,.905,2.069],[.25,.186,.002],new THREE.MeshStandardMaterial({color:'#728782',emissive:'#45645d',emissiveIntensity:.22,roughness:.5}));screen.rotation.x=-.18;
 for(const [x,y,z] of [[7.38,1.02,1.84],[8.78,1.02,1.84]]){const light=new THREE.PointLight(0xffbd72,1.8,1.6,2);light.position.set(x,y,z);group.add(light);}
 const fireMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 vUv;uniform float time;void main(){float y=vUv.y;float x=abs(vUv.x-.5+.10*sin(y*8.-time*2.)*y);float edge=(1.-y)*(.32+.07*sin(y*15.-time*3.));float a=(1.-smoothstep(edge-.08,edge,x))*smoothstep(0.,.09,y)*(1.-smoothstep(.88,1.,y));vec3 c=mix(vec3(1.,.69,.23),vec3(1.,.18,.025),y);gl_FragColor=vec4(c,a*.85);}`});
 for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.24,.38+(i%3)*.09),fireMat);m.rotation.y=-Math.PI/2;m.position.set(8.81-i*.002,.45,-4+(i-2)*.20);group.add(m);}
 for(let i=0;i<3;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.05,.045,.65,10),materials.soil);log.rotation.set(Math.PI/2,.1*(i-1),0);log.position.set(8.76+i*.025,.24+i*.025,-4+(i-1)*.12);group.add(log);}
 // Two shallow glazed roof lights bring daylight to the middle of the deep room.
 const roofParts=[];for(const [x,z,w,h]of [[0,-4,20,6],[0,4,20,6],[-8,0,4,2],[0,0,4,2],[8,0,4,2]])roofParts.push(new THREE.PlaneGeometry(w,h).rotateX(Math.PI/2).translate(x,3.81,z));
 const roofGeometry=mergeGeometries(roofParts);roofParts.forEach(g=>g.dispose());
 const ceiling=new THREE.Mesh(roofGeometry,new THREE.MeshStandardMaterial({color:'#e2d0af',roughness:1}));ceiling.name='Interior ceiling';ceiling.visible=false;group.add(ceiling);
 const roof=new THREE.Mesh(roofGeometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:THREE.DoubleSide}));roof.castShadow=true;roof.name='Roof shadow';group.add(roof);
 const roofFrames=new THREE.Group();group.add(roofFrames);
 for(const x of [-4,4])for(const [dx,dz,w,h]of [[0,-1,4,.05],[0,1,4,.05],[-2,0,.05,2],[2,0,.05,2],[0,0,.045,2]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.035,h),materials.ink);m.position.set(x+dx,3.80,dz);m.castShadow=true;roofFrames.add(m);}
 return {update(t,mode){ceiling.visible=roofFrames.visible=mode==='walk';fireMat.uniforms.time.value=t;}};
}
