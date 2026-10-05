const { _electron } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const data = path.join(process.cwd(), '.verification', 'diagnostic-' + Date.now());
  const env = { ...process.env, MD_HAWK_USER_DATA: data, MD_HAWK_TEST_HIDE: '1' }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: require('electron'), args: [process.cwd()], env });
  app.process().stderr.on('data', chunk => process.stdout.write(chunk));
  try {
    const page = await app.firstWindow(); await page.waitForTimeout(2000);
    console.log(JSON.stringify(await page.evaluate(async () => ({ url: location.href, text: document.body.innerText, api: typeof window.hawk, visibility: document.visibilityState, size: [innerWidth,innerHeight], state: await window.hawk?.state().catch(error => String(error)) })), null, 2));
    console.log('windows', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ visible: w.isVisible(), loading: w.webContents.isLoading(), url: w.webContents.getURL() }))));
  } finally { await app.close(); }
})();
