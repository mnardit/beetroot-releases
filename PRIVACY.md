# Privacy Policy

**Beetroot Clipboard Manager**
**Last updated:** March 23, 2026
**Version:** 1.6.2

---

## 1. Introduction

Beetroot ("the App") is a desktop clipboard manager for Windows developed by an independent developer ("we", "us", "our"). This Privacy Policy explains what data the App collects, how it is stored, and under what circumstances it may leave your device.

**Important:** Beetroot continuously monitors your system clipboard and stores a history of everything you copy, including text, images, and rich text content. This may include sensitive information such as passwords, personal data, financial information, and private communications.

---

## 2. Data We Collect

### 2.1 Clipboard Data (Stored Locally)

The App captures and stores:
- **Text content** copied to your system clipboard
- **Image data** (screenshots, copied images) saved as PNG files
- **Rich text / HTML content** for formatted paste
- **Metadata:** timestamp, content type, content hash, last used timestamp
- **Source app info:** executable name, display name, window title, and app icon of the application you copied from

This data is stored **exclusively on your device** in:
- `%APPDATA%/com.beetroot.desktop/clipboard.db` (SQLite database)
- `%APPDATA%/com.beetroot.desktop/images/` (image files)

### 2.2 Application Settings (Stored Locally)

- UI preferences (theme, language, hotkey, window effect)
- AI configuration (API key, model preference, custom prompts)
- Data management preferences (history limit, auto-delete period)

Settings are stored in the WebView's `localStorage` on your device.

### 2.3 Data Sent to Third Parties

The App sends data to external servers **only** when you explicitly use certain features:

| Action | Data sent | Destination | When |
|--------|-----------|-------------|------|
| AI Transform (OpenAI) | Selected clipboard text + prompt instruction | OpenAI API (`api.openai.com`) | Only when you manually trigger an AI action with OpenAI selected |
| AI Transform (Gemini) | Selected clipboard text + prompt instruction | Google API (`generativelanguage.googleapis.com`) | Only when you manually trigger an AI action with Gemini selected |
| AI Transform (Anthropic) | Selected clipboard text + prompt instruction | Anthropic API (`api.anthropic.com`) | Only when you manually trigger an AI action with Anthropic selected |
| AI Transform (DeepSeek) | Selected clipboard text + prompt instruction | DeepSeek API (`api.deepseek.com`) | Only when you manually trigger an AI action with DeepSeek selected |
| AI Transform (Local LLM) | Selected clipboard text + prompt instruction | Your local server (`127.0.0.1` / `localhost`) | Only when you manually trigger an AI action with Local LLM selected |
| Auto-update check | Current version number | GitHub (`github.com`) | Once after startup (if enabled) |

**No data is sent automatically** except the update check. AI transforms require your explicit action (right-click menu or keyboard shortcut).

**Local AI models:** When using Local LLM mode (LM Studio, Ollama, etc.), all AI processing happens on your machine. The App restricts local endpoints to loopback addresses only (127.0.0.1, localhost) — it cannot connect to remote servers in Local LLM mode.

You can disable auto-update in Settings → General, in which case the App makes **no network connections at all** (unless you use a cloud AI provider).

### 2.4 On-Device ML Processing

The App uses a TensorFlow.js machine learning model (from VS Code) to detect programming languages in code snippets for syntax highlighting. This model runs entirely within the App's WebView — **no data is sent to any server** for language detection. The model files are bundled with the App.

### 2.5 Data We Do NOT Collect

- No analytics or telemetry
- No usage tracking
- No crash reports
- No device fingerprinting
- No IP address logging
- No account or registration required
- No data sent to our servers (we have no servers)

---

## 3. Password Manager Detection

The App respects clipboard privacy signals from password managers. When a password manager (1Password, Bitwarden, KeePass, etc.) sets standard clipboard exclusion formats (`CF_CLIPBOARD_VIEWER_IGNORE`, `ExcludeClipboardContentFromMonitorProcessing`), the App **will not store** that clipboard entry.

**Limitation:** Passwords copied manually (e.g., selecting and pressing Ctrl+C in a browser password field) are **not** detected as sensitive and will be stored in the clipboard history. We recommend using your password manager's built-in copy function.

---

## 4. Data Storage and Retention

- All clipboard data is stored **locally on your device only**
- The database is **not encrypted** (stored as a standard SQLite file)
- Default history limit: 500 items. You can change this to 100, 250, 1000, or Unlimited in Settings. You can also enable auto-delete by age (1 day, 7 days, or 30 days)
- You can delete individual items, clear all history, or uninstall the App to remove all data
- Starred items are excluded from auto-deletion

### Data Location

By default, all App data is stored in: `%APPDATA%/com.beetroot.desktop/`

You can change the storage location in Settings (e.g., to an external drive or a different partition). The App will move your database and images to the new folder automatically.

To completely remove all data, delete the data folder after uninstalling.

---

## 5. AI Transforms

Beetroot supports five cloud AI providers and local models. You choose which one to use in Settings → AI. All providers use a Bring Your Own Key (BYOK) model — you provide your own API key and have a direct relationship with the provider.

### 5.1 Cloud Providers

When you use AI transforms with a cloud provider selected, the selected text is sent to that provider's API servers. Text is **only** sent when you explicitly trigger an AI transform action — never automatically.

