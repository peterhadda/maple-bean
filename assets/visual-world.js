import * as THREE from 'three';
import { menu, DRINKS } from '../cafe-life.js';
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
 const pastry=new THREE.MeshStandardMaterial({name:'Bean baked pastry',color:'#b98549',roughness:.8});
 const cabinet=new THREE.MeshStandardMaterial({name:'Bean fluted pine joinery',color:'#365647',roughness:.57});
 const shelfGlow=new THREE.MeshStandardMaterial({name:'Bean warm light shelf inset',color:'#d2ae78',emissive:'#ffc582',emissiveIntensity:1.2,roughness:.6});
 const trailingLeaf=new THREE.MeshStandardMaterial({color:'#4f6e3f',roughness:.85,side:THREE.DoubleSide});
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
  if(!o.isMesh)return;
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
  if(/^Cup_ready_for_espresso/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),r=(b.max.x-b.min.x)*.5,h=b.max.y-b.min.y;
   const profile=[[0,0],[r*.8,0],[r*.84,.008],[r,h*.92],[r*.97,h],[r*.82,h],[r*.73,.015],[0,.015]].map(p=>new THREE.Vector2(...p));
   add(new THREE.LatheGeometry(profile,24).translate(c.x,b.min.y,c.z),porcelain);
   add(new THREE.CircleGeometry(r*.83,24).rotateX(-Math.PI/2).translate(c.x,b.min.y+h*.77,c.z),dark);
   tube([[c.x+r*.96,b.min.y+h*.82,c.z],[c.x+r*1.55,b.min.y+h*.78,c.z],[c.x+r*1.5,b.min.y+h*.26,c.z],[c.x+r*.86,b.min.y+h*.23,c.z]],.007,porcelain);
   o.userData.replaced=true;
  }
  if(/^Coffee_jar/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),r=Math.min(b.max.x-b.min.x,b.max.z-b.min.z)*.5,h=b.max.y-b.min.y;
   add(new THREE.CylinderGeometry(r*.95,r,h-.018,24).translate(c.x,c.y-.009,c.z),o.material);
   add(new THREE.CylinderGeometry(r*1.03,r*1.03,.022,24).translate(c.x,b.max.y-.009,c.z),brass);
   add(new THREE.PlaneGeometry(r*1.1,h*.35).translate(c.x,c.y,c.z+r+.001),porcelain);o.userData.replaced=true;
  }
  if(/Maple_Hollow_tree_canopy/.test(o.name)){const b=new THREE.Box3().setFromObject(o);crowns.push({p:b.getCenter(new V()),s:b.getSize(new V()).multiplyScalar(.5)});o.userData.replaced=true;}
  if(/^(Plant_pot|Terracotta_plant_pot)/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),r=(b.max.x-b.min.x)/2,h=b.max.y-b.min.y;
   plants.push({x:c.x,y:b.max.y-.025,z:c.z,r});o.userData.replaced=true;
   const profile=[[r*.73,0],[r*.76,.025],[r*.95,h*.88],[r,h*.94],[r,h],[r*.86,h],[r*.85,h*.9]].map(([x,y])=>new THREE.Vector2(x,y));
   add(new THREE.LatheGeometry(profile,32).translate(c.x,b.min.y,c.z),o.material);
   add(new THREE.CircleGeometry(r*.87,24).rotateX(-Math.PI/2).translate(c.x,b.max.y-.028,c.z),dark);
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
  if(/^Oak_counter_top/.test(o.name)){
   // Keep the service hand-off clear; crockery sits at the espresso end.
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),x=b.min.x+.66,y=b.max.y,z=c.z+.08;
   add(new THREE.CylinderGeometry(.29,.29,.012,32).scale(1,1,.65).translate(x,y+.008,z),brass);
   for(const dx of [-.13,.13]){
    const profile=[[.042,0],[.055,.085],[.049,.085],[.036,.009]].map(p=>new THREE.Vector2(...p));
    add(new THREE.LatheGeometry(profile,20).translate(x+dx,y+.018,z),porcelain);
    tube([[x+dx+.052,y+.085,z],[x+dx+.085,y+.09,z],[x+dx+.089,y+.046,z],[x+dx+.047,y+.035,z]],.007,porcelain);
   }
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
   const profile=[[.07,0],[.095,.13],[.095,.15],[.08,.15],[.075,.025]].map(p=>new THREE.Vector2(...p));
   add(new THREE.LatheGeometry(profile,16).translate(x,y,z),porcelain);
   for(let branch=0;branch<3;branch++){
    const points=[];
    for(let i=0;i<9;i++){
     const t=i/8,px=x+Math.sin(t*4+branch)*.09,py=y+.16-t*(.42+branch*.09),pz=z+.07+Math.sin(t*2)*.13+branch*.035;points.push([px,py,pz]);
     if(i){const leaf=broadLeafGeometry();leaf.scale(.032,.075,.05);leaf.rotateZ((i%2?1:-1)*.7);leaf.rotateY(branch*.9);leaf.translate(px+(i%2?.03:-.03),py,pz);add(leaf,trailingLeaf);}
    }
    tube(points,.0035,trailingLeaf);
   }
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
  if(/^Sofa_(cushion|rounded_arm|upholstered_base)/.test(o.name)){
   // Softer padding stays in the original bounds, including the exact seat top.
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),half=b.getSize(new V()).multiplyScalar(.5),exponent=/rounded_arm/.test(o.name)?.46:.32;
   const g=new THREE.SphereGeometry(1,24,16),p=g.attributes.position,n=g.attributes.normal;
   for(let i=0;i<p.count;i++){
    const normal=new V();for(let axis=0;axis<3;axis++){const q=Math.sign(p.getComponent(i,axis))*Math.pow(Math.abs(p.getComponent(i,axis)),exponent);p.setComponent(i,axis,q*half.getComponent(axis));normal.setComponent(axis,Math.sign(q)*Math.pow(Math.abs(q),2/exponent-1)/half.getComponent(axis));}
    normal.normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
   }
   add(g.translate(c.x,c.y,c.z),o.material);o.userData.replaced=true;
   if(/upholstered_base/.test(o.name)&&b.min.y>0){
    const h=b.min.y+.008;for(const x of [b.min.x+.21,b.max.x-.21])for(const z of [b.min.z+.16,b.max.z-.16])add(new THREE.CylinderGeometry(.038,.052,h,16).translate(x,h/2,z),oak);
   }
  }
  if(/^Fireplace_glowing_hearth/.test(o.name)){
   // Keep the actual fire light, but avoid a white emissive rectangle below it.
   o.material=o.material.clone();o.material.name='Hearth ember bed';o.material.color.set('#733712');o.material.emissive.set('#d65e17');o.material.emissiveIntensity=.65;
  }
  if(/Sofa_generous_back/.test(o.name)){
   const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new V()),width=b.max.x-b.min.x;
   for(let i=0;i<3;i++){
    const m=new THREE.Matrix4().makeTranslation(c.x+(i-1)*(width-.3)/3,c.y+.015,c.z+.12);
    const cushion=new THREE.SphereGeometry(1,24,16),p=cushion.attributes.position;
    for(let n=0;n<p.count;n++)for(const [k,s]of [[0,(width-.4)/6],[1,.36],[2,.11]])p.setComponent(n,k,Math.sign(p.getComponent(n,k))*Math.pow(Math.abs(p.getComponent(n,k)),.4)*s);
    for(let n=0;n<p.count;n++)if(p.getZ(n)>0){const x=p.getX(n),y=p.getY(n);p.setZ(n,p.getZ(n)-.018*Math.exp(-((x/.10)**2))*(Math.exp(-(((y-.11)/.075)**2))+Math.exp(-(((y+.11)/.075)**2))));}
    cushion.computeVertexNormals();add(cushion,o.material,m);pill((width-.47)/6,.315,.067,seam,m);
    for(const y of [-.11,.11])add(new THREE.SphereGeometry(.012,10,8).scale(1,1,.3).translate(0,y,.094),o.material,m);
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
 for(let i=0;i<=32;i++)for(let j=0;j<=48;j++){const t=i/32,u=j/48; p.push(4.97+u*.52,.89-.54*Math.pow(Math.max(0,(t-.33)/.67),1.2)+.017*Math.sin(u*31+t*3),-5.77+t*.95);uv.push(u,t);}
 for(let i=0;i<32;i++)for(let j=0;j<48;j++){const a=i*49+j;ix.push(a,a+49,a+1,a+1,a+49,a+50);}blanket.setAttribute('position',new THREE.Float32BufferAttribute(p,3));blanket.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));blanket.setIndex(ix);blanket.computeVertexNormals();add(blanket,new THREE.MeshStandardMaterial({color:'#cfb28e',map:surface('fabric'),roughness:1,side:THREE.DoubleSide}));
 // Two-tier display: keep pastries inside the existing service footprint.
 for(const x of [-2.57,-1.23])add(new THREE.BoxGeometry(.12,.024,.63).translate(x,1.395,-4.71),brass);
 add(new THREE.BoxGeometry(1.30,.016,.64).translate(-1.9,1.405,-4.8),brass);
 add(new THREE.BoxGeometry(1.23,.006,.57).translate(-1.9,1.416,-4.8),porcelain);
 for(const x of [-2.34,-1.9,-1.46]){
  const curve=new THREE.CatmullRomCurve3([new V(-.125,0,.03),new V(-.07,.025,-.025),new V(0,.035,-.045),new V(.07,.025,-.025),new V(.125,0,.03)]);
  const g=new THREE.TubeGeometry(curve,16,.046,8,false),p=g.attributes.position;
  for(let i=0;i<=16;i++){const t=i/16,c=curve.getPointAt(t),k=.18+.82*Math.pow(Math.sin(Math.PI*t),.6);for(let j=0;j<=8;j++){const at=i*9+j;for(let axis=0;axis<3;axis++)p.setComponent(at,axis,c.getComponent(axis)+(p.getComponent(at,axis)-c.getComponent(axis))*k);}}
  g.computeVertexNormals();add(g.translate(x,1.452,-4.72),pastry);
  for(const dx of [-.055,0,.055])tube([[x+dx-.015,1.47,-4.75],[x+dx,1.529-Math.abs(dx)*.3,-4.765],[x+dx+.018,1.49,-4.71]],.0035,oak);
 }
 // Espresso group: controls, portafilters, cup rail and a ribbed drip tray.
 add(new THREE.BoxGeometry(.77,.31,.017).translate(-6.9,1.38,-4.645),steel);
 for(const x of [-7.13,-6.7]){
  add(new THREE.CylinderGeometry(.051,.051,.013,20).rotateX(Math.PI/2).translate(x,1.43,-4.631),dark);
  add(new THREE.CircleGeometry(.04,20).translate(x,1.43,-4.622),porcelain);
  tube([[x-.018,1.414,-4.618],[x+.01,1.45,-4.618]],.002,dark);
  tube([[x,1.32,-4.69],[x,1.27,-4.63],[x,1.25,-4.57]],.019,steel);
  tube([[x,1.27,-4.65],[x+.11,1.27,-4.53]],.016,dark);

 }
 for(const x of [-7.16,-6.94,-6.72]){
  const profile=[[.038,0],[.047,.060],[.041,.060],[.033,.007]].map(p=>new THREE.Vector2(...p));
  add(new THREE.LatheGeometry(profile,20).translate(x,1.628,-4.94),porcelain);
  tube([[x+.045,1.678,-4.94],[x+.070,1.677,-4.94],[x+.070,1.643,-4.94],[x+.037,1.641,-4.94]],.005,porcelain);
 }
 for(let i=0;i<11;i++)add(new THREE.BoxGeometry(.005,.009,.21).translate(-7.24+i*.068,1.079,-4.59),steel);
 tube([[-7.3,1.64,-4.73],[-7.3,1.69,-4.73],[-6.5,1.69,-4.73],[-6.5,1.64,-4.73]],.008,brass);
 const glass=new THREE.MeshPhysicalMaterial({color:'#e6f3ed',transparent:true,opacity:.16,roughness:.12,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
 add(new THREE.PlaneGeometry(1.40,.46).translate(-1.9,1.42,-4.395),glass);
 for(const x of [-2.6,-1.2])tube([[x,1.18,-4.40],[x,1.66,-4.40],[x,1.66,-5.18]],.012,brass);
 for(const [mat,geos]of parts){const mesh=new THREE.Mesh(mergeGeometries(geos),mat);mesh.name='Refined café details';mesh.castShadow=mat!==glass;mesh.receiveShadow=true;scene.add(mesh);geos.forEach(g=>g.dispose());}
 addOrganicPlants(scene,plants);
 // Individual folded leaves replace the old grape-like spheres in one shared draw.
 const canopyGeo=new THREE.BufferGeometry();
 canopyGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.035, -.32,.12,0, -.46,.42,0, -.25,.44,0, -.30,.70,0, 0,1,.02, .30,.70,0, .25,.44,0, .46,.42,0, .32,.12,0],3));
 canopyGeo.setIndex([0,1,2,0,2,3,0,3,4,0,4,5,0,5,6,0,6,7,0,7,8,0,8,9]);canopyGeo.computeVertexNormals();
 const canopyMat=new THREE.MeshStandardMaterial({color:'#a6b780',roughness:.93,side:THREE.DoubleSide});
 const leavesPerCrown=430,canopies=new THREE.InstancedMesh(canopyGeo,canopyMat,crowns.length*leavesPerCrown),d=new THREE.Object3D();let k=0;
 crowns.forEach(({p,s},c)=>{for(let i=0;i<leavesPerCrown;i++){
  const y=1-2*(i+.5)/leavesPerCrown,a=i*2.399963+c*.7,r=Math.sqrt(1-y*y),radius=.52+.48*((i*73%101)/100);
  d.position.copy(p).add(new V(Math.cos(a)*r*s.x*radius,y*s.y*radius,Math.sin(a)*r*s.z*radius));
  d.rotation.set(i*1.73,c*.4+i*2.17,i*.91);const size=.23+(i%7)*.025;
  d.scale.set(s.x*size,s.y*size*1.5,s.z*size);d.updateMatrix();canopies.setMatrixAt(k,d.matrix);
  canopies.setColorAt(k,new THREE.Color().setHSL(.23+(i%5)*.012,.28,.29+(i%7)*.025));k++;
 }});canopies.castShadow=true;canopies.receiveShadow=true;canopies.name='Layered Maple Hollow tree crowns';scene.add(canopies);
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
 const pots=[[13.6,.775,-1.95,.16],[-2.8,.86,5.5,.18],[4,.88,2,.22],[6.7,.45,-3.55,.18],[7.1,.77,2,.12],[6.35,1.76,-6.6,.2],[7.65,1.76,-6.6,.24],[6.5,2.56,-6.6,.20],[7.4,2.56,-6.6,.18]];
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
 return {setGameActive(id,active){const idle=idleGames.get(id);if(idle)idle.visible=!active;},update(t,mode){ceiling.visible=roofFrames.visible=mode==='walk';fireMat.uniforms.time.value=t;}};
}
