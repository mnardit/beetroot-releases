<p align="center">
  <img src="docs/screenshots/main.png" alt="Beetroot clipboard manager for Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  The clipboard manager Windows should have built.<br/>
  AI transforms, OCR, and fuzzy search across your full history — one shortcut away.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Version"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Free">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Download Beetroot (free)</strong></a> · <a href="https://max.nardit.com/beetroot">Website</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <b>English</b> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh.md">中文</a> · <a href="README.ja.md">日本語</a>
</p>

> **New in v1.6.0:** No-focus window — Beetroot no longer steals focus when opened. New Rust search engine with accent folding and typo tolerance. Window position presets. 4 new text transforms. [See what's new →](https://github.com/mnardit/beetroot-releases/releases/tag/v1.6.0)

---

## Why not Win+V?

| Feature | Win+V | Beetroot |
|---|---|---|
| History | 25 clips, lost on reboot | Unlimited, persists across reboots |
| Search | No | Fuzzy + regex |
| AI transforms | No | 5 cloud providers + local models, 10 built-in + custom |
| Source app tracking | No | Icon, name, window title per clip |
| OCR | No | Native Windows engine, on-device |
| Image history | Thumbnails only | Full images, stored locally |
| Themes | No | 9 themes + Auto mode + accent color |
| Plain text paste | No | Dedicated hotkey |
| Multi-monitor | No | Window follows your cursor |
| Pin on top | No | Pin + drag anywhere |
| Notes | No | Searchable annotations |

---

## See it in action

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — fuzzy search across clipboard history" width="600">
</p>

| AI Transforms | Themes |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="AI translate and fix grammar" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Theme switching" width="400"> |

<details>
<summary>More screenshots</summary>

| Dark theme | Light theme |
|---|---|
| ![Dark](docs/screenshots/main.png) | ![Light](docs/screenshots/main-light-filters.png) |

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

**Requirements:** Windows 10 or later.

---

## Features

### Search & workflow

- **5-phase search** — exact substring → word-start tokens → metadata → fuzzy. Typo-tolerant with ranked results
- **Regex mode** — `/pattern/` with match highlighting
- **Filters** — text, images, starred, notes — one click to narrow down
- **Quick paste** — `Ctrl+1..9` to paste recent clips without opening the window
- **Batch operations** — multi-select with `Ctrl+Click`, then copy (custom separator) or delete
- **Content detection** — auto-badges for URLs, emails, code, JSON, colors. ML-powered language detection (54 languages) for code preview
- **Single instance** — launching Beetroot again brings the existing window to focus

### AI transforms

- **5 cloud providers + local** — OpenAI, Gemini, Claude, DeepSeek, or local (LM Studio, Ollama), one-click switch
- **Reasoning models** — Qwen3, DeepSeek R1, and similar work out of the box (auto-strips `<think>` tags)
- **10 built-in prompts** — fix grammar, translate, summarize, rewrite, extract data, format as code, and more
- **Custom prompts** — create up to 20 of your own, accessible from the right-click menu
- **BYOK** — bring your own OpenAI key, or skip it with a local model

<details>
<summary>Recommended local models for text transforms</summary>

| Model | Size | Speed | Best for |
|-------|------|-------|----------|
| **Qwen3 8B** (Q4_K) | ~5 GB | Fast | Grammar, translation, rewriting |
| **Gemma 3 4B** (Q4_K) | ~3 GB | Very fast | Fixing typos, simple rewrites |
| **Phi-4 Mini 3.8B** (Q4_K) | ~2.5 GB | Very fast | Code and structured text |
| **Llama 3.1 8B** (Q4_K) | ~5 GB | Fast | General-purpose |
| **Mistral Small 3.1 24B** (Q4_K) | ~14 GB | Slow (16+ GB VRAM) | Premium quality |
| **DeepSeek R1 7B** (Q4_K) | ~5 GB | Fast | Complex rewrites, summarization |

Tested with [LM Studio](https://lmstudio.ai), [Ollama](https://ollama.com), and [llama.cpp](https://github.com/ggml-org/llama.cpp). Set up in Settings → AI → Local LLM.

</details>

### Source app tracking

- **See where each clip came from** — app icon, name, and window title
- **Filter by app** — "Apps" dropdown with search, sort by last used / most used / alphabetical
- **Searchable** — source app and window title included in fuzzy and regex search

### OCR

- **Extract text from images** — right-click any image → OCR
- **Native Windows engine** — no cloud, no uploads, fully offline
- **Instant** — async, never freezes the UI

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
| `Enter` | Paste selected clip |
| `Ctrl+1..9` | Quick paste |
| `Space` | Preview |
| `Alt+T` | Transform with AI |
| `Alt+P` | Pin window on top |
| `Alt+F` | Follow cursor mode |
| `Shift+F10` | Context menu |
| `Ctrl+C` | Copy to clipboard |
| `Alt+Del` | Delete |

All shortcuts are customizable in **Settings → Shortcuts**. Works with AZERTY, QWERTZ, and AltGr layouts.

---

## FAQ

**Is Beetroot free?**
Yes. Free for personal and commercial use — no ads, no trials, no feature gates, no telemetry.

**Does Beetroot send my clipboard data anywhere?**
No. Everything stays in a local SQLite database on your machine. With a local AI model, nothing ever leaves your machine. If you use a cloud AI provider (OpenAI, Gemini, Anthropic, or DeepSeek), only the text you explicitly transform is sent — directly to their API using your own key.

**Where is my API key stored?**
In the app's local settings (localStorage in the WebView2 profile). It never leaves your machine.

**Where is my data stored?**
By default in `%APPDATA%\com.beetroot.desktop\`. You can move it in Settings → Data. The database is a standard SQLite file — back it up by copying the folder.

**Does auto-update work?**
Yes, for v1.0.6+. Users on v1.0.5 or earlier need to [download manually](https://github.com/mnardit/beetroot-releases/releases/latest) once — after that, auto-update works normally. You can disable auto-update in Settings → General.

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
Beetroot is not code-signed yet (certificate pending). Click "More info" → "Run anyway" in SmartScreen. You can verify the .exe hash against the [release checksums](https://github.com/mnardit/beetroot-releases/releases/latest).

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

[Privacy Policy](PRIVACY.md) · [Security Policy](SECURITY.md) · [Terms of Service](TERMS.md)

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
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Download Beetroot</strong></a> · Enjoying it? A ⭐ helps others find it too.
</p>

<p align="center">
  Built by <a href="https://max.nardit.com">Max Nardit</a>
</p>
