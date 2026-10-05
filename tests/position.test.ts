import { describe, it, expect } from 'vitest';
import { capture, restore, jumpTo } from '../src/position';
function fixture() {
  const root = document.createElement('div'); root.innerHTML = '<article><h1 id="heading">Глава</h1><p>Первый блок</p><p>Повтор</p><p>Контекст</p><p>Повтор</p><p>Конец</p></article>';
  Object.defineProperty(root, 'scrollHeight', { value: 1200 }); Object.defineProperty(root, 'clientHeight', { value: 400 });
  root.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
  [...root.querySelectorAll<HTMLElement>('h1,p')].forEach((el, i) => { el.getBoundingClientRect = () => ({ top: i * 100 - root.scrollTop, bottom: i * 100 + 100 - root.scrollTop, height: 100 } as DOMRect); });
  return root;
}
describe('reading anchors', () => {
  it('keeps the document at absolute start instead of clipping its top margin', () => {
    const root = fixture(); root.querySelector<HTMLElement>('h1')!.getBoundingClientRect = () => ({ top: 43, bottom: 143, height: 100 } as DOMRect);
    const position = capture(root); restore(root, position); expect(root.scrollTop).toBe(0);
  });
  it('restores the contextual occurrence of duplicate text', () => {
    const root = fixture(); root.scrollTop = 401; const pos = capture(root); root.scrollTop = 0;
    expect(pos.text).toBe('Повтор'); expect(pos.before).toBe('Контекст'); expect(restore(root, pos)).toBe(false); expect(root.scrollTop).toBe(401);
  });
  it('disambiguates identical paragraphs under different headings', () => {
    const root = fixture(); root.innerHTML = '<article><h1>Часть первая</h1><p>Один текст</p><p>Один текст</p><p>Один текст</p><h1>Часть вторая</h1><p>Один текст</p><p>Один текст</p><p>Один текст</p></article>';
    [...root.querySelectorAll<HTMLElement>('h1,p')].forEach((el, i) => { el.getBoundingClientRect = () => ({ top: i * 100 - root.scrollTop, bottom: i * 100 + 100 - root.scrollTop, height: 100 } as DOMRect); });
    root.scrollTop = 601; const position = capture(root); root.scrollTop = 0; restore(root, position); expect(root.scrollTop).toBe(601);
  });
  it('falls back to heading when the text was edited', () => {
    const root = fixture(); root.scrollTop = 201; const pos = capture(root); pos.text = 'Удалено'; root.scrollTop = 0;
    expect(restore(root, pos)).toBe(true); expect(root.scrollTop).toBe(-24);
  });
  it('falls back to document progress when no anchor survives', () => {
    const root = fixture(); expect(restore(root, { text: 'gone', before: '', after: '', heading: 'gone', headingIndex: 0, offset: 0, fraction: .5 })).toBe(true); expect(root.scrollTop).toBe(400);
  });
  it('jumps to an existing id without CSS selector interpolation', () => { const root = fixture(); expect(jumpTo(root, 'heading')).toBe(true); expect(jumpTo(root, 'no-such-anchor')).toBe(false); });
});
