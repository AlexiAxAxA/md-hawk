import { LineSelection } from './LineSelection';
import { fonts } from './preferences';
import { t } from './i18n';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { BookmarkPlus, Bookmark as BookmarkIcon, ChevronDown, ChevronUp, List, PanelLeftClose, PanelLeftOpen, Search, X, Pencil, Trash2, Check } from 'lucide-react';
import { Markdown, WordMarkdown } from './markdown';
import { capture, restore, jumpTo } from './position';
import type { Bookmark, DocumentData, Heading, Position, Settings } from './types';
export interface ReaderHandle { flush(): Promise<void>; position(): Position | null; addBookmark(): void; search(): void }
export interface Navigation { serial: number; position?: Position; fragment?: string }
export function BookmarkRow({ item, onJump, onRename, onDelete }: { item: Bookmark; onJump: () => void; onRename: (name: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false), [name, setName] = useState(item.name);
  return <div className="bookmark-row">{editing ? <form onSubmit={e => { e.preventDefault(); if (name.trim()) { onRename(name); setEditing(false); } }}><input autoFocus aria-label={t("Название закладки")} maxLength={200} value={name} onChange={e => setName(e.target.value)} /><button className="icon-button" title={t("Сохранить название")}><Check size={15}/></button><button type="button" className="icon-button" title={t("Отменить")} onClick={() => setEditing(false)}><X size={15}/></button></form> : <><button className="bookmark-jump" onClick={onJump}><BookmarkIcon size={15}/><span>{item.name}</span></button><button className="icon-button" aria-label={t('Переименовать закладку ') + item.name} onClick={() => { setName(item.name); setEditing(true); }}><Pencil size={14}/></button><button className="icon-button" aria-label={t('Удалить закладку ') + item.name} onClick={onDelete}><Trash2 size={14}/></button></>}</div>;
}
export const Reader = forwardRef<ReaderHandle, { doc: DocumentData; settings: Settings; initialPosition?: Position | null; navigation?: Navigation; onRefresh: () => Promise<void>; onRelative: (reference: string) => void; notify: (message: string) => void }>(function Reader({ doc, settings, initialPosition, navigation, onRefresh, onRelative, notify }, ref) {
  const scroll = useRef<HTMLDivElement>(null), current = useRef<Position | null>(initialPosition || null), pendingRestore = useRef<Position | null>(initialPosition || null), restoring = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), saved = useRef('');
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [headings, setHeadings] = useState<Heading[]>([]), [panel, setPanel] = useState(true), [panelTab, setPanelTab] = useState<'toc' | 'bookmarks'>('toc'), [progress, setProgress] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState(''), [matches, setMatches] = useState<HTMLElement[]>([]), [matchIndex, setMatchIndex] = useState(0);
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!scroll.current) return;
    const pos = restoring.current && current.current ? current.current : capture(scroll.current); current.current = pos;
    if (settingsRef.current.rememberPosition && JSON.stringify(pos) !== saved.current) {
      await window.hawk.savePosition(doc.record.id, pos); saved.current = JSON.stringify(pos);
    }
  }, [doc.record.id]);
  const addBookmark = useCallback(async () => {
    if (!scroll.current) return;
    try { await window.hawk.addBookmark(doc.record.id, capture(scroll.current)); await onRefresh(); setPanel(true); setPanelTab('bookmarks'); notify(t('Закладка добавлена')); } catch (error) { notify(String(error)); }
  }, [doc.record.id, onRefresh, notify]);
  useImperativeHandle(ref, () => ({ flush, position: () => scroll.current ? capture(scroll.current) : null, addBookmark: () => { void addBookmark(); }, search: () => setSearchOpen(true) }), [flush, addBookmark]);
  useEffect(() => () => { clearTimeout(timer.current); }, []);
  const apply = useCallback((pos: Position, announce = false) => {
    if (!scroll.current) return;
    restoring.current = true; current.current = pos;
    const approximate = restore(scroll.current, pos); setProgress(Math.round(capture(scroll.current).fraction * 100));
    requestAnimationFrame(() => { restoring.current = false; });
    if (approximate && announce) notify(t('Документ изменился. Позиция восстановлена приблизительно.'));
  }, [notify]);
  useLayoutEffect(() => {
    if (!scroll.current) return;
    if (pendingRestore.current) apply(pendingRestore.current, true);
    else if (!current.current) current.current = capture(scroll.current);
    // Keep the initial/current anchor stable as asynchronous images and diagrams change geometry.
    const observer = new ResizeObserver(() => { const anchor = pendingRestore.current || current.current; if (anchor) apply(anchor); });
    const article = scroll.current.querySelector('article'); if (article) observer.observe(article);
    const mutations = new MutationObserver(() => {
      const article = scroll.current?.querySelector('article');
      if (article) { observer.observe(article); const anchor = pendingRestore.current || current.current; if (anchor) apply(anchor); }
    });
    mutations.observe(scroll.current, { childList: true, subtree: true });
    const cancel = () => { pendingRestore.current = null; };
    const element = scroll.current; element.addEventListener('wheel', cancel, { passive: true }); element.addEventListener('touchstart', cancel, { passive: true }); element.addEventListener('pointerdown', cancel); element.addEventListener('keydown', cancel);
    return () => { mutations.disconnect(); observer.disconnect(); element.removeEventListener('wheel', cancel); element.removeEventListener('touchstart', cancel); element.removeEventListener('pointerdown', cancel); element.removeEventListener('keydown', cancel); };
  }, [apply]);
  useLayoutEffect(() => { if (current.current) { pendingRestore.current = current.current; apply(current.current); } }, [settings.theme, settings.fontSize, settings.columnWidth, panel, apply]);
  useEffect(() => {
    if (!navigation || !scroll.current) return;
    if (navigation.position) { pendingRestore.current = navigation.position; apply(navigation.position, true); }
    else if (navigation.fragment) {
      pendingRestore.current = null;
      const jump = () => { if (scroll.current && jumpTo(scroll.current, navigation.fragment!)) { current.current = capture(scroll.current); void flush().catch(e => notify(String(e))); } };
      jump(); const timeout = setTimeout(jump, 150); return () => clearTimeout(timeout);
    }
  }, [navigation, apply, flush, notify]);
  const onLink = useCallback((reference: string) => {
    if (reference.startsWith('#')) {
      let id: string; try { id = decodeURIComponent(reference.slice(1)); } catch { notify(t('Некорректный якорь')); return; }
      pendingRestore.current = null;
      if (!scroll.current || !jumpTo(scroll.current, id)) notify(t('Раздел по этой ссылке не найден'));
      else { current.current = capture(scroll.current); void flush().catch(e => notify(String(e))); }
    } else if (/^https?:\/\//i.test(reference)) window.hawk.external(reference).catch(e => notify(String(e)));
    else onRelative(reference);
  }, [onRelative, notify, flush]);
  useEffect(() => {
    const element = scroll.current; if (!element) return;
    setMatches(Array.from(element.querySelectorAll<HTMLElement>('mark.search-match'))); setMatchIndex(0);
  }, [query, doc.content, settings.theme]);
  useEffect(() => {
    matches.forEach((el, i) => el.classList.toggle('current-match', i === matchIndex));
    const target = matches[matchIndex]; if (target && scroll.current) { pendingRestore.current = null; scroll.current.scrollTop += target.getBoundingClientRect().top - scroll.current.getBoundingClientRect().top - 80; }
  }, [matches, matchIndex]);
  const moveMatch = (direction: number) => { if (matches.length) setMatchIndex(value => (value + direction + matches.length) % matches.length); };
  return <main className="reader-layout">
    {panel && <aside className="reader-sidebar"><div className="sidebar-tabs"><button className={panelTab === 'toc' ? 'active' : ''} onClick={() => setPanelTab('toc')}><List size={16}/>{t("Оглавление")}</button><button className={panelTab === 'bookmarks' ? 'active' : ''} onClick={() => setPanelTab('bookmarks')}><BookmarkIcon size={16}/>{t("Закладки")}<span>{doc.record.bookmarks.length || ''}</span></button></div>
      <div className="sidebar-content">{panelTab === 'toc' ? headings.length ? <nav aria-label={t("Оглавление")}>{headings.map(item => <button key={item.id} className={'heading-link depth-' + item.depth} onClick={() => onLink('#' + item.id)}>{item.text}</button>)}</nav> : <p className="sidebar-empty">{t("В этом документе нет заголовков.")}</p> : <><button className="add-bookmark" onClick={() => void addBookmark()}><BookmarkPlus size={16}/>{t("Добавить здесь")}</button>{doc.record.bookmarks.map(item => <BookmarkRow key={item.id} item={item} onJump={() => { pendingRestore.current = item.position; apply(item.position, true); void flush().catch(e => notify(String(e))); }} onRename={name => { void window.hawk.renameBookmark(doc.record.id, item.id, name).then(onRefresh).catch(e => notify(String(e))); }} onDelete={() => { void window.hawk.removeBookmark(doc.record.id, item.id).then(onRefresh).catch(e => notify(String(e))); }} />)}{!doc.record.bookmarks.length && <p className="sidebar-empty">{t("Отметьте место, к которому хотите вернуться.")}</p>}</>}</div>
      <div className="sidebar-bottom">{settings.rememberPosition ? t('Место чтения сохраняется') : t('Автосохранение позиции выключено')}</div>
    </aside>}
    <section className="reading-area"><div className="reader-toolbar"><div><button className="icon-button" aria-label={panel ? t('Скрыть панель') : t('Показать панель')} onClick={() => setPanel(value => !value)}>{panel ? <PanelLeftClose size={20}/> : <PanelLeftOpen size={20}/>}</button><span title={doc.record.path}>{doc.record.title}</span></div><div><button className="icon-button" aria-label={t("Найти в документе")} onClick={() => setSearchOpen(value => !value)}><Search size={19}/></button><button className="icon-button" aria-label={t("Добавить закладку")} onClick={() => void addBookmark()}><BookmarkPlus size={19}/></button><span className="reader-progress">{progress}%</span></div></div>
      {searchOpen && <div className="document-search"><Search size={17}/><input autoFocus aria-label={t("Найти в документе")} placeholder={t("Найти в документе")} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') moveMatch(e.shiftKey ? -1 : 1); if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); } }}/><span>{matches.length ? `${matchIndex + 1} / ${matches.length}` : query ? t('Нет совпадений') : ''}</span><button className="icon-button" aria-label={t("Предыдущее совпадение")} onClick={() => moveMatch(-1)}><ChevronUp size={18}/></button><button className="icon-button" aria-label={t("Следующее совпадение")} onClick={() => moveMatch(1)}><ChevronDown size={18}/></button><button className="icon-button" aria-label={t("Закрыть поиск")} onClick={() => { setSearchOpen(false); setQuery(''); }}><X size={18}/></button></div>}
      <div ref={scroll} className="document-scroll" tabIndex={0} data-testid="document-scroll" style={{ '--reading-font': settings.fontSize + 'px', '--column-width': settings.columnWidth + 'px', '--reader-family': fonts[settings.fontFamily], '--reader-line-height': settings.lineHeight, '--reader-paragraph-spacing': settings.paragraphSpacing + 'px' } as React.CSSProperties} onScroll={() => {
        if (!scroll.current || restoring.current) return;
        current.current = capture(scroll.current); setProgress(Math.round(current.current.fraction * 100));
        clearTimeout(timer.current); timer.current = setTimeout(() => { void flush().catch(e => notify(String(e))); }, 450);
      }}><div className="document-body">{doc.format === 'docx' ? <WordMarkdown content={doc.content} docId={doc.record.id} theme={settings.theme} paletteVersion={JSON.stringify(settings.customColors[settings.theme] || {})} query={query} onHeadings={setHeadings} onLink={onLink}/> : <Markdown content={doc.content} docId={doc.record.id} theme={settings.theme} paletteVersion={JSON.stringify(settings.customColors[settings.theme] || {})} query={query} onHeadings={setHeadings} onLink={onLink}/>}<LineSelection/></div><div className="document-end"><span>{t("Конец документа")}</span><button onClick={() => { pendingRestore.current = null; if (scroll.current) scroll.current.scrollTop = 0; }}>{t("Вернуться к началу")}</button></div></div>
    </section>
  </main>;
});
