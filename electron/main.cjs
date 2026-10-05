const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu, screen, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { Store } = require('./store.cjs');
const { initialLanguage, translate } = require('./locale.cjs');
const { Library, resolveReference, EXTENSIONS } = require('./library.cjs');
const { externalUrl } = require('./security.cjs');
if (process.env.MD_HAWK_USER_DATA) app.setPath('userData', path.resolve(process.env.MD_HAWK_USER_DATA));
app.setName('MD Hawk');
protocol.registerSchemesAsPrivileged([{ scheme: 'hawk-app', privileges: { standard: true, secure: true, supportFetchAPI: true } }, { scheme: 'hawk-resource', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window, store, library, rendererReady = false, closing = false, closeRequested = false;
const queued = [], images = new Map();
function fileArguments(args) { return args.filter(arg => !arg.startsWith('--') && EXTENSIONS.includes(path.extname(arg).toLowerCase())).map(arg => path.resolve(arg)); }
function deliver(filename) {
  if (!rendererReady || !library) { queued.push(filename); return; }
  try { window.webContents.send('hawk:open', library.open(filename)); }
  catch (error) { window.webContents.send('hawk:error', 'Не удалось открыть файл: ' + error.message); }
}
app.on('open-file', (event, filename) => { event.preventDefault(); deliver(filename); });
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  queued.push(...fileArguments(process.argv.slice(1)));
  app.on('second-instance', (_event, args, cwd) => {
    if (window && !process.env.MD_HAWK_TEST_HIDE) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
    for (const filename of args.filter(a => !a.startsWith('--') && EXTENSIONS.includes(path.extname(a).toLowerCase()))) deliver(path.resolve(cwd, filename));
  });
  app.whenReady().then(createWindow);
}
async function pick() {
  const language = store.state.settings.language;
  const result = await dialog.showOpenDialog(window, { title: translate(language, 'Open document', 'Открыть документ'), properties: ['openFile', 'multiSelections'], filters: [{ name: translate(language, 'Open documents', 'Документы'), extensions: EXTENSIONS.map(extension => extension.slice(1)) }] });
  return result.canceled ? [] : result.filePaths;
}
function checkedSender(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый отправитель');
  const url = new URL(event.senderFrame.url);
  if (!(url.protocol === 'hawk-app:' && url.hostname === 'reader') && !(process.env.MD_HAWK_DEV && url.origin === 'http://127.0.0.1:5178')) throw new Error('Недопустимый источник');
}
function handler(name, action) { ipcMain.handle('hawk:' + name, (event, ...args) => { checkedSender(event); return action(...args); }); }
async function createWindow() {
  store = new Store(app.getPath('userData'), process.env.MD_HAWK_TEST_HIDE ? 'ru' : initialLanguage(path.dirname(process.execPath), app.getLocale())); library = new Library(store);
  const dist = path.join(__dirname, '..', 'dist');
  protocol.handle('hawk-app', request => {
    const url = new URL(request.url); let filename;
    try { filename = path.resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch { return new Response('Invalid path', { status: 400 }); }
    if (url.hostname !== 'reader' || path.relative(dist, filename).startsWith('..') || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filename).href);
  });
  protocol.handle('hawk-resource', request => {
    const url = new URL(request.url), filename = images.get(url.hostname);
    if (!filename) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filename).href);
  });
  const area = screen.getPrimaryDisplay().workAreaSize;
  const normalSize = { width: Math.min(1120, Math.floor(area.width * .82)), height: Math.min(800, Math.floor(area.height * .82)) };
  window = new BrowserWindow({ ...normalSize, minWidth: Math.min(560, area.width), minHeight: Math.min(420, area.height), show: false, backgroundColor: '#f3f5f8', title: 'MD Hawk', icon: path.join(__dirname, '..', 'assets', 'icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: !process.env.MD_HAWK_TEST_HIDE } });
  window.on('leave-full-screen', () => { if (window.isMaximized()) window.unmaximize(); window.setSize(normalSize.width, normalSize.height); window.center(); });
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ label: 'MD Hawk', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }, { label: 'Правка', submenu: [{ role: 'copy' }, { role: 'selectAll' }] }]) : null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  handler('state', () => ({ documents: library.list(), spaces: store.state.spaces, settings: store.state.settings, warning: store.warning, blocked: store.blocked }));
  handler('openDialog', async () => { const docs = []; for (const filename of await pick()) docs.push(library.open(filename)); return docs; });
  handler('openId', id => library.byId(id));
  handler('openRelative', (id, reference) => library.relative(id, reference));
  handler('relocate', async id => { const files = await pick(); return files.length ? library.relocate(id, files[0]) : null; });
  handler('pin', (id, value) => store.pin(id, value)); handler('remove', id => store.remove(id));
  handler('copyText', value => { if (typeof value !== 'string' || value.length > 20 * 1024 * 1024) throw new Error('Некорректный текст'); clipboard.writeText(value); });
  handler('settings', patch => store.settings(patch)); handler('savePosition', (id, value) => store.position(id, value));
  handler('saveSpace', (id, name, documentIds) => store.saveSpace(id, name, documentIds)); handler('removeSpace', id => store.removeSpace(id));
  handler('addBookmark', (id, value) => store.addBookmark(id, value));
  handler('renameBookmark', (id, bookmarkId, name) => store.renameBookmark(id, bookmarkId, name));
  handler('removeBookmark', (id, bookmarkId) => store.removeBookmark(id, bookmarkId));
  handler('reset', () => store.reset());
  handler('external', value => shell.openExternal(externalUrl(value)));
  handler('image', (id, reference) => {
    if (!library.openPaths.has(id)) throw new Error('Документ не открыт');
    const filename = fs.realpathSync(resolveReference(library.openPaths.get(id), reference).path);
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp'].includes(path.extname(filename).toLowerCase()) || fs.statSync(filename).size > 30 * 1024 * 1024) throw new Error('Неподдерживаемое изображение');
    let token = [...images].find(([, value]) => value === filename)?.[0];
    if (!token) { token = randomUUID(); images.set(token, filename); }
    return 'hawk-resource://' + token + '/image';
  });
  handler('drop', values => {
    if (!Array.isArray(values) || values.length > 100 || values.some(v => typeof v !== 'string')) throw new Error('Некорректный список файлов');
    return values.map(value => library.open(value));
  });
  handler('ready', () => { rendererReady = true; for (const filename of queued.splice(0)) deliver(filename); });
  handler('flushed', () => { if (closeRequested) { closing = true; window.close(); } });
  window.on('close', event => {
    if (!closing && rendererReady) { event.preventDefault(); if (!closeRequested) { closeRequested = true; window.webContents.send('hawk:flush'); setTimeout(() => { if (window && !window.isDestroyed()) { closing = true; window.close(); } }, 5000).unref(); } }
  });
  window.on('closed', () => { window = null; rendererReady = false; });
  window.once('ready-to-show', () => { if (!process.env.MD_HAWK_TEST_HIDE) window.show(); });
  await window.loadURL(process.env.MD_HAWK_DEV ? 'http://127.0.0.1:5178' : 'hawk-app://reader/');
}
app.on('window-all-closed', () => app.quit());
