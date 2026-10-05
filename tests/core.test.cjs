const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../electron/store.cjs');
const { Library, pathKey, resolveReference } = require('../electron/library.cjs');
const { externalUrl } = require('../electron/security.cjs');
function temp(t) { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'md-hawk-')); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; }

test('v2 migration and reading reset preserve documents, spaces and installer language preference', t => {
  const dir = temp(t), file = path.join(dir, 'chapter.md'), data = path.join(dir, 'profile'); fs.writeFileSync(file, '# Chapter');
  const store = new Store(data, 'zh'), doc = new Library(store).open(file);
  store.pin(doc.record.id, true); store.saveSpace(null, 'Work', [doc.record.id]);
  const old = structuredClone(store.state); old.version = 2;
  for (const key of ['customColors', 'fontFamily', 'lineHeight', 'paragraphSpacing']) delete old.settings[key];
  fs.writeFileSync(store.filename, JSON.stringify(old));
  const migrated = new Store(data, 'es'); assert.equal(migrated.state.version, 3); assert.equal(migrated.state.settings.language, 'zh');
  migrated.settings({ fontSize: 8, fontFamily: 'mono', lineHeight: 1.2, paragraphSpacing: 0, customColors: { light: { ink: '#ABCDEF' } } });
  assert.equal(new Store(data).state.settings.customColors.light.ink, '#abcdef');
  for (const patch of [{ fontSize: 7 }, { customColors: { light: { ink: 'url(https://example.org)' } } }, { customColors: { light: { unknown: '#123456' } } }, { language: 'unknown' }]) assert.throws(() => migrated.settings(patch));
  migrated.settings({ ...require('../shared/preferences.json').defaultSettings, language: 'zh' });
  assert.deepEqual(migrated.state.documents, old.documents); assert.deepEqual(migrated.state.spaces, old.spaces); assert.equal(migrated.state.settings.language, 'zh');
});

