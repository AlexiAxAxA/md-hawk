import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { ChevronLeft, ChevronRight, BookmarkPlus, Search, X } from 'lucide-react';
import { t } from './i18n';
import type { DocumentData, Position, Settings } from './types';
import type { Navigation, ReaderHandle } from './Reader';
import { BookmarkRow } from './Reader';
GlobalWorkerOptions.workerSrc = workerUrl;
const pageOf = (position?: Position | null) => Math.max(1, Number(position?.text.match(/^pdf:page:(\d+)$/)?.[1]) || 1);
export default forwardRef<ReaderHandle, { doc: DocumentData; settings: Settings; initialPosition?: Position | null; navigation?: Navigation; onRefresh: () => Promise<void>; notify: (message: string) => void }>(function PdfReader({ doc, settings, initialPosition, navigation, onRefresh, notify }, ref) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>(), [page, setPage] = useState(pageOf(initialPosition)), [zoom, setZoom] = useState(100), [width, setWidth] = useState(700), [error, setError] = useState(''), [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState(''), [searching, setSearching] = useState(false), [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), layer = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), pageRef = useRef(page), saved = useRef(''), settingsRef = useRef(settings), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), searchSerial = useRef(0), textCache = useRef(new Map<number, string>());
  pageRef.current = page; settingsRef.current = settings;
  const position = useCallback((): Position => ({ text: 'pdf:page:' + pageRef.current, before: '', after: '', heading: 'PDF', headingIndex: 0, offset: 0, fraction: pdf && pdf.numPages > 1 ? (pageRef.current - 1) / (pdf.numPages - 1) : 0 }), [pdf]);
  const flush = useCallback(async () => { clearTimeout(timer.current); const value = position(), json = JSON.stringify(value); if (pdf && settingsRef.current.rememberPosition && saved.current !== json) { await window.hawk.savePosition(doc.record.id, value); saved.current = json; } }, [position, doc.record.id, pdf]);
  const bookmark = useCallback(async () => { if (!pdf) return; try { const added = await window.hawk.addBookmark(doc.record.id, position()); await window.hawk.renameBookmark(doc.record.id, added.id, t('Страница') + ' ' + pageRef.current); await onRefresh(); notify(t('Закладка добавлена')); } catch (error) { notify(String(error)); } }, [pdf, doc.record.id, position, onRefresh, notify]);
  useImperativeHandle(ref, () => ({ flush, position, addBookmark: () => { void bookmark(); }, search: () => setSearchOpen(true) }), [flush, position, bookmark]);
  useEffect(() => {
    const task = getDocument({ data: Uint8Array.from(atob(doc.content), char => char.charCodeAt(0)), useSystemFonts: true, useWasm: false }); let alive = true;
    void task.promise.then(document => { if (!alive) return; if (document.numPages > 5000) { setError(t('Слишком много страниц PDF.')); return; } setPdf(document); setPage(value => Math.min(value, document.numPages)); }).catch(error => { if (alive) setError(t(error.name === 'PasswordException' ? 'PDF защищён паролем.' : 'Не удалось прочитать PDF.')); });
    return () => { alive = false; searchSerial.current++; clearTimeout(timer.current); void task.destroy(); };
  }, [doc.content]);
  useEffect(() => { const observer = new ResizeObserver(() => { if (host.current) setWidth(host.current.clientWidth); }); if (host.current) observer.observe(host.current); return () => observer.disconnect(); }, []);
  useEffect(() => { if (navigation?.position) setPage(Math.min(pdf?.numPages || 5000, pageOf(navigation.position))); }, [navigation, pdf]);
  useEffect(() => {
    if (!pdf || !canvas.current || !layer.current || !sheet.current) return;
    let alive = true, rendering: RenderTask | undefined, textLayer: TextLayer | undefined; setReady(false); layer.current.replaceChildren();
    void pdf.getPage(page).then(async value => {
      if (!alive || !canvas.current || !layer.current || !sheet.current) return;
      const natural = value.getViewport({ scale: 1 }), scale = Math.min(settings.columnWidth, Math.max(200, width - 40)) / natural.width * zoom / 100, viewport = value.getViewport({ scale }), density = Math.min(2, window.devicePixelRatio || 1);
      const element = canvas.current; element.width = Math.ceil(viewport.width * density); element.height = Math.ceil(viewport.height * density); element.style.width = viewport.width + 'px'; element.style.height = viewport.height + 'px';
      Object.assign(sheet.current.style, { width: viewport.width + 'px', height: viewport.height + 'px' }); sheet.current.style.setProperty('--total-scale-factor', String(scale));
      rendering = value.render({ canvas: element, viewport, transform: [density, 0, 0, density, 0, 0] }); await rendering.promise;
      if (!alive) return;
      const text = await value.getTextContent(); if (!alive) return;
      textCache.current.set(page, text.items.map(item => 'str' in item ? item.str : '').join(' '));
      textLayer = new TextLayer({ textContentSource: text, container: layer.current!, viewport }); await textLayer.render(); if (alive) setReady(true);
    }).catch(error => { if (alive && error.name !== 'RenderingCancelledException') setError(t('Не удалось прочитать PDF.')); });
    return () => { alive = false; rendering?.cancel(); textLayer?.cancel(); };
  }, [pdf, page, zoom, width, settings.columnWidth]);
  useEffect(() => { if (pdf) { clearTimeout(timer.current); timer.current = setTimeout(() => { void flush().catch(error => notify(String(error))); }, 450); } }, [page, pdf, flush, notify]);
  useEffect(() => { if (ready && layer.current) for (const span of layer.current.querySelectorAll('span')) span.classList.toggle('pdf-match', !!query.trim() && (span.textContent || '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); }, [ready, query]);
  const find = async () => {
    if (!pdf || !query.trim()) return;
    const serial = ++searchSerial.current; setSearching(true);
    try { for (let step = 1; step <= pdf.numPages; step++) { const number = (pageRef.current - 1 + step) % pdf.numPages + 1; let text = textCache.current.get(number);
      if (text === undefined) { const content = await (await pdf.getPage(number)).getTextContent(); text = content.items.map(item => 'str' in item ? item.str : '').join(' '); textCache.current.set(number, text); }
      if (serial !== searchSerial.current) return;
      if (text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) { setPage(number); return; }
    } notify(t('Нет совпадений')); } catch (error) { notify(String(error)); } finally { if (serial === searchSerial.current) setSearching(false); }
  };
  return <main className="reader-layout pdf-reader">
    <aside className="reader-sidebar"><div className="sidebar-tabs"><span>{t('Закладки')}</span><button className="icon-button" aria-label={t('Добавить закладку')} onClick={() => void bookmark()}><BookmarkPlus size={18}/></button></div><div className="sidebar-content">{doc.record.bookmarks.map(item => <BookmarkRow key={item.id} item={item} onJump={() => setPage(Math.min(pdf?.numPages || 5000, pageOf(item.position)))} onRename={name => void window.hawk.renameBookmark(doc.record.id, item.id, name).then(onRefresh).catch(error => notify(String(error)))} onDelete={() => void window.hawk.removeBookmark(doc.record.id, item.id).then(onRefresh).catch(error => notify(String(error)))}/>)}</div></aside>
    <section className="reading-area"><div className="reader-toolbar"><span title={doc.record.path}>{doc.record.title}</span><div><button className="icon-button" aria-label={t('Найти в документе')} onClick={() => setSearchOpen(value => !value)}><Search size={18}/></button><button className="icon-button" aria-label={t('Предыдущая страница')} disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18}/></button><input className="pdf-page-input" aria-label={t('Номер страницы')} type="number" min="1" max={pdf?.numPages || 1} value={page} onChange={event => setPage(Math.max(1, Math.min(pdf?.numPages || 1, Number(event.target.value))))}/><span>/ {pdf?.numPages || '…'}</span><button className="icon-button" aria-label={t('Следующая страница')} disabled={!pdf || page >= pdf.numPages} onClick={() => setPage(value => value + 1)}><ChevronRight size={18}/></button></div></div>
      {searchOpen && <form className="document-search" onSubmit={event => { event.preventDefault(); void find(); }}><input autoFocus aria-label={t('Найти в документе')} placeholder={t('Найти в документе')} value={query} onChange={event => { searchSerial.current++; setSearching(false); setQuery(event.target.value); }}/><button type="submit" disabled={searching}>{t(searching ? 'Поиск…' : 'Следующее совпадение')}</button><button type="button" className="icon-button" aria-label={t('Закрыть поиск')} onClick={() => { searchSerial.current++; setSearching(false); setSearchOpen(false); }}><X size={16}/></button></form>}
      <div className="pdf-zoom"><label>{t('Масштаб PDF')} <input aria-label={t('Масштаб PDF')} type="range" min="50" max="180" step="10" value={zoom} onChange={event => setZoom(Number(event.target.value))}/></label><span>{zoom}%</span></div>
      <div ref={host} className="pdf-scroll" data-testid="pdf-scroll">{error ? <p role="alert" className="render-error">{error}</p> : <><div ref={sheet} className="pdf-sheet" data-ready={ready}><canvas ref={canvas} aria-label={'PDF ' + t('Страница') + ' ' + page}/><div ref={layer} className="textLayer"/></div>{!ready && <p>{t('Загрузка PDF…')}</p>}</>}</div>
    </section>
  </main>;
});
