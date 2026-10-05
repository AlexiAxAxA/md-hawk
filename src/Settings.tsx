import { languages, defaultSettings, palette, paletteKeys, paletteLabels } from './preferences';
import { t } from './i18n';
import { X, Check } from 'lucide-react';
import type { Settings, Theme } from './types';
export const themes: { id: Theme; name: string; colors: string[] }[] = [
  { id: 'light', name: ('Светлая'), colors: ['#f3f5f8', '#ffffff', '#376a85'] },
  { id: 'dark', name: ('Тёмная'), colors: ['#202832', '#293440', '#a0cada'] },
  { id: 'mono-light', name: ('Чёрно-белая'), colors: ['#eeeeee', '#ffffff', '#111111'] },
  { id: 'mono-dark', name: ('Белое на чёрном'), colors: ['#000000', '#171717', '#ffffff'] },
  { id: 'sepia', name: ('Сепия'), colors: ['#e9dfcc', '#f6edda', '#79552d'] },
  { id: 'blue', name: ('Синяя'), colors: ['#e5eefb', '#f6f9ff', '#2852a3'] },
];
export function SettingsPanel({ settings, onChange, onClose }: { settings: Settings; onChange: (patch: Partial<Settings>) => void; onClose: () => void }) {
  return <div className="modal-shade" onClick={onClose}><section className="settings-dialog" role="dialog" aria-modal="true" aria-label={t("Настройки чтения")} onClick={e => e.stopPropagation()}>
    <header><h2>{t("Настройки чтения")}</h2><button className="icon-button" aria-label={t("Закрыть настройки")} onClick={onClose}><X size={20} /></button></header>
    <p className="muted">{t("Устройте себе удобное место для чтения.")}</p>
    <label className="language-setting"><span>{t('Язык интерфейса')}</span><select aria-label={t('Язык интерфейса')} value={settings.language} onChange={event => onChange({ language: event.target.value as Settings['language'] })}>{languages.map(language => <option key={language.id} value={language.id}>{language.name}</option>)}</select></label>
    <h3>{t("Оформление")}</h3><div className="theme-grid">{themes.map(theme => <button key={theme.id} className={'theme-option ' + (settings.theme === theme.id ? 'selected' : '')} onClick={() => onChange({ theme: theme.id })} aria-pressed={settings.theme === theme.id}>
      <span className="swatches">{theme.colors.map(color => <i key={color} style={{ background: color }} />)}{settings.theme === theme.id && <Check size={15} />}</span><span>{t(theme.name)}</span>
    </button>)}</div>
    <label className="range-setting"><span>{t("Размер текста")}<strong>{settings.fontSize} px</strong></span><input aria-label={t("Размер текста")} type="range" min="8" max="40" value={settings.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} /></label>
    <label className="range-setting"><span>{t("Ширина колонки")}<strong>{settings.columnWidth} px</strong></span><input aria-label={t("Ширина колонки")} type="range" min="560" max="1100" step="20" value={settings.columnWidth} onChange={e => onChange({ columnWidth: Number(e.target.value) })} /></label>
    <details className="advanced-settings"><summary>{t('Дополнительное оформление')}</summary>
      <label className="language-setting"><span>{t('Шрифт документа')}</span><select aria-label={t('Шрифт документа')} value={settings.fontFamily} onChange={event => onChange({ fontFamily: event.target.value as Settings['fontFamily'] })}><option value="serif">{t('С засечками')}</option><option value="sans">{t('Без засечек')}</option><option value="mono">{t('Моноширинный')}</option></select></label>
      <label className="range-setting"><span>{t('Межстрочный интервал')}<strong>{settings.lineHeight}</strong></span><input aria-label={t('Межстрочный интервал')} type="range" min="1.2" max="2.4" step="0.05" value={settings.lineHeight} onChange={event => onChange({ lineHeight: Number(event.target.value) })}/></label>
      <label className="range-setting"><span>{t('Отступ между абзацами')}<strong>{settings.paragraphSpacing} px</strong></span><input aria-label={t('Отступ между абзацами')} type="range" min="0" max="40" value={settings.paragraphSpacing} onChange={event => onChange({ paragraphSpacing: Number(event.target.value) })}/></label>
      <h3>{t('Цвета выбранной темы')}</h3><div className="palette-grid">{paletteKeys.map(key => <label key={key}><span>{t(paletteLabels[key])}</span><input type="color" aria-label={t(paletteLabels[key])} value={palette(settings)[key as keyof ReturnType<typeof palette>]} onChange={event => onChange({ customColors: { ...settings.customColors, [settings.theme]: { ...settings.customColors[settings.theme], [key]: event.target.value } } })}/></label>)}</div>
      <button className="reset-settings" onClick={() => { const next = { ...settings.customColors }; delete next[settings.theme]; onChange({ customColors: next }); }}>{t('Вернуть цвета этой темы')}</button>
    </details>
    <button className="reset-settings" onClick={() => onChange({ ...structuredClone(defaultSettings), language: settings.language })}>{t('Сбросить настройки чтения')}</button>
    <label className="toggle-setting"><span><strong>{t("Запоминать место чтения")}</strong><small>{t("Открывать документы там, где вы остановились.")}<br />{t("Ручные закладки доступны в любом режиме.")}</small></span><input aria-label={t("Запоминать место чтения")} type="checkbox" checked={settings.rememberPosition} onChange={e => onChange({ rememberPosition: e.target.checked })} /></label>
  </section></div>;
}
