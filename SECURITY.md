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
- **CSP enforced:** `connect-src 'self' https://api.openai.com` — no other outbound connections
- **Path validation:** All file operations are validated against path traversal
- **Size limits:** 1 MB text, 10 MB images
- **Clipboard throttle:** 300ms minimum between captures
- **Password manager respect:** Honors `CF_CLIPBOARD_VIEWER_IGNORE` and `ExcludeClipboardContentFromMonitorProcessing`

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

