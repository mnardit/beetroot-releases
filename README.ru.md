<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot — менеджер буфера обмена для Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  Менеджер буфера обмена, который Windows должен был сделать сам.<br/>
  AI-трансформации, OCR, нечёткий поиск по всей истории — всё по одному хоткею.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Версия"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Загрузки"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Бесплатно">
  <img src="https://img.shields.io/badge/source-proprietary-orange" alt="Проприетарный">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Скачать</strong></a> · <a href="https://max.nardit.com/beetroot">Сайт</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <b>Русский</b> · <a href="README.zh.md">中文</a> · <a href="README.ja.md">日本語</a>
</p>

> В этом репозитории — релизы и документация. Исходный код проприетарный.

---

## Смотрите в действии

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — нечёткий поиск по истории буфера обмена" width="600">
</p>

| AI-трансформации | Темы |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="AI перевод и исправление грамматики" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Переключение тем" width="400"> |

| Тёмная тема | Светлая тема |
|---|---|
| ![Тёмная](docs/screenshots/main-dark-new.png) | ![Светлая](docs/screenshots/main-light-filters.png) |

<details>
<summary>Больше скриншотов</summary>

| Контекстное меню и AI | Предпросмотр кода |
|---|---|
| ![Контекстное меню](docs/screenshots/context-menu.jpg) | ![Предпросмотр](docs/screenshots/preview-code.png) |

| Поиск | Меню AI-трансформаций |
|---|---|
| ![Поиск](docs/screenshots/search-results.png) | ![Трансформации](docs/screenshots/transform-menu.png) |

| Настройки | Языки |
|---|---|
| ![Настройки](docs/screenshots/settings-general-new.png) | ![Языки](docs/screenshots/settings-languages.png) |

</details>

---

## Установка

