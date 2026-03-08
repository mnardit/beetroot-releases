<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot — Zwischenablage-Manager für Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  Der Zwischenablage-Manager, den Windows längst hätte einbauen sollen.<br/>
  KI-Transformationen, OCR, unscharfe Suche über die gesamte Historie — alles mit einer Tastenkombination.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Version"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Kostenlos">
  <img src="https://img.shields.io/badge/source-proprietary-orange" alt="Proprietär">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Download</strong></a> · <a href="https://max.nardit.com/beetroot">Website</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.ru.md">Русский</a> · <b>Deutsch</b> · <a href="README.es.md">Español</a> · <a href="README.zh.md">中文</a>
</p>

> Dieses Repository enthält Releases und Dokumentation. Der Quellcode ist proprietär.

---

## In Aktion

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — unscharfe Suche in der Zwischenablage-Historie" width="600">
</p>

| KI-Transformationen | Themes |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="KI-Übersetzung und Grammatikkorrektur" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Theme-Wechsel" width="400"> |

| Dunkles Theme | Helles Theme |
|---|---|
| ![Dunkel](docs/screenshots/main-dark-new.png) | ![Hell](docs/screenshots/main-light-filters.png) |

<details>
<summary>Weitere Screenshots</summary>

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

**[Laden Sie die neueste .exe von GitHub Releases herunter](https://github.com/mnardit/beetroot-releases/releases/latest)**

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

> [!NOTE]
> **Update von v1.0.5 oder früher?** Das Auto-Update funktioniert aufgrund einer einmaligen Änderung des Signaturschlüssels nicht. [Laden Sie die neueste Version manuell herunter](https://github.com/mnardit/beetroot-releases/releases/latest) — alle zukünftigen Updates funktionieren dann automatisch.

**Voraussetzungen:** Windows 10 oder neuer.

---

## Warum nicht Win+V?

| Funktion | Win+V | Beetroot |
|---|---|---|
| Historie | 25 Einträge, nach Neustart weg | Unbegrenzt, dauerhaft gespeichert |
| Suche | Nein | Unscharf + Regex |
| KI-Transformationen | Nein | 10 integrierte + eigene Prompts |
| OCR | Nein | Native Windows-Engine, lokal |
| Bildhistorie | Nur Miniaturansichten | Vollbilder, lokal gespeichert |
| Themes | Nein | 9 Themes + Auto-Modus + Akzentfarbe |
| Nur-Text einfügen | Nein | Eigene Tastenkombination |
| Multi-Monitor | Nein | Fenster folgt dem Cursor |
| Anheften | Nein | Anheften + überall hinziehen |
| Notizen | Nein | Durchsuchbare Anmerkungen |

---

## Schnellstart

1. **Installieren** — .exe herunterladen oder winget/scoop/choco verwenden
2. **Öffnen** — `` Ctrl+` `` drücken (anpassbar) um Beetroot anzuzeigen
3. **Suchen** — einfach tippen für unscharfe Suche, oder `/regex/`
4. **Favoriten & Notizen** — Rechtsklick → Favorit um Einträge oben zu halten, Notizen für Kontext
5. **KI & OCR** — Rechtsklick → Transformieren für KI, oder Rechtsklick auf ein Bild → OCR

---

## Funktionen

### Suche & Workflow

- **Unscharfe Suche** — findet alles, auch mit Tippfehlern
- **Regex-Modus** — `/pattern/` für Power-User mit Hervorhebung
- **Filter** — Text, Bilder, Favoriten, Notizen — ein Klick zum Filtern
- **Schnelles Einfügen** — `Ctrl+1..9` für die letzten Einträge ohne Fenster zu öffnen
- **Stapeloperationen** — Mehrfachauswahl mit `Ctrl+Click`, Stapelkopieren oder -löschen
- **Inhaltserkennung** — Auto-Badges für URLs, E-Mails, Code, JSON, Farben; Klick zum Öffnen
- **Einzelinstanz** — erneutes Starten fokussiert das bestehende Fenster

### KI-Transformationen

- **10 integrierte Prompts** — Grammatik korrigieren, übersetzen, zusammenfassen, umschreiben, Daten extrahieren, als Code formatieren und mehr
- **Eigene Prompts** — bis zu 20 eigene, erreichbar über das Kontextmenü
- **BYOK** — eigenen OpenAI-API-Schlüssel verwenden; Beetroot speichert oder leitet Ihre Daten nie weiter
- **GPT-5 nano/mini** — schnell und günstig, optimiert für kurze Texte

### OCR

- **Text aus Bildern extrahieren** — Rechtsklick auf ein Bild → OCR
- **Native Windows-Engine** — keine Cloud, kein Upload, komplett offline
- **Sofort** — läuft asynchron, blockiert die App nicht

### Anpassung

- **9 Themes** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, Pure Dark (OLED #000000), plus Auto-Modus
- **Fenstereffekte** — Mica, Acrylic oder Solid; automatisch erkannt nach Windows-Version
- **Typografie** — 8 UI-Schriftarten, 5 Code-Schriftarten, 6 Größenstufen
- **26 Sprachen** — EN, RU, DE, ES, ZH, JA, FR, PT, KO, TR, IT, PL, NL, UK, TH, HI, ID, VI, CS, HU, RO, SV, DA, FI, NB, MS
- **Fenster anheften** — immer im Vordergrund, zwischen Monitoren ziehen, oder Cursor-Folgemodus
- **Alle Shortcuts anpassbar** — alles neu belegen unter Einstellungen → Tastenkombinationen; AZERTY, QWERTZ, AltGr unterstützt

### Zuverlässigkeit

- **Automatische Backups** — 3-Kopien-Rotation + Snapshot vor jedem Update
- **Auto-Wiederherstellung** — erkennt Beschädigungen, stellt aus Backup wieder her
- **Cloud-Sync-Warnungen** — warnt, wenn der Datenordner in OneDrive, Dropbox oder Google Drive liegt
- **Laufwerkserkennung** — warnt vor Schreiben auf USB- oder Netzlaufwerke
- **Auto-Update** — integrierter Updater, oder deaktivieren für komplett offline Betrieb

---

## Tastenkombinationen

| Kürzel | Aktion |
|---|---|
| `` Ctrl+` `` | Beetroot anzeigen / verbergen |
| `Enter` | Ausgewählten Eintrag einfügen |
| `Ctrl+1..9` | Schnelles Einfügen |
| `Space` | Vorschau |
| `Alt+T` | KI-Transformation |
| `Alt+P` | Fenster anheften |
| `Alt+F` | Cursor-Folgemodus |
| `Shift+F10` | Kontextmenü |
| `Ctrl+C` | In Zwischenablage kopieren |
| `Alt+Del` | Löschen |

Alle Tastenkombinationen sind anpassbar unter **Einstellungen → Tastenkombinationen**. Funktioniert mit AZERTY, QWERTZ und AltGr-Layouts. Labels aktualisieren sich sofort beim Wechsel mit Win+Space.

---

## FAQ

**Ist Beetroot kostenlos?**
Ja. Kostenlos für private und gewerbliche Nutzung — keine Werbung, keine Testversionen, keine Funktionseinschränkungen, keine Telemetrie.

**Sendet Beetroot meine Zwischenablage-Daten irgendwohin?**
Nein. Alles bleibt in einer lokalen SQLite-Datenbank auf Ihrem Rechner. KI-Transformationen senden nur den ausgewählten Text an die OpenAI-API, wenn Sie explizit eine Transformation wählen — und nur mit Ihrem eigenen API-Schlüssel.

**Was genau wird an OpenAI gesendet?**
Nur der Text, auf den Sie Rechtsklick → Transformieren klicken. Die Anfrage geht direkt von Ihrem Rechner an die OpenAI-API. Beetroot sieht, speichert oder leitet Ihre Daten nie weiter. Kein API-Schlüssel = null Netzwerkanfragen.

**Wo wird mein API-Schlüssel gespeichert?**
In den lokalen App-Einstellungen (localStorage im WebView2-Profil). Er verlässt nie Ihren Rechner.

**Wo werden meine Daten gespeichert?**
Standardmäßig in `%LOCALAPPDATA%\com.beetroot.desktop\`. Sie können den Ort ändern unter Einstellungen → Daten. Die Datenbank ist eine Standard-SQLite-Datei — sichern Sie sie durch Kopieren des Ordners.

**Funktioniert Beetroot unter Windows 10?**
Ja. Windows 10 und 11 werden unterstützt. Mica- und Acrylic-Fenstereffekte sind unter Windows 11 verfügbar.

**Kann ich mehrere Beetroot-Fenster öffnen?**
Nein. Beetroot läuft als Einzelinstanz — erneutes Starten fokussiert das bestehende Fenster.

**Funktioniert das Auto-Update?**
Ja, ab v1.0.6. Nutzer von v1.0.5 oder früher müssen einmal [manuell herunterladen](https://github.com/mnardit/beetroot-releases/releases/latest) — danach funktioniert Auto-Update normal. Auto-Update kann unter Einstellungen → Allgemein deaktiviert werden.

---

## Datenschutz & Sicherheit

Ihre Daten bleiben auf Ihrem Rechner. Keine Telemetrie, keine Analysen, keine Cloud-Synchronisation, kein Konto.

- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Terms of Service](TERMS.md)

---

## Fehlerbehebung

**Auto-Update funktioniert nicht (v1.0.5 und früher)**
Eine einmalige Änderung des Signaturschlüssels erfordert das [manuelle Herunterladen der neuesten Version](https://github.com/mnardit/beetroot-releases/releases/latest). Zukünftige Updates funktionieren dann automatisch.

**OCR funktioniert nicht oder schlechte Qualität**
OCR nutzt die native Windows-Engine. Stellen Sie sicher, dass das entsprechende Sprachpaket installiert ist: Einstellungen → Zeit und Sprache → Sprache → Sprache hinzufügen → „Sprache" oder „Einfache Eingabe" aktivieren.

**Beetroot öffnet sich nicht oder Hotkey funktioniert nicht**
- Prüfen Sie, ob eine andere App den gleichen Hotkey nutzt (z.B. `Ctrl+``)
- Versuchen Sie einen einmaligen Start als Administrator
- Ändern Sie den Hotkey unter Einstellungen → Tastenkombinationen

**SmartScreen- oder Antivirus-Warnung**
Beetroot ist noch nicht code-signiert (Zertifikat in Bearbeitung). Klicken Sie auf „Weitere Informationen" → „Trotzdem ausführen" in SmartScreen. Dies ist ein Fehlalarm — die App ist sicher.

---

## Feedback & Fehlerberichte

Fehler gefunden oder Feature-Wunsch? [Erstellen Sie ein Issue](https://github.com/mnardit/beetroot-releases/issues).

Bitte geben Sie an:
- Beetroot-Version (Einstellungen → Über)
- Windows-Version (`winver`)
- Schritte zur Reproduktion
- Screenshot oder Fehlermeldung, falls vorhanden

---

## Lizenz

Kostenlos für private und gewerbliche Nutzung. Quellcode ist proprietär.

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
  Erstellt von <a href="https://max.nardit.com">Max Nardit</a>
</p>
