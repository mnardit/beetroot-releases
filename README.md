# Beetroot

[![Latest Release](https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version)](https://github.com/mnardit/beetroot-releases/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/mnardit/beetroot-releases/total)](https://github.com/mnardit/beetroot-releases/releases)
[![Website](https://img.shields.io/badge/website-max.nardit.com%2Fbeetroot-C43D72)](https://max.nardit.com/beetroot)

**The clipboard manager Windows should have built.** AI transforms, OCR, search across your entire clipboard history.

Your data stays on your machine. No telemetry. No cloud. No account required.

**Website:** [max.nardit.com/beetroot](https://max.nardit.com/beetroot)

![Beetroot clipboard manager — dark theme](docs/screenshots/main-dark-new.png)

## See it in action

<table>
<tr>
<td align="center"><b>Search</b></td>
<td align="center"><b>AI Transforms</b></td>
</tr>
<tr>
<td><img src="docs/gif/search-demo.gif" alt="Fuzzy search demo" width="400"></td>
<td><img src="docs/gif/ai-transform.gif" alt="AI translate and fix grammar" width="400"></td>
</tr>
<tr>
<td align="center"><b>Themes</b></td>
<td align="center"><b>Settings</b></td>
</tr>
<tr>
<td><img src="docs/gif/theme-switching.gif" alt="Theme switching" width="400"></td>
<td><img src="docs/gif/settings-walkthrough.gif" alt="Settings walkthrough" width="400"></td>
</tr>
</table>

## Why I built this

I used Paste on macOS for years. When I switched to Windows, the built-in Win+V felt like a toy — 25-item limit, no search, gone after reboot. Ditto works but looks like it's from 2005. So I built the clipboard manager I wanted to use every day.

— [Max Nardit](https://max.nardit.com)

## Download

Get the latest version from [**Releases**](https://github.com/mnardit/beetroot-releases/releases/latest).

Or install via package manager:

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
> **Upgrading from v1.0.5 or earlier?** Auto-update won't work due to a signing key change. Please [download manually](https://github.com/mnardit/beetroot-releases/releases/latest). Users on v1.0.6+ get updates automatically.

**Requirements:** Windows 10 or later.

## What makes Beetroot different

### AI Transforms

Select any clipboard item and let AI rewrite it — fix grammar, translate to English, summarize, make professional, simplify, shorten, explain, extract key data, format as code, or create bullet points. 10 built-in prompts plus your own custom ones, all accessible from the right-click menu.

Bring your own OpenAI API key. No subscription to Beetroot.

![Context menu with AI transforms](docs/screenshots/context-menu.jpg)

### OCR

Copied a screenshot? Right-click it and extract the text. Runs entirely on-device using the native Windows OCR engine. No uploads, no external services, instant.

### Search

Find that thing you copied three weeks ago. Fuzzy search handles typos, regex mode for power users. Filter by type — text, images, pinned items, or notes.

![Fuzzy search in action](docs/screenshots/search-results.png)

### Pin Window

Keep Beetroot visible while you work. Pin it on top and drag it anywhere between monitors — it stays on top and doesn't hide when you click away. Or switch to follow-cursor mode so the window pops up right where your mouse is.

## Beetroot vs Win+V

| | Win+V | Beetroot |
|---|---|---|
| AI transforms | — | 10 built-in + custom prompts |
| Search | — | Fuzzy + regex |
| OCR | — | Native, on-device |
| Image history | Thumbnails, limited | Full images, stored locally |
| History size | 25 items, lost on reboot | Unlimited, persists forever |
| Themes | — | 9 themes + custom accent |
| Plain text paste | — | Dedicated hotkey |
| Multi-monitor | — | Window follows your cursor |
| Pin on top | — | Pin + drag anywhere |
| Notes | — | Searchable annotations |

## All features

- **Unlimited history** — every text and image you copy, persisted across reboots
- **Pin and notes** — pin important items, annotate with searchable notes
- **9 themes** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, Pure Dark (OLED black), plus Auto mode
- **Window effects** — Glass, Frosted, or Solid transparency. Mica on Windows 11.
- **Typography** — customizable UI font (8 presets) and code font (5 presets) with adjustable size
- **Global hotkeys** — default `Ctrl+`` `, fully configurable. Works with any keyboard layout (AZERTY, QWERTZ, AltGr). Separate hotkey for plain text paste. Instant layout detection when switching with Win+Space.
- **Keyboard-first** — `Ctrl+1..9` quick paste, `Alt+T` AI transform, `Space` preview, `Alt+P` pin, `Ctrl+C` copy, `Alt+Del` delete
- **Content detection** — auto-badges for URLs, emails, code, JSON, colors. Click to open URLs.
- **Batch operations** — multi-select with `Ctrl+Click`, then batch delete or copy with separator
- **Syntax highlighting** — automatic language detection in preview
- **Auto-update** — one-click updates, or disable in Settings for fully offline operation
- **15 languages** — English, Russian, German, Spanish, Chinese, Japanese, French, Portuguese, Korean, Turkish, Italian, Polish, Dutch, Ukrainian, Thai
- **Pin window on top** — always-on-top, drag between monitors, or follow-cursor mode
- **Never lose your data** — automatic backup rotation (3 copies + snapshot before each update), auto-recovery from corruption, warns if your data sits in OneDrive/Dropbox/Google Drive

## Screenshots

| Dark theme | Light theme |
|---|---|
| ![Dark](docs/screenshots/main-dark-new.png) | ![Light](docs/screenshots/main-light-filters.png) |

| Context menu & AI | Code preview |
|---|---|
| ![Context menu](docs/screenshots/context-menu.jpg) | ![Preview](docs/screenshots/preview-code.png) |

| Search | AI Transform menu |
|---|---|
| ![Search](docs/screenshots/search-results.png) | ![Transforms](docs/screenshots/transform-menu.png) |

| Settings | Rose theme |
|---|---|
| ![Settings](docs/screenshots/settings-languages.png) | ![Rose](docs/screenshots/settings-general-new.png) |

## License

Beetroot is free for personal and commercial use. Source code is proprietary.

### Third-party fonts

Beetroot bundles the following fonts under the [SIL Open Font License 1.1](https://openfontlicense.org/):

- [Inter](https://github.com/rsms/inter) — Copyright 2020 The Inter Project Authors
- [Open Sans](https://github.com/googlefonts/opensans) — Copyright 2020 The Open Sans Project Authors
- [Montserrat](https://github.com/JulietaUla/montserrat) — Copyright 2011 The Montserrat Project Authors
- [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) — Copyright 2022 The Noto Project Authors
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — Copyright 2020 The JetBrains Mono Project Authors

Built with Tauri, React, and Rust.
