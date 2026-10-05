# MD Hawk

Local Markdown, PDF and Word DOCX reader for Windows, macOS and Linux. Reading history, bookmarks, saved positions, document spaces and customizable themes. No account or cloud sync.

[Download Windows 1.2.0](https://github.com/AlexiAxAxA/md-hawk/releases/tag/v1.2.0) · [Русская документация](docs/index.md)

Choose your language in the Windows installer (15 languages) or Settings (16 languages, including Bengali). Portable uses your OS language on first launch. Existing preferences survive updates. Windows builds are unsigned; macOS/Linux packaging is configured but not verified.


Локальная читалка Markdown, PDF и Word DOCX. История, закрепление, перетаскиваемые вкладки, пространства с группами документов, оглавление, закладки, место чтения и шесть тем. 16 языков интерфейса, без аккаунтов и облака. Windows проверена; macOS/Linux подготовлены, но пока не проверены.

## Запуск

На этом компьютере приложение установлено в `App/MD Hawk.exe`. Используйте `Запустить MD Hawk.cmd` или ярлык **MD Hawk**. Для установки на другой Windows — `release/MD-Hawk-1.2.0-x64-nsis.exe`; для запуска без установки — `release/MD-Hawk-1.2.0-x64-portable.exe`.

Документ [«Добро пожаловать»](examples/Добро%20пожаловать.md) знакомит с возможностями приложения. При обычном запуске открывается библиотека; откройте этот файл кнопкой или перетащите в окно.

Исходники: Node.js 22.13+ (или актуальная LTS), npm.

```powershell
npm ci
npm run dev
```

Поддерживаются `.md`, `.markdown`, `.mdown` (UTF-8 и UTF-16 с BOM), `.pdf` и `.docx`. Старые `.doc` предварительно сохраните в DOCX. Открывайте через кнопку, перетаскивание или «Открыть с помощью» в системе. Настройки сохраняются в каталоге пользовательских данных MD Hawk, вне папки исходников. Linux использует XDG config, macOS — Application Support, Windows — AppData Roaming.

## Чтение

Домашний экран подстраивается под высоту окна: справа нет полосы прокрутки, кнопки остаются видимыми. В коротком окне декоративные элементы уменьшаются или скрываются. Список документов прокручивается только при переполнении.

- Вкладки скользят по строке с тенью и меткой места вставки; Escape отменяет перемещение; на кнопке вкладки Alt+←/→ меняет порядок.
- В библиотеке «Мои пространства» сохраняет выбранные документы или открытые вкладки в именованную группу. Можно открыть, изменить или удалить группу. Исходные файлы остаются на диске.
- В настройках выберите один из 16 языков. Обычное окно меньше рабочей области; снятие максимизации возвращает этот размер, окно допускает размещение на половине экрана.
- PDF: страницы, масштаб, выделение текста, поиск, сохранение страницы и закладки. Word DOCX: содержимое с заголовками, таблицами и встроенными изображениями; вёрстка может отличаться от Word. Контрольные файлы находятся в `examples/Проверка PDF.pdf` и `examples/Проверка Word.docx`.

- Ctrl/Cmd+O — открыть, Ctrl/Cmd+F — найти, Ctrl/Cmd+D — добавить закладку, Ctrl/Cmd+W — закрыть вкладку, Ctrl/Cmd+, — настройки.
- Переключатель запоминания общий. При выключении файлы открываются с начала; ручные закладки продолжают работать. Внутри открытой сессии вкладки сохраняют своё место.
- «Убрать из истории» не удаляет документ. Если файл перемещён, укажите новое расположение: закладки сохранятся.
- Относительные MD-ссылки открываются в приложении; HTTP/HTTPS — в браузере. Локальные картинки и HTTPS-картинки поддерживаются. Формулы — `$…$` и `$$…$$`, диаграммы — блоки `mermaid`.
- Встроенный HTML очищается. JS и произвольные схемы ссылок не выполняются. Приложение не изменяет исходные документы.

## Проверки и сборка

```powershell
npm test
npm run build
npm run test:e2e
npm run dist:win
```

Проверка установленного приложения использует отдельные профили:

```powershell
$env:MD_HAWK_TEST_EXECUTABLE = Join-Path (Get-Location) 'App/MD Hawk.exe'
npm run test:e2e
```

Если ограниченная среда запуска запрещает создание дочернего Electron-процесса, выполняйте настольные E2E из обычного терминала Windows. Sandbox в настройках самого приложения остаётся включённым. Результаты: [журнал проверок](docs/verification.md).

На macOS: `npm run dist:mac`; на Linux: `npm run dist:linux`. Для подписанной поставки нужны сертификаты владельца; подпись и нотарификация автоматически не обещаются. Пакеты каждой ОС проверяются на соответствующей системе.

Запуск без файла показывает библиотеку. Для конфигурации ассоциаций выберите MD Hawk в настройках системы; установка не заставляет менять приложение по умолчанию.

Полный статус и ограничения: [документация](docs/index.md).

## Новое в 1.2

- Кнопка «Копировать код» в каждом блоке; обычное выделение и Ctrl/Cmd+C также работают.
- Стрелка справа от Markdown/DOCX: щелчок выделяет визуальную строку, перетаскивание — несколько строк.
- Дополнительное оформление: 13 цветов каждой темы, три семейства шрифтов, интервалы и размер 8–40 px. Сброс чтения сохраняет библиотеку, закладки и язык.
- Русский, English, 简体中文, Español, Français, Deutsch, Português, हिन्दी, العربية, 日本語, 한국어, Italiano, Türkçe, Bahasa Indonesia, Tiếng Việt, বাংলা. Переводы пока без редактуры носителями.

## License

Copyright 2026 MD Hawk contributors. This program is free software under the GNU General Public License, version 3 or any later version (SPDX: GPL-3.0-or-later). It is distributed without warranty. See [LICENSE](LICENSE). Dependencies retain their own licenses; [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) includes their notices. Regenerate after dependency changes with `npm run licenses` before packaging.
