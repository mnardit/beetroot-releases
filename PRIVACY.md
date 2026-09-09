# Privacy Policy

**Beetroot Clipboard Manager**

**Last updated:** September 8, 2026

This policy describes the source in this repository, including changes planned for 1.6.7. The current packaged release is 1.6.6 and does not yet include those changes. In particular, older versions store AI keys in WebView settings instead of Windows Credential Manager.

## 1. What Beetroot Stores

Beetroot is a Windows clipboard manager created by [Max Nardit](https://max.nardit.com). While monitoring is enabled, it captures supported clipboard content unless an exclusion or size limit applies. Clipboard history can contain passwords, personal information, financial data and private communications.

Stored history includes text, HTML for formatted paste, PNG images, timestamps, notes, source application names, window titles and app icons. The database is not encrypted. Other software running as your Windows user may be able to read it.

The default data location is `%APPDATA%/com.beetroot.desktop/`, containing `clipboard.db`, the `images/` folder and database backups. **Settings > Data** shows the actual selected folder, which can differ after a Move or Switch. Files placed in a synced folder may be uploaded by your sync software; Beetroot cannot control that software.

Non-secret settings, including preferences, model selection and custom prompts, are stored separately in the WebView's `localStorage`.

### API Keys

Cloud API keys in this source version are stored in Windows Credential Manager, separately from settings. New keys briefly pass through the key editor and native command when saved. The native app loads them for provider requests; there is no frontend command to read a saved key back.

When upgrading from localStorage-based storage, each legacy key is removed only after a successful verified vault write. Failed migration preserves remaining keys for retry; ordinary settings saves do not erase them. Existing backups or old profiles may still contain legacy copies. Credential Manager does not protect against malicious software running as your Windows user.

Saving or deleting a key takes effect independently of the bottom **Save** button for other settings. **Test** sends the saved key to the provider without sending clipboard content.

## 2. Network Activity

Beetroot does not run a service that receives your clipboard history and has no built-in analytics or automatic crash-report uploads. That does not mean every feature is offline.

| Action                              | Data sent                                                               | Destination / trigger                                               |
| ----------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Cloud AI transform                  | Selected text or image, prompt, model parameters and API authentication | Selected provider, when you request a transform                     |
| Saved-key test                      | API authentication in a model-list request, no clipboard content        | Selected provider, when you press **Test**                          |
| Local AI transform                  | Selected text or image, prompt and model parameters                     | Your loopback server, when you request a transform                  |
| Local endpoint test / model listing | Model-list request, no clipboard content                                | Your loopback server from AI settings                               |
| Update check                        | HTTP request for release metadata, no clipboard content or AI keys      | GitHub after startup if enabled, or on a manual check               |
| Update download                     | HTTP requests for the chosen installer                                  | GitHub's release delivery infrastructure when you choose to install |
| External link                       | Normal browser request                                                  | The destination website when you open a link                        |

Internet services receive connection metadata such as your IP address. Their handling of that metadata is governed by their own policies, not by this document. Microsoft Store updates are handled by Microsoft Store, separately from Beetroot's built-in updater.

Disabling automatic updates stops the startup check, not manual checks, downloads, AI requests or browser links. Clipboard history, search, native Windows OCR and bundled code-language detection do not require a cloud service.

### Cloud AI

Beetroot supports OpenAI, Gemini, Anthropic and DeepSeek. Cloud features require your own provider API key. Only providers and models that support images can perform vision transforms; DeepSeek integration is text-only.

A transform sends the selected content and prompt directly to the provider. Images may expose everything visible in a screenshot. Consider the sensitivity of the content before submitting it. Beetroot does not control the provider's retention, training policies, processing locations or account settings.

| Provider  | API endpoint                        | Provider information                                                                   |
| --------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| OpenAI    | `api.openai.com`                    | [API data controls](https://developers.openai.com/api/docs/guides/your-data)           |
| Gemini    | `generativelanguage.googleapis.com` | [Gemini API terms and data use](https://ai.google.dev/gemini-api/terms)                |
| Anthropic | `api.anthropic.com`                 | [Privacy policy](https://www.anthropic.com/legal/privacy)                              |
| DeepSeek  | `api.deepseek.com`                  | [Privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html) |

Processing may take place outside your country. Check your provider's current API terms and any applicable organizational requirements before sending personal or confidential data. Beetroot does not establish those legal arrangements for you.

### Local AI

Beetroot restricts local AI connections to `localhost`, `127.0.0.1` or `[::1]` and does not follow HTTP redirects from that endpoint. These are local HTTP connections, not an absence of networking.

A downloaded model running locally can work without internet access. The local server's own logging, model downloads, forwarding and network activity are outside Beetroot's control. Configure that server accordingly; a loopback address alone does not guarantee its processing stays offline.

## 3. Password Manager Detection

Beetroot honors clipboard exclusion formats such as `CF_CLIPBOARD_VIEWER_IGNORE` and `ExcludeClipboardContentFromMonitorProcessing`. If exclusion checks cannot be completed, capture is skipped.

This depends on the copying application publishing the marker. It is not a guarantee that all passwords are detected. Sensitive text copied without such a marker can enter history. Pause monitoring before handling content you do not want recorded.

## 4. Retention and Deletion

The default history limit is 500 items; **Settings > General** offers other limits and optional age-based deletion. Starred items are excluded from automatic pruning. Individual items and history can be deleted in the app.

Deleting a history entry is not secure erasure. Undo state, database backups, recovery copies and backups made by you or other software may still retain content. Database backups do not include separate PNG image files, WebView settings or Credential Manager keys.

To remove your data:

1. Note the selected data folder in **Settings > Data**. Delete saved keys for each cloud provider in **Settings > AI** before uninstalling.
2. Quit Beetroot from its tray menu, then uninstall it if you no longer use it.
3. Remove the selected history folder and any older history locations, recovery copies or backups you no longer need. A custom data folder is not removed just by deleting the default folder.
4. Treat WebView settings and Credential Manager entries separately. Uninstalling or deleting the history folder does not itself guarantee their removal; verify remaining app data and credentials in your Windows profile.

Do not post databases, API keys, unredacted screenshots or other private content in a public issue.

## 5. Backup and Recovery

Beetroot keeps up to three rotating database backups and takes a database snapshot before a schema migration. Backup requests also follow every 100 clipboard-history write operations. These are not snapshots before every application update and are not complete application-profile backups.

On database corruption, startup attempts recovery from a valid backup after retaining the original database. Other startup failures stop with an error. Recovery may lose changes since the last usable backup; neither automatic backups nor recovery guarantee against data loss.

The app warns about cloud-synced folders and removable drives. Selecting a network drive for the database is rejected.

### Exporting Clipboard History

1. In **Settings > Data**, note the full path shown under **Data location**. Use this actual selected directory, which may differ from the default `%APPDATA%/com.beetroot.desktop/` after a Move or Switch.
2. Right-click the Beetroot system tray icon and select **Quit**. Wait for the app to exit. Closing or hiding the popup leaves it running in the tray and does not stop database writes.
3. Keep Beetroot stopped while copying the entire selected directory. Include `clipboard.db`, any `clipboard.db-wal` and `clipboard.db-shm` files still present, the `images/` folder and database backups. Do not mix files from different locations or copies.

Copying only the base database while the app is running can omit committed recent history. A database-only export does not include PNG files. Neither a database export nor a complete history-folder copy includes the separately stored WebView settings or Credential Manager keys.

## 6. Security Measures and Limits

- The WebView CSP restricts direct connections; AI and updater requests run in native code and are not constrained by that CSP.
- Database operations use native commands and parameterized queries. Image access and deletion validate their paths.
- Text capture is limited to 1 MiB of UTF-8 data; clipboard image capture to 10 MiB of base64 data (about 7.5 MiB decoded). AI requests have separate limits.
- Repeated events for the same clipboard content are suppressed within 500 ms; distinct content has no global capture throttle.
- A low-level keyboard hook is installed at startup and removed at shutdown. It handles navigation while the no-focus popup is active and otherwise passes events through. It does not record keystrokes. It may be reinstalled when the popup opens to recover from Windows removing an unresponsive hook.
- The optional copied overlay displays a content-type label, not the clipboard contents.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and the security model.

## 7. Questions and Changes

For general questions, use [GitHub Issues](https://github.com/mnardit/beetroot-releases/issues) without sharing private data. For vulnerabilities, use the [private reporting form](https://github.com/mnardit/beetroot-releases/security/advisories/new). Information you voluntarily submit in an issue or report is shared with GitHub and the people who can access that report; it is not automatic application telemetry.

This policy describes the desktop application, not the privacy practices of GitHub, Microsoft Store, AI providers or linked websites. The app does not require a Beetroot account. Local operation alone does not determine anyone's obligations under privacy law.

Changes to this policy are recorded in the repository; the date above identifies this revision.
