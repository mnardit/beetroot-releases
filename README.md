# Beetroot

**A smart clipboard manager for Windows with built-in AI transforms.**

## Download

Get the latest version from [Releases](https://github.com/mnardit/beetroot-releases/releases).

**Windows Installer (recommended):** Download `Beetroot_x64-setup.exe`

## Features

- **AI-powered text transforms** — Summarize, fix grammar, translate, rewrite, format as code. 10 built-in prompts, custom prompts with quick-access.
- **Unlimited clipboard history** — Text and images, persisted across reboots. Pin important items.
- **Fuzzy search and regex filtering** — Find anything instantly. Filter by type: text, images, pinned, notes.
- **OCR text extraction** — Right-click any image to extract text using native Windows OCR.
- **Notes on clipboard items** — Annotate any entry with a note for later context.
- **8 themes + custom accent color** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, plus Auto mode.
- **Window effects** — Glass, Frosted, or Solid transparency with Mica on Windows 11.
- **Global hotkey** — Default `Ctrl+`` to show/hide. Fully configurable.
- **Multi-monitor aware** — Window appears on the monitor where your cursor is.
- **Keyboard-first** — `Ctrl+1..9` quick paste, `Alt+T` transform, `Space` preview, arrow keys navigation.
- **Batch operations** — Multi-select, batch delete or copy with configurable separator.
- **Auto-update** — Built-in updater checks for new versions.
- **i18n** — English and Russian.

## Why not Win+V?

| Feature | Win+V | Beetroot |
|---|---|---|
| AI transforms | No | Summarize, translate, rewrite, custom prompts |
| Search | No | Fuzzy search + regex |
| Image history | Thumbnails only | Full images stored locally |
| OCR | No | Native Windows OCR |
| History limit | 25 items | Unlimited |
| Persists across reboots | No | Yes |
| Themes | No | 8 themes + custom accent color |
| Multi-monitor | No | Follows cursor |
| Notes on items | No | Yes |

## Install

Download the latest `.exe` installer from [Releases](https://github.com/mnardit/beetroot-releases/releases).

Package manager support (coming soon):

```
winget install beetroot
scoop install beetroot
```

**Requirements:** Windows 10 or later.

## Tech stack

Tauri v2 (Rust backend) + React 19 + TypeScript + SQLite + Vite

## License

Beetroot is free for personal and commercial use. Source code is proprietary.
