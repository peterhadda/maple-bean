import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const pass=process.argv[2]||'baseline',dir=`qa/characters/${pass}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4321/');await page.waitForFunction(()=>window.__ready,null,{timeout:240000});
 await page.evaluate(()=>{cafe.renderer.setAnimationLoop(null);cafe.cameraMode('walk');document.getElementById('labels').hidden=true;document.getElementById('welcome').hidden=true;window.qaCast={maya:cafe.maya,...Object.fromEntries(cafe.regulars.map(n=>[n.id,n.actor]))};for(const a of Object.values(qaCast)){a.group.visible=false;} });
 for(const id of (pass==='source'?[]:process.argv[3]?[process.argv[3]]:['maya','noah','claire','mara','jules'])){
  for(const [name,angle,distance,height]of [['close-front',0,1.1,1.48],['close-three-quarter',35,1.1,1.48],['close-side',90,1.1,1.48],['front',0,2.85,.86],['side',90,2.85,.86],['back',180,2.85,.86]]){
   await page.evaluate(({id,angle,distance,height})=>{for(const a of Object.values(qaCast))a.group.visible=false;const a=qaCast[id];a.group.visible=true;a.group.position.set(-2,0,1);a.group.rotation.set(0,0,0);a.update(0,0,{still:true,expression:'neutral'});const r=angle*Math.PI/180;cafe.camera.position.set(-2+Math.sin(r)*distance,height,1+Math.cos(r)*distance);cafe.camera.lookAt(-2,height,1);cafe.renderer.render(cafe.scene,cafe.camera);},{id,angle,distance,height});
   await page.screenshot({path:`${dir}/${id}-${name}.png`,timeout:120000});
  }
  console.log(`${pass}: ${id} six views captured`);
 }
 await page.evaluate(()=>{Object.values(qaCast).forEach((a,i)=>{a.group.visible=true;a.group.position.set(-4+i*.8,0,1);a.group.rotation.set(0,0,0);a.update(0,0,{still:true});});cafe.camera.position.set(-2.4,1.25,4.8);cafe.camera.lookAt(-2.4,.95,1);cafe.renderer.render(cafe.scene,cafe.camera);});
 await page.screenshot({path:`${dir}/lineup.png`,timeout:120000});
 if(pass==='baseline'||pass==='source'){
  await mkdir('assets/characters/source',{recursive:true});
  for(const id of ['maya','noah','claire','mara','jules']){
  const encoded=await page.evaluate(async id=>{
   const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
   const THREE=await import('three');const a=qaCast[id];
    a.group.position.set(0,0,0);a.group.updateMatrixWorld(true);const clone=a.group.clone(true);
    clone.traverse(o=>{if(!o.isMesh)return;o.geometry=o.geometry.clone();const m=o.material;
     const next=new THREE.MeshStandardMaterial({color:m.color,roughness:m.roughness??.6,metalness:m.metalness??0,map:m.map,normalMap:m.normalMap,side:m.side,vertexColors:m.vertexColors});
     const paint=m.userData?.shader?.uniforms?.uPaint?.value;
     if(paint){next.map=paint;const p=o.geometry.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push((p.getX(i)+.16)/.32,(p.getY(i)+.17)/.32);o.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}
     o.material=next;
    });
    const data=await new GLTFExporter().parseAsync(clone,{binary:true,onlyVisible:true});
    return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([data]));});
  },id);
  await writeFile(`assets/characters/source/${id}-before.glb`,Buffer.from(encoded,'base64'));console.log('Exported',id);
  }
 }
 await writeFile(`${dir}/errors.json`,JSON.stringify(errors,null,2));if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
