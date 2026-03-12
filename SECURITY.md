# Security Policy

## Supported Versions

Only the latest release is supported with security updates.

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| Older   | No        |

## Reporting a Vulnerability

Please report security vulnerabilities through GitHub's private vulnerability reporting:

https://github.com/mnardit/beetroot-releases/security/advisories

Alternatively, open a private issue or email the maintainer through their [GitHub profile](https://github.com/mnardit).

Do not open public issues for security vulnerabilities. We will acknowledge reports within 48 hours and provide a fix timeline within 7 days.

## Security Model

- **No servers:** All data is stored locally in `%APPDATA%/com.beetroot.desktop/`
- **CSP enforced:** `connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.deepseek.com http://127.0.0.1:* http://localhost:* https://127.0.0.1:* https://localhost:*` — no other outbound connections from the WebView
- **Loopback-only local AI:** Local LLM endpoints are restricted to 127.0.0.1 and localhost — the App cannot send clipboard data to remote servers in Local LLM mode
- **Offline mode:** Auto-update can be disabled in Settings — zero network connections without cloud AI. Local AI models require no network access
- **Path validation:** All file operations are validated against path traversal
- **Size limits:** 1 MB text, 10 MB images
- **Clipboard throttle:** 300ms minimum between captures
- **Password manager respect:** Honors `CF_CLIPBOARD_VIEWER_IGNORE` and `ExcludeClipboardContentFromMonitorProcessing`
- **Automatic backups:** 3-copy rotation using SQLite Backup API (point-in-time snapshots) + snapshot before each database migration
- **Auto-recovery:** Detects database corruption at startup and restores from the latest backup automatically
- **Cloud sync detection:** Warns if your data folder is inside OneDrive, Dropbox, Google Drive, or iCloud (cloud sync can corrupt SQLite databases)
- **Drive type detection:** Warns if the data folder is on a USB or network drive

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

