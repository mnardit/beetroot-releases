# Changelog

All notable changes to Beetroot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

These changes are in the source repository and planned for 1.6.7. They are not included in the current 1.6.6 installer.

### Open Source

- **Beetroot is open source under Apache 2.0**, with contributor setup instructions and attribution to its creator, Max Nardit. Explore the code, report bugs or help improve it.

### Improvements and Fixes

- **More reliable pasting** when searching history and switching between normal, follow-cursor and always-on-top modes. Reopening from the tray does not reuse an old paste destination.
- **Better Explorer interactions**, including file and folder rename handling and clear copy-only feedback when the original input field is no longer available.
- **Copy-only confirmation after the popup closes**: when automatic paste is cancelled because keys remain held or the destination changes, the existing "Copied" overlay confirms the result if enabled.
- **More dependable history**: fixes for undoing deletions, restoring images, moving the data folder and reopening an already-running app.
- **Safer AI key storage** in Windows Credential Manager, with migration from older settings and retry when a key cannot be moved.
- **AI fixes** for saving completed results, handling provider errors and DeepSeek reasoning responses.
- **Search and responsiveness fixes**, including Unicode highlighting and background database work.

### Known Limitations

- On one Windows 11 test installation, the first **Show in Explorer** action opened the correct folder without selecting the image. This also occurred with Beetroot closed; the cause is still under investigation.
- Selecting from a pinned window, reopening without a fresh paste target, or losing the original input field can intentionally copy without automatic paste. Focus the destination and paste manually.

## [1.6.6] - 2026-05-02

### Improvements and Fixes

- Copying cells from Excel, Word and PowerPoint now preserves text instead of capturing an image.
- Password-manager clipboard exclusion markers are respected more reliably.
- Fixed autostart for Microsoft Store installations.
- Improved text contrast on custom accent colors and keyboard access to settings.
- Distinct rapid copies are retained; copying from the preview no longer creates duplicate history entries.
- Smaller image thumbnails and cleanup of completed AI jobs reduce memory use.
- Settings, update checks and AI submissions report failures more clearly.
- Improved plain-text paste targeting, Escape handling and note editing during preview navigation.
- Cancel automatic paste when the foreground window changes, and report attempts to paste into elevated applications.

### Security and Reliability

- Strengthened validation of image paths before saving database entries and deleting image files.
- PNG file capture now checks the actual file format; unsupported image files are not stored as unreadable PNGs.
- Clipboard-format read failures skip capture, preserving password-manager exclusions.
- Limited image reads and queued AI payloads, and reduced permissions available to the copied notification overlay.
- Improved database migration consistency, image undo feedback and release-package validation.

