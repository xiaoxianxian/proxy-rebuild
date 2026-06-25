import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: '/tmp/dashboard.png', fullPage: false });
await browser.close();
console.log('Dashboard screenshot saved');
