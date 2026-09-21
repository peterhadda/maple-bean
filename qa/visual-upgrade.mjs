import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'qa/visual-upgrade';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:960}});
const errors=[]; page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
await page.goto('http://127.0.0.1:4321/cafe?guest=1');
try{await page.waitForFunction(()=>window.__ready,null,{timeout:180000});}catch(e){console.log(await page.locator('#load-message').textContent());await browser.close();throw e;}
await page.waitForTimeout(1500);
const prefix=process.argv[2]||'current';
await page.screenshot({path:`${out}/${prefix}-overview.png`,timeout:120000});
console.log(await page.evaluate(()=>({draws:cafe.renderer.info.render.calls,triangles:cafe.renderer.info.render.triangles,materials:[...new Set(cafe.scene.children.filter(o=>o.isMesh).map(o=>o.material?.name))]})));
if(prefix!=='before'){
 const interaction=await page.evaluate(async()=>{
  const s=cafe.layout.stations.find(s=>s.id==='noah');const original=cafe.player.clone();
  cafe.player.set(s.approach[0],0,s.approach[1]);await cafe.interact(s);
  const result={noahDialog:document.getElementById('dialog').open&&document.getElementById('dialog-content').textContent.includes('NOAH'),cast:cafe.regulars.map(n=>n.id),skinning:cafe.maya.skinning};
  document.getElementById('dialog').close();cafe.player.copy(original);return result;
 });
 console.log('Interaction check:',interaction);
 if(!interaction.noahDialog||interaction.skinning!=='gpu')throw new Error('Character integration check failed');
 const foliage=await page.evaluate(()=>cafe.scene.getObjectByName('Organic layered foliage').count);
 if(foliage!==385)throw new Error(`Expected foliage in all 11 existing pots; got ${foliage} leaves`);
 for(const [name,pos,target] of (process.env.ONLY_MOBILE?[]:[
  ['interior',[0,2.7,6.4],[0,1,-3]],
  ['lounge',[4,2.2,1],[7,1,-3.5]],
  ['bar',[-1,2,0],[-4.5,1.2,-5]],
  ['study',[5.5,1.8,5.8],[7.8,.9,2]],
  ['plants',[7.5,1.5,-2.6],[8.9,1,-6.15]],
  ['floor-plan',[19,24,23],[0,0,0]],
 ])){
  await page.evaluate(({pos,target,name})=>{cafe.cameraMode(name==='floor-plan'?'plan':'walk');cafe.renderer.setAnimationLoop(null);cafe.camera.position.set(...pos);cafe.camera.lookAt(...target);document.getElementById('welcome').hidden=true;document.querySelector('.locations').hidden=true;document.getElementById('labels').hidden=true;cafe.renderer.render(cafe.scene,cafe.camera);},{pos,target,name});
  await page.screenshot({path:`${out}/${prefix}-${name}.png`,timeout:120000});
 }
 for(const id of (process.env.ONLY_MOBILE?[]:['maya','claire','mara','jules','noah'])){
  await page.evaluate(id=>{
   cafe.cameraMode('walk');
   const a=id==='maya'?cafe.maya:cafe.regulars.find(n=>n.id===id).actor;
   a.group.visible=true;a.update(0,0,{still:true,expression:'neutral'});
   const p=a.group.position,angle=a.group.rotation.y;
   cafe.camera.position.set(p.x+Math.sin(angle)*1.65+.25,1.48,p.z+Math.cos(angle)*1.65);
   cafe.camera.lookAt(p.x,1.42,p.z);cafe.renderer.render(cafe.scene,cafe.camera);
  },id);
  await page.screenshot({path:`${out}/${prefix}-${id}.png`,timeout:120000});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{cafe.renderer.setAnimationLoop(null);cafe.cameraMode('plan');cafe.camera.position.set(26,39,34);cafe.camera.lookAt(0,0,0);cafe.renderer.render(cafe.scene,cafe.camera);});
 await page.waitForTimeout(1000);
 await page.evaluate(()=>cafe.renderer.render(cafe.scene,cafe.camera));
 await page.screenshot({path:`${out}/${prefix}-mobile.png`,timeout:120000});
 await page.evaluate(()=>{cafe.cameraMode('walk');const p=cafe.player;cafe.camera.position.set(p.x+.4,1.9,p.z+3.2);cafe.camera.lookAt(p.x,1,p.z);cafe.renderer.render(cafe.scene,cafe.camera);});
 await page.screenshot({path:`${out}/${prefix}-mobile-walk.png`,timeout:120000});
}
await writeFile(`${out}/${prefix}-errors.json`,JSON.stringify(errors,null,2));
console.log('Errors:',errors);
await browser.close();
