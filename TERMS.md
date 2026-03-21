# Terms of Service

**Beetroot Clipboard Manager**
**Last updated:** March 21, 2026
**Version:** 1.6.0

---

## 1. Acceptance of Terms

By downloading, installing, or using Beetroot ("the App"), you agree to these Terms of Service ("Terms"). If you do not agree, do not use the App.

---

## 2. Description of Service

Beetroot is a desktop clipboard manager for Windows that:
- Monitors your system clipboard and stores a history of copied content
- Provides search (5-phase ranked scoring with accent folding and typo tolerance), filtering, and organization of clipboard history
- Offers AI-powered text transforms via cloud providers (OpenAI, Gemini, Anthropic, DeepSeek — requires API key) or local AI models (LM Studio, Ollama, llama.cpp — no API key required)
- Provides OCR text extraction from images
- Supports no-focus window mode (no focus stealing), pin-on-top, and follow-cursor window modes
- Automatic backup rotation (3 copies) with recovery from database corruption
- Uses on-device ML model for programming language detection (54 languages, no network required)
- Stores all data locally on your device

---

## 3. License

Beetroot is provided as **free software** for personal and commercial use. You may:
- Install and use the App on any number of personal devices
- Use the App for any lawful purpose, personal or commercial

You may also:
- Redistribute the compiled application in its unmodified form (e.g., host on your website)

You may not:
- Reverse engineer, decompile, or disassemble the App
- Sell or sublicense the App
- Modify, repackage, or create derivative works of the App
- Remove or modify any proprietary notices
- Use the App for any unlawful purpose

The source code is proprietary. All rights not expressly granted are reserved.

---

## 4. Your Responsibilities

### 4.1 Clipboard Content

The App stores everything you copy to the clipboard. You are responsible for:
- Being aware that sensitive data (passwords, financial info, personal data) will be stored
- Using the Pause feature when handling highly sensitive information
- Configuring appropriate auto-delete settings
- Not relying solely on the App's password manager detection for security

### 4.2 AI Transforms

When using AI text transforms:
- You are responsible for not sending sensitive, confidential, or regulated data to any AI provider
- When using cloud providers (OpenAI, Gemini, Anthropic, DeepSeek): you must comply with each provider's usage policies and you are responsible for your API key and associated costs
- When using Local LLM: you are responsible for the model you run and its output
- AI-generated output may be inaccurate; verify results before relying on them

### 4.3 Data Security

Since all data is stored locally on your device:
- You are responsible for securing your device (passwords, encryption, physical access)
- You are responsible for backing up data if needed
- We recommend enabling full-disk encryption (e.g., BitLocker) for additional protection

---

## 5. Privacy

Your privacy is important. Please review our [Privacy Policy](PRIVACY.md) for details on data collection, storage, and processing. Key points:
- All clipboard data stays on your device
- No analytics, telemetry, or tracking
- AI transforms send text to cloud providers only when you explicitly trigger them (or stay fully local with Local LLM)
- No account or registration required

---

## 6. Intellectual Property

Beetroot, its logo, name, and all associated materials are the intellectual property of the developer. Third-party components are used under their respective licenses:
- Tauri (MIT/Apache-2.0)
- React (MIT)
- SQLite (Public Domain)
- Other dependencies as listed in the project's package files

---

## 7. Disclaimer of Warranties

THE APP IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.

We do not warrant that:
- The App will be error-free or uninterrupted
- The App will meet your specific requirements
- AI transform results will be accurate or complete
- The clipboard history database will not be corrupted or lost
- The App will detect and exclude all sensitive data (e.g., passwords)

---

## 8. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE DEVELOPER BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
- Loss of data or profits
- Data breaches resulting from the unencrypted local database
- Unauthorized access to clipboard history by third-party software
- Costs incurred from cloud AI provider API usage (OpenAI, Gemini, Anthropic, DeepSeek)
- Any AI-generated content used in error

OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE APP (WHICH IS $0 FOR THE FREE VERSION).

---

## 9. Updates

- The App includes an auto-update mechanism that checks for new versions
- Updates are downloaded from GitHub Releases and verified with cryptographic signatures
- You can disable auto-update checks in Settings
- We may update these Terms; continued use after changes constitutes acceptance

---

## 10. Termination

- You may stop using the App at any time by uninstalling it
- Delete `%APPDATA%/com.beetroot.desktop/` to remove all stored data
- We reserve the right to discontinue the App at any time without notice

---

## 11. Governing Law

These Terms are governed by applicable local law. Any disputes shall be resolved in the courts of the developer's jurisdiction.

---

## 12. Contact

For questions about these Terms:
- **GitHub Issues:** [github.com/mnardit/beetroot-releases/issues](https://github.com/mnardit/beetroot-releases/issues)

---

## 13. Summary

| Question | Answer |
|----------|--------|
| Is Beetroot free? | Yes, free for personal and commercial use |
| Can I redistribute it? | Yes, the unmodified compiled app (not the source code) |
| Who is responsible for my data? | You are; all data is stored locally |
| Is there a warranty? | No, provided "as is" |
| Can I use it commercially? | Yes |
| How do I delete everything? | Uninstall + delete `%APPDATA%/com.beetroot.desktop/` |
