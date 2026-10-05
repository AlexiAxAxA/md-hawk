const { contextBridge, ipcRenderer, webUtils } = require('electron');
const call = (operation, ...args) => ipcRenderer.invoke('hawk:' + operation, ...args);
contextBridge.exposeInMainWorld('hawk', {
  platform: process.platform, copyText: value => call('copyText', value),
  state: () => call('state'), openDialog: () => call('openDialog'), openId: id => call('openId', id),
  openRelative: (id, reference) => call('openRelative', id, reference),
  relocate: id => call('relocate', id), pin: (id, pinned) => call('pin', id, pinned), remove: id => call('remove', id),
  settings: patch => call('settings', patch), savePosition: (id, value) => call('savePosition', id, value),
  saveSpace: (id, name, documentIds) => call('saveSpace', id, name, documentIds), removeSpace: id => call('removeSpace', id),
  addBookmark: (id, value) => call('addBookmark', id, value), renameBookmark: (id, bookmarkId, name) => call('renameBookmark', id, bookmarkId, name),
  removeBookmark: (id, bookmarkId) => call('removeBookmark', id, bookmarkId),
  image: (id, reference) => call('image', id, reference), external: url => call('external', url), reset: () => call('reset'),
  drop: files => call('drop', Array.from(files).map(file => webUtils.getPathForFile(file))),
  ready: () => call('ready'),
  onOpen: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('hawk:open', listener); return () => ipcRenderer.removeListener('hawk:open', listener); },
  onError: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('hawk:error', listener); return () => ipcRenderer.removeListener('hawk:error', listener); },
  onFlush: callback => { const listener = () => callback(); ipcRenderer.on('hawk:flush', listener); return () => ipcRenderer.removeListener('hawk:flush', listener); },
  flushed: () => call('flushed'),
});
