const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const EXTENSIONS = ['.md', '.markdown', '.mdown', '.pdf', '.docx'];
function pathKey(value, platform = process.platform) { return platform === 'win32' ? path.win32.normalize(value).toLowerCase() : path.posix.normalize(value); }
function resolveReference(documentPath, reference) {
  if (typeof reference !== 'string' || reference.length > 32768 || /[\x00-\x1f]/.test(reference)) throw new Error('Некорректная ссылка');
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference) && !/^[a-z]:[\\/]/i.test(reference)) throw new Error('Недопустимая схема локальной ссылки');
  if (reference.startsWith('//') || reference.startsWith('\\\\')) throw new Error('Сетевые пути не поддерживаются');
  const index = reference.indexOf('#');
  const file = decodeURIComponent(index < 0 ? reference : reference.slice(0, index));
  if (/[\x00-\x1f]/.test(file)) throw new Error('Некорректная ссылка');
  if (file.startsWith('//') || file.startsWith('\\\\')) throw new Error('Сетевые пути не поддерживаются');
  return { path: file ? path.resolve(path.dirname(documentPath), file) : documentPath, fragment: index < 0 ? '' : decodeURIComponent(reference.slice(index + 1)) };
}
function readMarkdown(filename, cached) {
  if (typeof filename !== 'string' || filename.includes('\0') || !EXTENSIONS.includes(path.extname(filename).toLowerCase())) throw new Error('Выберите Markdown, PDF или Word DOCX');
  const actual = fs.realpathSync(filename); const stat = fs.statSync(actual);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error('Поддерживаются документы размером до 20 МБ');
  if (cached && cached.actual === actual && cached.mtime === stat.mtimeMs && cached.ctime === stat.ctimeMs && cached.size === stat.size) return cached;
  const extension = path.extname(actual).toLowerCase(), format = extension === '.pdf' ? 'pdf' : extension === '.docx' ? 'docx' : 'markdown';
  const buffer = fs.readFileSync(actual); let content;
  try { content = format !== 'markdown' ? buffer.toString('base64') : new TextDecoder(buffer[0] === 0xff && buffer[1] === 0xfe ? 'utf-16le' : buffer[0] === 0xfe && buffer[1] === 0xff ? 'utf-16be' : 'utf-8', { fatal: true }).decode(buffer); }
  catch { throw new Error('Не удалось прочитать кодировку. Сохраните документ в UTF-8 или UTF-16 с BOM.'); }
  return { actual, content, format, mtime: stat.mtimeMs, ctime: stat.ctimeMs, size: stat.size };
}
class Library {
  constructor(store) { this.store = store; this.openPaths = new Map(); this.cache = new Map(); }
  open(filename) {
    const data = readMarkdown(filename, this.cache.get(pathKey(filename))), { actual, content, format } = data; let record;
    // ponytail: five recently opened documents; add a byte budget if larger documents are allowed.
    this.cache.delete(pathKey(actual)); this.cache.set(pathKey(actual), data); if (this.cache.size > 5) this.cache.delete(this.cache.keys().next().value);
    this.store.mutate(s => {
      record = s.documents.find(d => pathKey(d.path) === pathKey(actual));
      if (!record) { record = { id: randomUUID(), path: actual, title: path.basename(actual), preview: '', lastOpened: 0, pinned: false, position: null, bookmarks: [] }; s.documents.push(record); }
      record.preview = format !== 'markdown' ? (format === 'pdf' ? 'PDF' : 'Word DOCX') : content.slice(0, 8000).replace(/^---[\s\S]*?---\s*/, '').replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[#*_>`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
      record.lastOpened = Date.now();
    });
    this.openPaths.set(record.id, actual); return { record, content, format };
  }
  byId(id) { return this.open(this.store.document(id).path); }
  relative(id, reference) { const resolved = resolveReference(this.store.document(id).path, reference); return { ...this.open(resolved.path), fragment: resolved.fragment }; }
  relocate(id, filename) {
    const { actual } = readMarkdown(filename);
    this.store.mutate(s => {
      const original = this.store.document(id, s); const duplicate = s.documents.find(d => d.id !== id && pathKey(d.path) === pathKey(actual));
      if (duplicate) { original.bookmarks.push(...duplicate.bookmarks); original.pinned ||= duplicate.pinned; original.position ||= duplicate.position; s.documents = s.documents.filter(d => d.id !== duplicate.id); for (const space of s.spaces) space.documentIds = [...new Set(space.documentIds.map(value => value === duplicate.id ? id : value))]; }
      original.path = actual; original.title = path.basename(actual);
    });
    return this.open(actual);
  }
  list() { return this.store.state.documents.map(doc => ({ ...doc, missing: !fs.existsSync(doc.path) })).sort((a, b) => b.lastOpened - a.lastOpened); }
}
module.exports = { Library, pathKey, resolveReference, EXTENSIONS };
