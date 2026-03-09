<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot — Windows 剪贴板管理器" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  Windows 本该内置的剪贴板管理器。<br/>
  AI 转换、OCR、模糊搜索全部历史记录 — 只需一个快捷键。
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="版本"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="下载量"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="免费">
  <img src="https://img.shields.io/badge/source-proprietary-orange" alt="专有">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>下载</strong></a> · <a href="https://max.nardit.com/beetroot">官网</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">更新日志</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <b>中文</b> · <a href="README.ja.md">日本語</a>
</p>

> 本仓库包含发行版和文档。源代码为专有软件。

---

## 实际效果

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — 剪贴板历史模糊搜索" width="600">
</p>

| AI 转换 | 主题 |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="AI 翻译和语法修正" width="400"> | <img src="docs/gif/theme-switching.gif" alt="主题切换" width="400"> |

| 深色主题 | 浅色主题 |
|---|---|
| ![深色](docs/screenshots/main-dark-new.png) | ![浅色](docs/screenshots/main-light-filters.png) |

<details>
<summary>更多截图</summary>

| 右键菜单与 AI | 代码预览 |
|---|---|
| ![右键菜单](docs/screenshots/context-menu.jpg) | ![预览](docs/screenshots/preview-code.png) |

| 搜索 | AI 转换菜单 |
|---|---|
| ![搜索](docs/screenshots/search-results.png) | ![转换](docs/screenshots/transform-menu.png) |

| 设置 | 语言 |
|---|---|
| ![设置](docs/screenshots/settings-general-new.png) | ![语言](docs/screenshots/settings-languages.png) |

</details>

---

## 安装

