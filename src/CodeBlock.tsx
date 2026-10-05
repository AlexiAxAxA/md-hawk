import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from './i18n';
export function CodeBlock({ text, children }: { text: string; children: ReactNode }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try { await window.hawk.copyText(text); setStatus('copied'); }
    catch { setStatus('error'); }
    clearTimeout(timer.current); timer.current = setTimeout(() => setStatus('idle'), 2500);
  };
  return <div className="code-block"><button className="code-copy" aria-label={t('Копировать код')} disabled={!text} onClick={() => void copy()}>{t(status === 'copied' ? 'Скопировано' : status === 'error' ? 'Ошибка копирования' : 'Копировать код')}</button><pre>{children}</pre><span className="sr-only" role="status">{status !== 'idle' && t(status === 'copied' ? 'Скопировано' : 'Ошибка копирования')}</span></div>;
}
