import zh from '../shared/locales/zh.json';
import es from '../shared/locales/es.json';
import fr from '../shared/locales/fr.json';
import de from '../shared/locales/de.json';
import pt from '../shared/locales/pt.json';
import hi from '../shared/locales/hi.json';
import ar from '../shared/locales/ar.json';
import ja from '../shared/locales/ja.json';
import ko from '../shared/locales/ko.json';
import it from '../shared/locales/it.json';
import tr from '../shared/locales/tr.json';
import id from '../shared/locales/id.json';
import vi from '../shared/locales/vi.json';
import bn from '../shared/locales/bn.json';
import type { Language } from './types';
// ponytail: one renderer root; use a context if separate UI roots are introduced.
let language: Language = 'ru';
export const getLanguage = () => language;
export const setLanguage = (value: Language) => { language = value; document.documentElement.lang = value; document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr'; };
export const english: Record<string, string> = {
  'MD Hawk — домашний экран': 'MD Hawk — home', 'Библиотека': 'Library', 'Настройки': 'Settings', 'Открытые документы': 'Open documents', 'Закрыть вкладку ': 'Close tab ',
  'Открыть файл': 'Open file', 'Открыть документ': 'Open document', 'Добавить документ': 'Add document', 'Открываем библиотеку…': 'Opening library…',
  'Мои документы': 'My documents', 'Найти документ': 'Find a document', 'Поиск документов': 'Search documents', 'Закреплённые': 'Pinned', 'Недавние': 'Recent',
  'Закрепить ': 'Pin ', 'Открепить ': 'Unpin ', 'Убрать из истории ': 'Remove from history ', 'Файл не найден': 'File not found',
  'Указать новое расположение': 'Locate moved file', 'Указать расположение': 'Locate file', 'Ничего не найдено': 'Nothing found', 'Попробуйте другое название.': 'Try another name.',
  'Здесь будут ваши документы': 'Your documents will appear here', 'Откройте первый Markdown-файл.': 'Open your first document.',
  'Продолжим читать?': 'Continue reading?', 'Место для ваших мыслей.': 'Room for your thoughts.', 'Ваши документы и сохранённые места — всегда под рукой.': 'Your documents and reading places, always at hand.',
  'Откройте Markdown и сосредоточьтесь на содержании.': 'Open a document and focus on its contents.', 'Откройте документ и сосредоточьтесь на содержании.': 'Open a document and focus on its contents.', 'Последний документ': 'Last document', 'Сохранённое место': 'Saved position',
  'Откройте первый документ.': 'Open your first document.',
  'Готов к чтению': 'Ready to read', 'Откройте документ, чтобы начать чтение.': 'Open a document to start reading.', 'Можно добавить закладки во время чтения': 'Add bookmarks as you read',
  'Документ перемещён или удалён. Укажите его новое расположение.': 'The document was moved or deleted. Locate it to continue.', 'Продолжить чтение': 'Continue reading',
  'Первый документ — начало библиотеки': 'Your library starts with one document', 'История открытий, любимые файлы и закладки.': 'Recent documents, favourite files and bookmarks.',
  'Всё хранится на вашем компьютере.': 'Everything stays on your computer.', 'Открыть Markdown-файл': 'Open document', 'Закрепляйте важное': 'Pin what matters',
  'Возвращайтесь к прочитанному': 'Return to your reading', 'Или перетащите файл в окно': 'Or drop a file into the window',
  'Настройки чтения': 'Reading settings', 'Закрыть настройки': 'Close settings', 'Устройте себе удобное место для чтения.': 'Make yourself comfortable.',
  'Оформление': 'Appearance', 'Светлая': 'Light', 'Тёмная': 'Dark', 'Чёрно-белая': 'Monochrome light', 'Белое на чёрном': 'Monochrome dark', 'Сепия': 'Sepia', 'Синяя': 'Blue',
  'Размер текста': 'Text size', 'Ширина колонки': 'Column width', 'Запоминать место чтения': 'Remember reading position',
  'Открывать документы там, где вы остановились.': 'Open documents where you left off.', 'Ручные закладки доступны в любом режиме.': 'Manual bookmarks work in either mode.',
  'Оглавление': 'Contents', 'Закладки': 'Bookmarks', 'Добавить здесь': 'Bookmark here', 'Добавить закладку': 'Add bookmark', 'Название закладки': 'Bookmark name',
  'Сохранить название': 'Save name', 'Отменить': 'Cancel', 'Переименовать закладку ': 'Rename bookmark ', 'Удалить закладку ': 'Delete bookmark ',
  'Закладка добавлена': 'Bookmark added', 'В этом документе нет заголовков.': 'This document has no headings.', 'Отметьте место, к которому хотите вернуться.': 'Bookmark a place you want to return to.',
  'Место чтения сохраняется': 'Reading position is saved', 'Автосохранение позиции выключено': 'Position saving is off', 'Скрыть панель': 'Hide sidebar', 'Показать панель': 'Show sidebar',
  'Найти в документе': 'Find in document', 'Предыдущее совпадение': 'Previous match', 'Следующее совпадение': 'Next match', 'Закрыть поиск': 'Close search', 'Нет совпадений': 'No matches',
  'Конец документа': 'End of document', 'Вернуться к началу': 'Back to top', 'Документ изменился. Позиция восстановлена приблизительно.': 'The document changed. The reading position was restored approximately.',
  'Раздел по этой ссылке не найден': 'Linked section not found', 'Некорректный якорь': 'Invalid anchor', 'Загрузка изображения…': 'Loading image…', 'Изображение недоступно: ': 'Image unavailable: ',
  'Диаграмма Mermaid': 'Mermaid diagram', 'Не удалось построить диаграмму. Проверьте синтаксис Mermaid.': 'Cannot render this diagram. Check the Mermaid syntax.', 'Не удалось загрузить диаграмму.': 'Cannot load the diagram.',
  'Не удалось открыть документ. ': 'Cannot open document. ', 'Не удалось открыть ссылку. ': 'Cannot open link. ', 'Закрыть сообщение': 'Close message',
  'Архивировать и создать новую историю': 'Archive and create new history', 'Откройте документ здесь': 'Drop your document here', 'Markdown-файлы добавятся в библиотеку': 'Documents will be added to your library',
  'Мои пространства': 'My spaces', 'Создать пространство': 'Create space', 'Изменить пространство': 'Edit space', 'Название пространства': 'Space name', 'Открыть пространство ': 'Open space ',
  'Редактировать пространство ': 'Edit space ', 'Удалить пространство ': 'Delete space ', 'Сохранить': 'Save', 'Документы пространства': 'Space documents',
  'Сохранить открытые вкладки': 'Save open tabs', 'Нет пространств. Объедините документы в группу.': 'No spaces yet. Group related documents.', 'Язык интерфейса': 'Interface language',
  'Переместить вкладку влево': 'Move tab left', 'Переместить вкладку вправо': 'Move tab right', 'Закладок: ': 'Bookmarks: ',
  'Копировать код': 'Copy code', 'Скопировано': 'Copied', 'Ошибка копирования': 'Copy failed', 'Выделение строк': 'Select lines', 'Щёлкните для выделения строки, протяните для нескольких строк': 'Click to select a line; drag to select several lines',
  'Дополнительное оформление': 'Advanced appearance', 'Шрифт документа': 'Document font', 'С засечками': 'Serif', 'Без засечек': 'Sans serif', 'Моноширинный': 'Monospace', 'Межстрочный интервал': 'Line spacing', 'Отступ между абзацами': 'Paragraph spacing', 'Цвета выбранной темы': 'Current theme colors', 'Вернуть цвета этой темы': 'Reset this theme colors', 'Сбросить настройки чтения': 'Reset reading settings',
  'Фон окна': 'Window background', 'Поверхность': 'Surface', 'Второй фон': 'Secondary background', 'Цвет текста': 'Text color', 'Второстепенный текст': 'Secondary text', 'Границы': 'Borders', 'Акцент и ссылки': 'Accent and links', 'Фон акцента': 'Accent background', 'Фон кода': 'Code background', 'Предупреждения': 'Warnings', 'Синтаксис: первый цвет': 'Syntax: first color', 'Синтаксис: второй цвет': 'Syntax: second color', 'Синтаксис: третий цвет': 'Syntax: third color',
  'Страница': 'Page', 'Предыдущая страница': 'Previous page', 'Следующая страница': 'Next page', 'Номер страницы': 'Page number', 'Масштаб PDF': 'PDF zoom',
  'Загрузка PDF…': 'Loading PDF…', 'Загрузка Word…': 'Loading Word…', 'Не удалось прочитать PDF.': 'Cannot read PDF.', 'Не удалось прочитать Word DOCX.': 'Cannot read Word DOCX.',
  'Поиск…': 'Searching…', 'PDF защищён паролем.': 'This PDF is password-protected.', 'Слишком много страниц PDF.': 'Too many PDF pages.',
  'Состояние восстановлено из резервной копии. Последнее изменение могло не сохраниться.': 'State recovered from backup. The last change may not have been saved.',
  'Файлы истории повреждены. Исходные копии сохранены; запись заблокирована. Можно создать новую историю с архивированием повреждённых копий.': 'History files are damaged. Original copies were preserved and writes are blocked. Archive them to create a new history.',
  'Документ не найден в истории': 'Document not found in history', 'Пространство не найдено': 'Space not found', 'Некорректное пространство': 'Invalid space',
  'Выберите Markdown, PDF или Word DOCX': 'Select Markdown, PDF or Word DOCX', 'Поддерживаются документы размером до 20 МБ': 'Documents up to 20 MiB are supported',
  'Не удалось открыть файл: ': 'Cannot open file: ', 'Сетевые пути не поддерживаются': 'Network paths are not supported', 'Недопустимая схема локальной ссылки': 'Unsupported local link scheme',
};
export const catalogues: Partial<Record<Language, Record<string, string>>> = { zh, es, fr, de, pt, hi, ar, ja, ko, it, tr, id, vi, bn };
export function t(text: string): string {
  if (language === 'ru') return text;
  const translate = (source: string) => catalogues[language]?.[source] || source;
  if (english[text]) return translate(english[text]);
  for (const key of Object.keys(english)) if (key.endsWith(' ') && text.startsWith(key)) return translate(english[key]) + text.slice(key.length);
  return text;
}
