import { CodeBlock } from './CodeBlock';
import { getLanguage } from './i18n';
import { t } from './i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import Slugger from 'github-slugger';
import type { Heading, Theme } from './types';
type AstNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: AstNode[] };
function plain(node: AstNode): string { return node.value || (node.children || []).map(plain).join(''); }
const schema = { ...defaultSchema, protocols: { ...defaultSchema.protocols, src: [...(defaultSchema.protocols?.src || []), 'data'] }, attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code || []), ['className', /^language-./, 'math-inline', 'math-display']], div: [...(defaultSchema.attributes?.div || []), ['className', 'math', 'math-display']], span: [...(defaultSchema.attributes?.span || []), ['className', 'math', 'math-inline']] } };
const safeImage = (src: string) => /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src) && src.length < 40 * 1024 * 1024;
function headingsPlugin(headings: Heading[]) {
  return () => (tree: AstNode) => {
    headings.length = 0; const slugger = new Slugger();
    function walk(node: AstNode) {
      if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
        const text = plain(node), id = slugger.slug(text); node.properties = { ...node.properties, id };
        headings.push({ id, text, depth: Number(node.tagName[1]) });
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}
function searchPlugin(query: string) {
  return () => (tree: AstNode) => {
    const needle = query.trim().toLocaleLowerCase(); if (!needle) return;
    let count = 0;
    function walk(node: AstNode) {
      if (!node.children || node.tagName === 'svg' || ((node.properties?.className as string[] | undefined) || []).some(name => name.startsWith('katex'))) return;
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text' || !child.value || count >= 2000) { walk(child); return [child]; }
        const result: AstNode[] = [], value = child.value, lower = value.toLocaleLowerCase(); let start = 0, index = lower.indexOf(needle);
        while (index >= 0 && count < 2000) {
          if (index > start) result.push({ type: 'text', value: value.slice(start, index) });
          result.push({ type: 'element', tagName: 'mark', properties: { className: ['search-match'] }, children: [{ type: 'text', value: value.slice(index, index + needle.length) }] });
          count++; start = index + needle.length; index = lower.indexOf(needle, start);
        }
        if (start < value.length) result.push({ type: 'text', value: value.slice(start) });
        return result;
      });
    }
    walk(tree);
  };
}
let mermaidSequence = 0;
let mermaidQueue: Promise<unknown> = Promise.resolve();
function Mermaid({ source, theme, paletteVersion }: { source: string; theme: Theme; paletteVersion?: string }) {
  const ref = useRef<HTMLDivElement>(null); const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false; setError('');
    mermaidQueue = mermaidQueue.then(async () => {
      const { default: mermaid } = await import('mermaid'); if (disposed) return;
      const style = getComputedStyle(ref.current!), color = (name: string) => style.getPropertyValue('--' + name).trim();
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme: 'base', themeVariables: {
        darkMode: ['dark', 'mono-dark'].includes(theme), background: color('bg'), primaryColor: color('accent-soft'), primaryTextColor: color('ink'), primaryBorderColor: color('accent'),
        secondaryColor: color('surface-alt'), tertiaryColor: color('surface'), textColor: color('ink'), lineColor: color('accent'),
      }, flowchart: { htmlLabels: false }, maxTextSize: 100000 });
      try { const { svg } = await mermaid.render('hawk-diagram-' + (++mermaidSequence), source); if (!disposed && ref.current) ref.current.innerHTML = svg; }
      catch { if (!disposed) setError(t('Не удалось построить диаграмму. Проверьте синтаксис Mermaid.')); }
    }).catch(() => { if (!disposed) setError(t('Не удалось загрузить диаграмму.')); });
    return () => { disposed = true; };
  }, [source, theme, paletteVersion]);
  return <div className="mermaid-block">{error ? <><div className="render-error">{error}</div><pre><code>{source}</code></pre></> : <div ref={ref} aria-label={t("Диаграмма Mermaid")} />}</div>;
}
function Image({ docId, src, alt, title }: { docId: string; src?: string; alt?: string; title?: string }) {
  const [resolved, setResolved] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true; setResolved(''); setFailed(false);
    if (!src) { setFailed(true); return; }
    if (src.startsWith('https://') || safeImage(src)) { setResolved(src); return; }
    window.hawk.image(docId, src).then(value => { if (alive) setResolved(value); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [docId, src]);
  return failed ? <span className="render-error">{t('Изображение недоступно: ')}{alt || src}</span> : resolved ? <img src={resolved} alt={alt || ''} title={title} loading="eager" onError={() => setFailed(true)} /> : <span className="image-loading">{t("Загрузка изображения…")}</span>;
}
export function Markdown({ content, docId, theme, paletteVersion, query, onHeadings, onLink }: { content: string; docId: string; theme: Theme; paletteVersion?: string; query: string; onHeadings: (items: Heading[]) => void; onLink: (reference: string) => void }) {
  const language = getLanguage();
  const result = useMemo(() => {
    const headings: Heading[] = [];
    const view = <ReactMarkdown urlTransform={(url, key) => key === 'src' && safeImage(url) ? url : defaultUrlTransform(url)} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], [rehypeKatex, { throwOnError: false, strict: false }], rehypeHighlight, headingsPlugin(headings), searchPlugin(query)]}
      components={{
        a: ({ href, children, ...props }) => <a {...props} href={href} onClick={event => { event.preventDefault(); if (href) onLink(href); }}>{children}</a>,
        img: ({ src, alt, title }) => <Image docId={docId} src={src} alt={alt} title={title} />,
        pre: ({ node, children }) => {
          const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code') as AstNode | undefined;
          return (code?.properties?.className as string[] | undefined)?.includes('language-mermaid') ? <Mermaid source={plain(code!)} theme={theme} paletteVersion={paletteVersion}/> : <CodeBlock text={code ? plain(code) : ''}>{children}</CodeBlock>;
        },
      }}>{content}</ReactMarkdown>;
    return { view, headings };
  }, [content, docId, theme, paletteVersion, language, query, onLink]);
  useEffect(() => { onHeadings([...result.headings]); }, [result, onHeadings]);
  return <article className="markdown">{result.view}</article>;
}
export function WordMarkdown(props: Parameters<typeof Markdown>[0]) {
  const [html, setHtml] = useState(''), [error, setError] = useState(false);
  useEffect(() => {
    let alive = true; setHtml(''); setError(false);
    void import('mammoth/mammoth.browser.js').then(async ({ default: mammoth }) => {
      const arrayBuffer = Uint8Array.from(atob(props.content), character => character.charCodeAt(0)).buffer;
      const result = await mammoth.convertToHtml({ arrayBuffer }, { externalFileAccess: false, includeEmbeddedStyleMap: false, convertImage: mammoth.images.imgElement(async image => {
        if (!/^image\/(png|jpeg|gif|webp)$/.test(image.contentType)) return { src: '' };
        return { src: 'data:' + image.contentType + ';base64,' + await image.readAsBase64String() };
      }) });
      if (alive) setHtml(result.value);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [props.content]);
  return error ? <p role="alert" className="render-error">{t('Не удалось прочитать Word DOCX.')}</p> : !html ? <p>{t('Загрузка Word…')}</p> : <Markdown {...props} content={html}/>;
}
