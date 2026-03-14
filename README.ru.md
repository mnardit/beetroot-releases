<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot — менеджер буфера обмена для Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  Менеджер буфера обмена, который Windows должен был сделать сам.<br/>
  AI-трансформации, OCR и нечёткий поиск по всей истории — всё по одному хоткею.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Версия"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Загрузки"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Бесплатно">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Скачать Beetroot (бесплатно)</strong></a> · <a href="https://max.nardit.com/beetroot">Сайт</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <b>Русский</b> · <a href="README.zh.md">中文</a> · <a href="README.ja.md">日本語</a>
</p>

> **Новое в v1.5.1:** ML-определение языков кода (54 языка через TensorFlow.js модель VS Code), переписанный 5-фазный поиск и превью фрагментов для длинных клипов. [Что нового →](https://github.com/mnardit/beetroot-releases/releases/tag/v1.5.1)

---

## Почему не Win+V?

| Функция | Win+V | Beetroot |
|---|---|---|
| История | 25 записей, пропадают после перезагрузки | Без ограничений, хранятся всегда |
| Поиск | Нет | Нечёткий + регулярные выражения |
| AI-трансформации | Нет | 5 облачных провайдеров + локальные модели, 10 встроенных + свои |
| Отслеживание приложений | Нет | Иконка, название и заголовок окна для каждого клипа |
| OCR | Нет | Нативный движок Windows, локально |
| История изображений | Только миниатюры | Полные изображения, хранятся локально |
| Темы | Нет | 9 тем + Авто-режим + акцентный цвет |
| Вставка без форматирования | Нет | Отдельный хоткей |
| Мультимонитор | Нет | Окно следует за курсором |
| Закрепить поверх | Нет | Закрепить + перетащить куда угодно |
| Заметки | Нет | Поиск по аннотациям |

---

## Смотрите в действии

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — нечёткий поиск по истории буфера обмена" width="600">
</p>

| AI-трансформации | Темы |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="AI-перевод и исправление грамматики" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Переключение тем" width="400"> |

<details>
<summary>Больше скриншотов</summary>

| Тёмная тема | Светлая тема |
|---|---|
| ![Тёмная](docs/screenshots/main-dark-new.png) | ![Светлая](docs/screenshots/main-light-filters.png) |

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

**Требования:** Windows 10 или новее.

---

## Возможности

### Поиск и рабочий процесс

- **Нечёткий поиск** — находит что угодно с допуском опечаток, на основе индекса в памяти
- **Режим регулярных выражений** — `/pattern/` с подсветкой совпадений
- **Фильтры** — текст, изображения, избранное, заметки — один клик для фильтрации
- **Быстрая вставка** — `Ctrl+1..9` для вставки последних клипов без открытия окна
- **Групповые операции** — множественный выбор через `Ctrl+Click`, затем копирование (свой разделитель) или удаление
- **Детекция контента** — автобейджи для URL, email, кода, JSON, цветов
- **Один экземпляр** — повторный запуск Beetroot фокусирует существующее окно

### AI-трансформации

- **5 облачных провайдеров + локальный** — OpenAI, Gemini, Claude, DeepSeek или локальный (LM Studio, Ollama), переключение в один клик
- **Reasoning-модели** — Qwen3, DeepSeek R1 и аналогичные работают из коробки (автоматически убирает теги `<think>`)
- **10 встроенных промптов** — исправление грамматики, перевод, пересказ, переписывание, извлечение данных, форматирование кода и другое
- **Свои промпты** — до 20 своих, доступны из контекстного меню
- **BYOK** — используйте свой ключ OpenAI, или обойдитесь без него с локальной моделью

<details>
<summary>Рекомендуемые локальные модели для трансформации текста</summary>

| Модель | Размер | Скорость | Лучше всего для |
|-------|------|-------|----------|
| **Qwen3 8B** (Q4_K) | ~5 ГБ | Быстро | Грамматика, перевод, переписывание |
| **Gemma 3 4B** (Q4_K) | ~3 ГБ | Очень быстро | Исправление опечаток, простые правки |
| **Phi-4 Mini 3.8B** (Q4_K) | ~2.5 ГБ | Очень быстро | Код и структурированный текст |
| **Llama 3.1 8B** (Q4_K) | ~5 ГБ | Быстро | Универсальные задачи |
| **Mistral Small 3.1 24B** (Q4_K) | ~14 ГБ | Медленно (16+ ГБ VRAM) | Премиальное качество |
| **DeepSeek R1 7B** (Q4_K) | ~5 ГБ | Быстро | Сложные правки, пересказ |

Протестировано с [LM Studio](https://lmstudio.ai), [Ollama](https://ollama.com) и [llama.cpp](https://github.com/ggml-org/llama.cpp). Настройка: Настройки → AI → Локальная LLM.

</details>

### Отслеживание приложений-источников

- **Видно откуда каждый клип** — иконка приложения, название и заголовок окна
- **Фильтр по приложению** — выпадающий список «Приложения» с поиском, сортировка по последнему / частому / алфавиту
- **Поиск** — приложение-источник и заголовок окна участвуют в нечётком и regex-поиске

### OCR

- **Извлечение текста из изображений** — правый клик по изображению → OCR
- **Нативный движок Windows** — без облака, без загрузок, полностью офлайн
- **Мгновенно** — работает асинхронно, не тормозит интерфейс

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
| `Enter` | Вставить выбранный клип |
| `Ctrl+1..9` | Быстрая вставка |
| `Space` | Предпросмотр |
| `Alt+T` | Трансформация AI |
| `Alt+P` | Закрепить окно поверх |
| `Alt+F` | Режим следования за курсором |
| `Shift+F10` | Контекстное меню |
| `Ctrl+C` | Копировать в буфер |
| `Alt+Del` | Удалить |

Все горячие клавиши настраиваются в **Настройки → Горячие клавиши**. Работает с AZERTY, QWERTZ и AltGr раскладками.

---

## FAQ

**Beetroot бесплатный?**
Да. Бесплатен для личного и коммерческого использования — без рекламы, пробных периодов, ограничений функций и телеметрии.

**Beetroot отправляет данные буфера обмена куда-то?**
Нет. Всё хранится в локальной базе SQLite на вашем компьютере. С локальной AI-моделью ничего вообще не покидает вашу машину. При использовании OpenAI отправляется только тот текст, который вы явно трансформируете — напрямую в их API с вашим собственным ключом.

**Где хранится API-ключ?**
В локальных настройках приложения (localStorage в профиле WebView2). Он никогда не покидает вашу машину.

**Где хранятся данные?**
По умолчанию в `%APPDATA%\com.beetroot.desktop\`. Можно переместить в Настройки → Данные. База данных — стандартный файл SQLite, для бэкапа достаточно скопировать папку.

**Работает ли автообновление?**
Да, начиная с v1.0.6. Пользователям v1.0.5 и раньше нужно [скачать вручную](https://github.com/mnardit/beetroot-releases/releases/latest) один раз — после этого автообновление работает нормально. Автообновление можно отключить в Настройки → Основные.

---

## Решение проблем

**Автообновление не работает (v1.0.5 и раньше)**
Одноразовая смена ключа подписи требует [скачать последнюю версию вручную](https://github.com/mnardit/beetroot-releases/releases/latest). Будущие обновления будут работать автоматически.

**OCR не работает или низкое качество**
OCR использует нативный движок Windows. Убедитесь, что нужный языковой пакет установлен: Параметры → Время и язык → Язык → Добавить язык → отметьте «Речь» или «Базовый ввод».

**Beetroot не открывается или хоткей не работает**
- Проверьте, не занят ли хоткей другим приложением (например, `Ctrl+``)
- Попробуйте запустить от имени администратора для исключения проблем с правами
- Переназначьте хоткей в Настройки → Горячие клавиши

**Предупреждение SmartScreen или антивируса**
Beetroot пока не имеет подписи кода (сертификат в процессе). Нажмите «Подробнее» → «Всё равно запустить» в SmartScreen. Можно сверить хеш .exe с [контрольными суммами релиза](https://github.com/mnardit/beetroot-releases/releases/latest).

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

[Privacy Policy](PRIVACY.md) · [Security Policy](SECURITY.md) · [Terms of Service](TERMS.md)

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
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Скачать Beetroot</strong></a> · Нравится? Поставьте ⭐ — так другие тоже его найдут.
</p>

<p align="center">
  Создано <a href="https://max.nardit.com">Max Nardit</a>
</p>
