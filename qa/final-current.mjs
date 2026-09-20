import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const out='qa/expansion/final-current';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:480,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4336/?qa',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/01-mobile-cafe.png'});
 await page.evaluate(()=>cafe.openCreator());await page.waitForFunction(()=>document.querySelector('#character-creator canvas')?.width>0);await page.screenshot({path:out+'/02-mobile-creator.png'});
 const bounds=await page.locator('#character-creator').boundingBox();assert.ok(bounds.width<=480&&bounds.x>=0);
 await page.setViewportSize({width:1280,height:800});await page.getByRole('button',{name:'Noah base',exact:true}).click();await page.getByRole('button',{name:'Face',exact:true}).click();await page.getByRole('button',{name:'2. Skin & eyes',exact:true}).click();await page.getByRole('button',{name:'Green',exact:true}).click();await page.waitForTimeout(800);await page.screenshot({path:out+'/03-green-eyes-current.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({mobileWidth:bounds.width,errors}));
}finally{await browser.close();}
