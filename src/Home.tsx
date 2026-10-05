import { t } from './i18n';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { getLanguage } from './i18n';
import { ArrowUpRight, BookOpen, FilePlus2, FileText, FolderOpen, Pin, Search, Trash2, TriangleAlert } from 'lucide-react';
import type { DocumentRecord, Settings } from './types';
export function HawkMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M7 15L30 23L22 35L7 15ZM57 15L34 23L42 35L57 15Z" fill="currentColor" opacity=".45"/><path d="M16 20L31 27L48 20L42 34L34 40L32 54L25 39L21 34L16 20Z" fill="currentColor"/><path d="M27 30L31 32L28 35L27 30ZM37 30L33 32L36 35L37 30Z" fill="var(--surface, #fff)"/></svg>;
}
function date(value: number) { return new Intl.DateTimeFormat(getLanguage(), { day: 'numeric', month: 'short' }).format(value); }
export function Home({ documents, settings, spaces, onOpen, onAdd, onPin, onRemove, onRelocate }: { documents: DocumentRecord[]; settings: Settings; spaces?: ReactNode; onOpen: (id: string) => void; onAdd: () => void; onPin: (id: string, value: boolean) => void; onRemove: (id: string) => void; onRelocate: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const filtered = documents.filter(doc => (doc.title + ' ' + doc.path).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pinned = filtered.filter(doc => doc.pinned), recent = filtered.filter(doc => !doc.pinned);
  const last = documents[0], progress = last?.position && settings.rememberPosition ? Math.round(last.position.fraction * 100) : 0;
  const section = (title: string, docs: DocumentRecord[]) => docs.length ? <section className="library-group"><h3>{title}<span>{docs.length}</span></h3>{docs.map(doc => <div className={'file-row ' + (doc.missing ? 'missing' : '')} key={doc.id}>
    <button className="file-open" onClick={() => doc.missing ? onRelocate(doc.id) : onOpen(doc.id)} title={doc.path}><FileText size={22} /><span><strong>{doc.title}</strong><small>{doc.missing ? t('Файл не найден') : doc.path}</small></span></button>
    <div className="file-actions"><span className="file-date">{date(doc.lastOpened)}</span><button className={'icon-button ' + (doc.pinned ? 'pinned' : '')} aria-label={doc.pinned ? t('Открепить ') + doc.title : t('Закрепить ') + doc.title} onClick={() => onPin(doc.id, !doc.pinned)}><Pin size={15} /></button><button className="icon-button" aria-label={t('Убрать из истории ') + doc.title} onClick={() => onRemove(doc.id)}><Trash2 size={15} /></button></div>
    {doc.missing && <button className="relocate-button" onClick={() => onRelocate(doc.id)}>{t("Указать новое расположение")}</button>}
  </div>)}</section> : null;
  return <main className="home"><aside className="library">
    <div className="library-heading"><h2>{t("Мои документы")}</h2><button className="icon-button" title={t("Открыть файл")} aria-label={t("Добавить документ")} onClick={onAdd}><FilePlus2 size={21} /></button></div>
    <label className="search-field"><Search size={17} /><input aria-label={t("Поиск документов")} placeholder={t("Найти документ")} value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="library-scroll">{spaces}{section(t('Закреплённые'), pinned)}{section(t('Недавние'), recent)}{!filtered.length && <div className="library-empty"><FileText size={30} /><p>{query ? t('Ничего не найдено') : t('Здесь будут ваши документы')}</p><small>{query ? t('Попробуйте другое название.') : t('Откройте первый документ.')}</small></div>}</div>
    <button className="library-add" onClick={onAdd}><FolderOpen size={18} />{t("Открыть файл")}<span>Ctrl / ⌘ O</span></button>
  </aside><section className="home-main"><div className="welcome-heading"><div><h1>{last ? t('Продолжим читать?') : t('Место для ваших мыслей.')}</h1><p>{last ? t('Ваши документы и сохранённые места — всегда под рукой.') : t('Откройте документ и сосредоточьтесь на содержании.')}</p></div><HawkMark className="welcome-hawk" /></div>
    {last ? <section className="continue-card"><div className="continue-meta"><span><BookOpen size={18} />{t("Последний документ")}</span><time>{date(last.lastOpened)}</time></div>
      <h2>{last.title.replace(/\.(md|markdown|mdown)$/i, '')}</h2><p className="continue-path" title={last.path}>{last.path}</p>
      <div className="paper-preview"><FileText size={25} /><p>{last.preview || t('Откройте документ, чтобы начать чтение.')}</p><div className="paper-lines"><i/><i/><i/></div></div>
      {last.missing ? <div className="missing-note"><TriangleAlert size={18}/>{t("Документ перемещён или удалён. Укажите его новое расположение.")}</div> : <div className="continue-progress"><div><span>{last.position && settings.rememberPosition ? t('Сохранённое место') : t('Готов к чтению')}</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: progress + '%' }} /></div></div>}
      <footer><span>{last.bookmarks.length ? t('Закладок: ') + last.bookmarks.length : t('Можно добавить закладки во время чтения')}</span><button className="primary" onClick={() => last.missing ? onRelocate(last.id) : onOpen(last.id)}>{last.missing ? t('Указать расположение') : last.position && settings.rememberPosition ? t('Продолжить чтение') : t('Открыть документ')}<ArrowUpRight size={18}/></button></footer>
    </section> : <section className="start-card"><div className="start-illustration"><HawkMark /><span>.md</span></div><h2>{t("Первый документ — начало библиотеки")}</h2><p>{t("История открытий, любимые файлы и закладки.")}<br/>{t("Всё хранится на вашем компьютере.")}</p><button className="primary" onClick={onAdd}><FolderOpen size={19}/>{t("Открыть Markdown-файл")}</button></section>}
    <div className="home-footnote"><span><Pin size={16}/>{t("Закрепляйте важное")}</span><span><BookOpen size={16}/>{t("Возвращайтесь к прочитанному")}</span><span>{t("Или перетащите файл в окно")}</span></div>
  </section></main>;
}