[Published release notes](https://github.com/mnardit/beetroot-releases/releases/tag/v1.6.6)

## [1.6.5] - 2026-04-04

### New features

- **Background AI job queue** — AI transforms now execute in a Rust background thread instead of blocking the React UI. Click an AI prompt → menu closes instantly → toast notification when done (result already in clipboard). Supports queueing multiple transforms in sequence
- **All AI providers in Rust** — OpenAI, Anthropic, Gemini, DeepSeek, and Local/Ollama API calls moved from webview fetch to `ureq` HTTP client. Eliminates CORS issues, works reliably when window is hidden, and removes the need for Vite dev proxy
- **Native Windows notifications** — when the Beetroot window is hidden during an AI transform, a Windows native notification appears instead of a toast. Click to bring Beetroot to front
- **Job cancellation** — queued (not yet running) jobs can be cancelled via `cancel_job` IPC command
- **AI Vision Transforms** — analyze images with cloud AI (GPT-4o, Claude, Gemini) or local models (Ollama). 5 built-in vision prompts: Read Text, Describe Image, Extract Data, Summarize Image, Translate Image Text. Custom vision prompts supported. AI button in preview panel for images. Type selector (Text/Image) in prompt editor. Ollama vision via native `/api/chat` with LM Studio fallback

### Improvements

- **AI results saved to history** — transform results are automatically saved to clipboard history with source "AI" and a label showing the prompt name and model used
- **Simplified AI UI** — TransformMenu and ContextMenu no longer show loading spinners or error states inline. Fire-and-forget UX with async notification

### Bug fixes

- **Fixed Anthropic Sonnet vision** — Sonnet returns thinking blocks before text; now finds first `type: "text"` content block instead of taking `content[0]`
- **Fixed LM Studio vision** — LM Studio returns 200 + `{"error": ...}` on Ollama `/api/chat` (not 404); now detects error field and falls back to OpenAI-compatible format
- **Fixed AI menu stuck on IPC error** — `submitJob` wrapped in `try/finally` so TransformMenu and ContextMenu always close
- **Fixed running job stuck after panic** — worker crash now marks both Running and Queued jobs as Failed
- **Fixed Settings cancel not rolling back fonts** — `handleCancel` now resets `--font-ui` and `--font-code` CSS vars
- **Fixed quickAccess limit shared across types** — text and image prompts now have independent 5-slot quick-access limits
- **Fixed error toast unreadable** — white text on danger background (was using `--text-on-accent` which could be dark)
- **Fixed vision soft error false positives** — error detection only on responses < 150 chars, narrowed phrases
- **Fixed legacy model fallback** — Settings draft default corrected from `gpt-5-nano` to `gpt-5.4-nano`

### Improvements

- **Localized time ago** — preview panel timestamps use `Intl.RelativeTimeFormat` (auto-detects language)
- **Translated "Set Local LLM endpoint"** — `transform.noEndpoint` now in all 26 languages
- **PreviewPanel OCR/AI labels** — extracted to i18n keys

## [1.6.4] - 2026-03-28

### New features

- **Preview panel redesign** — three content-aware modes (text/code/image). New header with human-readable app names (30-app mapping + fallback), type badge [Text]/[PHP]/[Image], and relative timestamp. Action bar with Copy, Transform, OCR (image), Wrap toggle (code), and ⋯More dropdown (Paste, Copy plain, Delete). Code mode has line numbers (non-selectable) and wrap toggle (hotkey W). Image mode has dark background and Fit↔1:1 click toggle. Adaptive height — short content compact, long content scrolls at 60vh
- **Overlay position, duration, and animation settings** — customize where the "Copied" notification appears (Near cursor / Top center / Bottom center), how long it stays visible (Quick 350ms / Comfortable 1s / Visible 2.5s), and exit animation (Fade down / Fade up / Fade / Scale down / Pop / Blur). Three dropdowns in Settings > General, hidden when notification is off. 15 new i18n keys across 26 languages

### Bug fixes

- **Fixed "Copied" overlay blocking clicks after fadeout** — Tauri's `w.hide()` could fail silently for WebView2 windows, leaving an invisible but click-intercepting area. Now uses raw Win32 `ShowWindow(SW_HIDE)` + move offscreen as belt-and-suspenders. Added safety timer: 500ms after hide, verifies window is hidden via `IsWindowVisible` — if not, repeats force-hide with warning log
- **Fixed overlay settings not saved** — Position and Duration dropdowns rendered but values were never persisted to localStorage. `DraftSettings`, `initDraft()`, and `handleSave()` were missing the new fields
- **Fixed ghost search highlights** — single-char queries (especially Cyrillic) caused green highlighted characters to persist after clearing search. Match indices from Rust fuzzy search were not clamped to the 200-char IPC truncation boundary, causing `highlightText()` to render at invalid positions
- **Fixed state not reset in no-focus mode** — `rememberTypeFilter`, query, selectedIndex, appFilter, and multiSelected were not reset when window re-showed in no-focus mode (`tauri://focus` doesn't fire with `SW_SHOWNOACTIVATE`). Filter stayed on Images/Starred after hide→show
- **Fixed image dimensions disappearing in preview** — note updates reset `imgDimensions` to null via shared useEffect, but browser didn't re-fire `onLoad` for already-loaded images. Split into separate effects for item.id (full reset) and item.note (sync only). Added ref callback fallback for cached data: URLs
- **Fixed raw HTML tags shown in code preview during search** — search highlight was rendering hljs HTML as plain text, showing `<span class="hljs-...">` tags. Now uses raw source lines when search is active
- **Fixed app name mapping** — hardcoded curated names (e.g. "Sublime Text") now take priority over OS display names from appIcons cache

## [1.6.3] - 2026-03-24

### New features

- **System-wide "Copied" overlay** — a small frosted-glass pill appears near the cursor for 1 second whenever you copy something, confirming Beetroot captured it. Works even when the main window is hidden. Adapts to the active theme and accent color. Click-through, no focus steal. Toggle in Settings > General (enabled by default). 26 languages supported

### Improvements

- **Updated OpenAI models** — default models upgraded from `gpt-5-nano`/`gpt-5-mini` to `gpt-5.4-nano`/`gpt-5.4-mini`. GPT-5.4 mini is 2x faster with improved coding and reasoning. Existing users with legacy models are auto-migrated on launch

### Bug fixes

- **Fixed images copied from Explorer not captured** — copying image files (PNG, JPG, etc.) in Windows Explorer uses CF_HDROP (file paths) instead of CF_BITMAP. The clipboard plugin's priority checked files before images, and with `files: false` it skipped both, falling through to text. Replaced the plugin's `listenToClipboard` with a custom handler that checks bitmap first (Snipping Tool, browser, Telegram), then reads image files from CF_HDROP paths (Explorer), then falls back to text. New Rust command `read_clipboard_image_file` reads arbitrary image files from disk with extension validation and 50 MB size limit
- **Fixed new note text lost on re-edit** — after adding a note to a clip and clicking the note again to edit, the input field appeared empty. The input used `item.note` (async prop from DB) as default value, which was still `undefined` for newly created notes. Now uses the synchronous `localNote` state which is updated immediately on input

### Security

- **Hardened `read_clipboard_image_file` IPC** — added path canonicalization (resolves `..`, symlinks, junctions), UNC/network path blocking, and system directory rejection. Prevents path traversal if webview is compromised

## [1.6.2] - 2026-03-23

### Bug fixes

- Fixed Apps filter showing wrong item count when combined with type filter (Starred/Text/Notes) — dropdown showed total count per app, but selecting an app with zero items in the active type filter showed "Clipboard history is empty". App counts now reflect the active type filter
- **Fixed all truncated content paths** — context menu AI quick-access prompts (Fix Grammar, Summarize, etc.), preview panel, and preview arrow navigation all used truncated 200-char search results instead of full content. AI transforms received incomplete text, preview showed partial content with wrong line/char counts, copy from preview copied truncated text. All paths now `await dbGetItem()` for full content before use
- Fixed Alt+T not toggling transform menu closed — overlay guard blocked the second Alt+T press. Now Alt+T passes through the guard in both focused and no-focus modes

## [1.6.1] - 2026-03-23

### New features

- **Preview panel overhaul** — dynamic header shows source app icon, content type, and primary stat (e.g. "Chrome · Text · 178 chars" or "PHP · Sublime Text · 93 lines") instead of static "Preview" label. Note field collapsed by default with pencil icon — click to expand. Excessive borders removed (4→1). Footer shows context-aware keyboard hints
- **Arrow navigation in preview** — ↑↓ keys change the previewed item without closing preview, enabling rapid review flow
- **Auto-activate for terminals** — Beetroot detects when the foreground app is a terminal (PowerShell, cmd, Windows Terminal, Alacritty, etc.) and automatically activates in focused mode. No-focus mode's key suppression doesn't work reliably with console apps — this ensures full keyboard functionality in terminals while preserving no-focus behavior for GUI apps

### Improvements

- **Keyboard hook architecture overhaul** — three-layer system: WH_KEYBOARD_LL for modifier-less keys (arrows, Space, Enter, Escape), RegisterHotKey for modifier combos (Ctrl+C, Alt+S), eval() for direct JS execution bypassing Tauri event system (which failed to deliver events without focus)
- **Hook reinstallation on every show** — recovers from silent removal by Win11 (removes LL hooks if callbacks exceed LowLevelHooksTimeout)
- **Non-poisoning database mutex** — replaced `std::sync::Mutex` with `parking_lot::Mutex` for DbPool. Panics in closures no longer cascade to all subsequent DB operations
- **Race-free clipboard source app capture** — WM_CLIPBOARDUPDATE listener captures GetForegroundWindow() at the exact moment of clipboard change, eliminating race where source app was wrong if user switched windows during async IPC resolution
- **Preview footer hints translated** — all 26 locales now have translated preview keyboard hints instead of English-only

### Bug fixes

- **Fixed keyboard navigation not working in no-focus mode** — Tauri event system (`app_handle.emit()`) silently failed to deliver events to unfocused WebView. Replaced with `win.eval()` for direct JS execution — works regardless of focus state
- Fixed Enter/Ctrl+C blocked in preview overlay in no-focus mode — overlay guard blocked all actions except Space
- Fixed note text truncated in preview — nowrap/ellipsis replaced with pre-wrap
- Fixed note edits not persisting when navigating with arrows in preview — optimistic local state + save on unmount
- Fixed first keypress after startup ignored — React useEffect hadn't defined `__beetrootNav`/`__beetrootAction` globals yet. Added try/catch with 150ms retry
- Removed dead code: INPUT_FOCUSED atomic, unused nav_id constants 100-108, stale debug logs

## [1.6.0] - 2026-03-21

### New features

- **No-focus window (Win+V behavior)** — Beetroot no longer steals focus when opened via hotkey. F2-rename in Explorer, IDE refactoring, and other focus-sensitive operations are no longer interrupted. Navigate with arrows, preview with Space (toggle), select with Enter, star with Alt+S, delete with Alt+Delete, click items to paste — all without leaving the current app. Click outside to dismiss. Escape always closes. Click search bar to activate for typing. Pinned mode retains focused behavior
- **Space toggles preview** — pressing Space opens preview, pressing again closes it (works in all modes)
- **Rust-powered search engine** — 5-phase search (contiguous substring → word-start tokens → secondary fields → fuzzy via Levenshtein edit distance) runs entirely in Rust via single `search_items` IPC call. Returns results, match indices for highlighting, and filter counts. Replaces JS Fuse.js. Scales to 100K+ items without loading all items into JS memory. Includes:
  - **Accent folding** — "cafe" finds "café", "uber" finds "über", "nino" finds "niño" (via Unicode NFD normalization)
  - **Whitespace normalization** — non-breaking spaces (from Word/web copy-paste) normalized to regular spaces
  - **Word-level fuzzy** — typo matching operates on individual words, not full text, preventing scattered-letter noise
  - **Prefix matching** — "lover" finds items containing "love", "lov" finds "love"
  - **Multi-word fuzzy** — "motivating exmple" finds "motivating example" (each word matched independently)
- **4 new text transforms** — Remove spaces (IBAN, card numbers), Single line (merge multiline text), Sort lines (alphabetical), Remove duplicates (deduplicate lists). Total: 8 built-in transforms
- **Remember selected filter** — new setting (off by default) to keep the last selected filter (Starred, Text, Image, Notes) between window opens instead of resetting to All
- **Transform menu search** — quick-filter input at the top of the Transform menu (Alt+T) to find transforms and AI prompts by name. Appears when 6+ items are available
- **Window position setting** — choose where the window appears on the monitor: Center, Top Left, Top Right, Bottom Left, Bottom Right. Respects DPI scaling and multi-monitor setups
- **Always-on-top on hotkey** — window now temporarily sets always-on-top when opened via hotkey, ensuring it appears above other always-on-top windows (Task Manager, media players). Reverts after 200ms unless pinned

### Improvements

- **Dynamic hotkey in onboarding** — welcome guide now shows the actual configured hotkey instead of hardcoded Ctrl+`
- **Image source app tracking** — images now capture source app and window title, fixing incomplete Apps filter
- **AI Transform menu CTA** — shows "Set API key in Settings" message instead of 10 greyed-out prompts when no API key is configured
- **Pinned mode paste feedback** — shows "Copied to clipboard" toast when pasting in pinned (always-on-top) mode
- **Regex search highlighting** — matches in notes, source app, and window title now show highlight indices instead of empty markers
- **Localized timestamps** — "now", "3m", "5h", "2d" labels now use the system language via `Intl.RelativeTimeFormat`
- **Localized error screen** — crash recovery screen respects the active language instead of always showing English
- **Database stats query optimized** — single query instead of 4 separate COUNT queries
- **Backup coverage expanded** — star, note, touch, and delete operations now trigger periodic backups (previously only clipboard capture did)
- **Transform bumps last_used** — transformed items move to the top of the list
- **Incremental list updates** — clipboard writes update the list in-place instead of reloading all 500 items from the database (eliminates 1 IPC round-trip per write)
- **Better multiline preview** — collapsed whitespace (tabs, multiple spaces, newlines) in list item preview for denser, more readable summaries
- **Context-aware footer hints** — "Space preview" hint hidden when search has text (Space types into search, not preview)
- **Deduplicated API key test** — 4 identical test handlers (85 lines) replaced with single reusable function
- **Unicode Title Case** — "Title Case" transform now works with Cyrillic, CJK, Arabic, and other non-Latin scripts
- **Better AI error messages** — rate limits (429), content filter blocks, and malformed responses now show specific messages instead of generic errors
- **ReDoS protection** — user-provided regex patterns timeout after 500ms to prevent UI freeze on catastrophic backtracking
- **Timestamps follow app language** — time labels ("5 мин. назад") now use the in-app language setting, not the OS locale

### Bug fixes

- Fixed Snipping Tool (Win+Shift+S) images not captured — two issues: (1) `CanIncludeInClipboardHistory` format false-positive as password manager, (2) clipboard plugin checked `hasFiles()` first and Snipping Tool sets file format, causing early return before image detection. Fix: removed false-positive formats + `files: false` in clipboard listener
- Fixed regex zero-length match crash — patterns like `^`, `a*`, `b?` no longer cause usize underflow panic
- Fixed Anthropic AI transforms leaking `<think>` tags (missing `stripThinkTags` call)
- Fixed TransformMenu AI result applying after menu was already closed (added unmount guard)
- Fixed overlays (preview, transform, context menu) persisting across no-focus hide/show cycles
- Fixed starred items sorting to top on All tab — now strictly chronological (`last_used DESC`)
- Fixed "Normalize whitespace" and "Remove spaces" having identical translations in 12 locales
- Fixed AI transforms showing leftover `<think>` blocks from DeepSeek/Qwen reasoning models when response contains multiple thinking sections
- Fixed local AI endpoint test and model list blocking the UI thread for up to 5 seconds (now runs in background)
- Fixed Escape key held down accumulating orphaned keyup listeners
- Fixed clipboard monitor setup race on rapid sleep/wake cycles
- Fixed PreviewPanel copy button failing silently instead of showing error toast
- Fixed rich text paste creating duplicate entries — suppress counter now handles multi-format clipboard events (text + HTML)
- Fixed search highlight appearing at wrong position on multiline clips after whitespace collapse
- Fixed ErrorBoundary allowing infinite retry loops — now limited to 3 attempts
- Removed dead code: sqlx migration shim, `validate_file_path`, `HotkeyManager::stop()`, `getDbUrl`/`writeFile`/`readFile` stubs, msedge self-alias

## [1.5.1] - 2026-03-14

> [Release article](https://max.nardit.com/articles/beetroot-v1-5-1) · [Search redesign deep dive](https://max.nardit.com/articles/beetroot-search-redesign)

### New features

- **ML language detection for code** — uses VS Code's TensorFlow.js model (54 languages) for accurate syntax highlighting in the preview panel. Rust, Go, Swift, Ruby, PHP and other languages now correctly detected and highlighted instead of guessing
- **Redesigned search engine** — cascading 5-phase search replaces pure Fuse.js: exact phrase → word-start tokens → secondary fields → fuzzy. Typical queries return 9 results instead of 98
- **Search fragment preview** — long clipboard entries show the matching fragment with "..." prefix instead of always showing the first 100 characters
- **Search highlight in notes & window titles** — matches highlighted in note subtitles and source window titles, not just in the main content

### Improvements

- **Smart field priority** — searches content and notes first; window titles and app names only used as fallback when content has few matches
- **Unicode word-boundary matching** — search tokens only match at word starts (after space, underscore, hyphen, or camelCase). "port" no longer matches inside "import". Works with Cyrillic and other scripts
- **Score-based ranking** — exact phrase > word-start tokens > metadata > fuzzy. Best matches always on top
- **Expanded code recognition** — Rust (`fn`, `impl`, `println!`), Go (`func`, `defer`, `fmt.`), Swift (`guard let`), Ruby (`attr_accessor`), PHP (`<?php`) and JS/TS object literals now correctly classified as code
- **Typo tolerance always available** — fuzzy results merge at low priority when few exact matches found, so misspellings like "timout" still find "timeout"

### Bug fixes

- Fixed source app icon changing to Beetroot after clipboard monitor re-initialization on window focus
- Fixed AI transforms stuck at "processing" in dev mode
- Fixed React StrictMode double-mount breaking async AI transform results
- Fixed source_app overwrite after AI transform paste

## [1.5.0] - 2026-03-12

### New features

- **Anthropic Claude provider** — fourth AI provider with BYOK, 2 models: claude-haiku-4-5 (fast & cheap) and claude-sonnet-4-6 (balanced). Native Messages API with `x-api-key` auth, API key test, model selector chips
- **DeepSeek provider** — fifth AI provider with BYOK, 2 models: deepseek-chat V3 (fast & versatile) and deepseek-reasoner R1 (deep reasoning). OpenAI-compatible API, API key test, model selector chips
- **Google Gemini provider** — third AI provider with BYOK, 2 models: gemini-2.5-flash-lite (cheapest) and gemini-2.5-flash (balanced). API key test, model selector chips
- AI-generated clipboard entries now display a sparkles icon in the list and Apps filter dropdown
- **Window icon extraction for wrapper processes** — Java, Python, Electron apps show their real window icon instead of generic `javaw.exe`/`python.exe`
- **Self-process detection** — copying from Beetroot's own preview panel shows Beetroot as source app
- **Window title in search results** — matching window titles shown as subtitle under the content
- **Notes subtitle in list** — items with notes display note text under the content

### Improvements

- **AI transform metadata in preview** — pressing Space on AI entries shows the prompt name and model used (e.g. "Any to English · gpt-5-nano")
- **Local LLM endpoint presets** — LM Studio, Ollama, Custom buttons for quick endpoint selection
- **Ollama auto-fetch models** — model dropdown loads automatically when Settings opens
- **Model dropdown** — after successful connection test, shows all available models with refresh button
- **Test button UX** — green checkmark on success, red on failure, inline in the button
- **App name cleanup** — strips trailing version numbers and parenthetical suffixes
- **Cross-process icon fallback** — WebView2/CEF subprocesses fall back to parent process icon
- All 5 AI provider descriptions translated in 26 languages
- Images no longer get `source_app` assigned — excluded from App filter

### Bug fixes

- Fixed SSRF vulnerability in local AI endpoint validation — `localhost.evil.com` was accepted as loopback; now checks host boundary after hostname
- Fixed window staying open after AI transform when pinned — now copies without hiding, same as regular paste
- Fixed local AI calls blocking Tauri async thread pool — moved to `spawn_blocking`
- Fixed Ollama auto-refresh not triggering when endpoint URL changes
- Fixed LM Studio model name not updating on reconnect — Test button always refreshes the model
- Fixed `<think>` tags from reasoning models (DeepSeek R1, Qwen3) leaking into cloud AI transform results
- Fixed API key test buttons hanging forever when API is unreachable — added 15s abort timeout
- Fixed `shortcutPinWindow` default mismatch — fallback was `Alt+KeyW` instead of `Alt+KeyP`
- Fixed Ollama returning 400 Bad Request — removed `max_tokens` and replaced `"auto"` model with `/v1/models` auto-detection (#12)
- Refactored 3 OpenAI-compatible providers into shared `callOpenAICompatible` function (~200 → ~90 lines)
- Fixed search highlight incorrectly using first Fuse.js match regardless of field
- Removed 3 dead i18n keys from all 26 locale files

## [1.4.0] - 2026-03-10

### New features

- **Multi-provider AI** — choose between OpenAI (cloud) and Local LLM (LM Studio, Ollama, llama.cpp) in Settings → AI tab
  - Provider selector chips — OpenAI UX unchanged, just select and go
  - Local LLM: enter endpoint URL + optional model name, test connection button auto-detects loaded model
  - Shared prompts library across both providers
  - 120s timeout for local models (vs 30s for OpenAI)
  - Reasoning model support — automatically strips `<think>` tags from Qwen3, DeepSeek R1, etc.
- **Source app tracking** — see which app each clipboard item was copied from, with app icon, name, and window title
  - App icon displayed next to each text item in the list (hidden for images)
  - Source app icon and window title shown in Preview panel (Space)
  - "Apps" filter dropdown with search, 3 sort modes (last used / most used / alphabetical), app icons, and clear button
  - Sort mode persisted across sessions
  - App icon shown in the active filter chip
  - App icons cached in SQLite for instant display
  - Source fields included in fuzzy and regex search
  - Works via Windows APIs: GetClipboardOwner, SHGetFileInfo, GetFileVersionInfo
- **Themed scrollbars** — all scrollable areas (context menu, preview panel, apps dropdown, settings) now use themed thin scrollbars matching the current theme

### Security

- Local LLM endpoint restricted to loopback only (127.0.0.1 / localhost) — prevents accidental clipboard exfiltration to remote servers
- PowerShell injection prevention in app icon extraction — character whitelist for exe names
- Password manager clipboard entries skipped on clipboard lock (fail-safe)
- CSP updated to allow both HTTP and HTTPS for localhost connections

### Bug fixes

- Fixed app icons not appearing for most apps — comprehensive exe path resolution with broad AppData scanning, UWP/Store app support via PowerShell `Get-AppxPackage`, known aliases (WindowsTerminal→wt.exe), and exe_path caching from clipboard monitor
- Fixed black background on app icons (e.g. Claude) — uses icon mask bitmap (`hbmMask`) for proper alpha transparency instead of forcing all pixels opaque
- Fixed icon quality — switched from 16×16 (`SHGFI_SMALLICON`) to 32×32 default icons for better rendering
- Fixed window flickering when holding the hotkey — added 300ms debounce on WM_HOTKEY
- Fixed Escape key leaking to the previous app after closing Beetroot — hide now waits for key release
- Fixed paste not working in browser extension popups (Bitwarden, LastPass, etc.) — detects when target window closed on focus loss and falls back to copy-only with a toast notification
- Fixed images incorrectly counted in App filter dropdown
- Fixed icon retry storm — 24h cooldown on failed icon extractions, batch preload on startup (1 IPC vs N)
- Fixed ArrowUp keyboard navigation in App filter dropdown
- Fixed setTimeout leaks in Settings AI test buttons
- Fixed local LLM results silently dropped when window lost focus

## [1.3.0] - 2026-03-07

### Highlights

- **26 languages** — added Hindi, Indonesian, Vietnamese, Czech, Hungarian, Romanian, Swedish, Danish, Finnish, Norwegian, and Malay
- **Customizable shortcuts** — new Settings → Shortcuts tab lets you remap all hotkeys including pin window (Alt+P) and follow cursor (Alt+F); layout-aware display for AZERTY/QWERTZ keyboards
- **Real Mica & Acrylic effects** — proper native window effects instead of faked CSS transparency; auto-detects your Windows version and shows only supported options
- **Single-instance** — no more accidental duplicate windows; launching Beetroot again brings the existing window to focus
- **Pin → Star rename** — "Pin" is now "Star" (like Gmail) to avoid confusion with window pinning; your starred items are unchanged

### New features

- Right-click menu accessible via keyboard (Shift+F10)
- Right-click menu now has Paste and Copy actions with keyboard hints
- Copy images from Preview panel (Ctrl+C)
- Smarter defaults for new installs — auto theme, auto language, autostart enabled
- Settings reorganized into 7 tabs (General, Appearance, Shortcuts, Language, AI, Data, About)

### Better accessibility

- Improved color contrast across all 9 themes (WCAG AA compliant)
- Larger star/delete button targets for easier clicking
- Focus trap in Preview panel — Tab stays inside the overlay
- Screen readers now report item position ("item 3 of 47")
- Better toast notifications with dismiss button

### Performance

- Language files load on demand — 95% smaller initial bundle
- OCR no longer freezes the app while processing

### Bug fixes

- Fixed context menu getting cut off with many AI prompts
- Fixed ShareX capturing extra transparent pixels around the window
- Fixed "Show in Explorer" failing for images
- Fixed installer ignoring custom install paths on non-C: drives
- Fixed OCR crash on Windows 10 without language packs
- Fixed AltGr shortcuts not working correctly on European keyboards
- Startup cleanup removes broken image entries from database
- 20+ additional stability and UX fixes

## [1.2.0] - 2026-03-05

### Added

- **Pin window on top** — keeps Beetroot visible and always-on-top; suppresses hide-on-blur; draggable between monitors via `data-tauri-drag-region`; hotkey/tray show skips centering; pin button in footer bar; state persisted in settings
- **Follow cursor mode** — window repositions near the mouse cursor on each show; third window mode alongside normal and pinned; toggle in footer bar
- **5 new languages** — Italian, Polish, Dutch, Ukrainian, Thai (15 languages total)
- **Icons: Lucide → Tabler** — replaced `lucide-react` with `@tabler/icons-react` (MIT, 5900+ icons); 33 icons across 13 files; enlarged icon sizes for better visual hierarchy
- **Window position and size persistence** — restores position on focus; pinned windows restore immediately on mount before first show (Issue #10)
- **SQLite Backup API** — replaced `fs::copy` with `rusqlite::backup::Backup` for point-in-time consistent snapshots; atomic `.backup.tmp` → `fs::rename`
- **Native error dialogs** — `show_fatal_error()` via `MessageBoxW` replaces `.expect()` panics for DB open, PRAGMA, and migration failures
- **Recovery notification** — `RECOVERY_NOTICE.txt` on corruption recovery; frontend reads via IPC and shows toast
- **Cloud sync detection** — warns if data directory is inside OneDrive/Dropbox/Google Drive sync folder
- **Drive type check** — `check_drive_type()` detects removable/network drives via `GetDriveTypeW`; blocks network drives in Rust
- **Orphaned image reconciliation** — startup scan deletes `.png` files not referenced by any DB row; handles legacy root-level and YYYY-MM organized images
- **Timestamped backup rotation** — backups named `clipboard.YYYY-MM-DDTHH.MM.backup`; keeps latest 3; auto-prunes older
- **Backup integrity verification** — `PRAGMA integrity_check(1)` after each backup; removes corrupt backups automatically
- **Pre-migration version snapshots** — `clipboard.pre-v{version}.backup` before DB migrations; idempotent; skips empty databases on fresh install
- **Full integrity check on upgrade** — first launch of new version runs `PRAGMA integrity_check(1)` instead of `quick_check` (Issue #7)
- **Runtime corruption marker** — writes `FORCE_RECOVERY` file on "disk image malformed"; next startup goes straight to backup recovery (Issue #7)
- **Runtime corruption notification** — emits `db-corruption-detected` event to frontend with toast in all 15 languages
- **Empty DB backup guard** — `backup_rotate()` skips rotation when database has 0 rows but valid backup exists
- **DB open retry** — retries `Connection::open()` 3 times with 2s delay for transient AV file locks
- **Bundled fonts** — Open Sans and Montserrat woff2 subsets added

### Fixed

- **Window resize jump on hotkey show** — focus restore now sets only position (not size); Rust doesn't change window size, so restoring saved size with scale factor rounding caused a visible jump
- **Corruption detection by error code** — `check_corruption()` pattern-matches SQLite error codes 11 (CORRUPT) and 26 (NOTADB) instead of string matching
- **Recovery tries all backup candidates** — `fs::copy` failure no longer aborts recovery; tries next candidate
- **Recovery removes -journal file** — stale journal sidecar no longer replays old transactions after restore
- **Recovery marker crash safety** — split into `check_force_recovery` / `clear_force_recovery`; marker survives crashes between check and recovery
- **Version snapshot sort order** — `.pre-v*` snapshots sorted reverse so newest tried first
- **Backup .tmp cleanup on error** — failed copies remove `.tmp` and sidecar files
- **Empty-DB backup guard** — `unwrap_or(-1)` → `unwrap_or(0)` so missing table correctly skips rotation
- **Pre-migration backup ordering** — runs before migrations (protects against migration bugs) with empty-DB skip
- **Corrupted header no longer fatal** — `configure_pragmas` skipped when `FORCE_RECOVERY` marker exists
- **Full integrity check in recovery** — backup validation uses `integrity_check` instead of `quick_check`
- **Autostart not working after update** — re-registers on every startup when enabled (Issue #8)
- **Image delete ordering** — backend deletes image files after successful row deletion
- **Reconcile race with save_image** — skips files younger than 60 seconds
- **Symlink traversal in reconcile** — skips symlinks/junctions in `images/` directory
- **Move data rollback safety** — rollback only removes what was created
- **Cloud-sync false positives** — checks word boundary after pattern
- **French translation** — Détacher → Désépingler for unpin action
- **Pin window drag region** — fixed drag handle pointer-events and paste behavior in pinned mode
- **Footer icon button styles** — unified spacing and alignment across all footer buttons
- **Dead snippet tables** — removed unused snippet table code

### Changed

- `integrity_ok()` returns `Result<bool>` — transient errors no longer trigger false-positive recovery
- `integrity_ok()` uses `PRAGMA quick_check(1)` — structure-only for faster startup
- `synchronous=FULL` fallback when WAL unavailable (FAT32/network drives)
- Mutex poison recovery — `unwrap_or_else(|e| e.into_inner())` instead of panic
- Migrations wrapped in `transaction()` with rollback on failure
- `data_path.txt` preserved on USB eject — reconnecting restores custom path
- `change_data_path` holds Mutex during checkpoint+copy
- Backend content size limits: 1MB for clipboard, 100KB for notes
- Clock-skew protection for auto-delete — caps at 365 days
- Hotkey rollback failure notification — emits `"hotkey-error"` event
- `cleanup_image_files()` runs in background thread
- Unicode NFC normalization before hashing
- Shutdown checkpoint logs errors instead of silently discarding
- BOM handling in `data_path.txt` — strips UTF-8 BOM
- `HotkeyManager::new` uses `recv_timeout(5s)` instead of blocking `recv()`

## [1.1.0] - 2026-03-03

### Added

- **Database backup system** — automatic backup rotation (2 copies) at startup and every 100 clipboard entries
- **Database recovery** — auto-detects corruption at startup, restores from backup or creates fresh DB
- **Drive detection** — warns when moving data to USB/network drives (SQLite WAL unreliable on non-local filesystems)
- `PRAGMA busy_timeout=5000` — prevents immediate failures on lock contention (antivirus, concurrent access)
- `PRAGMA integrity_check` at startup — catches corruption before it propagates
- Graceful shutdown WAL checkpoint (`RunEvent::Exit`) — flushes WAL on app exit / auto-update
- WAL flush in `switch_data_path` — prevents data loss on restart (was missing)
- User-friendly error messages for SQLITE_CORRUPT and SQLITE_BUSY
- 5 new i18n keys × 10 languages (error.dbCorrupted, error.dbBusy, error.dbGeneric, warning.unstableDrive, notification.dbRestored)
- Instant keyboard layout detection via `WM_INPUTLANGCHANGE` subclass — labels update immediately when switching layout while Beetroot is focused
- Recursive `EnumChildWindows` — reliably finds WebView2 renderer thread at any nesting depth
- `handle_layout_change()` DRY helper — deduplicates timer and subclass layout detection code paths
- **AltGr display label** — AltGr key now displays as "AltGr" instead of "Alt" in hotkey recorder and settings (Issue #3)
- `cleanup_image_files()` DRY helper — shared orphaned image cleanup across all 5 delete paths
- 10 backup/recovery Rust tests, 56 hotkey-utils frontend tests, 9 AZERTY Rust tests
- `hotkey-utils.ts` module — extracted from Settings.tsx for testability
- 9 themes (was "8 themes" in description — corrected to include Pure Dark)

### Fixed

- **Database corruption on kill** (Issue #7) — `PRAGMA wal_checkpoint(TRUNCATE)` at startup replaced with safe `PASSIVE`; TRUNCATE only at graceful shutdown
- **Stale keyboard layout labels** when Beetroot is focused — Win+Space now detected via window subclass, not just timer
- **AltGr displayed as "Alt"** (Issue #3) — `applyAltGrStrip` now produces `"AltGr"` modifier; `parse_shortcut` accepts `"AltGr"` prefix; backward compatible with old `"Alt+"` format
- **`switch_data_path` missing WAL flush** — data could be lost on restart
- **WAL mode never verified** — now logs warning if WAL fails (FAT32/network drives)
- **Orphaned image files on delete** — `db_delete_item`, `db_batch_delete_items`, `db_clear_unpinned` now collect `image_path` before DELETE and remove PNG files from disk (was only done in `db_delete_older_than` and `db_prune_old_items`)
- Compile errors in backup.rs: missing `tauri::Manager` import, wrong `OsStringExt` trait, `DRIVE_REMOTE`/`DRIVE_REMOVABLE` not exported in windows 0.58

### Changed

- Startup flow: `busy_timeout` → WAL (verified) → `synchronous=NORMAL` → `integrity_check` → backup/recover → migrations
- `maybe_backup` uses `compare_exchange` instead of `fetch_add` to prevent duplicate backups under concurrent writes
- Migration 7: dropped unused `snippets` and `snippet_groups` tables (created in migrations 3-4 but never wired to any IPC commands or UI)
- Total test count: 510 frontend + 76 Rust = 586 tests

## [1.0.6] - 2026-03-01

### Added

- 4 new languages: Français (FR), Português (PT), 한국어 (KO), Türkçe (TR) — total 10 languages
- Auto-update toggle in Settings > General — disable for fully offline operation (zero network connections without API key)
- Data path "Switch" option — change database location without copying data (instant, requires restart)
- Native file dialog via Rust `pick_folder` — modal dialog on top of app window, no more hidden-behind-window issue

### Changed

- Hotkey system rewritten: physical key detection (`e.code`), AltGr support, non-QWERTY layout compatibility (AZERTY, QWERTZ, JIS)
- Rust `build_shortcut_variants()` auto-registers `Ctrl+Alt+X` companion for `Alt+X` shortcuts
- Manual modifier tracking via `modifiersRef` Set — accurate state even across focus changes
- `dialogState.ts` module-level flag suppresses window reset during native file dialogs
- Removed 4 dead i18n keys across all 10 locales
- 44 Rust tests (was 41), 434 frontend tests

### Fixed

- Pasted items not moving to top of history list (`db_touch_item` IPC + `last_used` column update)
- Stale `data_path.txt` cleanup — if custom directory no longer exists, remove pointer and fall back to default
- File dialog appearing behind always-on-top window (replaced JS dialog with native Rust modal)
- AltGr key combinations not recognized on non-QWERTY keyboards (AZERTY, QWERTZ)
- Hotkey field stuck in "waiting" mode when pressing AltGr alone (added `AltGraph` to bare modifier filter)

## [1.0.5] - 2026-02-23

### Changed

- Rust `run_migrations` returns `Result` instead of panicking — proper error propagation
- Rust `change_hotkey` mutex lock with error handling instead of silent ignore
- Parameterized SQL query for `db_get_all_items` (LIMIT ?1 instead of format string)
- TOCTOU fix in `validate_data_path` / `validate_file_path` — return canonical path
- Extracted shared hooks: `useFocusTrap`, `useRestoreFocus`, `useContentType` (DRY)
- `getPromptLabel()` helper replaces repeated BUILTIN_I18N lookups
- `withSuppress()` helper in paste.ts with rollback on clipboard write failure
- LRU-style cache eviction in content-detect (delete oldest 200 instead of clear all)
- `tauriLink()` helper for external links in Settings
- ErrorBoundary uses hardcoded strings (class component i18n limitation)
- Toast.tsx: renamed `t` variable to `toast` to avoid shadowing `useTranslation`
- Removed unused `THEME_COLOR_KEYS` export, `onUpdateNote` prop from ContextMenu

### Fixed

- FooterBar separator menu: added click-outside-to-close handler
- SettingsData: `setMigrating(false)` on success path (was only reset on error)
- PreviewPanel: copy button now shows toast notification
- AI transforms: null-safe check on `result.text` before calling `onAIApply`
- AI input length limit (50,000 characters) with user-friendly error
- Builtin prompt push respects MAX_CUSTOM_PROMPTS limit

### Added

- Available on all 3 Windows package managers: Winget, Chocolatey, Scoop

## [1.0.4] - 2026-02-09

### Added

- Translated 10 builtin AI prompt names and descriptions across all 6 languages
- BYOK clarification in AI settings — "Requires your own OpenAI API key"

### Fixed

- About tab GitHub/Report issue links not clickable (Tauri webview blocks `<a target="_blank">`)

## [1.0.3] - 2026-02-09

### Added

- 4 new languages: Deutsch (DE), Español (ES), 中文 (ZH), 日本語 (JA) — all ~170 keys
- Contextual help hints for 5 settings fields (Item click action, Paste format, Auto-delete, History limit, Window effect)

### Fixed

- UpdateBanner showing "Restart now" instead of "Download and install" in available state
- Undefined `--error` CSS variable → `--state-danger` in settings update status
- Raw JavaScript regex errors shown to users — now shows friendly description with i18n support

## [1.0.2] - 2026-02-09

### Changed

- Built-in AI prompts are now read-only (name + quick-access toggle only, no edit/delete)
- Built-in prompts auto-update on load for seamless version upgrades
- AI prompt dedup: prevents duplicate builtins when user has custom prompt with same name

### Removed

- "Restore defaults" button (unnecessary now that builtins are read-only)

## [1.0.1] - 2026-02-09

### Added

- Check for updates button in Settings → About tab

### Fixed

- Pin bug: pinning one item pinned all recently copied items (optimistic `id: 0` collision)
- About tab links now point to public release repo

## [1.0.0] - 2026-02-09

### Added

- **CI/CD pipeline** — GitHub Actions: lint + TypeScript check + tests + Prettier + Rust fmt/clippy/test + build on every push/PR
- **Auto-update** — Tauri updater with signed releases, `useUpdater` hook, `UpdateBanner` component (checks 5s after startup)
- **Release workflow** — Automated Windows installer builds on version tag push with signing
- **Dependabot** — Automatic dependency update PRs for npm, Cargo, and GitHub Actions
- **Package manager manifests** — winget, scoop, chocolatey manifests in `packaging/`
- OpenAI-powered AI text transforms (GPT-5 nano / GPT-5 mini)
- Custom AI prompts in Settings (max 20, with name and instruction)
- Quick-access AI prompts in right-click context menu (up to 5 pinned prompts)
- AI prompt checkbox in Settings to mark prompts for quick access
- API key configuration with test/validate button
- Model selection (GPT-5 nano / GPT-5 mini) in Settings
- AI transforms section in Transform menu with loading/error states
- AI error propagation — toast notification on context menu AI errors
- 10 built-in AI prompts (Fix Grammar, Any to English, Summarize, Make Professional, Format as Code, Bullet Points, Simplify, Make Shorter, Explain This, Extract Key Data)
- AI prompt migration — new builtins auto-merge into existing user settings
- Paste mode setting: auto-paste (Ctrl+V) or copy-only
- Font size setting (small / default / large)
- Auto-delete old entries setting (never / 1 day / 7 days / 30 days)
- 8 themes: Beetroot Dark (default), Beetroot Light, Tokyo Night Storm, Gruvbox Material Hard, GitHub Light Pro, Nord Snow, Cyberpunk Dark, Cyberpunk Light + Auto
- Pinned filter chip (replaces pin-to-top sorting)
- Notes filter tab for items with notes
- About tab in Settings (extracted from Data tab)
- Window resize capability (compact / default / wide)
- Rust structured error types via `thiserror` (`AppError` enum)
- Shared validation module (`validation.rs`) — eliminates duplication between lib.rs and commands.rs
- File path restriction: `write_file`/`read_file` validate paths within data directory, `.json` only
- Rust unit tests: 20 tests (8 for parse_shortcut, 12 for path validation)
- Frontend tests for 6 previously untested components: TransformMenu, PreviewPanel, ShortcutsHelp, Onboarding, SnippetEditor, PlaceholderFiller (51 new tests)
- Exported `TranslationKey` type from i18n for type-safe dynamic translation keys
- Notes on clipboard items (DB migration v6, inline editor in PreviewPanel, Fuse.js searchable)
- OCR text extraction from images via native Windows OCR API
- WAL checkpoint(TRUNCATE) for database integrity
- `AppError::Database` variant with auto-conversion from rusqlite errors
- Batch operations use SQLite transactions
- Content-detect caching (Map with 1000 entry cap)
- Window effects: Glass, Frosted, Solid (Mica on Windows 11)

### Fixed

- Removed misleading "1 line" display in PreviewPanel for single-paragraph text
- Space key now opens preview even when search input is focused
- GPT-5 API compatibility: use `max_completion_tokens`, `reasoning_effort`, `developer` role
- Auto-paste reliability with direct Windows `keybd_event` API (replaced enigo)
- Transparent window corner artifacts on Windows
- Image loading via base64 IPC with shared promises (replaces broken asset protocol)
- Hover selection correctly follows mouse cursor
- Windows extended path prefix (`\\?\`) handling in path validation
- DB race conditions: replaced two-step UPDATE+INSERT with atomic UPSERT
- ESLint `no-explicit-any` violations — replaced `as any` casts with proper `TranslationKey` typing
- ESLint `react-hooks/set-state-in-effect` — refactored `useImageThumb` and `Snippets` to avoid synchronous setState in effects
- Fast refresh violation — extracted `useOnboarding` hook to separate file

### Changed

- AI prompt name limit reduced from 50 to 20 characters
- CSP updated to allow `connect-src https://api.openai.com`
- App.tsx refactored: all state/effects/callbacks extracted to `useAppState` hook (452 → 159 lines)
- Settings.tsx split into sections: SettingsAppearance, SettingsAI, SettingsData (632 → 300 lines)
- Rust commands now return `Result<_, AppError>` instead of `Result<_, String>`
- Removed hotkey number hints (1-9) from clipboard list items
- Note icon redesigned and repositioned (after time, before pin button)
- Total test count: 473 frontend + 41 Rust = 514 tests
- Updated vite 6 → 7, @vitejs/plugin-react 4 → 5, tauri 2.10.1 → 2.10.2, tauri-build 2.5.4 → 2.5.5
- Updated @types/react-window 1 → 2, @types/react 19.2.10 → 19.2.11
- GitHub Actions: actions/checkout 4 → 6, actions/setup-node 4 → 6, actions/upload-artifact 4 → 6

## [0.1.0] - 2026-02-04

### Added

- Clipboard monitoring with text and image support
- Global hotkey toggle (Ctrl+\`, configurable)
- Fuzzy search with Fuse.js
- Regex search mode with toggle
- Pin/unpin clipboard entries
- System tray with show/settings/quit actions
- Multiple themes: Catppuccin Mocha, Catppuccin Latte, Tokyo Night, Rose Pine
- Auto theme (follows system preference)
- Configurable history limit (100/250/500/1000/unlimited)
- Configurable hotkey selection
- Autostart on login
- Custom data directory with migration support
- Image clipboard support with thumbnail previews
- SQLite database with automatic migrations (4 migrations)
- Virtual list (react-window v2) for large history sets
- Snippets with groups, search, and `{{placeholder}}` support
- Multi-select batch operations with separator picker
- Text transforms: uppercase, lowercase, title case, trim, single line, reverse, slug
- Right-click context menu: pin, preview, transform, show in explorer, delete
- Preview panel (Space key)
- Keyboard shortcuts help overlay
- First-time onboarding walkthrough
- Flash animation for newly captured items
- Undo delete via toast notification
- Quick select via Ctrl+1..9
- i18n support: English and Russian (~160 keys each)
- Error boundary with retry
- Toast notification system
- Debounced search input (150ms)
- Fuse.js index caching
- Type-safe IPC wrappers for all Tauri commands
- Structured logging (Rust tracing + frontend log levels)
- Performance monitoring with slow operation warnings
- ESLint + Prettier configuration
- Component tests with Vitest + @testing-library/react
- CSP header and Tauri security hardening
- Clipboard content size limits (1MB text, 10MB images)
- Clipboard event rate limiting (300ms debounce)
- Thumbnail cache with LRU eviction (100 entries max)
- ARIA accessibility attributes and focus trap in settings
- Graceful shutdown via Tauri API
- Path traversal protection for image operations
- Input validation for hotkeys, data paths, and settings
- Adaptive tray icon based on Windows taskbar theme (light/dark)
- Per-component CSS files (17 files, BEM naming)
