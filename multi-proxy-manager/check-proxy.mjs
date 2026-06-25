import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const consoleMessages = [];
page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});

const pageErrors = [];
page.on('pageerror', err => {
  pageErrors.push(err.message);
});

try {
  await page.goto('http://localhost:18792/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const proxyStatusCount = await page.textContent('#proxyStatusCount');
  const installedCount = await page.textContent('#installedCount');
  const proxyStatusList = await page.textContent('#proxyStatusList');
  const proxyCards = await page.$$('.proxy-card');
  
  console.log('=== Console Messages ===');
  consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
  
  console.log('\n=== Page Errors ===');
  console.log(pageErrors.length > 0 ? pageErrors.join('\n') : 'None');
  
  console.log('\n=== Stats ===');
  console.log(`proxyStatusCount: ${proxyStatusCount}`);
  console.log(`installedCount: ${installedCount}`);
  console.log(`proxyCards: ${proxyCards.length}`);
  
  console.log('\n=== proxyStatusList (first 300 chars) ===');
  console.log(proxyStatusList ? proxyStatusList.substring(0, 300) : '(empty)');
  
} catch (e) {
  console.error('Error:', e.message);
}

await browser.close();
