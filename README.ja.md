<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot — Windows用クリップボードマネージャー" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  Windowsに標準搭載されるべきだったクリップボードマネージャー。<br/>
  AI変換、OCR、履歴全体のあいまい検索 — すべてひとつのショートカットキーで。
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="バージョン"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="ダウンロード数"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="無料">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Beetrootをダウンロード（無料）</strong></a> · <a href="https://max.nardit.com/beetroot">ウェブサイト</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">変更履歴</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh.md">中文</a> · <b>日本語</b>
</p>

> **v1.4の新機能：** ローカルAIモデル（LM Studio、Ollama）— APIキーなしで変換を実行できます。[新機能を見る →](https://github.com/mnardit/beetroot-releases/releases/tag/v1.4.0)

---

## なぜWin+Vではないのか？

| 機能 | Win+V | Beetroot |
|---|---|---|
| 履歴 | 25クリップ、再起動で消失 | 無制限、再起動後も保持 |
| 検索 | なし | あいまい検索 + 正規表現 |
| AI変換 | なし | OpenAI + ローカルモデル、10個の組み込み + カスタム |
| ソースアプリ追跡 | なし | アイコン、アプリ名、ウィンドウタイトルをクリップごとに記録 |
| OCR | なし | Windows標準エンジン、ローカル処理 |
| 画像履歴 | サムネイルのみ | フル画像、ローカル保存 |
| テーマ | なし | 9テーマ + 自動モード + アクセントカラー |
| プレーンテキスト貼り付け | なし | 専用ショートカット |
| マルチモニター | なし | ウィンドウがカーソルに追従 |
| ピン留め | なし | ピン留め + 自由にドラッグ |
| メモ | なし | 検索可能な注釈 |

---

## 実際の動作

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — クリップボード履歴のあいまい検索" width="600">
</p>

| AI変換 | テーマ |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="AI翻訳と文法修正" width="400"> | <img src="docs/gif/theme-switching.gif" alt="テーマ切り替え" width="400"> |

<details>
<summary>その他のスクリーンショット</summary>

| ダークテーマ | ライトテーマ |
|---|---|
| ![ダーク](docs/screenshots/main-dark-new.png) | ![ライト](docs/screenshots/main-light-filters.png) |

| コンテキストメニューとAI | コードプレビュー |
|---|---|
| ![コンテキストメニュー](docs/screenshots/context-menu.jpg) | ![プレビュー](docs/screenshots/preview-code.png) |

| 検索 | AI変換メニュー |
|---|---|
| ![検索](docs/screenshots/search-results.png) | ![変換](docs/screenshots/transform-menu.png) |

| 設定 | 言語 |
|---|---|
| ![設定](docs/screenshots/settings-general-new.png) | ![言語](docs/screenshots/settings-languages.png) |

</details>

---

## インストール

**[GitHub Releasesから最新の.exeをダウンロード](https://github.com/mnardit/beetroot-releases/releases/latest)**

またはパッケージマネージャーを使用：

```powershell
# Winget
winget install MNardit.Beetroot

# Scoop
scoop bucket add beetroot https://github.com/mnardit/scoop-bucket
scoop install beetroot

# Chocolatey
choco install beetroot
```

**動作要件：** Windows 10以降。

---

## 機能

### 検索とワークフロー

- **あいまい検索** — タイプミスがあっても何でも見つかる、インメモリインデックスで高速処理
- **正規表現モード** — `/pattern/` でマッチハイライト
- **フィルター** — テキスト、画像、お気に入り、メモ — ワンクリックで絞り込み
- **クイック貼り付け** — `Ctrl+1..9` でウィンドウを開かずに最近のクリップを貼り付け
- **一括操作** — `Ctrl+Click`で複数選択、コピー（カスタム区切り文字）または削除
- **コンテンツ検出** — URL、メール、コード、JSON、色を自動バッジ表示
- **シングルインスタンス** — Beetrootを再起動すると既存のウィンドウにフォーカス

### AI変換

- **2つのプロバイダー** — OpenAI（クラウド）またはローカル（LM Studio、Ollamaなど）、ワンクリックで切り替え
- **推論モデル** — Qwen3、DeepSeek R1などに対応（`<think>`タグを自動除去）
- **10個の組み込みプロンプト** — 文法修正、翻訳、要約、書き換え、データ抽出、コードフォーマットなど
- **カスタムプロンプト** — 最大20個作成可能、右クリックメニューからアクセス
- **BYOK** — 自分のOpenAI APIキーを使用、またはローカルモデルならキー不要

<details>
<summary>テキスト変換におすすめのローカルモデル</summary>

| モデル | サイズ | 速度 | 適した用途 |
|-------|------|-------|----------|
| **Qwen3 8B** (Q4_K) | 約5 GB | 高速 | 文法修正、翻訳、書き換え |
| **Gemma 3 4B** (Q4_K) | 約3 GB | 非常に高速 | タイプミス修正、簡単な書き換え |
| **Phi-4 Mini 3.8B** (Q4_K) | 約2.5 GB | 非常に高速 | コードと構造化テキスト |
| **Llama 3.1 8B** (Q4_K) | 約5 GB | 高速 | 汎用 |
| **Mistral Small 3.1 24B** (Q4_K) | 約14 GB | 低速（16+ GB VRAM） | プレミアム品質 |
| **DeepSeek R1 7B** (Q4_K) | 約5 GB | 高速 | 複雑な書き換え、要約 |

[LM Studio](https://lmstudio.ai)、[Ollama](https://ollama.com)、[llama.cpp](https://github.com/ggml-org/llama.cpp)で動作確認済み。設定 → AI → ローカルLLMで設定できます。

</details>

### ソースアプリ追跡

- **各クリップのコピー元を確認** — アプリアイコン、名前、ウィンドウタイトル
- **アプリでフィルター** — 「アプリ」ドロップダウンで検索、最終使用順/使用頻度順/アルファベット順でソート
- **検索対象に含まれる** — ソースアプリとウィンドウタイトルはあいまい検索・正規表現検索の対象

### OCR

- **画像からテキスト抽出** — 画像を右クリック → OCR
- **Windows標準エンジン** — クラウドなし、アップロードなし、完全オフライン
- **即座に実行** — 非同期処理、UIをブロックしません

### カスタマイズ

- **9テーマ** — Beetroot Dark/Light、Tokyo Night Storm、Gruvbox、GitHub Light、Nord Snow、Cyberpunk Dark/Light、Pure Dark（OLED #000000）、自動モード付き
- **ウィンドウエフェクト** — Mica、Acrylic、またはSolid；Windowsバージョンに応じて自動検出
- **タイポグラフィ** — UIフォント8種、コードフォント5種、サイズプリセット6段階
- **26言語** — EN、RU、DE、ES、ZH、JA、FR、PT、KO、TR、IT、PL、NL、UK、TH、HI、ID、VI、CS、HU、RO、SV、DA、FI、NB、MS
- **ウィンドウピン留め** — 常に最前面、モニター間でドラッグ、またはカーソル追従モード
- **すべてのショートカットをカスタマイズ** — 設定 → ショートカットですべて変更可能；AZERTY、QWERTZ、AltGr対応

### 信頼性

- **自動バックアップ** — 3コピーローテーション + 更新前にスナップショット
- **自動復旧** — 破損を検出し、バックアップから静かに復元
- **クラウド同期警告** — データフォルダがOneDrive、Dropbox、Google Drive内にある場合に警告
- **ドライブ検出** — USBやネットワークドライブへの書き込み前に警告
- **自動更新** — 組み込みアップデーター、完全オフライン運用では無効化可能

---

## ショートカットキー

| ショートカット | アクション |
|---|---|
| `` Ctrl+` `` | Beetrootの表示/非表示 |
| `Enter` | 選択クリップを貼り付け |
| `Ctrl+1..9` | クイック貼り付け |
| `Space` | プレビュー |
| `Alt+T` | AI変換 |
| `Alt+P` | ウィンドウピン留め |
| `Alt+F` | カーソル追従モード |
| `Shift+F10` | コンテキストメニュー |
| `Ctrl+C` | クリップボードにコピー |
| `Alt+Del` | 削除 |

すべてのショートカットは**設定 → ショートカット**でカスタマイズ可能。AZERTY、QWERTZ、AltGrレイアウトに対応。

---

## FAQ

**Beetrootは無料ですか？**
はい。個人利用・商用利用ともに無料 — 広告なし、試用期限なし、機能制限なし、テレメトリなし。

**Beetrootはクリップボードデータをどこかに送信しますか？**
いいえ。すべてのデータはマシン上のローカルSQLiteデータベースに保存されます。ローカルAIモデルを使用すれば、データがマシンから出ることは一切ありません。OpenAIを使用する場合、明示的に変換を選択したテキストのみが、ご自身のAPIキーを使って直接APIに送信されます。

**APIキーはどこに保存されますか？**
アプリのローカル設定（WebView2プロファイルのlocalStorage）に保存されます。マシンから外に出ることはありません。

**データはどこに保存されますか？**
デフォルトでは `%LOCALAPPDATA%\com.beetroot.desktop\`。設定 → データで移動可能です。データベースは標準的なSQLiteファイルです — フォルダをコピーするだけでバックアップできます。

**自動更新は動作しますか？**
はい、v1.0.6以降で動作します。v1.0.5以前のユーザーは一度[手動でダウンロード](https://github.com/mnardit/beetroot-releases/releases/latest)する必要があります — その後は自動更新が正常に動作します。設定 → 一般で自動更新を無効にできます。

---

## トラブルシューティング

**自動更新が動作しない（v1.0.5以前）**
署名キーの一度限りの変更により、[最新バージョンを手動でダウンロード](https://github.com/mnardit/beetroot-releases/releases/latest)する必要があります。以降の更新は自動で行われます。

**OCRが動作しない、または品質が低い**
OCRはWindows標準エンジンを使用しています。対応する言語パックがインストールされていることを確認してください：設定 → 時刻と言語 → 言語 → 言語の追加 → 「音声認識」または「基本入力」にチェック。

**Beetrootが開かない、またはホットキーが動作しない**
- 他のアプリが同じホットキーを使用していないか確認（例：`Ctrl+``）
- 一度管理者として実行してアクセス許可の問題を除外
- 設定 → ショートカットでホットキーを変更

**SmartScreenやウイルス対策の警告**
Beetrootはまだコード署名されていません（証明書申請中）。SmartScreenで「詳細情報」→「実行」をクリックしてください。[リリースのチェックサム](https://github.com/mnardit/beetroot-releases/releases/latest)で.exeのハッシュを検証できます。

---

## フィードバックとバグ報告

バグを発見、または機能リクエストがありますか？[Issueを作成](https://github.com/mnardit/beetroot-releases/issues)してください。

以下を含めてください：
- Beetrootバージョン（設定 → バージョン情報）
- Windowsバージョン（`winver`）
- 再現手順
- スクリーンショットまたはエラーメッセージ（該当する場合）

---

## ライセンス

個人利用・商用利用ともに無料。ソースコードはプロプライエタリです。

[Privacy Policy](PRIVACY.md) · [Security Policy](SECURITY.md) · [Terms of Service](TERMS.md)

<details>
<summary>サードパーティフォントとクレジット</summary>

**フォント**（SIL Open Font License 1.1）：
- [Inter](https://github.com/rsms/inter) — Copyright 2020 The Inter Project Authors
- [Open Sans](https://github.com/googlefonts/opensans) — Copyright 2020 The Open Sans Project Authors
- [Montserrat](https://github.com/JulietaUla/montserrat) — Copyright 2011 The Montserrat Project Authors
- [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) — Copyright 2022 The Noto Project Authors
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — Copyright 2020 The JetBrains Mono Project Authors

**使用技術：** [Tauri v2](https://tauri.app/) · React 19 · Rust · SQLite · TypeScript

</details>

---

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Beetrootをダウンロード</strong></a> · 気に入りましたか？ ⭐ を付けると他の人も見つけやすくなります。
</p>

<p align="center">
  <a href="https://max.nardit.com">Max Nardit</a> 制作
</p>
