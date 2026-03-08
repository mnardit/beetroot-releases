<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot clipboard manager for Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  The clipboard manager Windows should have built.<br/>
  AI transforms, OCR, fuzzy search across unlimited history — all from one keyboard shortcut.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Version"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Free">
  <img src="https://img.shields.io/badge/source-proprietary-orange" alt="Proprietary">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Download</strong></a> · <a href="https://max.nardit.com/beetroot">Website</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <b>English</b> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh.md">中文</a> · <a href="README.ja.md">日本語</a>
</p>

> This repo hosts releases and documentation. Source code is proprietary.

---

## See it in action

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — fuzzy search across clipboard history" width="600">
</p>

| AI Transforms | Themes |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="AI translate and fix grammar" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Theme switching" width="400"> |

| Dark theme | Light theme |
|---|---|
| ![Dark](docs/screenshots/main-dark-new.png) | ![Light](docs/screenshots/main-light-filters.png) |

<details>
<summary>More screenshots</summary>

| Context menu & AI | Code preview |
|---|---|
| ![Context menu](docs/screenshots/context-menu.jpg) | ![Preview](docs/screenshots/preview-code.png) |

| Search | AI Transform menu |
|---|---|
| ![Search](docs/screenshots/search-results.png) | ![Transforms](docs/screenshots/transform-menu.png) |

| Settings | Languages |
|---|---|
| ![Settings](docs/screenshots/settings-general-new.png) | ![Languages](docs/screenshots/settings-languages.png) |

</details>

---

## Install

