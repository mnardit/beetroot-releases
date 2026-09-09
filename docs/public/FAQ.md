# Frequently Asked Questions

Answers to the most common questions about Beetroot.

**Documentation scope:** Current source, including changes planned for 1.6.7. See the [release status](index.md); this is not the documentation bundled with the current 1.6.6 installer.
**Last updated:** 2026-09-08

---

## General

**Q: Is Beetroot free?**
A: Yes. This source is available under [Apache 2.0](../../LICENSE), with personal and commercial use permitted under its terms. See [CONTRIBUTING.md](../../CONTRIBUTING.md) to participate.

**Q: Does Beetroot work on Windows 10?**
A: Yes. Windows 10 and Windows 11 are both supported. The Mica window effect is only available on Windows 11; Acrylic and Solid work on both.

**Q: Does Beetroot work on macOS or Linux?**
A: No. Beetroot is a Windows-only application.

**Q: How do I stop Beetroot from running?**
A: Right-click the system tray icon and select "Quit." To prevent it from starting with Windows, go to Settings > General and turn off Autostart.

**Q: How do I report a bug?**
A: Go to Settings > About and click "Report issue" to open a GitHub issue. Include what you were doing, what you expected, and what happened instead.

---

## Privacy and Security

**Q: Does Beetroot send my clipboard data anywhere?**
A: History is stored locally. Cloud transforms send selected content and the prompt to your chosen provider. Updates and saved-key tests also make requests. Local AI connects to a loopback server whose own logging and network activity depend on its configuration. See [PRIVACY.md](../../PRIVACY.md).

**Q: Does Beetroot capture passwords?**
A: Beetroot detects when content is copied from known password managers and skips those clipboard entries. However, if you manually copy a password from a text file or website, it will be captured like any other text.

**Q: Can I use Beetroot without an internet connection?**
A: Yes. Everything except AI transforms (cloud providers) and auto-updates works offline. OCR and all local features work without internet. If you use a local LLM (Ollama, LM Studio), AI transforms work offline too.

**Q: Where are my API keys stored?**
A: In this source version, keys are stored in Windows Credential Manager, separately from settings. Legacy keys are migrated on upgrade; unsuccessful migration leaves them available for retry. Keys are sent to the selected provider for transforms or saved-key tests, not to a Beetroot service.

---

## Data

**Q: Where is my data stored?**
A: By default, in `%APPDATA%\com.beetroot.desktop\`. This includes a SQLite database file and an `images` folder. Settings > Data shows the actual selected location; WebView settings and API keys are stored separately.

**Q: Can I sync my clipboard history across computers?**
A: No, and this is intentional. Cloud sync services (OneDrive, Dropbox, etc.) can corrupt the SQLite database. Beetroot is designed to work on a single computer.

**Q: Can I export my clipboard history?**
A: Quit Beetroot from the tray before copying your selected data folder, including the images and any database sidecars. See the [backup instructions](../../PRIVACY.md#exporting-clipboard-history). This does not export WebView settings or API keys.

**Q: What happens when I reach the history limit?**
A: The oldest non-starred clips are automatically removed to make room. Starred clips are never removed by the history limit.

**Q: How do I completely remove a clip?**
A: Press Alt+Delete or right-click > Delete. Undo is offered when restoration is available. This removes the entry from active history, not securely from every backup or recovery copy; see [retention and deletion](../../PRIVACY.md#4-retention-and-deletion).

---

## Features

**Q: Can I use multiple AI providers?**
A: You can configure keys for all providers, but only one is active at a time. Switch between them in Settings > AI. Your keys are saved for each provider.

**Q: What keyboard layouts are supported?**
A: Beetroot detects your active keyboard layout in real-time and adapts hotkeys accordingly. QWERTY, AZERTY, QWERTZ, and layouts with AltGr dead keys are all supported. If the default Ctrl+` does not work on your layout, you can record any key combination in Settings > Shortcuts.

**Q: How does search work?**
A: Search runs in the Rust backend with ranked text and metadata matches, accent folding (so "cafe" can find "café") and typo-tolerant results. Regex mode is also available.

