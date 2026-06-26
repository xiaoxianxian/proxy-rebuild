import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { console.log(`✅ ${name}`); pass++; }
  else { console.log(`❌ ${name}`); fail++; }
}

try {
  await page.goto('http://localhost:18792/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);

  // === 1. Dashboard ===
  const sc = await page.textContent('#proxyStatusCount');
  check('① 概览 - 统计显示 3/3', sc && sc.includes('3'));
  check('② 概览 - 已安装3个', await page.textContent('#installedCount') === '3');
  check('③ 概览 - 3张卡片', (await page.$$('.proxy-card')).length === 3);

  // === 2. Codex Proxy Page ===
  await page.click('[data-page="proxy-codex"]');
  await page.waitForTimeout(5000);
  check('④ Codex页 - 运行中', (await page.$eval('#proxy-codex-status', el => el.textContent)).includes('运行中'));
  
  // Switch to each tab
  for (const [sec, tabText] of [['config','配置'],['providers','供应商'],['models','模型'],['balances','余额'],['history','切换历史']]) {
    if (sec !== 'config') {
      const tab = await page.$(`.page.active .section-tab:has-text("${tabText}")`);
      if (tab) { await tab.click(); await page.waitForTimeout(500); }
    }
    const content = await page.$eval(`#proxy-codex-${sec}-content`, el => el.innerHTML);
    check(`⑤ Codex-${sec}`, content.length > 10 && !content.includes('加载中') && !content.includes('失败'));
  }

  // === 3. Hermes Proxy Page ===
  await page.click('[data-page="proxy-hermes"]');
  await page.waitForTimeout(5000);
  check('⑥ Hermes页 - 运行中', (await page.$eval('#proxy-hermes-status', el => el.textContent)).includes('运行中'));
  for (const [sec, tabText] of [['config','配置'],['providers','供应商'],['models','模型'],['balances','余额'],['history','切换历史']]) {
    if (sec !== 'config') {
      const tab = await page.$(`.page.active .section-tab:has-text("${tabText}")`);
      if (tab) { await tab.click(); await page.waitForTimeout(500); }
    }
    const content = await page.$eval(`#proxy-hermes-${sec}-content`, el => el.innerHTML);
    check(`⑦ Hermes-${sec}`, content.length > 10 && !content.includes('加载中') && !content.includes('失败'));
  }

  // === 4. Cursor Proxy Page ===
  await page.click('[data-page="proxy-cursor"]');
  await page.waitForTimeout(5000);
  check('⑧ Cursor页 - 运行中', (await page.$eval('#proxy-cursor-status', el => el.textContent)).includes('运行中'));
  for (const [sec, tabText] of [['config','配置'],['providers','供应商'],['models','模型'],['balances','余额'],['history','切换历史']]) {
    if (sec !== 'config') {
      const tab = await page.$(`.page.active .section-tab:has-text("${tabText}")`);
      if (tab) { await tab.click(); await page.waitForTimeout(500); }
    }
    const content = await page.$eval(`#proxy-cursor-${sec}-content`, el => el.innerHTML);
    check(`⑨ Cursor-${sec}`, content.length > 10 && !content.includes('加载中') && !content.includes('失败'));
  }

  // Cursor providers has add button
  await page.click('[data-page="proxy-cursor"]');
  await page.waitForTimeout(3000);
  const provTab = await page.$('.page#page-proxy-cursor .section-tab:has-text("供应商")');
  if (provTab) { await provTab.click(); await page.waitForTimeout(1000); }
  check('⑩ Cursor - 添加供应商按钮', !!(await page.$('#page-proxy-cursor button:has-text("+ 添加供应商")')));

  // === 5. Logs Page ===
  await page.click('[data-page="logs"]');
  await page.waitForTimeout(1000);
  const logBtn = await page.$('#page-logs button:has-text("刷新")');
  if (logBtn) {
    await logBtn.click();
    await page.waitForTimeout(2000);
    check('⑪ 日志页 - 日志加载', (await page.textContent('#logViewer')).length > 10);
  }

  // === 6. Toggle Test ===
  await page.click('[data-page="dashboard"]');
  await page.waitForTimeout(2000);
  const stopBtn = await page.$('#btn-toggle-codex');
  if (stopBtn) {
    const before = await page.textContent('#proxyStatusCount');
    await stopBtn.click();
    await page.waitForTimeout(5000);
    const after = await page.textContent('#proxyStatusCount');
    check('⑫ 启停 - 停止后变化', before !== after);
    
    const startBtns = await page.$$('button:has-text("启动")');
    if (startBtns.length > 0) {
      await startBtns[0].click();
      await page.waitForTimeout(5000);
      const restored = await page.textContent('#proxyStatusCount');
      check('⑬ 启停 - 启动后恢复', restored.includes('3'));
    }
  }

  // === 7. Agnes Models ===
  await page.click('[data-page="proxy-codex"]');
  await page.waitForTimeout(3000);
  const modelsTab = await page.$('.page#page-proxy-codex .section-tab:has-text("模型")');
  if (modelsTab) { await modelsTab.click(); await page.waitForTimeout(1000); }
  const modelsContent = await page.$eval('#proxy-codex-models-content', el => el.innerHTML);
  check('⑭ Agnes模型可见', modelsContent.includes('agnes-2.0-flash'));

  console.log(`\n========== ${pass}/${pass+fail} PASSED ==========`);
  
} catch (e) {
  console.error('Fatal:', e.message);
}

await browser.close();
process.exit(fail > 0 ? 1 : 0);
