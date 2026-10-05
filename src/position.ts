import type { Position } from './types';
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 4000);
export function blocks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('article h1, article h2, article h3, article h4, article h5, article h6, article p, article pre, article table, article li, article .mermaid-block'))
    .filter(el => !el.closest('[data-no-position]') && !(el.tagName === 'P' && el.closest('li, table, .mermaid-block')));
}
export function capture(container: HTMLElement): Position {
  const items = blocks(container), top = container.getBoundingClientRect().top + 24;
  let index = items.findIndex(el => el.getBoundingClientRect().bottom > top);
  if (index < 0) index = Math.max(0, items.length - 1);
  const el = items[index], rect = el?.getBoundingClientRect();
  const headingList = items.slice(0, index + 1).filter(item => /^H[1-6]$/.test(item.tagName));
  const heading = normalize(headingList.at(-1)?.textContent || '');
  const headingIndex = Math.max(0, headingList.filter(item => normalize(item.textContent || '') === heading).length - 1);
  return { text: normalize(el?.textContent || ''), before: normalize(items[index - 1]?.textContent || ''), after: normalize(items[index + 1]?.textContent || ''), heading, headingIndex,
    offset: rect ? Math.min(1, Math.max(0, (top - rect.top) / Math.max(1, rect.height))) : 0,
    fraction: Math.min(1, Math.max(0, container.scrollTop / Math.max(1, container.scrollHeight - container.clientHeight))) };
}
export function restore(container: HTMLElement, position: Position): boolean {
  if (position.fraction === 0) { container.scrollTop = 0; return false; }
  const items = blocks(container); let candidate: HTMLElement | undefined, score = -1, distance = Infinity, heading = '', headingIndex = 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    if (/^H[1-6]$/.test(items[i].tagName)) { heading = normalize(items[i].textContent || ''); headingIndex = counts.get(heading) || 0; counts.set(heading, headingIndex + 1); }
    if (normalize(items[i].textContent || '') !== position.text || !position.text) continue;
    const sameHeading = heading === position.heading;
    const match = Number(normalize(items[i - 1]?.textContent || '') === position.before) + Number(normalize(items[i + 1]?.textContent || '') === position.after) + (sameHeading ? 4 : 0) + (sameHeading && headingIndex === position.headingIndex ? 2 : 0);
    const fraction = (items[i].getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop) / Math.max(1, container.scrollHeight - container.clientHeight);
    const proximity = Math.abs(fraction - position.fraction);
    if (match > score || (match === score && proximity < distance)) { candidate = items[i]; score = match; distance = proximity; }
  }
  let approximate = false;
  if (!candidate && position.heading) {
    const headings = items.filter(el => /^H[1-6]$/.test(el.tagName) && normalize(el.textContent || '') === position.heading);
    candidate = headings[position.headingIndex] || headings[0]; approximate = true;
  }
  if (candidate) {
    const rect = candidate.getBoundingClientRect();
    container.scrollTop += rect.top - container.getBoundingClientRect().top - 24 + (approximate ? 0 : rect.height * position.offset);
  } else { container.scrollTop = position.fraction * Math.max(0, container.scrollHeight - container.clientHeight); approximate = true; }
  return approximate;
}
export function jumpTo(container: HTMLElement, id: string): boolean {
  const targets = Array.from(container.querySelectorAll<HTMLElement>('[id]'));
  const target = targets.find(el => el.id === id) || targets.find(el => el.id === 'user-content-' + id);
  if (!target) return false;
  container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top - 24;
  return true;
}