| Provider | API endpoint | Servers | Privacy policy |
|----------|-------------|---------|----------------|
| OpenAI | `api.openai.com` | United States | [openai.com/privacy](https://openai.com/privacy) |
| Google Gemini | `generativelanguage.googleapis.com` | United States | [ai.google/privacy](https://ai.google/responsibility/privacy/) |
| Anthropic Claude | `api.anthropic.com` | United States | [anthropic.com/privacy](https://www.anthropic.com/privacy) |
| DeepSeek | `api.deepseek.com` | China | [deepseek.com/privacy](https://www.deepseek.com/privacy) |

Each provider's own privacy policy and terms apply to your API usage. You are responsible for your API key and associated costs.

### 5.2 Local LLM

When you use AI transforms with Local LLM selected, the text is sent to a server running on your own machine (e.g., LM Studio, Ollama, llama.cpp).

- **No cloud:** All processing happens locally. No data leaves your device.
- **Loopback only:** The App only connects to loopback addresses (127.0.0.1, localhost). It cannot send data to remote servers in this mode.
- **No API key required:** Local models do not require an API key or account.

### 5.3 Sensitive Data Warning

Do not use AI transforms on text containing passwords, API keys, financial data, medical records, or other sensitive information — regardless of which provider you use.

---

## 6. Data Security

We implement the following security measures:
- **Content Security Policy (CSP):** Restricts network access to `self`, AI provider APIs (`api.openai.com`, `generativelanguage.googleapis.com`, `api.anthropic.com`, `api.deepseek.com`), and loopback addresses (`127.0.0.1`, `localhost`) for local AI models
- **No raw SQL access:** All database operations go through typed Rust IPC commands with parameterized queries
- **Path validation:** Prevents path traversal attacks on file operations
- **Size limits:** Maximum 1 MB text, 10 MB images to prevent abuse
- **Clipboard throttling:** 300ms minimum between captures
- **Automatic backups:** 3-copy rotation using SQLite Backup API (point-in-time snapshots), plus a snapshot before each database migration. If corruption is detected at startup, the App automatically restores from the latest backup and notifies you
- **Cloud sync detection:** The App warns you if your data folder is inside a cloud sync service (OneDrive, Dropbox, Google Drive, iCloud) because cloud sync can corrupt SQLite databases. It also warns about USB and network drives
- **Keyboard hook (no-focus mode only):** When the no-focus window is visible, the App installs a low-level keyboard hook (WH_KEYBOARD_LL) to intercept navigation keys (arrows, Enter, Escape, etc.) directed at the App. No keystrokes are logged or stored — the hook is used solely for UI navigation and is removed when the window is hidden

**Known limitations:**
- The SQLite database is not encrypted. Any process running under your user account can read the clipboard history file.
- API keys are stored in the WebView's localStorage without encryption.
- Runtime backups are created every 100 clipboard writes. In the unlikely event of both a crash and database corruption between backups, up to 100 recent items could be lost.

---

## 7. Your Rights

You have complete control over your data:

| Right | How to exercise |
|-------|----------------|
| **Access** | All data is stored locally; open the App to view your clipboard history |
| **Delete** | Right-click any item to delete it, or configure auto-delete in Settings > General |
| **Export** | Manually copy the database file from `%APPDATA%/com.beetroot.desktop/` |
| **Restrict processing** | Use the Pause button to stop clipboard monitoring at any time |
| **Withdraw consent** | Uninstall the App to stop all data collection |

For GDPR (EU), CCPA (California), LGPD (Brazil), and similar data protection regulations: since all data is stored locally on your device and we have no access to it, you are effectively the data controller. We do not process your personal data on any server.

---

## 8. Children's Privacy

Beetroot is not directed at children under 13 years of age. We do not knowingly collect personal information from children. If you are under 13, please do not use this application.

---

## 9. International Data Transfers

The App itself does not transfer data internationally. However, when you use cloud AI transforms, your text is sent to the selected provider's servers:

- **OpenAI, Gemini, Anthropic:** servers in the United States
- **DeepSeek:** servers in China

If you are located in the EU/EEA, this constitutes an international data transfer. Each provider maintains their own data protection agreements. You choose which provider to use (or none — Local LLM keeps everything on your device).

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be included in App updates and posted on our GitHub repository. The "Last updated" date at the top indicates the most recent revision.

---

## 11. Contact

For privacy-related questions or concerns:
- **GitHub Issues:** [github.com/mnardit/beetroot-releases/issues](https://github.com/mnardit/beetroot-releases/issues)
- **Security vulnerabilities:** [github.com/mnardit/beetroot-releases/security/advisories](https://github.com/mnardit/beetroot-releases/security/advisories)

---

## 12. Summary

| Question | Answer |
|----------|--------|
| Does the App collect my clipboard data? | Yes, it stores everything you copy locally on your device |
| Is my data sent to any server? | No, unless you use a cloud AI provider (OpenAI, Gemini, Anthropic, or DeepSeek). Local AI stays on your machine |
| Is my data encrypted? | No, it is stored as a standard SQLite database |
| Can I delete my data? | Yes, through the App or by deleting `%APPDATA%/com.beetroot.desktop/` |
| Do you have access to my data? | No, we have no servers and no access to your device |
| Does the App have analytics? | No |
| Is an account required? | No |
