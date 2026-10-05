import { useRef } from 'react';
import { t } from './i18n';
type CaretDocument = Document & { caretRangeFromPoint(x: number, y: number): Range | null };
// Electron's Chromium supplies caretRangeFromPoint and Selection.modify for visual lines.
function lineAt(article: HTMLElement, y: number): Range | null {
  const rect = article.getBoundingClientRect(), caret = (document as CaretDocument).caretRangeFromPoint(rect.right - 2, y);
  if (!caret || !article.contains(caret.startContainer)) return null;
  const selection = window.getSelection(); if (!selection) return null;
  selection.removeAllRanges(); selection.addRange(caret);
  selection.modify('move', 'backward', 'lineboundary'); selection.modify('extend', 'forward', 'lineboundary');
  return selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
}
export function LineSelection() {
  const anchor = useRef<Range | null>(null);
  const select = (element: HTMLElement, y: number) => {
    const article = element.parentElement?.querySelector<HTMLElement>('article'); if (!article) return;
    const line = lineAt(article, y); if (!line) return;
    if (!anchor.current) anchor.current = line.cloneRange();
    const range = anchor.current.cloneRange();
    if (line.compareBoundaryPoints(Range.START_TO_START, range) < 0) range.setStart(line.startContainer, line.startOffset);
    if (line.compareBoundaryPoints(Range.END_TO_END, range) > 0) range.setEnd(line.endContainer, line.endOffset);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  };
  return <div className="line-selection-gutter" data-testid="line-selection-gutter" aria-hidden="true" title={t('Щёлкните для выделения строки, протяните для нескольких строк')} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); anchor.current = null; event.currentTarget.setPointerCapture(event.pointerId); select(event.currentTarget, event.clientY); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { event.preventDefault(); select(event.currentTarget, event.clientY); } }} onPointerUp={event => { anchor.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { anchor.current = null; }}/>
}