**[从 GitHub Releases 下载最新 .exe](https://github.com/mnardit/beetroot-releases/releases/latest)**

或使用包管理器：

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
> **从 v1.0.5 或更早版本升级？** 由于一次性签名密钥更换，自动更新将不起作用。请[手动下载最新版本](https://github.com/mnardit/beetroot-releases/releases/latest) — 之后所有更新将自动进行。

**系统要求：** Windows 10 或更高版本。

---

## 为什么不用 Win+V？

| 功能 | Win+V | Beetroot |
|---|---|---|
| 历史记录 | 25 条 clip，重启后丢失 | 无限制，永久保存 |
| 搜索 | 无 | 模糊搜索 + 正则表达式 |
| AI 转换 | 无 | 10 个内置 + 自定义提示词 |
| OCR | 无 | Windows 原生引擎，本地处理 |
| 图片历史 | 仅缩略图 | 完整图片，本地存储 |
| 主题 | 无 | 9 个主题 + 自动模式 + 强调色 |
| 纯文本粘贴 | 无 | 专用快捷键 |
| 多显示器 | 无 | 窗口跟随光标 |
| 置顶 | 无 | 置顶 + 任意拖动 |
| 备注 | 无 | 可搜索的注释 |

---

## 快速开始

1. **安装** — 下载 .exe 或使用 winget/scoop/choco
2. **打开** — 按 `` Ctrl+` ``（可自定义）呼出 Beetroot
3. **搜索** — 直接输入进行模糊搜索，或使用 `/正则表达式/`
4. **收藏与备注** — 右键 → 收藏以置顶，添加备注提供上下文
5. **AI 与 OCR** — 右键 → 转换使用 AI，或右键图片 → OCR

---

## 功能

### 搜索与工作流

- **模糊搜索** — 容错查找任何内容
- **正则模式** — `/pattern/` 支持匹配高亮
- **过滤器** — 文本、图片、收藏、备注 — 一键筛选
- **快速粘贴** — `Ctrl+1..9` 无需打开窗口即可粘贴最近的项目
- **批量操作** — `Ctrl+Click` 多选，批量复制或删除
- **内容检测** — 自动识别 URL、邮箱、代码、JSON、颜色；点击即可打开
- **单实例** — 再次启动 Beetroot 将聚焦现有窗口

### AI 转换

- **10 个内置提示词** — 修正语法、翻译、摘要、改写、提取数据、格式化代码等
- **自定义提示词** — 最多 20 个，可从右键菜单访问
- **BYOK** — 使用您自己的 OpenAI API 密钥；Beetroot 绝不存储或代理您的数据
- **GPT-5 nano/mini** — 快速且经济，针对短文本优化

### OCR

- **从图片提取文字** — 右键点击图片 → OCR
- **Windows 原生引擎** — 无云端、无上传，完全离线
- **即时** — 异步运行，不阻塞应用

### 自定义

- **9 个主题** — Beetroot Dark/Light、Tokyo Night Storm、Gruvbox、GitHub Light、Nord Snow、Cyberpunk Dark/Light、Pure Dark（OLED #000000），以及自动模式
- **窗口效果** — Mica、Acrylic 或 Solid；根据 Windows 版本自动检测
- **字体** — 8 种 UI 字体、5 种代码字体、6 种大小
- **26 种语言** — EN、RU、DE、ES、ZH、JA、FR、PT、KO、TR、IT、PL、NL、UK、TH、HI、ID、VI、CS、HU、RO、SV、DA、FI、NB、MS
- **窗口置顶** — 始终显示在最前，可在显示器间拖动，或使用光标跟随模式
- **所有快捷键可自定义** — 在设置 → 快捷键中重新映射；支持 AZERTY、QWERTZ、AltGr

### 可靠性

- **自动备份** — 3 份轮换 + 每次更新前快照
- **自动恢复** — 检测损坏，静默从备份恢复
- **云同步警告** — 当数据文件夹位于 OneDrive、Dropbox 或 Google Drive 时发出警告
- **驱动器检测** — 写入 USB 或网络驱动器前发出警告
- **自动更新** — 内置更新器，也可禁用以完全离线运行

---

## 快捷键

| 快捷键 | 操作 |
|---|---|
| `` Ctrl+` `` | 显示 / 隐藏 Beetroot |
| `Enter` | 粘贴选中项 |
| `Ctrl+1..9` | 快速粘贴 |
| `Space` | 预览 |
| `Alt+T` | AI 转换 |
| `Alt+P` | 窗口置顶 |
| `Alt+F` | 光标跟随模式 |
| `Shift+F10` | 右键菜单 |
| `Ctrl+C` | 复制到剪贴板 |
| `Alt+Del` | 删除 |

所有快捷键可在**设置 → 快捷键**中自定义。支持 AZERTY、QWERTZ 和 AltGr 键盘布局。切换输入法时标签即时更新。

---

## 常见问题

**Beetroot 是免费的吗？**
是的。个人和商业使用均免费 — 无广告、无试用、无功能限制、无遥测。

**Beetroot 会发送我的剪贴板数据吗？**
不会。所有数据存储在本地 SQLite 数据库中。AI 转换仅在您明确选择转换时将选中文本发送到 OpenAI API — 且仅使用您自己的 API 密钥。

**具体发送了什么给 OpenAI？**
仅您右键 → 转换的文本。请求直接从您的电脑发送到 OpenAI API。Beetroot 绝不查看、存储或代理您的数据。没有 API 密钥 = 零网络请求。

**我的 API 密钥存储在哪里？**
在应用的本地设置中（WebView2 配置文件中的 localStorage）。它绝不会离开您的电脑。

**我的数据存储在哪里？**
默认在 `%LOCALAPPDATA%\com.beetroot.desktop\`。可在设置 → 数据中移动。数据库是标准 SQLite 文件 — 复制文件夹即可备份。

**Beetroot 支持 Windows 10 吗？**
支持。Windows 10 和 11 均受支持。Mica 和 Acrylic 窗口效果在 Windows 11 上可用。

**可以打开多个 Beetroot 窗口吗？**
不可以。Beetroot 为单实例运行 — 再次启动将聚焦现有窗口。

**自动更新可用吗？**
是的，v1.0.6 起可用。v1.0.5 及更早版本的用户需要[手动下载](https://github.com/mnardit/beetroot-releases/releases/latest)一次 — 之后自动更新正常工作。可在设置 → 通用中禁用自动更新。

---

## 隐私与安全

您的数据留在您的电脑上。无遥测、无分析、无云同步、无账户。

- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Terms of Service](TERMS.md)

---

## 故障排除

**自动更新不工作（v1.0.5 及更早版本）**
由于一次性签名密钥更换，需要[手动下载最新版本](https://github.com/mnardit/beetroot-releases/releases/latest)。之后的更新将自动进行。

**OCR 不工作或质量差**
OCR 使用 Windows 原生引擎。请确保安装了对应语言包：设置 → 时间和语言 → 语言 → 添加语言 → 勾选"语音"或"基本输入"。

**Beetroot 无法打开或快捷键无响应**
- 检查是否有其他应用占用了相同快捷键（如 `Ctrl+``）
- 尝试以管理员身份运行一次
- 在设置 → 快捷键中重新映射

**SmartScreen 或杀毒软件警告**
Beetroot 尚未进行代码签名（证书申请中）。在 SmartScreen 中点击"更多信息"→"仍要运行"。这是误报 — 应用是安全的。

---

## 反馈与错误报告

发现 bug 或有功能建议？[创建 issue](https://github.com/mnardit/beetroot-releases/issues)。

请包含：
- Beetroot 版本（设置 → 关于）
- Windows 版本（`winver`）
- 复现步骤
- 截图或错误信息（如有）

---

## 许可证

个人和商业使用均免费。源代码为专有软件。

<details>
<summary>第三方字体与致谢</summary>

**字体**（SIL Open Font License 1.1）：
- [Inter](https://github.com/rsms/inter) — Copyright 2020 The Inter Project Authors
- [Open Sans](https://github.com/googlefonts/opensans) — Copyright 2020 The Open Sans Project Authors
- [Montserrat](https://github.com/JulietaUla/montserrat) — Copyright 2011 The Montserrat Project Authors
- [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) — Copyright 2022 The Noto Project Authors
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — Copyright 2020 The JetBrains Mono Project Authors

**构建技术：** [Tauri v2](https://tauri.app/) · React 19 · Rust · SQLite · TypeScript

</details>

---

<p align="center">
  喜欢 Beetroot？点个 ⭐ 帮助更多人发现它。
</p>

<p align="center">
  由 <a href="https://max.nardit.com">Max Nardit</a> 开发
</p>
