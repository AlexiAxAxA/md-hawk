const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, '.verification', 'portable-' + Date.now());
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'Проверка portable.md');
fs.writeFileSync(file, '# Portable работает\n\nФайл с кириллицей и пробелами.\n');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const env = { ...process.env, MD_HAWK_USER_DATA: path.join(dir, 'profile'), MD_HAWK_TEST_HIDE: '1' }; delete env.ELECTRON_RUN_AS_NODE;
  const version = require('../package.json').version;
  const child = spawn(path.join(root, 'release', 'MD-Hawk-' + version + '-x64-portable.exe'), ['--remote-debugging-port=' + port, file], { env, stdio: 'ignore', windowsHide: true });
  let browser;
  try {
    for (let i = 0; i < 120 && !browser; i++) {
      if (child.exitCode !== null) throw new Error('Portable exited before startup: ' + child.exitCode);
      try { browser = await chromium.connectOverCDP('http://127.0.0.1:' + port, { timeout: 500 }); } catch { await delay(500); }
    }
    if (!browser) throw new Error('Portable startup timed out');
    const page = browser.contexts()[0].pages()[0];
    await page.locator('article h1').waitFor({ timeout: 15000 });
    if (await page.locator('article h1').textContent() !== 'Portable работает') throw new Error('Unexpected document');
    const state = await page.evaluate(() => window.hawk.state());
    if (state.documents.length !== 1) throw new Error('History not saved');
    await page.close();
    for (let i = 0; i < 40 && child.exitCode === null; i++) await delay(250);
    if (child.exitCode !== 0) throw new Error('Portable did not exit cleanly: ' + child.exitCode);
    fs.writeFileSync(path.join(root, '.verification', 'portable.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), started: true, openedDocument: true, savedHistory: true, exitCode: child.exitCode }, null, 2));
    console.log('Portable startup, Markdown, history and normal close verified.');
  } finally { if (browser) await browser.close().catch(() => {}); if (child.exitCode === null) child.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