**Q: Can I use regex in search?**
A: Yes. Click the `.*` button in the search bar to switch to regex mode. Type any regular expression pattern. Regex search is case-insensitive by default.

**Q: How does OCR work?**
A: Beetroot uses the Windows built-in OCR engine -- no internet required. Right-click an image clip and select "Extract text (OCR)." The recognized text is saved as a new clip.

**Q: What is "Pin Window" mode?**
A: Pin mode keeps the Beetroot window visible on top of all other windows. When pinned, clicking a clip copies it to your clipboard instead of auto-pasting, because the target app might not be correct. A drag handle appears so you can move the window around.

**Q: What is "Follow Cursor" mode?**
A: Follow Cursor positions the popup near the cursor when it opens. It does not continuously chase the mouse while you use the list.

**Q: What is no-focus mode?**
A: Normal and follow-cursor hotkey openings can leave the original app focused while you select with navigation keys. Click the search field to type a query; that activates Beetroot and can end an Explorer rename field. If the original input is no longer available, Beetroot copies with feedback instead of pasting into a different target. Pinned windows copy rather than automatically paste.

**Q: What is the "Copied" overlay?**
A: A small frosted-glass pill that confirms clipboard capture. It also confirms when a selected clip or AI result was copied but could not be automatically pasted after the popup closed, for example because a modifier key stayed held or the destination changed. Focus the destination and press Ctrl+V manually. You can change the overlay's position and duration or turn it off in Settings > General; when it is off, a hidden popup cannot show this confirmation.

**Q: Can I navigate clips while in preview?**
A: Yes. Press Arrow Up or Arrow Down while the preview panel is open to browse through your clips without closing the panel.

**Q: Images from Explorer are not captured.**
A: Explorer file capture supports PNG files, subject to the size limit. Other image file types are not imported as history images. Copying a bitmap from an image viewer or a screenshot uses a different capture path.

**Q: What is the plain text paste hotkey?**
A: An optional global hotkey (you set it in Settings > Shortcuts) that pastes the current clipboard content as plain text, stripping all formatting. This works system-wide, even when Beetroot is hidden.

---

## Troubleshooting

**Q: The hotkey does not open Beetroot.**
A: Make sure Beetroot is running (check the system tray). Your hotkey might conflict with another application -- go to Settings > Shortcuts and try a different key combination. On AZERTY or QWERTZ keyboards, the backtick key may not be available; record a new hotkey.

**Q: Clipboard monitoring seems paused.**
A: Look for a yellow "Clipboard monitoring paused" banner. Click the pause/play button in the footer bar or use the system tray right-click menu to resume.

**Q: I see "Database corruption detected."**
A: On startup, Beetroot attempts recovery after retaining the original database. It may restore a valid backup or create a fresh database if none is available. Other startup errors stop with a message. Keep the original and backups when investigating; recovery can lose recent history.

**Q: Beetroot warns about cloud sync or USB drives.**
A: Cloud sync and removable storage can interfere with database access. Prefer a local, unsynced drive. Beetroot warns about those locations and rejects network drives for database storage.

**Q: AI transforms are not working.**
A: In Settings > AI, enter the selected provider's key, click **Save key now**, then **Test**. The bottom **Save** button saves provider/model settings, not the key. For local LLM, confirm your model server is running. See the [AI Setup Guide](AI_SETUP.md).

**Q: The window appears on the wrong monitor.**
A: Beetroot opens on the monitor where your mouse cursor is. Move your cursor to the desired monitor before pressing the hotkey.

**Q: App icons are not showing for some applications.**
A: Some applications (especially UWP/Store apps) store their icons in non-standard locations. This is cosmetic and does not affect functionality.

**Q: Autostart does not work in the Microsoft Store version.**
A: This was a bug fixed in v1.6.5. The registry-based autostart mechanism (used by .exe/.msi installs) is silently ignored inside the MSIX sandbox. The Store build now uses the `windows.startupTask` OS mechanism instead. After updating, enable Autostart in Settings → General; Beetroot will appear in Settings → Apps → Startup.

---

_Last updated: 2026-09-08_
