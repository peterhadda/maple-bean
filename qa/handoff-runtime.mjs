import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const out='qa/expansion/final-runtime';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4336/?qa',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready,null,{timeout:180000});
 await page.evaluate(async()=>{cafe.cameraMode('walk');Object.assign(cafe.me,{x:-3.4,z:-3.3});cafe.playerCtl.stop();await cafe.orderAtCounter();window.beforeOrder=cafe.econ.coins;document.querySelector('[data-order="Coffee"]').click();});
 await page.waitForFunction(()=>cafe.playerCtl.activity==='reach',null,{timeout:60000});await page.keyboard.press('Escape');
 await page.waitForTimeout(1500);const race=await page.evaluate(()=>({before:beforeOrder,after:cafe.econ.coins,drink:cafe.cup.drink,script:cafe.script}));assert.equal(race.after,race.before);assert.equal(race.drink,null);console.log('handoff Escape cancellation',JSON.stringify(race));
 await page.evaluate(()=>{Object.assign(cafe.me,{x:-4.7,z:-2.5});cafe.playerCtl.stop();cafe.talkTo(cafe.npc('mara'));});await page.waitForFunction(()=>cafe.chat.npc==='mara',null,{timeout:20000});
 await page.waitForFunction(()=>Math.abs(cafe.camera.position.z-(cafe.me.z+1.8))<.12,null,{timeout:45000});await page.screenshot({path:out+'/03-mara-public-camera.png'});console.log('public Mara camera settled');
 await page.evaluate(()=>{document.querySelector('#music-categories button').click();document.getElementById('music-play').click();});
 await page.waitForFunction(()=>!document.getElementById('now-listening').hidden);
 const privateStatus=await page.waitForRequest(r=>{try{return r.url().endsWith('/api')&&r.postDataJSON().action==='move';}catch{return false;}},{timeout:10000});
 assert.notEqual(privateStatus.postDataJSON().status,'music');assert.ok(!privateStatus.postDataJSON().statusDetail?.includes('🎧'));console.log('music stays private when unchecked');
 const shared=page.waitForRequest(r=>{try{return r.url().endsWith('/api')&&r.postDataJSON().action==='move'&&r.postDataJSON().statusDetail?.includes('🎧');}catch{return false;}},{timeout:10000});
 await page.evaluate(()=>{document.getElementById('music-share').checked=true;document.getElementById('music-share').dispatchEvent(new Event('change'));});
 const request=await shared;console.log('opt-in headphone presence',request.postDataJSON().statusDetail);assert.deepEqual(errors,[]);console.log('errors',errors);
}finally{await browser.close();}