**[Download the latest .exe from GitHub Releases](https://github.com/mnardit/beetroot-releases/releases/latest)**

Or use a package manager:

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
> **Upgrading from v1.0.5 or earlier?** Auto-update won't work due to a one-time signing key change. [Download the latest version manually](https://github.com/mnardit/beetroot-releases/releases/latest) — all future updates will work automatically.

**Requirements:** Windows 10 or later.

---

## Why not Win+V?

| Feature | Win+V | Beetroot |
|---|---|---|
| History | 25 items, lost on reboot | Unlimited, persists forever |
| Search | No | Fuzzy + regex |
| AI transforms | No | 10 built-in + custom prompts |
| OCR | No | Native Windows engine, on-device |
| Image history | Thumbnails only | Full images, stored locally |
| Themes | No | 9 themes + Auto mode + accent color |
| Plain text paste | No | Dedicated hotkey |
| Multi-monitor | No | Window follows your cursor |
| Pin on top | No | Pin + drag anywhere |
| Notes | No | Searchable annotations |

---

## Quick start

1. **Install** — download .exe or use winget/scoop/choco
2. **Open** — press `` Ctrl+` `` (customizable) to show Beetroot
3. **Search** — start typing to fuzzy-search your history, or use `/regex/`
4. **Star & annotate** — right-click → Star to keep items on top, add notes for context
5. **AI & OCR** — right-click → Transform for AI, or right-click an image → OCR

---

## Table of contents

- [Features](#features)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [FAQ](#faq)
- [Privacy & security](#privacy--security)
- [Troubleshooting](#troubleshooting)
- [Feedback & bug reports](#feedback--bug-reports)
- [License](#license)

---

## Features

### Search & workflow

- **Fuzzy search** — find anything with typo tolerance, powered by in-memory index
- **Regex mode** — `/pattern/` for power users with match highlighting
- **Filters** — text, images, starred, notes — one click to narrow down
- **Quick paste** — `Ctrl+1..9` to paste recent items without opening the window
- **Batch operations** — multi-select with `Ctrl+Click`, batch copy with custom separator or delete
- **Content detection** — auto-badges for URLs, emails, code, JSON, colors; click to open URLs
- **Single instance** — launching Beetroot again brings the existing window to focus

### AI transforms

- **10 built-in prompts** — fix grammar, translate, summarize, rewrite, extract data, format as code, and more
- **Custom prompts** — create up to 20 of your own, accessible from the right-click menu
- **BYOK** — bring your own OpenAI API key; Beetroot never stores or proxies your data
- **GPT-5 nano/mini** — fast and cheap, optimized for short text transforms

### OCR

- **Extract text from images** — right-click any image → OCR
- **Native Windows engine** — no cloud, no uploads, works fully offline
- **Instant** — runs asynchronously, doesn't freeze the app

### Customization

- **9 themes** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, Pure Dark (OLED #000000), plus Auto mode
- **Window effects** — Mica, Acrylic, or Solid; auto-detected by Windows version
- **Typography** — 8 UI fonts, 5 code fonts, 6 size presets
- **26 languages** — EN, RU, DE, ES, ZH, JA, FR, PT, KO, TR, IT, PL, NL, UK, TH, HI, ID, VI, CS, HU, RO, SV, DA, FI, NB, MS
- **Pin window** — always-on-top, drag between monitors, or follow-cursor mode
- **All shortcuts customizable** — remap everything in Settings → Shortcuts; AZERTY, QWERTZ, AltGr supported

### Reliability

- **Automatic backups** — 3-copy rotation + snapshot before every update
- **Auto-recovery** — detects corruption, restores from backup silently
- **Cloud sync warnings** — alerts if data folder is inside OneDrive, Dropbox, or Google Drive
- **Drive detection** — warns before writing to USB or network drives
- **Auto-update** — built-in updater, or disable for fully offline operation

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `` Ctrl+` `` | Show / hide Beetroot |
| `Enter` | Paste selected item |
| `Ctrl+1..9` | Quick paste |
| `Space` | Preview |
| `Alt+T` | Transform with AI |
| `Alt+P` | Pin window on top |
| `Alt+F` | Follow cursor mode |
| `Shift+F10` | Context menu |
| `Ctrl+C` | Copy to clipboard |
| `Alt+Del` | Delete |

All shortcuts are customizable in **Settings → Shortcuts**. Works with AZERTY, QWERTZ, and AltGr layouts. Layout labels update instantly when you switch with Win+Space.

---

## FAQ

**Is Beetroot free?**
Yes. Free for personal and commercial use — no ads, no trials, no feature gates, no telemetry.

**Does Beetroot send my clipboard data anywhere?**
No. Everything stays in a local SQLite database on your machine. AI transforms send only the selected text to the OpenAI API when you explicitly choose to transform — and only using your own API key.

**What exactly is sent to OpenAI?**
Only the text you right-click → Transform. The request goes directly from your machine to the OpenAI API. Beetroot never sees, stores, or proxies your data. No API key = zero network requests.

**Where is my API key stored?**
In the app's local settings (localStorage in the WebView2 profile). It never leaves your machine.

**Where is my data stored?**
By default in `%LOCALAPPDATA%\com.beetroot.desktop\`. You can move it in Settings → Data. The database is a standard SQLite file — back it up by copying the folder.

**Does Beetroot work on Windows 10?**
Yes. Windows 10 and 11 are both supported. Mica and Acrylic window effects are available on Windows 11.

**Can I run multiple Beetroot windows?**
No. Beetroot is single-instance — launching it again brings the existing window to focus.

**Does auto-update work?**
Yes, for v1.0.6+. Users on v1.0.5 or earlier need to [download manually](https://github.com/mnardit/beetroot-releases/releases/latest) once — after that, auto-update works normally. You can disable auto-update in Settings → General.

---

## Privacy & security

Your data stays on your machine. No telemetry, no analytics, no cloud sync, no account.

- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Terms of Service](TERMS.md)

---

## Troubleshooting

**Auto-update not working (v1.0.5 or earlier)**
A one-time signing key change means you need to [download the latest version manually](https://github.com/mnardit/beetroot-releases/releases/latest). Future updates will work automatically.

**OCR not working or low quality**
OCR uses the native Windows engine. Make sure the relevant language pack is installed: Settings → Time & Language → Language → Add a language → check "Speech" or "Basic typing".

**Beetroot doesn't open or hotkey doesn't work**
- Check if another app is using the same hotkey (e.g. `Ctrl+``)
- Try running as administrator once to rule out permission issues
- Remap the hotkey in Settings → Shortcuts

**SmartScreen or antivirus warning**
Beetroot is not code-signed yet (certificate pending). Click "More info" → "Run anyway" in SmartScreen. This is a false positive — the app is safe.

---

## Feedback & bug reports

Found a bug or have a feature request? [Open an issue](https://github.com/mnardit/beetroot-releases/issues).

Please include:
- Beetroot version (Settings → About)
- Windows version (`winver`)
- Steps to reproduce
- Screenshot or error message if applicable

---

## License

Free for personal and commercial use. Source code is proprietary.

<details>
<summary>Third-party fonts & credits</summary>

**Fonts** (SIL Open Font License 1.1):
- [Inter](https://github.com/rsms/inter) — Copyright 2020 The Inter Project Authors
- [Open Sans](https://github.com/googlefonts/opensans) — Copyright 2020 The Open Sans Project Authors
- [Montserrat](https://github.com/JulietaUla/montserrat) — Copyright 2011 The Montserrat Project Authors
- [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) — Copyright 2022 The Noto Project Authors
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — Copyright 2020 The JetBrains Mono Project Authors

**Built with:** [Tauri v2](https://tauri.app/) · React 19 · Rust · SQLite · TypeScript

</details>

---

<p align="center">
  Built by <a href="https://max.nardit.com">Max Nardit</a>
</p>
