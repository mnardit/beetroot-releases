<p align="center">
  <img src="docs/screenshots/main-dark.png" alt="Beetroot — Windows 剪贴板管理器" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases">源代码</a> · <a href="CONTRIBUTING.md">参与开发</a> · <a href="https://max.nardit.com">Max Nardit</a>
</p>

<p align="center">
  Windows 本该内置的剪贴板管理器。<br/>
  AI 转换、OCR、模糊搜索全部历史记录 — 只需一个快捷键。
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="版本"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="下载量"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="免费">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="Apache 2.0"></a>
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>下载 Beetroot（免费）</strong></a> · <a href="https://apps.microsoft.com/detail/9ng50mkds58x">Microsoft Store</a> · <a href="https://max.nardit.com/beetroot">官网</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">更新日志</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <b>中文</b> · <a href="README.ja.md">日本語</a>
</p>

> **Beetroot 现已采用 [Apache 2.0](LICENSE) 开源。** 欢迎查看代码、报告问题或参与开发。作者：[Max Nardit](https://max.nardit.com)。
>
> **发布状态：** 当前安装版为 [1.6.6](https://github.com/mnardit/beetroot-releases/releases/tag/v1.6.6)。本 README 描述仓库中的代码；[Unreleased](CHANGELOG.md#unreleased) 中的更改（包括新的密钥存储方式）计划随 1.6.7 发布，尚未包含在该下载中。

---

## 为什么不用 Win+V？

| 功能         | Win+V                  | Beetroot                                                     |
| ------------ | ---------------------- | ------------------------------------------------------------ |
| 历史记录     | 25 条 clip，重启后丢失 | 无限制，跨重启永久保存                                       |
| 搜索         | 无                     | 模糊搜索 + 正则表达式                                        |
| AI 转换      | 无                     | 4 个云端提供商 + 本地模型，10 个文本 + 5 个视觉内置 + 自定义 |
| AI 视觉      | 无                     | 用 AI 识别文字、描述内容、从图片中提取数据                   |
| 来源应用追踪 | 无                     | 每条 clip 显示图标、应用名、窗口标题                         |
| OCR          | 无                     | Windows 原生引擎，本地处理                                   |
| 图片历史     | 仅缩略图               | 完整图片，本地存储                                           |
| 主题         | 无                     | 9 个主题 + 自动模式 + 强调色                                 |
| 纯文本粘贴   | 无                     | 专用快捷键                                                   |
| 多显示器     | 无                     | 窗口跟随光标                                                 |
| 置顶         | 无                     | 置顶 + 任意拖动                                              |
| 备注         | 无                     | 可搜索的注释                                                 |

---

## 截图

<p align="center">
  <img src="docs/screenshots/search.png" alt="Beetroot — 剪贴板历史模糊搜索" width="600">
</p>

| AI 操作                                                                    | 外观                                                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| <img src="docs/screenshots/context-menu-ai.png" alt="AI 操作" width="400"> | <img src="docs/screenshots/settings-appearance.png" alt="外观" width="400"> |

<details>
<summary>更多截图</summary>

| 深色主题                                | 浅色主题                                 |
| --------------------------------------- | ---------------------------------------- |
| ![深色](docs/screenshots/main-dark.png) | ![浅色](docs/screenshots/main-light.png) |

| 右键菜单与 AI                                     | JSON 预览                                  |
| ------------------------------------------------- | ------------------------------------------ |
| ![右键菜单](docs/screenshots/context-menu-ai.png) | ![预览](docs/screenshots/preview-json.png) |

</details>

---

## 安装

**[从 GitHub Releases 下载最新 .exe](https://github.com/mnardit/beetroot-releases/releases/latest)**，或从 **[Microsoft Store](https://apps.microsoft.com/detail/9ng50mkds58x)** 安装。

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

**系统要求：** Windows 10 或更高版本。

---

## 功能

### 搜索与工作流

- **5 阶段搜索** — 精确子串 → 词首匹配 → 元数据 → 模糊。容错搜索，结果按相关性排序
- **正则模式** — `/pattern/` 支持匹配高亮
- **过滤器** — 文本、图片、收藏、备注 — 一键筛选
- **快速粘贴**：在 Beetroot 列表处于活动状态时，`Ctrl+1..9` 可选择最近的条目；窗口隐藏时它不是全局快捷键。
- **批量操作** — `Ctrl+Click` 多选，然后复制（自定义分隔符）或删除
- **内容检测** — 自动识别 URL、邮箱、代码、JSON、颜色。ML 驱动的编程语言检测（54 种语言），用于代码预览
- **单实例** — 再次启动 Beetroot 将聚焦现有窗口

### AI 转换

- **4 个云端提供商 + 本地** — OpenAI、Gemini、Claude、DeepSeek 或本地（LM Studio、Ollama），一键切换
- **后台处理** — 点击提示词后菜单立即关闭，处理完成后通知。支持多个转换排队
- **推理模型** — Qwen3、DeepSeek R1 等开箱即用（自动去除 `<think>` 标签）
- **10 个文本提示词** — 修正语法、翻译、摘要、改写、提取数据、格式化代码等
- **自定义提示词** — 最多 20 个，可从右键菜单访问
- **BYOK** — 使用您自己的 OpenAI 密钥，或使用本地模型无需密钥
- **原生 Rust** — 所有 AI API 调用在原生代码中执行，不经过浏览器引擎。无 CORS 问题，窗口隐藏时也能正常工作

### AI 视觉

- **5 个内置视觉提示词** — 识别文字、描述图片、提取数据、总结图片内容、翻译图片文字
- **适用于历史记录中的所有图片** — 截图、照片、扫描件、手写笔记
- **云端 + 本地** — GPT-5.4、Claude、Gemini，或本地模型（Ollama llava/bakllava/moondream、LM Studio）
- **自定义视觉提示词** — 在设置 → AI 中创建，类型选择"图片"
- **应用场景：** 识别手写处方、从收据中提取数据、OCR 外语截图、描述图表和图示

<details>
<summary>推荐的本地文本转换模型</summary>

| 模型                             | 大小    | 速度                 | 适用场景             |
| -------------------------------- | ------- | -------------------- | -------------------- |
| **Qwen3 8B** (Q4_K)              | ~5 GB   | 快                   | 语法修正、翻译、改写 |
| **Gemma 3 4B** (Q4_K)            | ~3 GB   | 很快                 | 修正错别字、简单改写 |
| **Phi-4 Mini 3.8B** (Q4_K)       | ~2.5 GB | 很快                 | 代码和结构化文本     |
| **Llama 3.1 8B** (Q4_K)          | ~5 GB   | 快                   | 通用场景             |
| **Mistral Small 3.1 24B** (Q4_K) | ~14 GB  | 慢（需 16+ GB 显存） | 高质量输出           |
| **DeepSeek R1 7B** (Q4_K)        | ~5 GB   | 快                   | 复杂改写、摘要       |

已通过 [LM Studio](https://lmstudio.ai)、[Ollama](https://ollama.com) 和 [llama.cpp](https://github.com/ggml-org/llama.cpp) 测试。在设置 → AI → Local LLM 中配置。

</details>

### 来源应用追踪

- **查看每条 clip 的来源** — 应用图标、名称和窗口标题
- **按应用过滤** — "应用"下拉菜单支持搜索，可按最近使用 / 最常使用 / 字母排序
- **可搜索** — 来源应用和窗口标题包含在模糊搜索和正则搜索中

### OCR

- **从图片提取文字** — 右键点击图片 → OCR
- **Windows 原生引擎** — 无云端、无上传，完全离线
- **即时** — 异步运行，不阻塞界面

### 自定义

- **9 个主题** — Beetroot Dark/Light、Tokyo Night Storm、Gruvbox、GitHub Light、Nord Snow、Cyberpunk Dark/Light、Pure Dark（OLED #000000），以及自动模式
- **窗口效果** — Mica、Acrylic 或 Solid；根据 Windows 版本自动检测
- **字体** — 8 种 UI 字体、5 种代码字体、6 种大小预设
- **26 种语言** — EN、RU、DE、ES、ZH、JA、FR、PT、KO、TR、IT、PL、NL、UK、TH、HI、ID、VI、CS、HU、RO、SV、DA、FI、NB、MS
- **窗口置顶** — 始终显示在最前，可在显示器间拖动，或使用光标跟随模式
- **所有快捷键可自定义** — 在设置 → 快捷键中重新映射；支持 AZERTY、QWERTZ、AltGr

### 可靠性

- **数据库备份**：最多保留 3 份轮换备份，并在数据库迁移前创建快照。图片和设置需要另行备份。
- **恢复并提示**：在可恢复时，保留原始文件后从有效备份恢复数据库；最近的条目可能缺失。
- **云同步警告** — 当数据文件夹位于 OneDrive、Dropbox 或 Google Drive 时发出警告
- **驱动器检查**：对可移动驱动器和云同步文件夹发出警告；拒绝将数据库存放在网络驱动器上。
- **自动更新** — 内置更新器，也可禁用以完全离线运行

---

## 快捷键

| 快捷键       | 操作                 |
| ------------ | -------------------- |
| `` Ctrl+` `` | 显示 / 隐藏 Beetroot |
| `Enter`      | 粘贴选中项           |
| `Ctrl+1..9`  | 快速粘贴             |
| `Space`      | 预览                 |
| `Alt+T`      | AI 转换              |
| `Alt+P`      | 窗口置顶             |
| `Alt+F`      | 光标跟随模式         |
| `Shift+F10`  | 右键菜单             |
| `Ctrl+C`     | 复制到剪贴板         |
| `Alt+Del`    | 删除                 |

所有快捷键可在**设置 → 快捷键**中自定义。支持 AZERTY、QWERTZ 和 AltGr 键盘布局。

---

## 常见问题

**Beetroot 是免费的吗？**
是的。个人和商业使用均免费 — 无广告、无试用、无功能限制、无遥测。

**Beetroot 会发送我的剪贴板数据吗？**
历史记录保存在本地。仅在您请求转换时，云 AI 才会收到选中的内容和提示词。本地 AI 使用回环服务器，该服务器自身的日志和网络行为取决于其配置。更新和密钥测试也会发出请求。详见 [PRIVACY.md](PRIVACY.md)。

**Beetroot 能识别图片中的文字吗？**
可以。右键点击剪贴板历史中的图片 → AI → 识别文字。支持云端提供商（GPT-5.4、Claude、Gemini）和本地视觉模型（Ollama llava、LM Studio）。如果只需要简单 OCR 而不需要 AI，可以使用内置 OCR 功能（Windows 原生引擎，完全离线）。

**AI 视觉可以离线使用吗？**
可以，需要在本地服务器中运行已下载的模型。Beetroot 通过回环连接访问服务器；请同时检查服务器自身的离线设置。

**我的 API 密钥存储在哪里？**
密钥保存在 Windows 凭据管理器（Windows Credential Manager）中，与应用设置分开存储。当您执行 AI 操作或验证已保存的密钥时，密钥会发送给所选的 AI 服务提供商。旧版密钥迁移详情请参阅 [PRIVACY.md](PRIVACY.md)。

**我的数据存储在哪里？**
默认位于 `%APPDATA%\com.beetroot.desktop\`，当前文件夹可在设置 > 数据中查看。复制整个文件夹备份历史前，请先从托盘退出 Beetroot。设置与 API 密钥单独存储。请参阅[备份步骤](PRIVACY.md#exporting-clipboard-history)。

**自动更新可用吗？**
是的，v1.0.6 起可用。v1.0.5 及更早版本的用户需要[手动下载](https://github.com/mnardit/beetroot-releases/releases/latest)一次 — 之后自动更新正常工作。可在设置 → 通用中禁用自动更新。

---

## 故障排除

**自动更新不工作（v1.0.5 及更早版本）**
由于一次性签名密钥更换，需要[手动下载最新版本](https://github.com/mnardit/beetroot-releases/releases/latest)。之后的更新将自动进行。

**OCR 不工作或质量差**
OCR 使用 Windows 原生引擎。请确保安装了对应语言包：设置 → 时间和语言 → 语言 → 添加语言 → 勾选"语音"或"基本输入"。

**Beetroot 无法打开或快捷键无响应**

- 检查是否有其他应用占用了相同快捷键（如 `Ctrl+``）
- 确认 Beetroot 与目标应用位于同一 Windows 会话；普通进程无法向以管理员权限运行的应用发送输入。
- 在设置 → 快捷键中重新映射

**SmartScreen 或杀毒软件警告**
对于尚未建立发布者信誉的安装程序，Windows 可能显示 SmartScreen。请从[官方发布页面](https://github.com/mnardit/beetroot-releases/releases/latest)下载，并在运行前确认文件来源。Tauri 更新签名与 Windows Authenticode 是不同的机制。

---

## 反馈与错误报告

发现 bug 或有功能建议？[创建 issue](https://github.com/mnardit/beetroot-releases/issues)。

请包含：

- Beetroot 版本（设置 → 关于）
- Windows 版本（`winver`）
- 复现步骤
- 截图或错误信息（如有）

---

## 开发与贡献

[CONTRIBUTING.md](CONTRIBUTING.md) 介绍环境准备、测试及第一个 PR。本机应用开发需要 Windows，前端检查也可在 Linux 和 macOS 上运行。本地构建不需要签名密钥。可通过[架构文档](docs/architecture.md) 了解代码结构。

欢迎提交问题、翻译及范围明确的修复。较大的功能请先讨论。安全漏洞请通过 [SECURITY.md](SECURITY.md) 中的私密渠道报告，不要提交公开 issue。

---

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。遵循许可条款即可用于个人或商业用途、修改及再分发。作者署名见 [NOTICE](NOTICE)。第三方组件保留其[各自的许可证](THIRD_PARTY_NOTICES.md)。

[Privacy Policy](PRIVACY.md) · [Security Policy](SECURITY.md) · [Terms of Service](TERMS.md)

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
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>下载 Beetroot</strong></a> · 喜欢的话，点个 ⭐ 帮助更多人发现它。
</p>

<p align="center">
  由 <a href="https://max.nardit.com">Max Nardit</a> 开发
</p>
