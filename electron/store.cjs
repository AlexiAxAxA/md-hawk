const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { defaultSettings, languages, paletteKeys } = require('../shared/preferences.json');
const LANGUAGES = languages.map(value => value.id);
const THEMES = ['light', 'dark', 'mono-light', 'mono-dark', 'sepia', 'blue'];
const defaults = (language = 'ru') => ({ version: 3, settings: { ...structuredClone(defaultSettings), language: LANGUAGES.includes(language) ? language : 'ru' }, documents: [], spaces: [] });
function text(value, max = 4000) { if (typeof value !== 'string' || value.length > max) throw new Error('Некорректные текстовые данные'); return value; }
function number(value, min, max) { if (!Number.isFinite(value) || value < min || value > max) throw new Error('Некорректное числовое значение'); return value; }
function position(value) {
  if (!value || typeof value !== 'object') throw new Error('Некорректная позиция');
  return { text: text(value.text), before: text(value.before), after: text(value.after), heading: text(value.heading), headingIndex: number(value.headingIndex, 0, 100000), offset: number(value.offset, 0, 1), fraction: number(value.fraction, 0, 1) };
}
function settingsPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Некорректные настройки');
  const result = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'theme' && THEMES.includes(value)) result[key] = value;
    else if (key === 'language' && LANGUAGES.includes(value)) result[key] = value;
    else if (key === 'rememberPosition' && typeof value === 'boolean') result[key] = value;
    else if (key === 'fontSize') result[key] = number(value, 8, 40);
    else if (key === 'fontFamily' && ['serif', 'sans', 'mono'].includes(value)) result[key] = value;
    else if (key === 'lineHeight') result[key] = number(value, 1.2, 2.4);
    else if (key === 'paragraphSpacing') result[key] = number(value, 0, 40);
    else if (key === 'customColors') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные цвета');
      const clean = {};
      for (const [theme, colors] of Object.entries(value)) {
        if (!THEMES.includes(theme) || !colors || typeof colors !== 'object' || Array.isArray(colors)) throw new Error('Некорректная тема');
        clean[theme] = {};
        for (const [name, color] of Object.entries(colors)) {
          if (!paletteKeys.includes(name) || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Некорректный цвет');
          clean[theme][name] = color.toLowerCase();
        }
      }
      result[key] = clean;
    }
    else if (key === 'columnWidth') result[key] = number(value, 560, 1100);
    else throw new Error('Некорректная настройка: ' + key);
  }
  return result;
}
function parse(raw) {
  const value = JSON.parse(raw);
  if (![1, 2, 3].includes(value.version) || !Array.isArray(value.documents) || !value.settings || value.documents.length > 10000) throw new Error('Некорректное состояние');
  if (Object.keys(value.settings).length !== (value.version === 1 ? 4 : value.version === 2 ? 5 : 9)) throw new Error('Некорректные настройки состояния');
  settingsPatch(value.settings);
  const ids = new Set();
  for (const doc of value.documents) {
    text(doc.id, 100); text(doc.path, 32768); text(doc.title); text(doc.preview); number(doc.lastOpened, 0, Number.MAX_SAFE_INTEGER);
    if (ids.has(doc.id) || typeof doc.pinned !== 'boolean' || !Array.isArray(doc.bookmarks)) throw new Error('Некорректная запись документа');
    ids.add(doc.id);
    if (doc.position !== null) position(doc.position);
    for (const bookmark of doc.bookmarks) { text(bookmark.id, 100); text(bookmark.name, 200); position(bookmark.position); }
  }
  if (value.version === 1) { value.version = 2; value.settings.language = 'ru'; value.spaces = []; }
  if (value.version === 2) { value.settings = { ...structuredClone(defaultSettings), ...value.settings }; value.version = 3; }
  if (!Array.isArray(value.spaces) || value.spaces.length > 1000) throw new Error('Некорректные пространства');
  const spaceIds = new Set();
  for (const space of value.spaces) {
    text(space.id, 100); text(space.name, 100);
    if (spaceIds.has(space.id) || !space.name.trim() || !Array.isArray(space.documentIds) || space.documentIds.some(id => !ids.has(id)) || new Set(space.documentIds).size !== space.documentIds.length) throw new Error('Некорректное пространство');
    spaceIds.add(space.id);
  }
  return value;
}
class Store {
  constructor(directory, initialLanguage = 'ru') {
    fs.mkdirSync(directory, { recursive: true });
    this.filename = path.join(directory, 'state.json'); this.backup = this.filename + '.bak'; this.blocked = false; this.warning = '';
    if (!fs.existsSync(this.filename) && !fs.existsSync(this.backup)) { this.state = defaults(initialLanguage); this.write(this.state); return; }
    try { this.state = parse(fs.readFileSync(this.filename, 'utf8')); }
    catch {
      try { this.state = parse(fs.readFileSync(this.backup, 'utf8')); this.warning = 'Состояние восстановлено из резервной копии. Последнее изменение могло не сохраниться.'; }
      catch { this.state = defaults(); this.blocked = true; this.warning = 'Файлы истории повреждены. Исходные копии сохранены; запись заблокирована. Можно создать новую историю с архивированием повреждённых копий.'; }
    }
  }
  write(next) {
    if (this.blocked) throw new Error('Файлы истории повреждены; сначала восстановите хранилище');
    const temp = this.filename + '.tmp';
    const handle = fs.openSync(temp, 'w');
    try { fs.writeFileSync(handle, JSON.stringify(next, null, 2)); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
    if (fs.existsSync(this.filename)) {
      try { parse(fs.readFileSync(this.filename, 'utf8')); fs.copyFileSync(this.filename, this.backup); }
      catch (error) { if (error.code) { fs.rmSync(temp, { force: true }); throw error; } }
    }
    fs.renameSync(temp, this.filename);
  }
  mutate(action) {
    const next = structuredClone(this.state); const result = action(next);
    this.write(next); this.state = next; return result;
  }
  document(id, state = this.state) { text(id, 100); const doc = state.documents.find(d => d.id === id); if (!doc) throw new Error('Документ не найден в истории'); return doc; }
  settings(patch) { const clean = settingsPatch(patch); this.mutate(s => Object.assign(s.settings, clean)); return this.state.settings; }
  pin(id, pinned) { if (typeof pinned !== 'boolean') throw new Error('Некорректное закрепление'); this.mutate(s => { this.document(id, s).pinned = pinned; }); }
  remove(id) { text(id, 100); this.mutate(s => { s.documents = s.documents.filter(d => d.id !== id); for (const space of s.spaces) space.documentIds = space.documentIds.filter(value => value !== id); }); }
  saveSpace(id, name, documentIds) {
    text(name, 100); if (!name.trim() || !Array.isArray(documentIds) || documentIds.length > 10000) throw new Error('Некорректное пространство');
    if (id !== null) text(id, 100);
    const nextId = id || randomUUID();
    this.mutate(s => {
      const space = id ? s.spaces.find(item => item.id === id) : { id: nextId };
      if (!space) throw new Error('Пространство не найдено');
      for (const docId of documentIds) this.document(docId, s);
      Object.assign(space, { name: name.trim(), documentIds: [...new Set(documentIds)] });
      if (!id) { if (s.spaces.length >= 1000) throw new Error('Слишком много пространств'); s.spaces.push(space); }
    });
    return nextId;
  }
  removeSpace(id) { text(id, 100); this.mutate(s => { s.spaces = s.spaces.filter(space => space.id !== id); }); }
  position(id, value) { const clean = position(value); if (this.state.settings.rememberPosition) this.mutate(s => { this.document(id, s).position = clean; }); }
  addBookmark(id, value) {
    const clean = position(value); const bookmark = { id: randomUUID(), name: (clean.text || clean.heading || 'Закладка').slice(0, 80), position: clean };
    this.mutate(s => { this.document(id, s).bookmarks.push(bookmark); }); return bookmark;
  }
  renameBookmark(id, bookmarkId, name) {
    text(name, 200); if (!name.trim()) throw new Error('Введите название закладки');
    this.mutate(s => { const b = this.document(id, s).bookmarks.find(b => b.id === bookmarkId); if (!b) throw new Error('Закладка не найдена'); b.name = name.trim(); });
  }
  removeBookmark(id, bookmarkId) { this.mutate(s => { const doc = this.document(id, s); doc.bookmarks = doc.bookmarks.filter(b => b.id !== bookmarkId); }); }
  reset() {
    const stamp = Date.now();
    for (const name of [this.filename, this.backup]) if (fs.existsSync(name)) fs.copyFileSync(name, name + '.corrupt-' + stamp);
    this.blocked = false; this.warning = ''; this.write(defaults()); this.state = defaults();
  }
}
module.exports = { Store, position, settingsPatch };