**[Скачайте последнюю версию .exe из GitHub Releases](https://github.com/mnardit/beetroot-releases/releases/latest)**

Или через пакетный менеджер:

```powershell
# Winget
winget install MNardit.Beetroot

# Scoop
scoop bucket add beetroot https://github.com/mnardit/scoop-bucket
scoop install beetroot

# Chocolatey
choco install beetroot
```

> [!NOTE]
> **Обновляетесь с v1.0.5 или раньше?** Автообновление не сработает из-за одноразовой смены ключа подписи. [Скачайте последнюю версию вручную](https://github.com/mnardit/beetroot-releases/releases/latest) — все будущие обновления будут работать автоматически.

**Требования:** Windows 10 или новее.

---

## Почему не Win+V?

| Функция | Win+V | Beetroot |
|---|---|---|
| История | 25 записей, пропадают после перезагрузки | Без ограничений, хранятся всегда |
| Поиск | Нет | Нечёткий + регулярные выражения |
| AI-трансформации | Нет | 10 встроенных + свои промпты |
| OCR | Нет | Нативный движок Windows, локально |
| История изображений | Только миниатюры | Полные изображения, хранятся локально |
| Темы | Нет | 9 тем + Авто-режим + акцентный цвет |
| Вставка без форматирования | Нет | Отдельный хоткей |
| Мультимонитор | Нет | Окно следует за курсором |
| Закрепить поверх | Нет | Закрепить + перетащить куда угодно |
| Заметки | Нет | Поиск по аннотациям |

---

## Быстрый старт

1. **Установите** — скачайте .exe или используйте winget/scoop/choco
2. **Откройте** — нажмите `` Ctrl+` `` (настраивается) чтобы вызвать Beetroot
3. **Ищите** — начните печатать для нечёткого поиска, или `/regex/`
4. **Избранное и заметки** — правый клик → В избранное, добавляйте заметки для контекста
5. **AI и OCR** — правый клик → Трансформировать для AI, или правый клик по изображению → OCR

---

## Возможности

### Поиск и рабочий процесс

- **Нечёткий поиск** — находит что угодно с допуском опечаток
- **Режим регулярных выражений** — `/pattern/` для продвинутых пользователей с подсветкой совпадений
- **Фильтры** — текст, изображения, избранное, заметки — один клик для фильтрации
- **Быстрая вставка** — `Ctrl+1..9` для вставки последних записей без открытия окна
- **Групповые операции** — множественный выбор через `Ctrl+Click`, групповое копирование или удаление
- **Детекция контента** — автобейджи для URL, email, кода, JSON, цветов; клик для открытия URL
- **Один экземпляр** — повторный запуск Beetroot фокусирует существующее окно

### AI-трансформации

- **10 встроенных промптов** — исправление грамматики, перевод, пересказ, переписывание, извлечение данных, форматирование кода и другое
- **Свои промпты** — до 20 своих, доступны из контекстного меню
- **BYOK** — используйте свой ключ OpenAI API; Beetroot никогда не хранит и не проксирует ваши данные
- **GPT-5 nano/mini** — быстро и дёшево, оптимизировано для коротких текстов

### OCR

- **Извлечение текста из изображений** — правый клик по изображению → OCR
- **Нативный движок Windows** — без облака, без загрузок, полностью офлайн
- **Мгновенно** — работает асинхронно, не тормозит приложение

### Кастомизация

- **9 тем** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, Pure Dark (OLED #000000), плюс Авто-режим
- **Эффекты окна** — Mica, Acrylic или Solid; определяются автоматически по версии Windows
- **Типографика** — 8 UI-шрифтов, 5 шрифтов для кода, 6 размеров
- **26 языков** — EN, RU, DE, ES, ZH, JA, FR, PT, KO, TR, IT, PL, NL, UK, TH, HI, ID, VI, CS, HU, RO, SV, DA, FI, NB, MS
- **Закрепление окна** — поверх всех окон, перетаскивание между мониторами, режим следования за курсором
- **Все хоткеи настраиваются** — переназначьте всё в Настройки → Горячие клавиши; поддержка AZERTY, QWERTZ, AltGr

### Надёжность

- **Автоматические бэкапы** — ротация из 3 копий + снимок перед каждым обновлением
- **Автовосстановление** — обнаруживает повреждения, восстанавливает из бэкапа незаметно
- **Предупреждения об облачной синхронизации** — если папка данных внутри OneDrive, Dropbox или Google Drive
- **Детекция диска** — предупреждение при записи на USB или сетевые диски
- **Автообновление** — встроенный апдейтер, можно отключить для полностью офлайн работы

---

## Горячие клавиши

| Сочетание | Действие |
|---|---|
| `` Ctrl+` `` | Показать / скрыть Beetroot |
| `Enter` | Вставить выбранную запись |
| `Ctrl+1..9` | Быстрая вставка |
| `Space` | Предпросмотр |
| `Alt+T` | Трансформация AI |
| `Alt+P` | Закрепить окно поверх |
| `Alt+F` | Режим следования за курсором |
| `Shift+F10` | Контекстное меню |
| `Ctrl+C` | Копировать в буфер |
| `Alt+Del` | Удалить |

Все горячие клавиши настраиваются в **Настройки → Горячие клавиши**. Работает с AZERTY, QWERTZ и AltGr раскладками. Подписи обновляются мгновенно при переключении раскладки через Win+Space.

---

## FAQ

**Beetroot бесплатный?**
Да. Бесплатен для личного и коммерческого использования — без рекламы, пробных периодов, ограничений функций и телеметрии.

**Beetroot отправляет данные буфера обмена куда-то?**
Нет. Всё хранится в локальной базе SQLite на вашем компьютере. AI-трансформации отправляют только выбранный текст в OpenAI API, когда вы явно выбираете трансформацию — и только с вашим собственным API-ключом.

**Что именно отправляется в OpenAI?**
Только текст, по которому вы нажали правой кнопкой → Трансформировать. Запрос идёт напрямую с вашей машины в OpenAI API. Beetroot никогда не видит, не хранит и не проксирует ваши данные. Нет API-ключа = ноль сетевых запросов.

**Где хранится API-ключ?**
В локальных настройках приложения (localStorage в профиле WebView2). Он никогда не покидает вашу машину.

**Где хранятся данные?**
По умолчанию в `%LOCALAPPDATA%\com.beetroot.desktop\`. Можно переместить в Настройки → Данные. База данных — стандартный файл SQLite, для бэкапа достаточно скопировать папку.

**Работает ли Beetroot на Windows 10?**
Да. Поддерживаются Windows 10 и 11. Эффекты Mica и Acrylic доступны на Windows 11.

**Можно ли открыть несколько окон Beetroot?**
Нет. Beetroot работает в одном экземпляре — повторный запуск фокусирует существующее окно.

**Работает ли автообновление?**
Да, начиная с v1.0.6. Пользователям v1.0.5 и раньше нужно [скачать вручную](https://github.com/mnardit/beetroot-releases/releases/latest) один раз — после этого автообновление работает нормально. Автообновление можно отключить в Настройки → Основные.

---

## Приватность и безопасность

Ваши данные остаются на вашем компьютере. Без телеметрии, аналитики, облачной синхронизации и аккаунтов.

- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Terms of Service](TERMS.md)

---

## Решение проблем

**Автообновление не работает (v1.0.5 и раньше)**
Одноразовая смена ключа подписи требует [скачать последнюю версию вручную](https://github.com/mnardit/beetroot-releases/releases/latest). Будущие обновления будут работать автоматически.

**OCR не работает или низкое качество**
OCR использует нативный движок Windows. Убедитесь, что нужный языковой пакет установлен: Параметры → Время и язык → Язык → Добавить язык → отметьте «Речь» или «Базовый ввод».

**Beetroot не открывается или хоткей не работает**
- Проверьте, не занят ли хоткей другим приложением (например, `Ctrl+``)
- Попробуйте запустить от имени администратора
- Переназначьте хоткей в Настройки → Горячие клавиши

**Предупреждение SmartScreen или антивируса**
Beetroot пока не имеет подписи кода (сертификат в процессе). Нажмите «Подробнее» → «Всё равно запустить» в SmartScreen. Это ложное срабатывание — приложение безопасно.

---

## Обратная связь и баги

Нашли баг или хотите предложить фичу? [Создайте issue](https://github.com/mnardit/beetroot-releases/issues).

Пожалуйста, укажите:
- Версию Beetroot (Настройки → О программе)
- Версию Windows (`winver`)
- Шаги для воспроизведения
- Скриншот или текст ошибки, если есть

---

## Лицензия

Бесплатно для личного и коммерческого использования. Исходный код проприетарный.

<details>
<summary>Сторонние шрифты и благодарности</summary>

**Шрифты** (SIL Open Font License 1.1):
- [Inter](https://github.com/rsms/inter) — Copyright 2020 The Inter Project Authors
- [Open Sans](https://github.com/googlefonts/opensans) — Copyright 2020 The Open Sans Project Authors
- [Montserrat](https://github.com/JulietaUla/montserrat) — Copyright 2011 The Montserrat Project Authors
- [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) — Copyright 2022 The Noto Project Authors
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — Copyright 2020 The JetBrains Mono Project Authors

**Создано с:** [Tauri v2](https://tauri.app/) · React 19 · Rust · SQLite · TypeScript

</details>

---

<p align="center">
  Создано <a href="https://max.nardit.com">Max Nardit</a>
</p>
