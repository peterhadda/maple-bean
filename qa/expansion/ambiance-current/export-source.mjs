// Export the verified runtime environment only, without booting the game or GPU.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='qa/expansion/ambiance-current/source';fs.mkdirSync(out,{recursive:true});
const origin=process.env.CAFE_URL||'http://127.0.0.1:4321';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();
 await page.route('**/__source_export__',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>'}));
 await page.goto(origin+'/__source_export__');
 await page.exposeFunction('saveSource',({base64,manifest})=>{fs.writeFileSync(out+'/verified-environment.glb',Buffer.from(base64,'base64'));fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest,null,2));});
 const report=await page.evaluate(async()=>{
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const {mergeGeometries}=await import('three/addons/utils/BufferGeometryUtils.js');
  const {refineCafe,polishMaterial,worldUV,addVisualDetails}=await import('/assets/visual-world.js');
  const root=(await new GLTFLoader().loadAsync('/assets/cafe.glb')).scene,scene=new THREE.Scene();root.updateMatrixWorld(true);
  refineCafe(root,scene);
  const hiddenSource=[],copiedSource=[];
  root.traverse(o=>{
   if(!o.isMesh)return;
   if(o.userData.replaced||/Broad_living_leaf|Plant_frond/.test(o.name)){hiddenSource.push(o.name);return;}
   if(/Garden_backdrop/.test(o.name))o.material=new THREE.MeshStandardMaterial({color:'#899578',roughness:1});
   const g=o.geometry.clone().applyMatrix4(o.matrixWorld);worldUV(g);polishMaterial(o.material);
   const mesh=new THREE.Mesh(g,o.material);mesh.name='Runtime source '+o.name;mesh.userData.sourceName=o.name;scene.add(mesh);copiedSource.push(o.name);
  });
  const layout=await(await fetch('/assets/layout.json')).json();addVisualDetails(scene,layout);
  const instances=[];scene.traverse(o=>{if(o.isInstancedMesh)instances.push(o);});
  for(const mesh of instances){
   if(!mesh.count){mesh.removeFromParent();continue;}
   const geos=[],matrix=new THREE.Matrix4(),tint=new THREE.Color();
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);const g=mesh.geometry.clone().applyMatrix4(matrix),p=g.attributes.position,colors=g.attributes.color;
    if(mesh.instanceColor){mesh.getColorAt(i,tint);const a=new Float32Array(p.count*3);for(let j=0;j<p.count;j++)a.set([tint.r*(colors?.getX(j)??1),tint.g*(colors?.getY(j)??1),tint.b*(colors?.getZ(j)??1)],j*3);g.setAttribute('color',new THREE.BufferAttribute(a,3));}
    geos.push(g);
   }
   const material=mesh.material.clone();if(mesh.instanceColor)material.vertexColors=true;
   const baked=new THREE.Mesh(mergeGeometries(geos),material);baked.name=mesh.name||'Runtime instanced detail';baked.matrix.copy(mesh.matrix);baked.matrixAutoUpdate=false;mesh.parent.add(baked);mesh.removeFromParent();geos.forEach(g=>g.dispose());
  }
  const fireCanvas=document.createElement('canvas');fireCanvas.width=fireCanvas.height=128;
  const fireContext=fireCanvas.getContext('2d'),pixels=fireContext.createImageData(128,128),smooth=(a,b,x)=>{const k=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return k*k*(3-2*k);};
  for(let j=0;j<128;j++)for(let i=0;i<128;i++){
   const y=1-j/127,x=Math.abs(i/127-.5+.1*Math.sin(y*8)*y),edge=(1-y)*(.32+.07*Math.sin(y*15)),a=(1-smooth(edge-.08,edge,x))*smooth(0,.09,y)*(1-smooth(.88,1,y));
   pixels.data.set([255,255*(.69-.51*y),255*(.23-.205*y),255*a*.85],(j*128+i)*4);
  }
  fireContext.putImageData(pixels,0,0);const fireMap=new THREE.CanvasTexture(fireCanvas);fireMap.colorSpace=THREE.SRGBColorSpace;
  const staticFire=new THREE.MeshBasicMaterial({name:'Baked fireplace flame',map:fireMap,transparent:true,side:THREE.DoubleSide});
  scene.traverse(o=>{
   if(o.name==='Roof shadow')o.visible=false;
   if(o.name==='Interior ceiling'){o.visible=true;o.userData.cutawayCeiling=true;}
   if(o.isLight)o.visible=false;
   if(o.material?.isShaderMaterial)o.material=staticFire;
   if(/warm light/i.test(o.material?.name||''))o.material.emissiveIntensity=2.2;
   if(o.material?.bumpMap)o.material.userData.sourceBumpScale=o.material.bumpScale;
  });
  const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true,maxTextureSize:2048});
  const bytes=new Uint8Array(binary);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const manifest={source:'assets/cafe.glb',hiddenSource,copiedSource,hideMatchingOriginal:[...hiddenSource,...copiedSource],axis:'GLB Y-up; Blender importer converts automatically',instancePolicy:'Offline merged copies only; runtime instances unchanged',layoutArea:layout.area};
  await window.saveSource({base64:btoa(text),manifest});return {bytes:bytes.length,copiedSource:copiedSource.length,replacedSource:hiddenSource.length,offlineInstanceBatches:instances.length};
 });
 console.log(JSON.stringify(report));
}finally{await browser.close();}
