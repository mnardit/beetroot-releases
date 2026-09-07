# Getting Started with Beetroot

Get productive with Beetroot in under five minutes.

**Documentation scope:** Current source, including changes planned for 1.6.7. See the [release status](index.md); this is not the documentation bundled with the current 1.6.6 installer.
**Last updated:** 2026-09-08

---

## Install Beetroot

Choose one of four methods:

### Installer (recommended)

Download the latest `.exe` or `.msi` installer from [GitHub Releases](https://github.com/mnardit/beetroot-releases/releases/latest) and run it. Beetroot starts automatically after installation.

### Scoop

```
scoop bucket add beetroot https://github.com/mnardit/scoop-bucket
scoop install beetroot
```

### Winget

```
winget install MNardit.Beetroot
```

### Chocolatey

```
choco install beetroot
```

---

## First Launch

After installation, Beetroot runs in the background. Look for the Beetroot icon in your system tray (bottom-right corner of your taskbar, near the clock).

While monitoring is enabled, Beetroot captures supported clipboard content subject to exclusion markers and size limits. Pause it before copying sensitive content you do not want in history.

---

## Five Essential Actions

### 1. Open Beetroot

Press **Ctrl+`** (backtick -- the key to the left of `1` on most keyboards). The Beetroot window appears on whichever monitor your cursor is on. It opens without stealing focus from the app you are working in, so your cursor stays exactly where it was.

> If Ctrl+` does not work on your keyboard layout (AZERTY, QWERTZ, etc.), go to Settings > Shortcuts and record a different hotkey.

### 2. Paste from History

Open Beetroot using the hotkey, then select a clip and press **Enter**. In normal paste mode it returns to the original input and pastes. Pinned windows, copy-only settings or an unavailable target copy with feedback instead; focus the destination and paste manually.

### 3. Search Your History

Click the search field and type. Beetroot searches your clips, notes and source app names. Press Enter to use the selected result. Activating search can end a focus-sensitive field such as Explorer's rename box; in that case, copy and paste manually.

### 4. Star Important Clips

Press **Alt+S** to star the selected clip. Starred clips are never automatically deleted, even when the history limit is reached. Use the **Starred** filter to see only your starred clips.

### 5. Transform Text with AI

Press **Alt+T** to open the Transform menu. Choose one of 8 built-in text transforms (like UPPERCASE, Title Case, Sort Lines, or Remove Duplicates) or an AI prompt (requires a one-time API key setup in Settings > AI).

---

## Top 10 Keyboard Shortcuts

| Shortcut             | Action                               |
| -------------------- | ------------------------------------ |
| **Ctrl+`**           | Show / hide Beetroot                 |
| **Arrow Up / Down**  | Navigate the clip list               |
| **Enter**            | Paste the selected clip              |
| **Space**            | Toggle preview for the selected clip |
| **Escape**           | Hide Beetroot                        |
| **Alt+S**            | Star / unstar the selected clip      |
| **Alt+T**            | Open the Transform menu              |
| **Alt+Delete**       | Delete the selected clip             |
| **Ctrl+C**           | Copy the selected clip to clipboard  |
| **Ctrl+1 to Ctrl+9** | Quick-paste the 1st through 9th clip |

For the full list, see [Keyboard Shortcuts](KEYBOARD_SHORTCUTS.md).

---

## Next Steps

- Read the full **[User Guide](USER_GUIDE.md)** for a complete walkthrough of every feature.
- Set up **[AI Transforms](AI_SETUP.md)** to translate, summarize, fix grammar, and more.
- Check the **[FAQ](FAQ.md)** if you have questions.

---

_Last updated: 2026-09-08_
