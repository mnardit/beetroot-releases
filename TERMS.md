# License and Usage Terms

**Beetroot Clipboard Manager**

**Last updated:** September 8, 2026

## License

The source code in this repository and new builds distributed with it are licensed under [Apache License 2.0](LICENSE), except for third-party components under their own licenses. Historical installers retain the terms distributed with those releases; publishing this source does not replace or relabel older binaries.

Apache 2.0 permits personal and commercial use, modification and redistribution under its terms. It does not require modified versions to be open source. Redistribution obligations, including retaining applicable notices and marking changed files, are defined by the license itself.

[NOTICE](NOTICE) records authorship by Max Nardit. It does not add a mandatory advertising banner, require a particular UI credit or change the license. Third-party attribution is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the accompanying license files.

These usage notes explain the application and do not add restrictions to Apache 2.0. If this document conflicts with that license, the license controls.

## Authorship and Contributions

Beetroot was created by [Max Nardit](https://max.nardit.com). Contributors retain copyright in their own work. Contribution terms and setup instructions are in [CONTRIBUTING.md](CONTRIBUTING.md); no copyright assignment or separate CLA is required.

Apache 2.0 does not grant trademark rights beyond the uses described in section 6. Attribution does not mean the author endorses a fork or derivative product.

## Clipboard Data

Beetroot captures supported clipboard content while monitoring is enabled, subject to exclusions and limits. History may contain private information. Password-manager markers cannot identify every sensitive clip.

Secure your Windows account and device, pause monitoring when needed, choose appropriate retention settings and keep backups of important data. The clipboard database is not encrypted. Automatic recovery is not a guarantee against data loss.

Storage, network activity, API-key migration and deletion are explained in [PRIVACY.md](PRIVACY.md). History, WebView settings and Credential Manager keys are separate: uninstalling the app or deleting one history folder does not guarantee removal of all copies.

## Optional AI Features

Cloud AI transforms send the selected text or image and prompt to your chosen provider using your API key. Saved-key tests authenticate with that provider without sending clipboard content. You are responsible for your provider account, charges and compliance with applicable provider terms.

Local AI connects to a loopback server that you run. That server's own processing and network activity are outside Beetroot's control. Review the sensitivity of content before using either mode. AI output may be incomplete or incorrect; verify it before relying on it.

Beetroot's own history, search and native OCR do not require a cloud AI account.

## Updates and Support

Official standalone updates are distributed through [GitHub Releases](https://github.com/mnardit/beetroot-releases/releases); the built-in updater verifies Tauri update signatures. Those signatures are separate from Windows Authenticode. Microsoft Store installations update through Microsoft Store.

Automatic checks can be disabled; manual checks and optional network features remain available. Source publication does not itself release a new installer. The release page identifies the currently available version.

The author may stop maintaining or distributing the application. That does not revoke rights already granted under Apache 2.0. A supported release or an issue response does not constitute a separate warranty agreement.

## Warranty and Liability

The warranty disclaimer and liability terms in sections 7 and 8 of [Apache License 2.0](LICENSE) apply, subject to applicable law. These notes do not replace them or limit rights that cannot lawfully be excluded.

The application may have defects, clipboard history may be lost and AI output may be wrong. Assess whether it is appropriate for your use and do not treat clipboard history as your only copy of important information.

## Contact

For general questions, use [GitHub Issues](https://github.com/mnardit/beetroot-releases/issues). Do not include personal clipboard content or credentials. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
