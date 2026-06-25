import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => console.log(`[console.${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(6000);

// Check DOM state
const domState = await page.evaluate(() => {
  return {
    proxyPagesContainer: document.getElementById('proxyPagesContainer')?.innerHTML?.substring(0, 200),
    proxyStatusList: document.getElementById('proxyStatusList')?.textContent?.substring(0, 100),
    proxyStatusCount: document.getElementById('proxyStatusCount')?.textContent,
    installedCount: document.getElementById('installedCount')?.textContent,
    proxyNavItems: document.getElementById('proxyNavItems')?.innerHTML?.substring(0, 200),
    proxyCards: document.querySelectorAll('.proxy-card').length,
    proxyPages: document.querySelectorAll('[id^="page-proxy-"]').length,
    pageIds: Array.from(document.querySelectorAll('[id^="page-"]')).map(el => el.id),
  };
});

console.log('\n=== DOM State ===');
console.log(JSON.stringify(domState, null, 2));

await browser.close();
