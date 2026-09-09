# Security Policy

## Supported Versions

Only the latest release is supported with security updates.

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
| Older   | No        |

## Reporting a Vulnerability

Report vulnerabilities privately using GitHub's [Report a vulnerability](https://github.com/mnardit/beetroot-releases/security/advisories/new) form.

Do not open public issues for security vulnerabilities. We will acknowledge reports within 48 hours and provide a fix timeline within 7 days.

## Security Model

- **Local history:** Clipboard history is stored locally, by default in `%APPDATA%/com.beetroot.desktop/`. Beetroot has no clipboard-hosting service; cloud AI sends selected content to your chosen provider.
- **CSP enforced:** `connect-src 'self'` restricts WebView connections. AI requests and saved-key validation run in Rust; CSP does not constrain native Rust networking.
- **Loopback-only local AI:** The App connects only to localhost, 127.0.0.1 or [::1] for local AI. The local server's own processing, logging and network activity are outside Beetroot's control.
- **Network activity:** Disabling automatic updates stops startup update checks. Manual checks/downloads, cloud AI transforms and saved-key tests still use the internet; local AI uses loopback HTTP. Store updates are handled by Microsoft Store.
- **Path validation:** Image access checks canonical paths and rejects network and protected system paths. History-image deletion checks that files belong to the app's image directory.
- **Capture limits:** Text is limited to 1 MiB of UTF-8 data and clipboard images to 10 MiB of base64 data (about 7.5 MiB decoded). AI requests have separate limits.
- **Clipboard duplicate suppression:** Repeated events for the same clipboard content are suppressed within 500ms. Distinct content is not subject to a global capture throttle.
- **Password manager respect:** Honors `CF_CLIPBOARD_VIEWER_IGNORE` and `ExcludeClipboardContentFromMonitorProcessing`
- **Automatic backups:** 3-copy rotation using SQLite Backup API (point-in-time snapshots) + snapshot before each database migration
- **Auto-recovery:** Startup can restore a corrupt database from a valid backup after preserving the original. Other startup failures stop with an error; recovery is not a guarantee against data loss.
- **Cloud sync detection:** Warns if your data folder is inside OneDrive, Dropbox, Google Drive, or iCloud (cloud sync can corrupt SQLite databases)
- **Drive type detection:** Warns about removable drives; selecting a network drive for the database is rejected.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.
