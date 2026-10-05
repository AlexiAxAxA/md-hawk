import { themeStyle } from './preferences';
import { t, setLanguage } from './i18n';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FilePlus2, Home as HomeIcon, Settings2, X, AlertCircle, Upload } from 'lucide-react';
import type { DocumentData, Position, Settings, State } from './types';
import { Home, HawkMark } from './Home';
import { Reader, type Navigation, type ReaderHandle } from './Reader';
import { SettingsPanel } from './Settings';
import { Spaces } from './Spaces';
const PdfReader = lazy(() => import('./PdfReader'));
export function App() {
  const [state, setState] = useState<State | null>(null), [tabs, setTabs] = useState<DocumentData[]>([]), [activeId, setActiveId] = useState<string | null>(null), [home, setHome] = useState(true), [settingsOpen, setSettingsOpen] = useState(false), [message, setMessage] = useState(''), [dragging, setDragging] = useState(false), [navigation, setNavigation] = useState<Navigation>();
  const reader = useRef<ReaderHandle>(null), sessionPositions = useRef(new Map<string, Position>()), activeRef = useRef(activeId), noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), serial = useRef(0), settingsQueue = useRef<Promise<unknown>>(Promise.resolve());
  activeRef.current = activeId;
  const notify = useCallback((text: string) => { setMessage(text.replace(/^Error: (Error invoking remote method '[^']+': Error: )?/, '')); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setMessage(''), 6500); }, []);
  const refresh = useCallback(async () => {
    const next = await window.hawk.state(); setLanguage(next.settings.language); setState(next);
    setTabs(previous => previous.map(doc => { const record = next.documents.find(item => item.id === doc.record.id); return record ? { ...doc, record } : doc; }));
  }, []);
  const saveCurrent = useCallback(async () => {
    const position = reader.current?.position(); if (position && activeRef.current) sessionPositions.current.set(activeRef.current, position);
    await reader.current?.flush();
  }, []);
  const showDoc = useCallback(async (doc: DocumentData) => {
    try { await saveCurrent(); setTabs(previous => { const existing = previous.find(item => item.record.id === doc.record.id); return existing ? previous.map(item => item.record.id === doc.record.id ? doc : item) : [...previous, doc]; });
      setActiveId(doc.record.id); setHome(false); setNavigation({ serial: ++serial.current, fragment: doc.fragment }); await refresh();
    } catch (error) { notify(String(error)); }
  }, [saveCurrent, refresh, notify]);
  useEffect(() => {
    const offOpen = window.hawk.onOpen(doc => { void showDoc(doc); }), offError = window.hawk.onError(notify), offFlush = window.hawk.onFlush(() => { void settingsQueue.current.then(saveCurrent).then(() => window.hawk.flushed()).catch(e => notify(String(e))); });
    void refresh().then(() => window.hawk.ready()).catch(e => notify(String(e)));
    return () => { offOpen(); offError(); offFlush(); };
  }, [refresh, showDoc, notify, saveCurrent]);
  const open = useCallback(async (id?: string) => {
    try { const docs = id ? [await window.hawk.openId(id)] : await window.hawk.openDialog(); for (const doc of docs) await showDoc(doc); }
    catch (error) { notify(t('Не удалось открыть документ. ') + String(error)); await refresh(); }
  }, [showDoc, notify, refresh]);
  const selectTab = useCallback(async (id: string) => { try { await saveCurrent(); setActiveId(id); setHome(false); setNavigation(undefined); } catch (e) { notify(String(e)); } }, [saveCurrent, notify]);
  const closeTab = useCallback(async (id: string) => {
    try { if (activeRef.current === id && !home) await saveCurrent();
      sessionPositions.current.delete(id); const remaining = tabs.filter(doc => doc.record.id !== id); setTabs(remaining);
      if (activeRef.current === id) { setActiveId(remaining.at(-1)?.record.id || null); setHome(home || !remaining.length); setNavigation(undefined); }
      await refresh();
    } catch (e) { notify(String(e)); }
  }, [tabs, home, saveCurrent, refresh, notify]);
  const goHome = useCallback(async () => { try { await saveCurrent(); setHome(true); await refresh(); } catch (e) { notify(String(e)); } }, [saveCurrent, refresh, notify]);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const position = reader.current?.position(); if (position && activeRef.current) sessionPositions.current.set(activeRef.current, position);
    // Start flushing before React applies the new rememberPosition value.
    const flushed = saveCurrent();
    if (patch.language) setLanguage(patch.language);
    setState(previous => previous ? { ...previous, settings: { ...previous.settings, ...patch } } : previous);
    if (position) setNavigation({ serial: ++serial.current, position });
    settingsQueue.current = settingsQueue.current.catch(() => {}).then(async () => { await flushed; await window.hawk.settings(patch); });
    void settingsQueue.current.catch(async e => { notify(String(e)); await refresh(); });
  }, [saveCurrent, notify, refresh]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettingsOpen(false); tabDrag.current = null; setTabPreview(null); return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); void open(); }
      if (!home && event.key.toLowerCase() === 'f') { event.preventDefault(); reader.current?.search(); }
      if (!home && event.key.toLowerCase() === 'd') { event.preventDefault(); reader.current?.addBookmark(); }
      if (!home && event.key.toLowerCase() === 'w' && activeId) { event.preventDefault(); void closeTab(activeId); }
      if (event.key === ',') { event.preventDefault(); setSettingsOpen(true); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [open, home, activeId, closeTab]);
  const relative = useCallback((reference: string) => {
    if (!activeRef.current) return;
    void window.hawk.openRelative(activeRef.current, reference).then(showDoc).catch(e => notify(t('Не удалось открыть ссылку. ') + String(e)));
  }, [showDoc, notify]);
  const tabDrag = useRef<{ id: string; startX: number; left: number; width: number; index: number } | null>(null);
  const suppressTabClick = useRef(false);
  const [tabPreview, setTabPreview] = useState<{ id: string; startX: number; left: number; width: number; offset: number; insertion: number; marker: number } | null>(null);
  const clearTabDrag = () => { tabDrag.current = null; setTabPreview(null); };

  const moveTab = (id: string, target: number) => setTabs(previous => {
    const from = previous.findIndex(doc => doc.record.id === id); if (from < 0 || target < 0 || target >= previous.length || from === target) return previous;
    const next = [...previous], [doc] = next.splice(from, 1); next.splice(target, 0, doc); return next;
  });
  if (!state) return <div className="loading"><HawkMark/><p>{t("Открываем библиотеку…")}</p>{message && <p>{message}</p>}</div>;
  const active = tabs.find(doc => doc.record.id === activeId);
  return <div className="app" data-theme={state.settings.theme} data-custom-theme={Object.keys(state.settings.customColors[state.settings.theme] || {}).length ? 'true' : undefined} style={themeStyle(state.settings)} onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => {
    event.preventDefault(); setDragging(false); const files = Array.from(event.dataTransfer.files);
    if (files.length) void window.hawk.drop(files).then(async docs => { for (const doc of docs) await showDoc(doc); }).catch(e => notify(String(e)));
  }}>
    <header className="app-header"><button className="brand" onClick={() => void goHome()} aria-label={t("MD Hawk — домашний экран")}><HawkMark/><span>MD <strong>Hawk</strong></span></button><button className="icon-button settings-button" aria-label={t("Настройки")} onClick={() => setSettingsOpen(true)}><Settings2 size={21}/></button></header>
    <nav className="tab-bar" aria-label={t("Открытые документы")}><button className={'home-tab ' + (home ? 'active' : '')} onClick={() => void goHome()}><HomeIcon size={17}/><span>{t("Библиотека")}</span></button><div className="document-tabs" onPointerDown={event => {
      if (event.button !== 0 || (event.target as Element).closest('.tab-close')) return;
      const element = (event.target as Element).closest<HTMLElement>('.document-tab'); if (!element) return;
      const index = Number(element.dataset.index), rect = element.getBoundingClientRect();
      suppressTabClick.current = false;
      tabDrag.current = { id: tabs[index].record.id, startX: event.clientX, left: rect.left, width: rect.width, index };
    }} onPointerMove={event => {
      const drag = tabDrag.current; if (!drag || (!tabPreview && Math.abs(event.clientX - drag.startX) < 5)) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); suppressTabClick.current = true;
      const row = event.currentTarget, elements = Array.from(row.querySelectorAll<HTMLElement>('.document-tab')), bounds = row.getBoundingClientRect();
      let insertion = tabs.length;
      for (let index = 0; index < elements.length; index++) {
        if (tabs[index].record.id === drag.id) continue;
        const rect = elements[index].getBoundingClientRect();
        if (event.clientX < rect.left + rect.width / 2) { insertion = index; break; }
      }
      const marker = insertion < elements.length ? elements[insertion].offsetLeft : (elements.at(-1)?.offsetLeft || 0) + (elements.at(-1)?.offsetWidth || 0);
      const offset = Math.max(bounds.left - drag.left, Math.min(bounds.right - drag.left - drag.width, event.clientX - drag.startX));
      setTabPreview({ ...drag, offset, insertion, marker });
    }} onPointerUp={event => {
      if (tabPreview) { const from = tabs.findIndex(doc => doc.record.id === tabPreview.id); moveTab(tabPreview.id, tabPreview.insertion > from ? tabPreview.insertion - 1 : tabPreview.insertion); }
      clearTabDrag(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }} onPointerCancel={clearTabDrag} onLostPointerCapture={clearTabDrag} onPointerLeave={() => { if (!tabPreview) tabDrag.current = null; }}>{tabs.map((doc, index) => <div key={doc.record.id} className={'document-tab ' + (!home && activeId === doc.record.id ? 'active ' : '') + (tabPreview?.id === doc.record.id ? 'tab-dragging' : '')} style={tabPreview?.id === doc.record.id ? { transform: `translateX(${tabPreview.offset}px)` } : undefined} data-index={index}><button className="tab-select" onClick={() => { if (suppressTabClick.current) { suppressTabClick.current = false; return; } void selectTab(doc.record.id); }} title={doc.record.path} aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" onKeyDown={event => { if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); moveTab(doc.record.id, index + (event.key === 'ArrowLeft' ? -1 : 1)); } }}>{doc.record.title}</button><button className="tab-close" aria-label={t('Закрыть вкладку ') + doc.record.title} onClick={() => void closeTab(doc.record.id)}><X size={14}/></button></div>)}{tabPreview && tabPreview.insertion >= 0 && <span className="tab-insertion-marker" data-testid="tab-insertion-marker" aria-hidden="true" style={{ left: Math.max(2, tabPreview.marker - 2) }}/>}</div><button className="icon-button new-tab" aria-label={t("Открыть файл")} onClick={() => void open()}><FilePlus2 size={19}/></button></nav>
    {state.warning && <div className="storage-warning" role="alert"><AlertCircle size={18}/><span>{t(state.warning)}</span>{state.blocked && <button onClick={() => { void window.hawk.reset().then(refresh).catch(e => notify(String(e))); }}>{t("Архивировать и создать новую историю")}</button>}</div>}
    {home || !active ? <Home documents={state.documents} settings={state.settings} spaces={<Spaces spaces={state.spaces} documents={state.documents} openIds={tabs.map(doc => doc.record.id)} onRefresh={refresh} onOpen={ids => { void (async () => { for (const id of ids) await open(id); })(); }} notify={notify}/>} onOpen={id => void open(id)} onAdd={() => void open()} onPin={(id, value) => { void window.hawk.pin(id, value).then(refresh).catch(e => notify(String(e))); }} onRemove={id => { void (async () => { await closeTab(id); await window.hawk.remove(id); await refresh(); })().catch(e => notify(String(e))); }} onRelocate={id => { void window.hawk.relocate(id).then(async doc => { if (doc) { setTabs(previous => previous.filter(item => item.record.id !== doc.record.id && item.record.path !== doc.record.path)); await showDoc(doc); } }).catch(e => notify(String(e))); }} /> : active.format === 'pdf' ? <Suspense fallback={<div className="loading">{t('Загрузка PDF…')}</div>}><PdfReader ref={reader} key={active.record.id} doc={active} settings={state.settings} initialPosition={sessionPositions.current.get(active.record.id) || (state.settings.rememberPosition ? active.record.position : null)} navigation={navigation} onRefresh={refresh} notify={notify}/></Suspense> : <Reader ref={reader} key={active.record.id} doc={active} settings={state.settings} initialPosition={sessionPositions.current.get(active.record.id) || (state.settings.rememberPosition ? active.record.position : null)} navigation={navigation} onRefresh={refresh} onRelative={relative} notify={notify}/>}
    {settingsOpen && <SettingsPanel settings={state.settings} onChange={patch => void updateSettings(patch)} onClose={() => setSettingsOpen(false)}/>}
    {message && <div className="toast" role="status"><AlertCircle size={17}/><span>{t(message)}</span><button className="icon-button" aria-label={t("Закрыть сообщение")} onClick={() => setMessage('')}><X size={15}/></button></div>}
    {dragging && <div className="drop-overlay"><Upload size={40}/><h2>{t("Откройте документ здесь")}</h2><p>{t("Markdown-файлы добавятся в библиотеку")}</p></div>}
  </div>;
}
