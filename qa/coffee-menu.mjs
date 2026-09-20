import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const out='qa/expansion/coffee-menu';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:4336/?qa',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready,null,{timeout:180000});
await page.evaluate(async()=>{cafe.cameraMode('walk');Object.assign(cafe.me,{x:-3.4,z:-3.3});cafe.playerCtl.stop();await cafe.orderAtCounter();});await page.waitForSelector('#dialog[open] .coffee-menu');
assert.equal(await page.locator('[data-order]').count(),6);assert.equal((await page.locator('[data-order="Coffee"] .coffee-price').innerText()).replace(/\s+/g,' '),'3 🍁 Maple Coins');
await page.screenshot({path:out+'/desktop.png'});await page.locator('.coffee-help').click();assert.equal(await page.locator('#help-mara').isChecked(),true);await page.locator('.coffee-help').click();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile-top.png'});const bounds=await page.locator('#dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.width<=390);assert.equal(await page.evaluate(()=>document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth),true);
await page.locator('.coffee-help').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-bottom.png'});assert.ok((await page.locator('[data-order="Coffee"]').boundingBox()).height>=44);
await page.setViewportSize({width:1280,height:900});await page.locator('[data-order="Coffee"]').click();await page.waitForFunction(()=>cafe.econ.coins===27);await page.keyboard.press('Escape');await page.waitForFunction(()=>cafe.econ.coins===30);assert.equal(await page.evaluate(()=>cafe.cup.drink),null);
assert.deepEqual(errors,[]);console.log(JSON.stringify({sixActualDrinks:true,mobile:bounds,helpToggle:true,chargeAndCancellation:true,errors}));
}finally{await browser.close();}