test('installer language maps LCIDs and portable locales with safe fallback', t => {
  const { chooseLanguage, initialLanguage } = require('../electron/locale.cjs'), dir = temp(t);
  assert.equal(chooseLanguage(2052, 'en-US'), 'zh'); assert.equal(chooseLanguage(3082, 'ru'), 'es');
  assert.equal(chooseLanguage(undefined, 'pt-BR'), 'pt'); assert.equal(chooseLanguage(undefined, 'bn-IN'), 'bn'); assert.equal(chooseLanguage(null, 'unknown'), 'en');
  fs.writeFileSync(path.join(dir, 'installer-language.json'), '{"lcid":3082}'); assert.equal(initialLanguage(dir, 'ru'), 'es');
  fs.writeFileSync(path.join(dir, 'installer-language.json'), 'broken'); assert.equal(initialLanguage(dir, 'ja-JP'), 'ja');
});
test('history deduplicates real paths and persists pins, bookmarks and settings', t => {
  const dir = temp(t), file = path.join(dir, 'Текст с пробелами.md'); fs.writeFileSync(file, '# Привет\n\nТекст');
  const store = new Store(path.join(dir, 'data')), library = new Library(store);
  const a = library.open(file), b = library.open(path.join(dir, '.', 'Текст с пробелами.md'));
  assert.equal(a.record.id, b.record.id); assert.equal(store.state.documents.length, 1);
  store.pin(a.record.id, true); store.settings({ theme: 'sepia' });
  store.addBookmark(a.record.id, { text: 'Текст', before: '', after: '', heading: 'Привет', headingIndex: 0, offset: 0.2, fraction: 0.5 });
  const restored = new Store(path.join(dir, 'data'));
  assert.equal(restored.state.documents[0].pinned, true); assert.equal(restored.state.documents[0].bookmarks.length, 1); assert.equal(restored.state.settings.theme, 'sepia');
  store.remove(a.record.id); assert.equal(fs.readFileSync(file, 'utf8'), '# Привет\n\nТекст');
});
test('disabled remembering preserves previous position and rejects new autosaves', t => {
  const dir = temp(t), file = path.join(dir, 'a.md'); fs.writeFileSync(file, '# A');
  const store = new Store(path.join(dir, 'data')), doc = new Library(store).open(file);
  const pos = { text: 'A', before: '', after: '', heading: 'A', headingIndex: 0, offset: 0, fraction: 0.3 };
  store.position(doc.record.id, pos); store.settings({ rememberPosition: false }); store.position(doc.record.id, { ...pos, fraction: 0.8 });
  assert.equal(store.state.documents[0].position.fraction, 0.3);
  store.addBookmark(doc.record.id, pos); assert.equal(store.state.documents[0].bookmarks.length, 1);
});
test('backup recovery preserves history; both corrupt copies block writes until explicit reset', t => {
  const dir = temp(t), store = new Store(dir); store.settings({ theme: 'dark' }); store.settings({ fontSize: 21 });
  fs.writeFileSync(store.filename, '{broken'); const recovered = new Store(dir);
  assert.equal(recovered.state.settings.theme, 'dark'); assert.match(recovered.warning, /резерв/);
  recovered.settings({ columnWidth: 850 }); assert.equal(new Store(dir).state.settings.columnWidth, 850);
  fs.writeFileSync(store.filename, 'broken main'); fs.writeFileSync(store.backup, 'broken backup');
  const blocked = new Store(dir); assert.equal(blocked.blocked, true); assert.throws(() => blocked.settings({ theme: 'blue' }), /поврежден/);
  assert.equal(fs.readFileSync(store.filename, 'utf8'), 'broken main');
  blocked.reset(); assert.equal(blocked.blocked, false); assert.ok(fs.readdirSync(dir).some(name => name.includes('corrupt')));
});
test('relocation retains identity and bookmarks; duplicate destination merges safely', t => {
  const dir = temp(t), a = path.join(dir, 'old.md'), b = path.join(dir, 'new.md'); fs.writeFileSync(a, '# A'); fs.writeFileSync(b, '# B');
  const store = new Store(path.join(dir, 'data')), lib = new Library(store), doc = lib.open(a);
  store.addBookmark(doc.record.id, { text: 'A', before: '', after: '', heading: 'A', headingIndex: 0, offset: 0, fraction: 0 });
  lib.open(b); fs.unlinkSync(a); const moved = lib.relocate(doc.record.id, b);
  assert.equal(moved.record.id, doc.record.id); assert.equal(moved.record.bookmarks.length, 1); assert.equal(store.state.documents.length, 1);
});
test('OS path rules, URL validation and relative Markdown references', () => {
  assert.equal(pathKey('C:\\Docs\\TEST.md', 'win32'), pathKey('c:\\docs\\test.md', 'win32'));
  assert.notEqual(pathKey('/docs/A.md', 'linux'), pathKey('/docs/a.md', 'linux'));
  assert.equal(resolveReference('/docs/a.md', './Глава%202.md#раздел').path, path.resolve('/docs', 'Глава 2.md'));
  assert.equal(resolveReference('/docs/a.md', './b.md#part').fragment, 'part');
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,a', 'https://a.test\n']) assert.throws(() => externalUrl(url));
  assert.equal(externalUrl('https://example.org/p?q=1'), 'https://example.org/p?q=1');
  assert.throws(() => resolveReference('/docs/a.md', 'javascript:alert(1)'));
  for (const link of ['%5C%5Cserver%5Cshare%5Ca.md', '%2F%2Fserver/share/a.md', 'a%00.md']) assert.throws(() => resolveReference('/docs/a.md', link));
});
test('validation rejects malformed state, settings and positions rather than losing data', t => {
  const dir = temp(t), store = new Store(dir);
  assert.throws(() => store.settings({ fontSize: -99 })); assert.throws(() => store.settings({ arbitrary: true }));
  fs.writeFileSync(store.filename, JSON.stringify({ version: 1, settings: {}, documents: [{ id: 'bad' }] }));
  const again = new Store(dir); assert.ok(again.warning || again.blocked);
});
test('v1 migration retains history and bookmarks; spaces and language survive restart', t => {
  const dir = temp(t), file = path.join(dir, 'legacy.md'); fs.writeFileSync(file, '# Legacy');
  const store = new Store(path.join(dir, 'data')), doc = new Library(store).open(file);
  store.addBookmark(doc.record.id, { text: 'Legacy', before: '', after: '', heading: 'Legacy', headingIndex: 0, offset: 0, fraction: 0 });
  const legacy = structuredClone(store.state); legacy.version = 1; for (const key of ['language','customColors','fontFamily','lineHeight','paragraphSpacing']) delete legacy.settings[key]; delete legacy.spaces; fs.writeFileSync(store.filename, JSON.stringify(legacy));
  const migrated = new Store(path.join(dir, 'data')); assert.equal(migrated.state.version, 3); assert.equal(migrated.state.documents[0].bookmarks.length, 1);
  migrated.settings({ language: 'en' }); const id = migrated.saveSpace(null, 'Reading', [doc.record.id, doc.record.id]);
  const restored = new Store(path.join(dir, 'data')); assert.equal(restored.state.settings.language, 'en'); assert.deepEqual(restored.state.spaces[0].documentIds, [doc.record.id]);
  restored.saveSpace(id, 'Work', []); assert.equal(restored.state.spaces[0].name, 'Work');
  assert.throws(() => restored.saveSpace(null, 'Broken', ['missing'])); assert.throws(() => restored.settings({ language: 'xx' }));
  restored.saveSpace(id, 'Reading', [doc.record.id]); restored.remove(doc.record.id); assert.deepEqual(new Store(path.join(dir, 'data')).state.spaces[0].documentIds, []);
  restored.removeSpace(id); assert.equal(restored.state.spaces.length, 0);
});
test('binary format routing and cached reopening retain fresh content', t => {
  const dir = temp(t), store = new Store(path.join(dir, 'data')), library = new Library(store), file = path.join(dir, 'cached.md'); fs.writeFileSync(file, '# One');
  let reads = 0; const read = fs.readFileSync; t.mock.method(fs, 'readFileSync', function(filename, ...args) { if (filename === file) reads++; return read.call(this, filename, ...args); });
  library.open(file); library.open(file); assert.equal(reads, 1);
  fs.writeFileSync(file, '# Two'); fs.utimesSync(file, new Date(), new Date(Date.now() + 1000)); assert.equal(library.open(file).content, '# Two'); assert.equal(reads, 2);
  for (const format of ['pdf', 'docx']) { const binary = path.join(dir, 'test.' + format), bytes = Buffer.from([0, 1, 2, 255]); fs.writeFileSync(binary, bytes); const doc = library.open(binary); assert.equal(doc.format, format); assert.equal(doc.content, bytes.toString('base64')); }
});
