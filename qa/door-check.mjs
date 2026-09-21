// The front door must be the front door: localhost always shows the sign-in
// page, signed in or not.
import { chromium } from 'playwright-core';
const base = process.env.CAFE_URL_BASE || 'http://127.0.0.1:4321';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const email = `door-${Date.now()}@maplebean.test`, handle = 'Door' + String(Date.now()).slice(-4);
await page.goto(base + '/', { waitUntil: 'networkidle' });
console.log('signed out, landed on:', page.url(), '| choice visible:', !!await page.$('#screen-choice:not([hidden])'));
await page.click('[data-go="signup"]');
await page.fill('#signup-handle', handle);
await page.fill('#signup-email', email);
await page.fill('#signup-password', 'latte2024');
await page.fill('#signup-confirm', 'latte2024');
await page.click('#signup-terms + .mb-check__box');
await Promise.all([page.waitForURL(/\/cafe/), page.click('#signup-submit')]);
console.log('after signup:', page.url());
// Now come back to localhost with a live session.
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log('signed in, landed on:', page.url());
console.log('choice visible:', !!await page.$('#screen-choice:not([hidden])'));
console.log('welcome-back card:', await page.textContent('#resume-card h2').catch(() => 'MISSING'));
await page.screenshot({ path: 'qa/login/screen-07-welcome-back.png' });
await b.close();
