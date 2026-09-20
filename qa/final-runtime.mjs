import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const out='qa/expansion/final-runtime';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4336/?qa',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready,null,{timeout:180000});
 await page.evaluate(()=>cafe.openCreator());await page.getByRole('button',{name:'Noah base',exact:true}).click();await page.getByRole('button',{name:'Face',exact:true}).click();
 await page.getByRole('button',{name:'2. Skin & eyes',exact:true}).click();await page.getByRole('button',{name:'Green',exact:true}).click();await page.waitForTimeout(700);await page.screenshot({path:out+'/01-green-eyes.png'});await page.evaluate(()=>cafe.creator.close());console.log('green eyes rendered');
 await page.evaluate(()=>{cafe.cameraMode('walk');const st=cafe.layout.stations.find(s=>s.game==='xo'),n=cafe.npc('noah');Object.assign(cafe.me,{x:st.seats[0].approach[0],z:st.seats[0].approach[1]});cafe.playerCtl.stop();Object.assign(n.life,{visible:true,scripted:false,phase:'idle',timer:100,seat:null,x:st.seats[1].approach[0],z:st.seats[1].approach[1]});n.ctl.scriptedBy=false;n.ctl.posture='stand';n.ctl.stop();cafe.startGame(st,n);});
 await page.waitForFunction(()=>cafe.playing?.ctl,null,{timeout:35000});
 assert.equal(await page.evaluate(()=>cafe.scene.getObjectByName('Idle activity game-xo').visible),false);
 await page.waitForFunction(()=>cafe.camera.position.distanceTo(cafe.playing.ctl.camera.position)<.12,null,{timeout:45000});await page.screenshot({path:out+'/02-xo-at-table.png'});
 await page.evaluate(()=>cafe.leaveGame());assert.equal(await page.evaluate(()=>cafe.scene.getObjectByName('Idle activity game-xo').visible),true);console.log('XO launch, idle decoration hide and restore passed');
 await page.evaluate(async()=>{Object.assign(cafe.me,{x:-3.4,z:-3.3});cafe.playerCtl.stop();await cafe.orderAtCounter();window.beforeOrder=cafe.econ.coins;document.querySelector('[data-order="Coffee"]').click();});
 await page.waitForFunction(()=>cafe.playerCtl.activity==='reach',null,{timeout:60000});
 await page.keyboard.press('Escape');await page.waitForTimeout(1500);
 const race=await page.evaluate(()=>({before:beforeOrder,after:cafe.econ.coins,drink:cafe.cup.drink}));assert.equal(race.after,race.before);assert.equal(race.drink,null);console.log('handoff cancellation',JSON.stringify(race));
 await page.evaluate(()=>{Object.assign(cafe.me,{x:-4.7,z:-2.5});cafe.playerCtl.stop();cafe.talkTo(cafe.npc('mara'));});
 await page.waitForFunction(()=>cafe.chat.npc==='mara',null,{timeout:20000});
 await page.waitForFunction(()=>Math.abs(cafe.camera.position.z-(cafe.me.z+1.8))<.12,null,{timeout:45000});await page.screenshot({path:out+'/03-mara-public-camera.png'});
 assert.deepEqual(errors,[]);console.log('errors',errors);
}finally{await browser.close();}

