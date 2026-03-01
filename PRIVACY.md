# Privacy Policy

**Beetroot Clipboard Manager**
**Last updated:** March 1, 2026
**Version:** 1.1

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

This data is stored **exclusively on your device** in:
- `%APPDATA%/com.beetroot.desktop/clipboard.db` (SQLite database)
- `%APPDATA%/com.beetroot.desktop/images/` (image files)

### 2.2 Application Settings (Stored Locally)

- UI preferences (theme, language, hotkey, window effect)
- AI configuration (API key, model preference, custom prompts)
- Data management preferences (history limit, auto-delete period)

Settings are stored in the WebView's `localStorage` on your device.

### 2.3 Data Sent to Third Parties

The App sends data to external servers **only** when you explicitly use AI text transforms:

| Action | Data sent | Destination | When |
|--------|-----------|-------------|------|
| AI Transform | Selected clipboard text + prompt instruction | OpenAI API (`api.openai.com`) | Only when you manually trigger an AI action |

**No data is sent automatically.** AI transforms require your explicit action (right-click menu or keyboard shortcut).

If auto-update is enabled (the default), the App connects to GitHub (`github.com`) shortly after startup to check for available updates. This request contains no personal data — only the current version number is compared against published releases. You can disable auto-update in Settings > General, in which case the App makes **no network connections at all** (unless you use AI transforms).

### 2.4 Data We Do NOT Collect

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
- Default retention: configurable in Settings (auto-delete after N days, or unlimited)
- You can delete individual items, clear all history, or uninstall the App to remove all data
- Pinned items are excluded from auto-deletion

### Data Location

All App data is stored in: `%APPDATA%/com.beetroot.desktop/`

To completely remove all data, delete this folder after uninstalling.

---

## 5. AI Transforms and OpenAI

When you use AI text transforms, the selected text is sent to OpenAI's API servers in the United States.

- **Your API key:** If you provide your own OpenAI API key (BYOK), you have a direct relationship with OpenAI. Their [Privacy Policy](https://openai.com/privacy) and [Terms](https://openai.com/terms) apply to your usage.
- **Data processing:** OpenAI processes the text to generate the transformation result. Refer to [OpenAI's API data usage policy](https://openai.com/enterprise-privacy) for details on data retention.
- **No automatic sending:** Text is only sent when you explicitly trigger an AI transform action.
- **Sensitive data warning:** Do not use AI transforms on text containing passwords, API keys, financial data, medical records, or other sensitive information.

---

## 6. Data Security

We implement the following security measures:
- **Content Security Policy (CSP):** Restricts network access to `self` and `api.openai.com` only
- **No raw SQL access:** All database operations go through typed Rust IPC commands with parameterized queries
- **Path validation:** Prevents path traversal attacks on file operations
- **Size limits:** Maximum 1 MB text, 10 MB images to prevent abuse
- **Clipboard throttling:** 300ms minimum between captures

**Known limitations:**
- The SQLite database is not encrypted. Any process running under your user account can read the clipboard history file.
- The OpenAI API key is stored in the WebView's localStorage without encryption.

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

The App itself does not transfer data internationally. However, when you use AI transforms, your text is sent to OpenAI servers in the United States. If you are located in the EU/EEA, this constitutes an international data transfer. OpenAI maintains Standard Contractual Clauses (SCCs) for such transfers. See OpenAI's [Data Processing Agreement](https://openai.com/policies/data-processing-agreement).

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
| Is my data sent to any server? | No, unless you manually use AI transforms (sent to OpenAI) |
| Is my data encrypted? | No, it is stored as a standard SQLite database |
| Can I delete my data? | Yes, through the App or by deleting `%APPDATA%/com.beetroot.desktop/` |
| Do you have access to my data? | No, we have no servers and no access to your device |
| Does the App have analytics? | No |
| Is an account required? | No |
