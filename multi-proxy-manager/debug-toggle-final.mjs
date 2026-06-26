import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(5000);

console.log('Before:', await page.textContent('#proxyStatusCount'));
await page.click('#btn-toggle-codex');
await page.waitForTimeout(5000);
console.log('After stop:', await page.textContent('#proxyStatusCount'));
console.log('Button text:', await page.$eval('#btn-toggle-codex', el => el.textContent.trim()));

// Check API
const status = await page.evaluate(async () => {
  const res = await fetch('/api/status');
  return await res.json();
});
console.log('API codex running:', status.codex?.running);

await browser.close();
