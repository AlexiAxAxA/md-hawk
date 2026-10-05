import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const root = path.resolve('.'), verification = path.join(root, '.verification'), screenshots = path.join(verification, 'screenshots');
process.env.electron_config_cache = path.join(verification, 'electron-cache');
fs.mkdirSync(screenshots, { recursive: true });
function fixture(name: string) {
  const dir = path.join(verification, name); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'Путеводитель по Markdown.md'), next = path.join(dir, 'Вторая глава.md');
  fs.writeFileSync(next, '# Вторая глава\n\n## Цель\n\nСсылка открыла нужный документ.\n\n' + 'Дополнительный текст.\n\n'.repeat(30));
  fs.writeFileSync(path.join(dir, 'image.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="80"><rect width="480" height="80" rx="12" fill="#376a85"/><text x="30" y="48" font-size="22" fill="white">MD Hawk — local image</text></svg>');
  const content = '# Путеводитель по Markdown\n\nСпокойное пространство для чтения, заметок и возвращения к важному.\n\n[Перейти к разделу](#раздел-12) · [Следующий документ](Вторая%20глава.md#цель) · [Внешняя ссылка](https://example.org)\n\n## Возможности\n\n- История документов\n- Закладки и оглавление\n- [x] Локальное хранение\n- [ ] Новые открытия\n\n> Сосредоточьтесь на содержании. MD Hawk запомнит место, где вы остановились.\n\n| Элемент | Поддержка |\n|---|---|\n| Формулы | KaTeX |\n| Диаграммы | Mermaid |\n\n```typescript\nconst reader = { name: "MD Hawk", remember: true };\n```\n\nФормула: $E = mc^2$.\n\n$$\\int_0^1 x^2 dx = \\frac{1}{3}$$\n\n```mermaid\nflowchart LR\n  A[Открыть] --> B[Читать]\n  B --> C[Продолжить]\n```\n\n![Локальная картинка](image.svg)\n\nТекст со сноской[^1].\n\n[^1]: Проверенная сноска.\n\n## Повтор\n\nПервое повторение.\n\n## Повтор\n\nВторое повторение.\n\n<script>window.__injected = true</script>\n\n<img src="image.svg" onerror="window.__injected = true">\n\n[Опасная ссылка](javascript:alert(1))\n\n';
  fs.writeFileSync(file, content + Array.from({ length: 30 }, (_, i) => `## Раздел ${i + 1}\n\nТекст главы ${i + 1}. Здесь можно остановиться и поставить закладку.\n\n` + 'Чтение помогает замечать детали и находить связи между идеями. Сохранённая позиция позволяет вернуться к нужному абзацу.\n\n'.repeat(4)).join(''));
  return { dir, file, next, data: path.join(dir, 'profile'), content: fs.readFileSync(file, 'utf8') };
}
async function launch(data: string, files: string[] = [], installed = false) {
  const env = { ...process.env, MD_HAWK_USER_DATA: data, MD_HAWK_TEST_HIDE: '1' }; delete (env as NodeJS.ProcessEnv).ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.MD_HAWK_TEST_EXECUTABLE || require('electron');
  const app = await electron.launch({ executablePath, args: installed || process.env.MD_HAWK_TEST_EXECUTABLE ? files : [root, ...files], env });
  try { const page = await app.firstWindow(); await page.getByRole('button', { name: /MD Hawk — (домашний экран|home)/ }).waitFor(); return { app, page }; }
  catch (error) { await close(app); throw error; }
}
async function openDialog(app: ElectronApplication, page: Page, file: string) {
  await app.evaluate(({ dialog }, value) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [value] }); }, file);
  await page.locator('.new-tab').click();
  await expect(page.locator('article h1')).toBeVisible();
}
async function close(app: ElectronApplication) {
  if (app.process().exitCode !== null) return;
  const closed = app.waitForEvent('close');
  // Exercise the real window-close/renderer-flush path, keeping the debugger attached until exit.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.close())).catch(() => {});
  await closed;
}
async function state(page: Page) { return page.evaluate(() => window.hawk.state()); }
async function screenshot(app: ElectronApplication, name: string) {
  const page = await app.firstWindow(); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const data = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toDataURL());
  fs.writeFileSync(path.join(screenshots, name), Buffer.from(data.split(',')[1], 'base64'));
}
async function scrollTo(page: Page, fraction: number) {
  await page.getByTestId('document-scroll').hover(); await page.mouse.wheel(0, 2);
  await page.getByTestId('document-scroll').evaluate((element, value) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * value; }, fraction);
  await expect.poll(async () => (await state(page)).documents[0].position?.fraction || 0).toBeGreaterThan(fraction - .03);
}
test('Markdown rendering, links, search, duplicate headings and isolation', async () => {
  const f = fixture('render-' + Date.now()); const { app, page } = await launch(f.data, [f.file]); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await expect(page.locator('article h1')).toHaveText('Путеводитель по Markdown');
    await expect(page.locator('article table')).toHaveCount(1); await expect(page.locator('article .katex')).toHaveCount(2);
    await expect(page.locator('.mermaid-block svg')).toHaveCount(1); await expect(page.locator('article img').first()).toHaveJSProperty('naturalWidth', 480);
    await expect(page.locator('article #повтор')).toHaveCount(1); await expect(page.locator('article #повтор-1')).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { __injected?: boolean }).__injected)).toBeUndefined();
    expect(await page.locator('article script, article [onerror]').count()).toBe(0);
    expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
    await screenshot(app, 'reader-light.png');
    await page.locator('article a[data-footnote-ref]').click(); await expect.poll(() => page.getByTestId('document-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(3000);
    await page.locator('article a[data-footnote-backref]').click();
    await page.getByRole('link', { name: 'Перейти к разделу' }).click(); await expect.poll(() => page.getByTestId('document-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(2000);
    await page.keyboard.press('Control+f'); await page.getByRole('textbox', { name: 'Найти в документе' }).fill('связи'); await expect(page.locator('mark.search-match')).toHaveCount(120);
    await page.getByRole('button', { name: 'Следующее совпадение' }).click(); await page.getByRole('button', { name: 'Закрыть поиск' }).click(); await expect(page.locator('mark.search-match')).toHaveCount(0);
    await page.locator('article').getByRole('link', { name: 'Следующий документ' }).click(); await expect(page.locator('article h1')).toHaveText('Вторая глава'); await expect(page.locator('.document-tab')).toHaveCount(2);
    expect(errors).toEqual([]); expect(fs.readFileSync(f.file, 'utf8')).toBe(f.content);
  } finally { await close(app); }
});
test('positions, bookmarks, themes and pins persist; normal launch shows home', async () => {
  const f = fixture('persist-' + Date.now()); let { app, page } = await launch(f.data, [f.file]);
  try {
    await expect(page.locator('article h1')).toBeVisible(); await expect(page.locator('.mermaid-block svg')).toHaveCount(1);
    await scrollTo(page, .45); await page.keyboard.press('Control+d'); await expect(page.locator('.bookmark-row')).toHaveCount(1);
    await page.getByRole('button', { name: /Переименовать закладку/ }).click(); await page.getByRole('textbox', { name: 'Название закладки' }).fill('Вернуться к этому месту'); await page.getByTitle('Сохранить название').click();
    await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Тёмная', exact: true }).click(); await expect(page.locator('.app')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('slider', { name: 'Размер текста' }).fill('23'); await page.getByRole('slider', { name: 'Ширина колонки' }).fill('900'); await page.getByRole('button', { name: 'Закрыть настройки' }).click();
    await expect.poll(async () => (await state(page)).settings.fontSize).toBe(23);
    const before = (await state(page)).documents[0].position!;
    await page.getByRole('button', { name: 'MD Hawk — домашний экран' }).click(); await page.getByRole('button', { name: /Закрепить Путеводитель/ }).click(); await expect(page.getByRole('heading', { name: 'Закреплённые' })).toBeVisible();
    await screenshot(app, 'home-dark.png');
    await close(app); ({ app, page } = await launch(f.data));
    await expect(page.getByRole('heading', { name: 'Продолжим читать?' })).toBeVisible(); expect(await page.locator('article').count()).toBe(0); await expect(page.locator('.app')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Продолжить чтение', exact: true }).click();
    await expect.poll(() => page.getByTestId('document-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(2000);
    await page.getByRole('button', { name: 'Закладки', exact: false }).click(); await expect(page.getByRole('button', { name: 'Вернуться к этому месту', exact: true })).toBeVisible();
    const record = (await state(page)).documents[0]; expect(record.pinned).toBe(true); expect(record.position!.text).toBe(before.text); expect(record.position!.heading).toBe(before.heading);
    await screenshot(app, 'reader-dark.png');
  } finally { await close(app); }
});
test('reading anchor survives window resize and edited-document heading fallback', async () => {
  const f = fixture('resize-' + Date.now()); let { app, page } = await launch(f.data, [f.file]);
  try {
    await expect(page.locator('.mermaid-block svg')).toHaveCount(1); await scrollTo(page, .62);
    // Land inside a paragraph, independent of viewport height, so replacing prose forces heading fallback.
    await page.getByTestId('document-scroll').evaluate(element => { const top = element.getBoundingClientRect().top + 24; const paragraph = Array.from(element.querySelectorAll('article p')).find(item => item.getBoundingClientRect().top >= top); if (paragraph) element.scrollTop += paragraph.getBoundingClientRect().top - top + 6; });
    await expect.poll(async () => { const position = (await state(page)).documents[0].position!; return !!position && position.text !== position.heading; }).toBe(true);
    const settledFraction = await page.getByTestId('document-scroll').evaluate(element => element.scrollTop / (element.scrollHeight - element.clientHeight));
    await expect.poll(async () => (await state(page)).documents[0].position!.fraction).toBeCloseTo(settledFraction, 4);
    const anchor = (await state(page)).documents[0].position!;
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 700));
    await page.waitForTimeout(600);
    const visibleHeading = await page.getByTestId('document-scroll').evaluate(el => {
      const top = el.getBoundingClientRect().top + 24; return Array.from(el.querySelectorAll('h1,h2,h3')).filter(h => h.getBoundingClientRect().top <= top).at(-1)?.textContent;
    });
    expect(visibleHeading).toBe(anchor.heading);
    await close(app);
    // Keep headings but replace every paragraph used by the original anchor.
    fs.writeFileSync(f.file, '# Новое введение\n\nИзменённый документ.\n\n' + Array.from({ length: 30 }, (_, i) => `## Раздел ${i + 1}\n\nСовершенно другой текст главы.\n\n` + 'Новая версия содержания.\n\n'.repeat(4)).join(''));
    ({ app, page } = await launch(f.data, [f.file])); await expect(page.getByRole('status')).toContainText('приблизительно');
    const heading = page.locator('article h2').filter({ hasText: new RegExp('^' + anchor.heading + '$') });
    await expect(heading).toBeVisible();
  } finally { await close(app); }
});
test('native file drop, second instance and unsafe API inputs', async () => {
  const f = fixture('drop-' + Date.now()); const { app, page } = await launch(f.data);
  try {
    await page.evaluate(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'native-drop-fixture'; input.hidden = true; document.body.append(input); });
    await page.locator('#native-drop-fixture').setInputFiles(f.file);
    await page.evaluate(() => { const input = document.querySelector<HTMLInputElement>('#native-drop-fixture')!, transfer = new DataTransfer(); transfer.items.add(input.files![0]); document.querySelector('.app')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })); input.remove(); });
    await expect(page.locator('article h1')).toHaveText('Путеводитель по Markdown');
    const env: NodeJS.ProcessEnv = { ...process.env, MD_HAWK_USER_DATA: f.data, MD_HAWK_TEST_HIDE: '1' }; delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(process.env.MD_HAWK_TEST_EXECUTABLE || require('electron'), process.env.MD_HAWK_TEST_EXECUTABLE ? [f.next] : [root, f.next], { env, stdio: 'ignore', windowsHide: true });
    expect(child.pid).toBeGreaterThan(0); await expect(page.locator('article h1')).toHaveText('Вторая глава'); await expect(page.locator('.document-tab')).toHaveCount(2);
    const invalid = await page.evaluate(async () => {
      const doc = (await window.hawk.state()).documents[0]; const errors = [];
      for (const call of [() => window.hawk.external('javascript:alert(1)'), () => window.hawk.image(doc.id, '../state.json'), () => window.hawk.settings({ fontSize: -1 }), () => window.hawk.openRelative(doc.id, 'file:///etc/passwd')]) { try { await call(); errors.push(false); } catch { errors.push(true); } }
      return errors;
    });
    expect(invalid).toEqual([true, true, true, true]);
  } finally { await close(app); }
});
test('invalid formulas and diagrams remain local errors; corrupt profile recovers visibly', async () => {
  const f = fixture('errors-' + Date.now()); fs.writeFileSync(f.file, '# Проверка ошибок\n\n$$\\frac{broken$$\n\n```mermaid\nnot_a_diagram ???\n```\n\n## Читаемый раздел\n\nДокумент остаётся доступен.');
  let { app, page } = await launch(f.data, [f.file]);
  try {
    await expect(page.locator('.katex-error')).toHaveCount(1); await expect(page.locator('.mermaid-block .render-error')).toContainText('Не удалось'); await expect(page.getByRole('heading', { name: 'Читаемый раздел', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('button', { name: 'Сепия', exact: true }).click(); await expect.poll(async () => (await state(page)).settings.theme).toBe('sepia'); await close(app);
    fs.writeFileSync(path.join(f.data, 'state.json'), 'broken'); ({ app, page } = await launch(f.data)); await expect(page.getByRole('alert')).toContainText('резервной копии');
    expect((await state(page)).documents).toHaveLength(1);
  } finally { await close(app); }
});
test('disabled remembering opens from start; manual bookmark still jumps and deletes', async () => {
  const f = fixture('off-' + Date.now()); let { app, page } = await launch(f.data, [f.file]);
  try {
    await expect(page.locator('.mermaid-block svg')).toHaveCount(1); await scrollTo(page, .55); await page.keyboard.press('Control+d');
    await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('checkbox', { name: 'Запоминать место чтения' }).uncheck(); await page.getByRole('button', { name: 'Закрыть настройки' }).click();
    const previous = (await state(page)).documents[0].position!.fraction;
    await page.getByTestId('document-scroll').hover(); await page.mouse.wheel(0, 500); await page.waitForTimeout(650);
    expect((await state(page)).documents[0].position!.fraction).toBe(previous);
    await close(app); ({ app, page } = await launch(f.data, [f.file]));
    await expect(page.locator('.mermaid-block svg')).toHaveCount(1); expect(await page.getByTestId('document-scroll').evaluate(el => el.scrollTop)).toBe(0);
    await page.getByRole('button', { name: 'Закладки', exact: false }).click(); await page.locator('.bookmark-jump').click(); await expect.poll(() => page.getByTestId('document-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(2000);
    await page.getByRole('button', { name: /Удалить закладку/ }).click(); await expect(page.locator('.bookmark-row')).toHaveCount(0);
  } finally { await close(app); }
});
test('missing files relocate preserving bookmarks; removing history preserves source', async () => {
  const f = fixture('move-' + Date.now()); let { app, page } = await launch(f.data, [f.file]);
  try {
    await expect(page.locator('article h1')).toBeVisible(); await page.keyboard.press('Control+d'); await expect(page.locator('.bookmark-row')).toHaveCount(1); await close(app);
    const moved = path.join(f.dir, 'Перемещённый.md'); fs.renameSync(f.file, moved);
    ({ app, page } = await launch(f.data)); await expect(page.getByText('Файл не найден', { exact: true })).toBeVisible();
    await app.evaluate(({ dialog }, filename) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filename] }); }, moved);
    await page.getByRole('button', { name: 'Указать новое расположение', exact: true }).click(); await expect(page.locator('article h1')).toBeVisible();
    expect((await state(page)).documents[0].bookmarks).toHaveLength(1);
    await page.getByRole('button', { name: 'MD Hawk — домашний экран' }).click(); await page.getByRole('button', { name: /Убрать из истории Перемещённый/ }).click(); await expect(page.getByRole('heading', { name: 'Место для ваших мыслей.' })).toBeVisible(); expect(fs.readFileSync(moved, 'utf8')).toBe(f.content);
  } finally { await close(app); }
});
test('all six themes and opening existing file reuse its tab', async () => {
  const f = fixture('themes-' + Date.now()); const { app, page } = await launch(f.data);
  try {
    await screenshot(app, 'home-empty.png'); await openDialog(app, page, f.file); await openDialog(app, page, f.file); await expect(page.locator('.document-tab')).toHaveCount(1);
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    for (const [name, id, fill] of [['Светлая','light','rgb(228, 239, 244)'],['Тёмная','dark','rgb(52, 75, 89)'],['Чёрно-белая','mono-light','rgb(229, 229, 229)'],['Белое на чёрном','mono-dark','rgb(51, 51, 51)'],['Сепия','sepia','rgb(229, 213, 185)'],['Синяя','blue','rgb(220, 231, 251)']]) { await page.getByRole('button', { name, exact: true }).click(); await expect(page.locator('.app')).toHaveAttribute('data-theme', id); await expect(page.locator('.mermaid-block .node rect').first()).toHaveCSS('fill', fill); }
    await screenshot(app, 'settings-blue.png'); await page.getByRole('button', { name: 'Закрыть настройки' }).click(); await page.keyboard.press('Control+w'); await expect(page.locator('article')).toHaveCount(0);
  } finally { await close(app); }
});
test('tabs reorder without changing active document; spaces persist and reopen their documents', async () => {
  const f = fixture('spaces-' + Date.now()); let { app, page } = await launch(f.data, [f.file, f.next]);
  try {
    await expect(page.locator('.document-tab')).toHaveCount(2); await expect(page.locator('article h1')).toHaveText('Вторая глава');
    const source = (await page.locator('.document-tab').first().boundingBox())!, target = (await page.locator('.document-tab').last().boundingBox())!;
    await page.mouse.move(source.x + 25, source.y + 15); await page.mouse.down(); await page.mouse.move(target.x + target.width - 10, target.y + 15, { steps: 10 });
    await expect(page.getByTestId('tab-insertion-marker')).toBeVisible(); await expect(page.locator('.tab-dragging')).toHaveCount(1);
    expect(await page.locator('.tab-dragging').evaluate(element => getComputedStyle(element).transform)).not.toBe('none');
    expect(await page.locator('.tab-dragging').evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none');
    await screenshot(app, 'tab-drag-preview.png'); await page.mouse.up(); await expect(page.getByTestId('tab-insertion-marker')).toHaveCount(0);
    await expect(page.locator('.tab-select').first()).toHaveText('Вторая глава.md'); await expect(page.locator('article h1')).toHaveText('Вторая глава');
    await page.locator('.tab-select').first().focus(); await page.keyboard.press('Alt+ArrowRight'); await expect(page.locator('.tab-select').last()).toHaveText('Вторая глава.md');
    await page.locator('.document-tab').last().dragTo(page.locator('.document-tab').first(), { targetPosition: { x: 10, y: 15 } }); await expect(page.locator('.tab-select').first()).toHaveText('Вторая глава.md');
    await page.locator('.tab-select').first().focus(); await page.keyboard.press('Alt+ArrowRight');
    const cancelSource = (await page.locator('.document-tab').first().boundingBox())!;
    await page.mouse.move(cancelSource.x + 25, cancelSource.y + 15); await page.mouse.down(); await page.mouse.move(cancelSource.x + 80, cancelSource.y + 15, { steps: 5 }); await expect(page.getByTestId('tab-insertion-marker')).toBeVisible(); await page.keyboard.press('Escape'); await page.mouse.up();
    await expect(page.getByTestId('tab-insertion-marker')).toHaveCount(0); await expect(page.locator('.tab-select').first()).toHaveText('Путеводитель по Markdown.md');
    await page.getByRole('button', { name: 'MD Hawk — домашний экран' }).click(); await expect(page.getByText('Ваше пространство для чтения')).toHaveCount(0);
    await page.getByRole('button', { name: 'Создать пространство', exact: true }).click(); await page.getByRole('textbox', { name: 'Название пространства' }).fill('Моё чтение'); await expect(page.locator('.space-documents input:checked')).toHaveCount(2); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect((await state(page)).spaces[0].documentIds).toHaveLength(2); await screenshot(app, 'spaces-russian.png'); await close(app);
    ({ app, page } = await launch(f.data)); await page.getByRole('button', { name: 'Открыть пространство Моё чтение' }).click(); await expect(page.locator('.document-tab')).toHaveCount(2);
    await page.getByRole('button', { name: 'MD Hawk — домашний экран' }).click(); await page.getByRole('button', { name: 'Редактировать пространство Моё чтение' }).click(); await page.getByRole('textbox', { name: 'Название пространства' }).fill('Учёба'); await page.locator('.space-documents input').last().uncheck(); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect((await state(page)).spaces[0].documentIds).toHaveLength(1); await page.getByRole('button', { name: 'Удалить пространство Учёба' }).click(); await expect(page.locator('.space-row')).toHaveCount(0); expect(fs.readFileSync(f.file, 'utf8')).toBe(f.content);
  } finally { await close(app); }
});
test('English settings persist and window restores smaller than work area with half-screen sizing', async () => {
  const f = fixture('language-' + Date.now()); let { app, page } = await launch(f.data);
  try {
    const initial = await app.evaluate(({ BrowserWindow, screen }) => ({ bounds: BrowserWindow.getAllWindows()[0].getBounds(), area: screen.getPrimaryDisplay().workAreaSize }));
    expect(initial.bounds.width).toBeLessThan(initial.area.width); expect(initial.bounds.height).toBeLessThan(initial.area.height);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize()); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize()); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds().width)).toBeLessThan(initial.area.width);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(true)); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(false)); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds().width)).toBeLessThan(initial.area.width);
    await app.evaluate(({ BrowserWindow, screen }) => { const area = screen.getPrimaryDisplay().workAreaSize; BrowserWindow.getAllWindows()[0].setSize(Math.floor(area.width / 2), 600); });
    // Native frame edges round to whole device pixels on scaled Windows displays.
    expect((await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())).width).toBeLessThanOrEqual(Math.max(560, initial.area.width / 2) + 4);
    await page.getByRole('button', { name: 'Настройки', exact: true }).click(); await page.getByRole('combobox', { name: 'Язык интерфейса' }).selectOption('en'); await expect(page.getByRole('dialog', { name: 'Reading settings' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Light', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Close settings' }).click(); await expect(page.getByRole('heading', { name: 'My spaces' })).toBeVisible(); await screenshot(app, 'english-half-screen.png'); await close(app);
    ({ app, page } = await launch(f.data)); await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible(); expect((await state(page)).settings.language).toBe('en');
  } finally { await close(app); }
});
test('PDF renders real pages, searches and persists page bookmarks', async () => {
  const f = fixture('pdf-' + Date.now()), file = path.join(f.dir, 'PDF с пробелами.pdf'); fs.copyFileSync(path.join(root, 'examples', 'Проверка PDF.pdf'), file); let { app, page } = await launch(f.data, [file]);
  try {
    await expect(page.locator('.pdf-sheet')).toHaveAttribute('data-ready', 'true'); await expect(page.locator('.textLayer')).toContainText('page 1');
    expect(await page.locator('.pdf-sheet canvas').evaluate(element => { const context = (element as HTMLCanvasElement).getContext('2d')!, data = context.getImageData(0, 0, (element as HTMLCanvasElement).width, (element as HTMLCanvasElement).height).data; return data.some((value, index) => index % 4 !== 3 && value < 100); })).toBe(true);
    await page.getByRole('button', { name: 'Следующая страница' }).click(); await expect(page.locator('.textLayer')).toContainText('page 2'); await page.keyboard.press('Control+d'); await expect(page.locator('.bookmark-row')).toHaveCount(1);
    await page.keyboard.press('Control+f'); await page.getByRole('textbox', { name: 'Найти в документе' }).fill('sample 3'); await page.keyboard.press('Enter'); await expect(page.getByRole('spinbutton', { name: 'Номер страницы' })).toHaveValue('3'); await expect(page.locator('.pdf-sheet')).toHaveAttribute('data-ready', 'true'); await screenshot(app, 'pdf-reader.png');
    await page.locator('.bookmark-jump').click(); await expect(page.getByRole('spinbutton', { name: 'Номер страницы' })).toHaveValue('2'); await close(app);
    ({ app, page } = await launch(f.data, [file])); await expect(page.getByRole('spinbutton', { name: 'Номер страницы' })).toHaveValue('2'); await expect(page.locator('.bookmark-row')).toHaveCount(1);
  } finally { await close(app); }
});
test('Word DOCX renders formatting, table and embedded image; bookmark survives restart', async () => {
  const f = fixture('word-' + Date.now()), file = path.join(f.dir, 'Word с пробелами.docx'); fs.copyFileSync(path.join(root, 'examples', 'Проверка Word.docx'), file); let { app, page } = await launch(f.data, [file]);
  try {
    await expect(page.locator('article h1')).toHaveText('Word — проверка'); await expect(page.locator('article strong')).toContainText('Жирное начертание'); await expect(page.locator('article table')).toHaveCount(1); await expect(page.locator('article img')).toHaveJSProperty('naturalWidth', 512);
    expect(await page.locator('article a[href^="javascript:"]').count()).toBe(0); await screenshot(app, 'word-reader.png'); await scrollTo(page, .4); await page.keyboard.press('Control+d'); await expect(page.locator('.bookmark-row')).toHaveCount(1); const before = (await state(page)).documents[0].position!.text; await close(app);
    ({ app, page } = await launch(f.data, [file])); await expect(page.locator('article h1')).toHaveText('Word — проверка'); await expect.poll(() => page.getByTestId('document-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(1000); expect((await state(page)).documents[0].position!.text).toBe(before);
  } finally { await close(app); }
});


test('home fits small windows without redundant scrollbars; long library still scrolls', async () => {
  const f = fixture('home-fit-' + Date.now()); let { app, page } = await launch(f.data);
  const fit = async (width: number, height: number, empty: boolean) => {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size[0], size[1]), [width, height]);
    const panel = page.locator('.home-main');
    await expect.poll(() => panel.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    const button = page.locator(empty ? '.start-card .primary' : '.continue-card .primary');
    await expect(button).toBeVisible();
    const bounds = (await panel.boundingBox())!, action = (await button.boundingBox())!;
    expect(action.y).toBeGreaterThanOrEqual(bounds.y); expect(action.y + action.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    expect(action.x + action.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  };
  try {
    for (const size of [[1120, 800], [650, 600], [560, 420]]) {
      await fit(size[0], size[1], true); expect(await page.locator('.library-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    }
    await screenshot(app, 'home-empty-compact.png');
    await openDialog(app, page, f.file); await page.getByRole('button', { name: 'MD Hawk — домашний экран' }).click();
    await fit(650, 600, false); expect(await page.locator('.library-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await fit(560, 420, false); expect(await page.locator('.library-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1); await screenshot(app, 'home-continue-compact.png'); await close(app);
    const { Store } = require(path.join(root, 'electron/store.cjs')), { Library } = require(path.join(root, 'electron/library.cjs'));
    const store = new Store(f.data), library = new Library(store); store.settings({ theme: 'dark' });
    for (let index = 0; index < 18; index++) { const file = path.join(f.dir, 'Книга ' + index + '.md'); fs.writeFileSync(file, '# Книга ' + index + '\n\nТекст книги.'); library.open(file); }
    ({ app, page } = await launch(f.data)); await fit(650, 600, false);
    expect(await page.locator('.library-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
    await page.locator('.library-scroll').hover(); await page.mouse.wheel(0, 500); await expect.poll(() => page.locator('.library-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await screenshot(app, 'home-library-overflow.png'); await page.locator('.continue-card .primary').click(); await expect(page.locator('article h1')).toHaveText('Книга 17');
  } finally { await close(app); }
});

test('code clipboard and whole visual-line selection from the right margin', async () => {
  const f = fixture('copy-lines-' + Date.now());
  fs.writeFileSync(f.file, '# Selection\n\nFirst visual line.\n\nSecond visual line.\n\n```typescript\nconst answer = 42;\nconsole.log(answer);\n```\n');
  const { app, page } = await launch(f.data, [f.file]);
  let priorClipboard = '', written = '';
  try {
    priorClipboard = await app.evaluate(({ clipboard }) => clipboard.readText());
    await page.getByRole('button', { name: 'Копировать код', exact: true }).click();
    written = 'const answer = 42;\nconsole.log(answer);\n';
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(written);
    await expect(page.getByRole('button', { name: 'Копировать код', exact: true })).toHaveText('Скопировано');
    expect(await page.evaluate(async () => { try { await window.hawk.copyText(123 as unknown as string); return false; } catch { return true; } })).toBe(true);
    const first = await page.locator('article p').nth(0).boundingBox(), second = await page.locator('article p').nth(1).boundingBox(), gutter = await page.getByTestId('line-selection-gutter').boundingBox();
    expect(first && second && gutter).toBeTruthy();
    const x = gutter!.x + gutter!.width / 2, y = first!.y + first!.height / 2;
    await page.mouse.click(x, y);
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('First visual line.');
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, second!.y + second!.height / 2, { steps: 8 }); await page.mouse.up();
    const selected = await page.evaluate(() => window.getSelection()?.toString());
    expect(selected).toContain('First visual line.'); expect(selected).toContain('Second visual line.'); expect(selected).not.toContain('Selection');
    await screenshot(app, 'line-selection.png');
  } finally {
    if (written) await app.evaluate(({ clipboard }, values) => { if (clipboard.readText() === values.written) clipboard.writeText(values.prior); }, { written, prior: priorClipboard });
    await close(app);
  }
});

test('advanced typography, custom palette, reset and multilingual interface persist', async () => {
  const f = fixture('appearance-' + Date.now()); let { app, page } = await launch(f.data, [f.file]);
  try {
    await expect(page.locator('article h1')).toBeVisible(); await page.keyboard.press('Control+d');
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByRole('slider', { name: 'Размер текста', exact: true }).fill('8');
    await page.locator('.advanced-settings summary').click();
    await page.getByRole('combobox', { name: 'Шрифт документа', exact: true }).selectOption('mono');
    await page.getByRole('slider', { name: 'Межстрочный интервал', exact: true }).fill('1.4');
    await page.getByRole('slider', { name: 'Отступ между абзацами', exact: true }).fill('8');
    await page.getByLabel('Цвет текста', { exact: true }).fill('#123456');
    await expect.poll(async () => (await state(page)).settings.customColors.light?.ink).toBe('#123456');
    await page.getByRole('button', { name: 'Закрыть настройки', exact: true }).click();
    await expect(page.locator('article')).toHaveCSS('font-size', '8px'); await expect(page.locator('article p').first()).toHaveCSS('color', 'rgb(18, 52, 86)');
    await close(app); ({ app, page } = await launch(f.data));
    const saved = await state(page); expect(saved.settings.fontSize).toBe(8); expect(saved.settings.fontFamily).toBe('mono'); expect(saved.documents[0].bookmarks).toHaveLength(1);
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByRole('combobox', { name: 'Язык интерфейса', exact: true }).selectOption('zh');
    await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', '阅读设置');
    await page.locator('.language-setting select').first().selectOption('es');
    await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', 'Ajustes de lectura');
    await page.locator('.language-setting select').first().selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); await screenshot(app, 'settings-arabic.png');
    await page.locator('.language-setting select').first().selectOption('en');
    await page.getByRole('button', { name: 'Reset reading settings', exact: true }).click();
    const reset = await state(page); expect(reset.settings.fontSize).toBe(19); expect(reset.settings.customColors).toEqual({}); expect(reset.settings.language).toBe('en'); expect(reset.documents[0].bookmarks).toHaveLength(1);
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await close(app); ({ app, page } = await launch(f.data));
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible(); expect((await state(page)).settings.language).toBe('en');
  } finally { await close(app); }
});
