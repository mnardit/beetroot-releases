<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot — Zwischenablage-Manager für Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  Der Zwischenablage-Manager, den Windows längst hätte einbauen sollen.<br/>
  KI-Transformationen, OCR und unscharfe Suche über die gesamte Historie — alles mit einer Tastenkombination.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Version"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Kostenlos">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Beetroot herunterladen (kostenlos)</strong></a> · <a href="https://max.nardit.com/beetroot">Website</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Deutsch</b> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh.md">中文</a> · <a href="README.ja.md">日本語</a>
</p>

> **Neu in v1.4:** Lokale KI-Modelle (LM Studio, Ollama) — Transformationen ohne API-Schlüssel. [Neuerungen ansehen →](https://github.com/mnardit/beetroot-releases/releases/tag/v1.4.0)

---

## Warum nicht Win+V?

| Funktion | Win+V | Beetroot |
|---|---|---|
| Historie | 25 Clips, nach Neustart weg | Unbegrenzt, bleibt über Neustarts erhalten |
| Suche | Nein | Unscharf + Regex |
| KI-Transformationen | Nein | OpenAI + lokale Modelle, 10 integrierte + eigene |
| Quell-App-Erkennung | Nein | Icon, Name und Fenstertitel pro Clip |
| OCR | Nein | Native Windows-Engine, lokal |
| Bildhistorie | Nur Miniaturansichten | Vollbilder, lokal gespeichert |
| Themes | Nein | 9 Themes + Auto-Modus + Akzentfarbe |
| Nur-Text einfügen | Nein | Eigene Tastenkombination |
| Multi-Monitor | Nein | Fenster folgt dem Cursor |
| Anheften | Nein | Anheften + überall hinziehen |
| Notizen | Nein | Durchsuchbare Anmerkungen |

---

## In Aktion

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — unscharfe Suche in der Zwischenablage-Historie" width="600">
</p>

| KI-Transformationen | Themes |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="KI-Übersetzung und Grammatikkorrektur" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Theme-Wechsel" width="400"> |

<details>
<summary>Weitere Screenshots</summary>

| Dunkles Theme | Helles Theme |
|---|---|
| ![Dunkel](docs/screenshots/main-dark-new.png) | ![Hell](docs/screenshots/main-light-filters.png) |

| Kontextmenü & KI | Code-Vorschau |
|---|---|
| ![Kontextmenü](docs/screenshots/context-menu.jpg) | ![Vorschau](docs/screenshots/preview-code.png) |

| Suche | KI-Transformationsmenü |
|---|---|
| ![Suche](docs/screenshots/search-results.png) | ![Transformationen](docs/screenshots/transform-menu.png) |

| Einstellungen | Sprachen |
|---|---|
| ![Einstellungen](docs/screenshots/settings-general-new.png) | ![Sprachen](docs/screenshots/settings-languages.png) |

</details>

---

## Installation

**[Neueste .exe von GitHub Releases herunterladen](https://github.com/mnardit/beetroot-releases/releases/latest)**

Oder über einen Paketmanager:

```powershell
# Winget
winget install MNardit.Beetroot

# Scoop
scoop bucket add beetroot https://github.com/mnardit/scoop-bucket
scoop install beetroot

# Chocolatey
choco install beetroot
```

**Voraussetzungen:** Windows 10 oder neuer.

---

## Funktionen

### Suche & Workflow

- **Unscharfe Suche** — findet alles trotz Tippfehlern, dank In-Memory-Index
- **Regex-Modus** — `/pattern/` mit Treffer-Hervorhebung
- **Filter** — Text, Bilder, Favoriten, Notizen — ein Klick zum Eingrenzen
- **Schnelles Einfügen** — `Ctrl+1..9` für die letzten Clips, ohne das Fenster zu öffnen
- **Stapeloperationen** — Mehrfachauswahl mit `Ctrl+Click`, dann kopieren (eigenes Trennzeichen) oder löschen
- **Inhaltserkennung** — Auto-Badges für URLs, E-Mails, Code, JSON, Farben
- **Einzelinstanz** — erneutes Starten bringt das bestehende Fenster in den Vordergrund

### KI-Transformationen

- **Zwei Anbieter** — OpenAI (Cloud) oder lokal (LM Studio, Ollama, etc.), mit einem Klick wechselbar
- **Reasoning-Modelle** — Qwen3, DeepSeek R1 und ähnliche funktionieren sofort (automatisches Entfernen von `<think>`-Tags)
- **10 integrierte Prompts** — Grammatik korrigieren, übersetzen, zusammenfassen, umschreiben, Daten extrahieren, als Code formatieren und mehr
- **Eigene Prompts** — bis zu 20 eigene erstellen, erreichbar über das Rechtsklick-Menü
- **BYOK** — eigenen OpenAI-Schlüssel verwenden, oder mit einem lokalen Modell ganz ohne Schlüssel arbeiten

<details>
<summary>Empfohlene lokale Modelle für Text-Transformationen</summary>

| Modell | Größe | Geschwindigkeit | Ideal für |
|-------|------|-------|----------|
| **Qwen3 8B** (Q4_K) | ~5 GB | Schnell | Grammatik, Übersetzung, Umschreiben |
| **Gemma 3 4B** (Q4_K) | ~3 GB | Sehr schnell | Tippfehler korrigieren, einfache Umformulierungen |
| **Phi-4 Mini 3.8B** (Q4_K) | ~2,5 GB | Sehr schnell | Code und strukturierter Text |
| **Llama 3.1 8B** (Q4_K) | ~5 GB | Schnell | Allzweck |
| **Mistral Small 3.1 24B** (Q4_K) | ~14 GB | Langsam (16+ GB VRAM) | Premium-Qualität |
| **DeepSeek R1 7B** (Q4_K) | ~5 GB | Schnell | Komplexe Umformulierungen, Zusammenfassungen |

Getestet mit [LM Studio](https://lmstudio.ai), [Ollama](https://ollama.com) und [llama.cpp](https://github.com/ggml-org/llama.cpp). Einrichtung unter Einstellungen → KI → Lokales LLM.

</details>

### Quell-App-Erkennung

- **Herkunft jedes Clips sehen** — App-Icon, Name und Fenstertitel
- **Nach App filtern** — „Apps"-Dropdown mit Suche, sortierbar nach zuletzt / am häufigsten genutzt / alphabetisch
- **Durchsuchbar** — Quell-App und Fenstertitel werden bei unscharfer und Regex-Suche berücksichtigt

### OCR

- **Text aus Bildern extrahieren** — Rechtsklick auf ein Bild → OCR
- **Native Windows-Engine** — keine Cloud, kein Upload, komplett offline
- **Sofort** — asynchron, blockiert die Oberfläche nicht

### Anpassung

- **9 Themes** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, Pure Dark (OLED #000000), plus Auto-Modus
- **Fenstereffekte** — Mica, Acrylic oder Solid; automatisch nach Windows-Version erkannt
- **Typografie** — 8 UI-Schriftarten, 5 Code-Schriftarten, 6 Größenstufen
- **26 Sprachen** — EN, RU, DE, ES, ZH, JA, FR, PT, KO, TR, IT, PL, NL, UK, TH, HI, ID, VI, CS, HU, RO, SV, DA, FI, NB, MS
- **Fenster anheften** — immer im Vordergrund, zwischen Monitoren ziehen oder Cursor-Folgemodus
- **Alle Shortcuts anpassbar** — alles neu belegen unter Einstellungen → Tastenkombinationen; AZERTY, QWERTZ, AltGr unterstützt

### Zuverlässigkeit

- **Automatische Backups** — 3-Kopien-Rotation + Snapshot vor jedem Update
- **Auto-Wiederherstellung** — erkennt Beschädigungen, stellt aus Backup wieder her
- **Cloud-Sync-Warnungen** — warnt, wenn der Datenordner in OneDrive, Dropbox oder Google Drive liegt
- **Laufwerkserkennung** — warnt vor dem Schreiben auf USB- oder Netzlaufwerke
- **Auto-Update** — integrierter Updater, oder deaktivierbar für komplett offline Betrieb

---

## Tastenkombinationen

| Kürzel | Aktion |
|---|---|
| `` Ctrl+` `` | Beetroot anzeigen / verbergen |
| `Enter` | Ausgewählten Clip einfügen |
| `Ctrl+1..9` | Schnelles Einfügen |
| `Space` | Vorschau |
| `Alt+T` | KI-Transformation |
| `Alt+P` | Fenster anheften |
| `Alt+F` | Cursor-Folgemodus |
| `Shift+F10` | Kontextmenü |
| `Ctrl+C` | In Zwischenablage kopieren |
| `Alt+Del` | Löschen |

Alle Tastenkombinationen sind anpassbar unter **Einstellungen → Tastenkombinationen**. Funktioniert mit AZERTY, QWERTZ und AltGr-Layouts.

---

## FAQ

**Ist Beetroot kostenlos?**
Ja. Kostenlos für private und gewerbliche Nutzung — keine Werbung, keine Testversionen, keine Funktionseinschränkungen, keine Telemetrie.

**Sendet Beetroot meine Zwischenablage-Daten irgendwohin?**
Nein. Alles bleibt in einer lokalen SQLite-Datenbank auf deinem Rechner. Mit einem lokalen KI-Modell verlässt nie etwas deinen Rechner. Bei OpenAI wird nur der Text gesendet, den du explizit transformierst — direkt an deren API mit deinem eigenen Schlüssel.

**Wo wird mein API-Schlüssel gespeichert?**
In den lokalen App-Einstellungen (localStorage im WebView2-Profil). Er verlässt nie deinen Rechner.

**Wo werden meine Daten gespeichert?**
Standardmäßig in `%LOCALAPPDATA%\com.beetroot.desktop\`. Der Speicherort lässt sich ändern unter Einstellungen → Daten. Die Datenbank ist eine Standard-SQLite-Datei — Backup durch Kopieren des Ordners.

**Funktioniert Auto-Update?**
Ja, ab v1.0.6. Nutzer von v1.0.5 oder früher müssen einmal [manuell herunterladen](https://github.com/mnardit/beetroot-releases/releases/latest) — danach funktioniert Auto-Update normal. Auto-Update kann unter Einstellungen → Allgemein deaktiviert werden.

---

## Fehlerbehebung

**Auto-Update funktioniert nicht (v1.0.5 und früher)**
Eine einmalige Änderung des Signaturschlüssels erfordert das [manuelle Herunterladen der neuesten Version](https://github.com/mnardit/beetroot-releases/releases/latest). Zukünftige Updates funktionieren dann automatisch.

**OCR funktioniert nicht oder schlechte Qualität**
OCR nutzt die native Windows-Engine. Stelle sicher, dass das entsprechende Sprachpaket installiert ist: Einstellungen → Zeit und Sprache → Sprache → Sprache hinzufügen → „Sprache" oder „Einfache Eingabe" aktivieren.

**Beetroot öffnet sich nicht oder Hotkey funktioniert nicht**
- Prüfe, ob eine andere App den gleichen Hotkey nutzt (z.B. `Ctrl+``)
- Versuche einen einmaligen Start als Administrator
- Ändere den Hotkey unter Einstellungen → Tastenkombinationen

**SmartScreen- oder Antivirus-Warnung**
Beetroot ist noch nicht code-signiert (Zertifikat in Bearbeitung). Klicke auf „Weitere Informationen" → „Trotzdem ausführen" in SmartScreen. Die .exe-Prüfsumme lässt sich mit den [Release-Checksummen](https://github.com/mnardit/beetroot-releases/releases/latest) abgleichen.

---

## Feedback & Fehlerberichte

Fehler gefunden oder Feature-Wunsch? [Erstelle ein Issue](https://github.com/mnardit/beetroot-releases/issues).

Bitte gib folgendes an:
- Beetroot-Version (Einstellungen → Über)
- Windows-Version (`winver`)
- Schritte zur Reproduktion
- Screenshot oder Fehlermeldung, falls vorhanden

---

## Lizenz

Kostenlos für private und gewerbliche Nutzung. Quellcode ist proprietär.

[Privacy Policy](PRIVACY.md) · [Security Policy](SECURITY.md) · [Terms of Service](TERMS.md)

<details>
<summary>Drittanbieter-Schriftarten & Credits</summary>

**Schriftarten** (SIL Open Font License 1.1):
- [Inter](https://github.com/rsms/inter) — Copyright 2020 The Inter Project Authors
- [Open Sans](https://github.com/googlefonts/opensans) — Copyright 2020 The Open Sans Project Authors
- [Montserrat](https://github.com/JulietaUla/montserrat) — Copyright 2011 The Montserrat Project Authors
- [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) — Copyright 2022 The Noto Project Authors
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — Copyright 2020 The JetBrains Mono Project Authors

**Erstellt mit:** [Tauri v2](https://tauri.app/) · React 19 · Rust · SQLite · TypeScript

</details>

---

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Beetroot herunterladen</strong></a> · Gefällt es dir? Ein ⭐ hilft anderen, es zu finden.
</p>

<p align="center">
  Erstellt von <a href="https://max.nardit.com">Max Nardit</a>
</p>
