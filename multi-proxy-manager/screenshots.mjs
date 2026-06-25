import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });

// 1. Dashboard
const page1 = await browser.newPage();
await page1.setViewportSize({ width: 1440, height: 900 });
await page1.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page1.waitForTimeout(5000);
await page1.screenshot({ path: '/tmp/dashboard.png' });
console.log('Dashboard screenshot saved');

// 2. Codex config page
const page2 = await browser.newPage();
await page2.setViewportSize({ width: 1440, height: 900 });
await page2.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page2.waitForTimeout(5000);
await page2.click('[data-page="proxy-codex"]');
await page2.waitForTimeout(4000);
await page2.screenshot({ path: '/tmp/codex-config.png' });
console.log('Codex config screenshot saved');

// 3. Cursor providers page (with CRUD)
const page3 = await browser.newPage();
await page3.setViewportSize({ width: 1440, height: 900 });
await page3.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page3.waitForTimeout(5000);
await page3.click('[data-page="proxy-cursor"]');
await page3.waitForTimeout(4000);
const provTab = await page3.$('.page#page-proxy-cursor .section-tab:has-text("供应商")');
if (provTab) { await provTab.click(); await page3.waitForTimeout(1000); }
await page3.screenshot({ path: '/tmp/cursor-providers.png' });
console.log('Cursor providers screenshot saved');

// 4. Logs page
const page4 = await browser.newPage();
await page4.setViewportSize({ width: 1440, height: 900 });
await page4.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page4.waitForTimeout(5000);
await page4.click('[data-page="logs"]');
await page4.waitForTimeout(2000);
const refreshBtn = await page4.$('#page-logs button:has-text("刷新")');
if (refreshBtn) { await refreshBtn.click(); await page4.waitForTimeout(2000); }
await page4.screenshot({ path: '/tmp/logs.png' });
console.log('Logs screenshot saved');

await browser.close();
console.log('All screenshots done');
