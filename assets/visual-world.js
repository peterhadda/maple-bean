import * as THREE from 'three';
import { menu, DRINKS } from '../cafe-life.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { claimSourceMesh, placeEnvArt } from './env-art.js';

// Dress the existing furniture and pots in place; their collision footprints stay intact.
export function refineCafe(root,scene){
 const parts=new Map(),V=THREE.Vector3;
 const oak=new THREE.MeshStandardMaterial({color:'#997047',roughness:.72});
 const seam=new THREE.MeshStandardMaterial({color:'#869273',roughness:1});
 const brass=new THREE.MeshStandardMaterial({color:'#bc955b',metalness:.7,roughness:.3});
 const porcelain=new THREE.MeshStandardMaterial({color:'#f0e5cc',roughness:.3});
 const cabinet=new THREE.MeshStandardMaterial({name:'Bean fluted pine joinery',color:'#365647',roughness:.57});
 const shelfGlow=new THREE.MeshStandardMaterial({name:'Bean warm light shelf inset',color:'#d2ae78',emissive:'#ffc582',emissiveIntensity:1.2,roughness:.6});
 const readingGlow=new THREE.MeshStandardMaterial({name:'Warm reading lamp diffuser',color:'#ffdda3',emissive:'#ffc078',emissiveIntensity:1.4,roughness:.7});
 const screenCanvas=document.createElement('canvas');screenCanvas.width=384;screenCanvas.height=240;
 const screenContext=screenCanvas.getContext('2d');screenContext.fillStyle='#e8e4d5';screenContext.fillRect(0,0,384,240);screenContext.fillStyle='#3b6556';screenContext.fillRect(0,0,384,34);screenContext.fillStyle='#f2ecdc';screenContext.font='14px sans-serif';screenContext.fillText('MAPLE NOTES',16,23);screenContext.fillStyle='#354c41';screenContext.font='bold 22px Georgia';screenContext.fillText('One page at a time',28,80);
 for(let i=0;i<5;i++){screenContext.fillStyle=i===4?'#a3b9a3':'#bec7b7';screenContext.fillRect(28,104+i*20,i%2?260:300,5);}
 const screenMap=new THREE.CanvasTexture(screenCanvas);screenMap.colorSpace=THREE.SRGBColorSpace;
 const noteScreen=new THREE.MeshStandardMaterial({map:screenMap,emissiveMap:screenMap,emissive:'#ffffff',emissiveIntensity:.3,roughness:.6});

 const add=(g,mat,matrix)=>{if(matrix)g.applyMatrix4(matrix);if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}for(const n of Object.keys(g.attributes))if(!['position','normal','uv'].includes(n))g.deleteAttribute(n);if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!parts.has(mat))parts.set(mat,[]);parts.get(mat).push(g);};
 const tube=(pts,r,mat,matrix,closed=false)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new V(...p)),closed),Math.max(12,pts.length*4),r,5,closed),mat,matrix);
 const pill=(w,h,z,mat,matrix)=>{const pts=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*2;pts.push([Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.35)*w,Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.35)*h,z]);}tube(pts,.003,mat,matrix,true);};
 root.traverse(o=>{
  if(!o.isMesh||claimSourceMesh(o))return;
  if(/^Oak_cafe_tabletop/.test(o.name)){
   // Reference brass reading lamps; keep the table centre clear for cups and interaction.
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),x=c.x+.22,z=c.z-.23,y=b.max.y;
   add(new THREE.CylinderGeometry(.078,.086,.018,24).translate(x,y+.009,z),brass);
   add(new THREE.CylinderGeometry(.012,.014,.225,16).translate(x,y+.1295,z),brass);
   const profile=[[0,.302],[.035,.301],[.070,.292],[.102,.276],[.12,.252],[.122,.232],[.115,.232],[.110,.249],[.095,.269],[.063,.285],[.031,.293],[0,.294]].map(p=>new THREE.Vector2(...p));
   add(new THREE.LatheGeometry(profile,32).translate(x,y,z),brass);
   add(new THREE.CircleGeometry(.112,24).rotateX(Math.PI/2).translate(x,y+.234,z),readingGlow);
   const light=new THREE.PointLight(0xffc078,1.1,.85,2);light.name='Warm brass table reading light';light.position.set(x,y+.216,z);scene.add(light);
  }
  if(/^Menu_(heading|coffee|tea|bun|welcome)$/.test(o.name)){o.userData.replaced=true;return;}
  if(o.name==='Backboard'){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),w=b.max.x-b.min.x,h=b.max.y-b.min.y;
   const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=528;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#faf7ee';ctx.fillRect(0,0,1536,528);ctx.fillStyle='#304c40';ctx.fillRect(0,0,1536,133);
   ctx.strokeStyle='#b7814e';ctx.lineWidth=5;ctx.strokeRect(12,12,1512,504);ctx.textAlign='center';ctx.fillStyle='#faf7ee';ctx.font='72px Georgia';ctx.fillText('maple bean',768,83);ctx.font='18px sans-serif';ctx.fillText('A LITTLE CUP OF GOOD COMPANY',768,116);
   ctx.strokeStyle='#e6d7bf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(768,165);ctx.lineTo(768,438);ctx.stroke();
   // ponytail: six-drink board; reflow the grid if the shared menu grows.
   Object.entries(menu).forEach(([name,price],i)=>{
    const x=i<3?68:820,y=198+(i%3)*99;ctx.textAlign='left';ctx.fillStyle='#304c40';ctx.font='42px Georgia';ctx.fillText(name,x,y);ctx.fillStyle='#777866';ctx.font='19px sans-serif';ctx.fillText(DRINKS[name].note,x,y+30);
    ctx.textAlign='right';ctx.fillStyle='#304c40';ctx.font='bold 36px Georgia';ctx.fillText(String(price),x+632,y);
   });
   ctx.textAlign='center';ctx.fillStyle='#9b6d44';ctx.font='20px sans-serif';ctx.fillText('PRICES IN MAPLE COINS  /  MADE WITH CARE',768,486);
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
   add(new THREE.BoxGeometry(w+.08,h+.08,.06).translate(c.x,c.y,c.z),oak);
   add(new THREE.PlaneGeometry(w,h).translate(c.x,c.y,b.max.z+.004),new THREE.MeshBasicMaterial({name:'Maple Bean shared menu',map,toneMapped:false}));o.userData.replaced=true;return;
  }
  if(/^Coffee_jar/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),r=Math.min(b.max.x-b.min.x,b.max.z-b.min.z)*.5,h=b.max.y-b.min.y;
   add(new THREE.CylinderGeometry(r*.95,r,h-.018,24).translate(c.x,c.y-.009,c.z),o.material);
   add(new THREE.CylinderGeometry(r*1.03,r*1.03,.022,24).translate(c.x,b.max.y-.009,c.z),brass);
   add(new THREE.PlaneGeometry(r*1.1,h*.35).translate(c.x,c.y,c.z+r+.001),porcelain);o.userData.replaced=true;
  }
  if(/^Study_laptop_screen/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V());
   add(new THREE.PlaneGeometry(b.max.x-b.min.x,.17).rotateX(-.25).translate(c.x,c.y,c.z+.003),noteScreen);o.userData.replaced=true;
  }
  if(/^Bookcase_oak_frame/.test(o.name)){
   // The source frame is a solid cuboid that hides its own books. Open its front.
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),size=b.getSize(new V()),alongZ=size.x<size.z,dir=alongZ?(c.x>5?-1:1):1;
   const width=alongZ?size.z:size.x,depth=alongZ?size.x:size.z;
   const plank=(u,y,d,w,h,t)=>add(new THREE.BoxGeometry(alongZ?t:w,h,alongZ?w:t).translate(c.x+(alongZ?d*dir:u),b.min.y+y,c.z+(alongZ?u:d*dir)),o.material);
   plank(0,size.y/2,-depth/2+.025,width,size.y,.05);
   for(const side of [-1,1])plank(side*(width/2-.035),size.y/2,0,.07,size.y,depth);
   for(const y of [0.035,...(width>3?[.25,.85,1.45,2.05]:[.3,.75,1.2,1.65]),size.y-.035])plank(0,y-.015,0,width,.045,depth);
   o.userData.replaced=true;
  }
  if(/^Service_counter/.test(o.name)){
   // Shallow flutes stay inside the existing countertop overhang/collision box.
   const b=new THREE.Box3().setFromObject(o),bottom=Math.max(.11,b.min.y+.1),top=b.max.y-.055;
   for(let x=b.min.x+.08;x<b.max.x-.06;x+=.12)add(new THREE.BoxGeometry(.025,top-bottom,.018).translate(x,(top+bottom)/2,b.max.z+.008),cabinet);
   add(new THREE.BoxGeometry(b.max.x-b.min.x-.10,.045,.021).translate((b.min.x+b.max.x)/2,bottom,b.max.z+.008),cabinet);
  }
  if(/^Wall_shelf/.test(o.name)){
   // Dress the outer shelf edge, leaving the original cups and jars in place.
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),x=b.max.x-.14,y=b.max.y,z=c.z;
   add(new THREE.BoxGeometry(Math.max(.1,b.max.x-b.min.x-.1),.009,.012).translate(c.x,b.min.y-.004,b.max.z-.025),shelfGlow);
  }
  if(/Chair_curved_back/.test(o.name)){
   o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+.14*x*x+.022*Math.cos(y*4));}o.geometry.computeVertexNormals();
   pill(.257,.247,.075,seam,o.matrixWorld);
   for(const x of [-.12,.12])add(new THREE.SphereGeometry(.013,8,6).scale(1,1,.4).translate(x,.05,.089),seam,o.matrixWorld);
  }
  if(/^Fireplace_glowing_hearth/.test(o.name)){
   // Keep the actual fire light, but avoid a white emissive rectangle below it.
   o.material=o.material.clone();o.material.name='Hearth ember bed';o.material.color.set('#733712');o.material.emissive.set('#d65e17');o.material.emissiveIntensity=.65;
  }
  if(/Pendant_shade/.test(o.name)){
   const profile=[[.045,.14],[.09,.132],[.17,.102],[.24,.052],[.29,-.026],[.335,-.126],[.335,-.14],[.32,-.14],[.28,-.033],[.23,.04],[.16,.09],[.08,.119],[.045,.126]].map(p=>new THREE.Vector2(...p));
   // Source shade is a Blender cylinder rotated into Y-up; replace in world space.
   const c=new THREE.Box3().setFromObject(o).getCenter(new V());o.visible=false;o.userData.replaced=true;
   add(new THREE.LatheGeometry(profile,32).translate(c.x,c.y,c.z),brass);
  }
 });
 // Folded throw draped over the existing lounge arm.
 const blanket=new THREE.BufferGeometry(),p=[],uv=[],ix=[];
 for(let i=0;i<=32;i++)for(let j=0;j<=48;j++){const t=i/32,u=j/48; p.push(4.97+u*.52,.89-.54*Math.pow(Math.max(0,(t-.33)/.67),1.2)+.017*Math.sin(u*31+t*3),-5.77+t*.95);uv.push(u,t);}
 for(let i=0;i<32;i++)for(let j=0;j<48;j++){const a=i*49+j;ix.push(a,a+49,a+1,a+1,a+49,a+50);}blanket.setAttribute('position',new THREE.Float32BufferAttribute(p,3));blanket.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));blanket.setIndex(ix);blanket.computeVertexNormals();add(blanket,new THREE.MeshStandardMaterial({color:'#cfb28e',map:surface('fabric'),roughness:1,side:THREE.DoubleSide}));
 for(const [mat,geos]of parts){const mesh=new THREE.Mesh(mergeGeometries(geos),mat);mesh.name='Refined café details';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);geos.forEach(g=>g.dispose());}
 return placeEnvArt(scene);
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
  const v=kind==='wood'?237+grain*6+Math.sin(x*.63+Math.sin(y*.022)*3)*2+noise*2:kind==='fabric'?246+weave*2+noise:247+noise*2;
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
 if(/oak|plank/i.test(n)){mat.map=surface('wood');mat.roughness=/plank/i.test(n)?.76:.48;mat.bumpMap=mat.map;mat.bumpScale=.003;}
 else if(/velvet|upholstery|linen/i.test(n)){mat.map=surface('fabric');mat.roughness=/linen/i.test(n)?.94:.87;mat.bumpMap=mat.map;mat.bumpScale=.0015;}
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
 // The existing east study room and north games room retain all seat/route positions.
 poster(13.55,1.94,-6.22,.91,1.06,'One thing|at a time.','QUIET STUDY');
 poster(3.15,1.98,-14.20,1.02,1.18,'Play|together.','CHESS � CARDS � XO');
 box('Dartboard oak backplate',[6.1,1.73,-14.30],[.88,1.08,.055],materials.wood);
 const acoustic=new THREE.MeshStandardMaterial({color:'#8c997d',map:surface('fabric'),roughness:1});
 for(const z of [-4.8,-3.5]){
  box('Study acoustic oak frame',[10.15,1.96,z],[.075,1.28,.92],materials.wood);
  box('Study fabric acoustic panel',[10.195,1.96,z],[.035,1.18,.82],acoustic);
 }
 // Idle boards make each table legible before joining; the real game hides these.
 const idleGames=new Map();
 for(const station of layout.stations.filter(s=>s.kind==='game'&&['chess','xo','cards','memory'].includes(s.game))){
  const idle=new THREE.Group();idle.name='Idle activity '+station.id;idle.position.set(station.x,(station.tableHeight||.79)+.026,station.z);group.add(idle);idleGames.set(station.id,idle);
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  ctx.fillStyle=station.game==='chess'?'#dcc49c':'#355c48';ctx.fillRect(0,0,256,256);
  if(station.game==='chess'){
   ctx.fillStyle='#47624c';for(let row=0;row<8;row++)for(let col=0;col<8;col++)if((row+col)%2)ctx.fillRect(col*32,row*32,32,32);
   const profile=[[.021,0],[.026,.01],[.017,.018],[.01,.038],[.018,.05],[.014,.065],[0,.073]].map(p=>new THREE.Vector2(...p));
   const geo=new THREE.LatheGeometry(profile,10);
   for(const [side,mat]of [[-1,materials.ink],[1,materials.paper]]){
    const pieces=new THREE.InstancedMesh(geo,mat,16),d=new THREE.Object3D();
    for(let i=0;i<16;i++){d.position.set((i%8-3.5)*.065,.005,side*(i<8?.2275:.1625));d.scale.set(1,i<8?1.15+(i%4)*.18:1,1);d.updateMatrix();pieces.setMatrixAt(i,d.matrix);}pieces.castShadow=true;idle.add(pieces);
   }
  }else if(station.game==='xo'){
   ctx.strokeStyle='#d8c4a0';ctx.lineWidth=5;ctx.beginPath();for(const p of [85,171]){ctx.moveTo(p,12);ctx.lineTo(p,244);ctx.moveTo(12,p);ctx.lineTo(244,p);}ctx.stroke();
   ctx.font='56px Georgia';ctx.fillStyle='#ede0c7';ctx.textAlign='center';ctx.fillText('X',43,65);ctx.fillText('O',128,150);
  }else{
   for(let i=0;i<(station.game==='memory'?8:5);i++){
    const x=station.game==='memory'?27+(i%4)*55:32+i*32,y=station.game==='memory'?42+Math.floor(i/4)*91:70+(i%2)*22;
    ctx.fillStyle='#e7d6b9';ctx.fillRect(x,y,40,64);ctx.fillStyle='#a9674b';ctx.fillRect(x+4,y+4,32,56);ctx.strokeStyle='#eadbc2';ctx.strokeRect(x+8,y+8,24,48);
   }
  }
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(station.game==='chess'?.52:.6,station.game==='chess'?.52:.6).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map,roughness:.95}));board.receiveShadow=true;idle.add(board);
 }
 // Shelves and foliage add depth to the bare wall over the lounge.
 for(const y of [1.72,2.52])box('Floating oak shelf',[7.1,y,-6.6],[1.95,.065,.34],materials.wood);
 const dummy=new THREE.Object3D();
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
 return {setGameActive(id,active){const idle=idleGames.get(id);if(idle)idle.visible=!active;},update(t,mode){ceiling.visible=roofFrames.visible=mode==='walk';fireMat.uniforms.time.value=t;}};
}
