import type { TranslationDictionary } from "../i18n";

const vi: TranslationDictionary = {
  // General
  cancel: "H\u1ee7y",
  save: "L\u01b0u",
  delete: "X\u00f3a",
  close: "\u0110\u00f3ng",
  paste: "D\u00e1n",
  create: "T\u1ea1o",
  rename: "\u0110\u1ed5i t\u00ean",
  export: "Xu\u1ea5t",
  import: "Nh\u1eadp",
  edit: "Ch\u1ec9nh s\u1eeda",
  deleted: "\u0110\u00e3 x\u00f3a",
  undo: "Ho\u00e0n t\u00e1c",

  // Search
  "search.placeholder": "T\u00ecm ki\u1ebfm l\u1ecbch s\u1eed clipboard...",
  "search.regexPlaceholder": "M\u1eabu regex...",
  "search.modeSwitch": "Chuy\u1ec3n sang t\u00ecm ki\u1ebfm {mode}",
  "search.modeLabel": "Ch\u1ebf \u0111\u1ed9 t\u00ecm: {mode}",
  "search.resultCount": "T\u00ecm th\u1ea5y {count}",
  "search.clear": "X\u00f3a t\u00ecm ki\u1ebfm",
  "search.regexTooltip": "B\u1eadt/t\u1eaft t\u00ecm ki\u1ebfm regex",
  "search.regexError": "M\u1eabu kh\u00f4ng h\u1ee3p l\u1ec7: {detail}",

  // Filter
  "filter.all": "T\u1ea5t c\u1ea3",
  "filter.pinned": "\u0110\u00e1nh d\u1ea5u sao",
  "filter.text": "V\u0103n b\u1ea3n",
  "filter.images": "H\u00ecnh \u1ea3nh",
  "filter.notes": "Ghi ch\u00fa",
  "filter.apps": "\u1ee8ng d\u1ee5ng",
  "filter.searchApps": "T\u00ecm \u1ee9ng d\u1ee5ng\u2026",
  "filter.sortLastUsed": "D\u00f9ng g\u1ea7n nh\u1ea5t",
  "filter.sortMostUsed": "D\u00f9ng nhi\u1ec1u nh\u1ea5t",
  "filter.sortAlpha": "Theo b\u1ea3ng ch\u1eef c\u00e1i",
  "filter.noAppsFound": "Kh\u00f4ng t\u00ecm th\u1ea5y \u1ee9ng d\u1ee5ng",
  "filter.aiTransform": "AI Transform",

  // Empty state
  "empty.noMatch": "Kh\u00f4ng t\u00ecm th\u1ea5y m\u1ee5c ph\u00f9 h\u1ee3p",
  "empty.noMatchHint": "Th\u1eed m\u1ed9t t\u1eeb kh\u00f3a kh\u00e1c",
  "empty.noItems": "L\u1ecbch s\u1eed clipboard tr\u1ed1ng",
  "empty.noItemsHint": "Sao ch\u00e9p g\u00ec \u0111\u00f3 \u0111\u1ec3 b\u1eaft \u0111\u1ea7u",

  // Footer
  "footer.selected":
    "\u0110\u00e3 ch\u1ecdn {count} \u00b7 Ctrl+Click \u0111\u1ec3 ch\u1ecdn/b\u1ecf ch\u1ecdn",
  "footer.pasteDropdown": "D\u00e1n \u25be",
  "footer.hint":
    "Enter d\u00e1n \u00b7 Space xem tr\u01b0\u1edbc \u00b7 Alt+T bi\u1ebfn \u0111\u1ed5i \u00b7 Esc \u0111\u00f3ng",
  "footer.hintPinned":
    "Enter sao ch\u00e9p \u00b7 Space xem tr\u01b0\u1edbc \u00b7 Alt+T bi\u1ebfn \u0111\u1ed5i \u00b7 Esc \u0111\u00f3ng",
  "footer.hintNoFocus": "↑↓ điều hướng · Enter dán · Esc đóng · Nhấp để tìm",
  "footer.hintPreview": "Space đóng · Enter dán · Ctrl+C sao chép · ↑↓ điều hướng",
  "footer.shortcuts": "Ph\u00edm t\u1eaft (?)",
  "footer.resumeMonitor": "Ti\u1ebfp t\u1ee5c theo d\u00f5i",
  "footer.pauseMonitor": "T\u1ea1m d\u1eebng theo d\u00f5i",
  "footer.pinWindow": "Ghim c\u1eeda s\u1ed5",
  "footer.unpinWindow": "B\u1ecf ghim",
  "footer.settings": "C\u00e0i \u0111\u1eb7t",
  "footer.followCursorOn": "Theo con tr\u1ecf",
  "footer.followCursorOff": "Ng\u1eebng theo con tr\u1ecf",
  "footer.monitorPaused": "\u0110\u00e3 t\u1ea1m d\u1eebng theo d\u00f5i clipboard",

  // Separator menu
  "sep.newline": "Xu\u1ed1ng d\u00f2ng",
  "sep.comma": "D\u1ea5u ph\u1ea9y",
  "sep.space": "Kho\u1ea3ng tr\u1eafng",
  "sep.tab": "Tab",
  "sep.none": "Kh\u00f4ng",

  // Toast
  "toast.pasted": "\u0110\u00e3 d\u00e1n",
  "toast.copied": "\u0110\u00e3 sao ch\u00e9p v\u00e0o clipboard",
  "toast.pasteFailed": "D\u00e1n th\u1ea5t b\u1ea1i",
  "toast.explorerFailed": "Kh\u00f4ng th\u1ec3 m\u1edf Explorer",
  "toast.deletedItems": "\u0110\u00e3 x\u00f3a {count} m\u1ee5c",
  "toast.deletedItemsSkipped":
    "\u0110\u00e3 x\u00f3a {count} m\u1ee5c ({skipped} h\u00ecnh \u1ea3nh kh\u00f4ng th\u1ec3 ho\u00e0n t\u00e1c)",
  "toast.pastedItems": "\u0110\u00e3 d\u00e1n {count} m\u1ee5c",
  "toast.pastedItemsSkipped": "Đã dán {count} mục (bỏ qua {skipped} hình ảnh)",
  "toast.importedItems": "\u0110\u00e3 nh\u1eadp {count} m\u1ee5c",
  "toast.ocrSuccess":
    "\u0110\u00e3 tr\u00edch xu\u1ea5t v\u0103n b\u1ea3n v\u00e0 th\u00eam v\u00e0o l\u1ecbch s\u1eed",
  "toast.ocrEmpty": "Kh\u00f4ng t\u00ecm th\u1ea5y v\u0103n b\u1ea3n trong h\u00ecnh \u1ea3nh",
  "toast.ocrFailed": "OCR th\u1ea5t b\u1ea1i",
  "toast.aiProcessing": "Đang xử lý {name}...",
  "toast.aiCompleted": "✓ {name}",
  "toast.aiFailed": "{name} — {error}",
  "toast.pinned": "\u0110\u00e3 g\u1eafn sao",
  "toast.unpinned": "\u0110\u00e3 b\u1ecf sao",
  "toast.ocrStarted": "\u0110ang tr\u00edch xu\u1ea5t v\u0103n b\u1ea3n...",
  "toast.imageFormatNotSupported": "Only PNG images are supported from File Explorer",
  "toast.settingsSaveFailed": "Couldn't save settings — your browser storage may be full",

  // Settings
  "settings.title": "C\u00e0i \u0111\u1eb7t",
  "settings.theme": "Giao di\u1ec7n",
  "settings.system": "H\u1ec7 th\u1ed1ng",
  "settings.historyLimit": "Gi\u1edbi h\u1ea1n l\u1ecbch s\u1eed",
  "settings.unlimited": "Kh\u00f4ng gi\u1edbi h\u1ea1n",
  "settings.hotkey": "Ph\u00edm t\u1eaft",
  "settings.hotkeyRecording": "Nh\u1ea5n t\u1ed5 h\u1ee3p ph\u00edm...",
  "settings.hotkeyReset": "\u0110\u1eb7t l\u1ea1i",
  "settings.plainTextHotkey": "Ph\u00edm t\u1eaft d\u00e1n v\u0103n b\u1ea3n thu\u1ea7n",
  "settings.plainTextHotkeyHint":
    "D\u00e1n clipboard d\u01b0\u1edbi d\u1ea1ng v\u0103n b\u1ea3n thu\u1ea7n, lo\u1ea1i b\u1ecf \u0111\u1ecbnh d\u1ea1ng",
  "settings.plainTextHotkeyNone": "Kh\u00f4ng (nh\u1ea5p \u0111\u1ec3 \u0111\u1eb7t)",
  "settings.plainTextHotkeyConflict":
    "Ph\u00edm t\u1eaft d\u00e1n thu\u1ea7n ph\u1ea3i kh\u00e1c ph\u00edm t\u1eaft ch\u00ednh",
  "settings.shortcutConflict":
    "Ph\u00edm t\u1eaft ph\u1ea3i duy nh\u1ea5t \u2014 hai thao t\u00e1c kh\u00f4ng th\u1ec3 d\u00f9ng chung m\u1ed9t t\u1ed5 h\u1ee3p ph\u00edm",
  "settings.autostart": "Kh\u1edfi \u0111\u1ed9ng c\u00f9ng Windows",
  "settings.autostart.disabledByUser":
    "Tự động khởi động đã bị tắt trong Trình quản lý tác vụ của Windows. Bật lại ở đó: Trình quản lý tác vụ → Ứng dụng khởi động → Beetroot → Bật.",
  "settings.autostart.disabledByPolicy":
    "Tự động khởi động bị tắt bởi chính sách của tổ chức bạn hoặc không được hỗ trợ trên thiết bị này.",
  "settings.autoUpdate": "T\u1ef1 \u0111\u1ed9ng c\u1eadp nh\u1eadt",
  "settings.autoUpdateHint":
    "Khi t\u1eaft, \u1ee9ng d\u1ee5ng kh\u00f4ng t\u1ef1 \u0111\u1ed9ng k\u1ebft n\u1ed1i m\u1ea1ng (tr\u1eeb khi b\u1ea1n d\u00f9ng bi\u1ebfn \u0111\u1ed5i AI)",
  "settings.rememberFilter": "Ghi nh\u1edb b\u1ed9 l\u1ecdc \u0111\u00e3 ch\u1ecdn",
  "settings.rememberFilterHint": "Giữ bộ lọc cuối cùng (Yêu thích, Văn bản, v.v.) khi đóng cửa sổ",
  "settings.copiedOverlay": "Thông báo sao chép",
  "settings.copiedOverlayHint": "Hiển thị xác nhận ngắn khi sao chép",
  "settings.overlayPosition": "Vị trí",
  "settings.overlayPosition.cursor": "Gần con trỏ",
  "settings.overlayPosition.topCenter": "Trên cùng giữa",
  "settings.overlayPosition.bottomCenter": "Dưới cùng giữa",
  "settings.overlayDuration": "Thời lượng",
  "settings.overlayDuration.quick": "Nhanh",
  "settings.overlayDuration.comfortable": "Thoải mái",
  "settings.overlayDuration.visible": "Rõ ràng",
  "settings.overlayAnimation": "Hoạt ảnh",
  "settings.overlayAnimation.fadeDown": "Mờ dần xuống",
  "settings.overlayAnimation.fadeUp": "Mờ dần lên",
  "settings.overlayAnimation.fade": "Mờ dần",
  "settings.overlayAnimation.scaleDown": "Thu nhỏ",
  "settings.overlayAnimation.pop": "Pop",
  "settings.overlayAnimation.blur": "Blur",
  "overlay.copied": "Đã sao chép",
  "overlay.imageCopied": "Đã sao chép hình ảnh",
  "settings.on": "Bật",
  "settings.off": "T\u1eaft",
  "settings.autoDelete": "T\u1ef1 x\u00f3a sau",
  "settings.never": "Kh\u00f4ng bao gi\u1edd",
  "settings.1day": "1 ng\u00e0y",
  "settings.7days": "7 ng\u00e0y",
  "settings.30days": "30 ng\u00e0y",
  "settings.dataLocation": "V\u1ecb tr\u00ed d\u1eef li\u1ec7u",
  "settings.dataLocationHint":
    "Di chuy\u1ec3n sao ch\u00e9p c\u01a1 s\u1edf d\u1eef li\u1ec7u v\u00e0 h\u00ecnh \u1ea3nh sang th\u01b0 m\u1ee5c m\u1edbi. Chuy\u1ec3n tr\u1ecf \u0111\u1ebfn th\u01b0 m\u1ee5c kh\u00e1c m\u00e0 kh\u00f4ng sao ch\u00e9p (th\u01b0 m\u1ee5c tr\u1ed1ng = b\u1eaft \u0111\u1ea7u m\u1edbi).",
  "settings.moving": "\u0110ang di chuy\u1ec3n...",
  "settings.move": "Di chuy\u1ec3n",
  "settings.switch": "Chuy\u1ec3n",
  "settings.switching": "\u0110ang chuy\u1ec3n...",
  "settings.data": "D\u1eef li\u1ec7u",
  "settings.saving": "\u0110ang l\u01b0u...",
  "settings.language": "Ng\u00f4n ng\u1eef",
  "settings.pasteMode": "Thao t\u00e1c khi nh\u1ea5p m\u1ee5c",
  "settings.pasteAuto": "T\u1ef1 \u0111\u1ed9ng d\u00e1n",
  "settings.pasteCopy": "Ch\u1ec9 sao ch\u00e9p",
  "settings.accentColor": "M\u00e0u nh\u1ea5n",
  "settings.resetAccent": "\u0110\u1eb7t l\u1ea1i",
  "settings.fontSize": "C\u1ee1 ch\u1eef",
  "settings.fontCompact": "G\u1ecdn",
  "settings.fontSmall": "Nh\u1ecf",
  "settings.fontDefault": "M\u1eb7c \u0111\u1ecbnh",
  "settings.fontLarge": "L\u1edbn",
  "settings.fontLarger": "L\u1edbn h\u01a1n",
  "settings.fontLargest": "L\u1edbn nh\u1ea5t",
  "settings.uiFont": "Ph\u00f4ng ch\u1eef giao di\u1ec7n",
  "settings.uiFontHint":
    "Ph\u00f4ng ch\u1eef cho giao di\u1ec7n v\u00e0 v\u0103n b\u1ea3n thu\u1ea7n",
  "settings.codeFont": "Ph\u00f4ng ch\u1eef m\u00e3",
  "settings.codeFontHint":
    "Ph\u00f4ng ch\u1eef cho m\u00e3, regex, JSON v\u00e0 n\u1ed9i dung monospace",
  "settings.pasteFormat": "\u0110\u1ecbnh d\u1ea1ng d\u00e1n",
  "settings.pasteFormatPlain": "V\u0103n b\u1ea3n thu\u1ea7n",
  "settings.pasteFormatOriginal": "G\u1ed1c",
  "settings.pasteModeHint":
    "T\u1ef1 \u0111\u1ed9ng d\u00e1n g\u00f5 tr\u1ef1c ti\u1ebfp v\u00e0o \u1ee9ng d\u1ee5ng \u0111ang ho\u1ea1t \u0111\u1ed9ng",
  "settings.pasteFormatHint":
    "V\u0103n b\u1ea3n thu\u1ea7n lo\u1ea1i b\u1ecf \u0111\u1ecbnh d\u1ea1ng. G\u1ed1c gi\u1eef nguy\u00ean rich text",
  "settings.autoDeleteHint":
    "T\u1ef1 \u0111\u1ed9ng x\u00f3a c\u00e1c m\u1ee5c ch\u01b0a g\u1eafn sao c\u0169 h\u01a1n th\u1eddi gian n\u00e0y",
  "settings.historyLimitHint":
    "C\u00e1c m\u1ee5c ch\u01b0a g\u1eafn sao c\u0169 nh\u1ea5t s\u1ebd b\u1ecb x\u00f3a khi \u0111\u1ea1t gi\u1edbi h\u1ea1n",
  "settings.windowEffectHint":
    "Mica y\u00eau c\u1ea7u Windows 11. Acrylic ho\u1ea1t \u0111\u1ed9ng tr\u00ean Windows 10+.",
  "settings.windowPosition": "Vị trí cửa sổ",
  "settings.windowPositionHint": "Vị trí cửa sổ xuất hiện trên màn hình khi mở bằng phím tắt",
  "settings.positionCenter": "Giữa",
  "settings.positionTopLeft": "Trên trái",
  "settings.positionTopRight": "Trên phải",
  "settings.positionBottomLeft": "Dưới trái",
  "settings.positionBottomRight": "Dưới phải",

  // Settings tabs
  "settings.tabGeneral": "Chung",
  "settings.tabAppearance": "Giao di\u1ec7n",
  "settings.tabAI": "AI",
  "settings.tabData": "D\u1eef li\u1ec7u",
  "settings.tabShortcuts": "Ph\u00edm t\u1eaft",
  "settings.tabAbout": "Gi\u1edbi thi\u1ec7u",
  "settings.tabLanguage": "Ng\u00f4n ng\u1eef",

  // About
  "settings.about": "Gi\u1edbi thi\u1ec7u",
  "settings.aboutVersion": "Phi\u00ean b\u1ea3n {version}",
  "settings.aboutGithub": "GitHub",
  "settings.aboutReportIssue": "B\u00e1o l\u1ed7i",
  "settings.aboutPrivacy": "Ch\u00ednh s\u00e1ch b\u1ea3o m\u1eadt",
  "settings.aboutTerms": "\u0110i\u1ec1u kho\u1ea3n d\u1ecbch v\u1ee5",
  "settings.aboutCredits": "X\u00e2y d\u1ef1ng v\u1edbi Tauri + React",
  "settings.checkForUpdates": "Ki\u1ec3m tra c\u1eadp nh\u1eadt",

  // AI
  "settings.ai": "Bi\u1ebfn \u0111\u1ed5i AI",
  "settings.aiKey": "Kh\u00f3a API OpenAI",
  "settings.aiKeyPlaceholder": "sk-...",
  "settings.aiModel": "M\u00f4 h\u00ecnh",
  "settings.aiPrompts": "Prompt t\u00f9y ch\u1ec9nh",
  "settings.aiPromptName": "T\u00ean",
  "settings.aiPromptText": "H\u01b0\u1edbng d\u1eabn prompt",
  "settings.aiAddPrompt": "+ Th\u00eam prompt",
  "settings.aiNoPrompts": "Ch\u01b0a c\u00f3 prompt t\u00f9y ch\u1ec9nh",
  "settings.aiQuickAccess": "Menu nhanh (t\u1ed1i \u0111a 5)",
  "settings.aiQuickAccessHint": "Hi\u1ec3n th\u1ecb trong menu chu\u1ed9t ph\u1ea3i",
  "settings.aiTestKey": "Ki\u1ec3m tra",
  "settings.aiKeyValid": "Kh\u00f3a API h\u1ee3p l\u1ec7",
  "settings.aiKeyInvalid": "Kh\u00f3a API kh\u00f4ng h\u1ee3p l\u1ec7",
  "settings.aiKeyTesting": "\u0110ang ki\u1ec3m tra...",
  "settings.aiModelNanoDesc":
    "Nhanh v\u00e0 r\u1ebb nh\u1ea5t \u2014 bi\u1ebfn \u0111\u1ed5i \u0111\u01a1n gi\u1ea3n (vi\u1ebft hoa, d\u1ecdn s\u1ea1ch, t\u00f3m t\u1eaft)",
  "settings.aiModelMiniDesc":
    "Th\u00f4ng minh h\u01a1n \u2014 t\u00e1c v\u1ee5 ph\u1ee9c t\u1ea1p (vi\u1ebft l\u1ea1i, d\u1ecbch, sinh m\u00e3)",
  "settings.aiDescription":
    "Y\u00eau c\u1ea7u kh\u00f3a API OpenAI c\u1ee7a b\u1ea1n (BYOK). L\u1ea5y t\u1ea1i platform.openai.com.",
  "settings.aiQuickHeader": "Nhanh",

  // Loading
  loading: "\u0110ang t\u1ea3i...",

  // Context menu
  "ctx.paste": "Dán",
  "ctx.copy": "Sao ch\u00e9p",
  "ctx.pin": "G\u1eafn sao",
  "ctx.unpin": "B\u1ecf sao",
  "ctx.preview": "Xem tr\u01b0\u1edbc",
  "ctx.transform": "Bi\u1ebfn \u0111\u1ed5i",
  "ctx.showInExplorer": "Hi\u1ec3n th\u1ecb trong Explorer",
  "ctx.ocr": "Tr\u00edch xu\u1ea5t v\u0103n b\u1ea3n (OCR)",

  // Transform
  "transform.title": "Bi\u1ebfn \u0111\u1ed5i v\u0103n b\u1ea3n",
  "transform.upper": "UPPERCASE",
  "transform.lower": "lowercase",
  "transform.titleCase": "Title Case",
  "transform.trim": "Chu\u1ea9n h\u00f3a kho\u1ea3ng tr\u1eafng",
  "transform.nospaces": "X\u00f3a kho\u1ea3ng tr\u1eafng",
  "transform.singleline": "G\u1ed9p th\u00e0nh m\u1ed9t d\u00f2ng",
  "transform.sortlines": "S\u1eafp x\u1ebfp d\u00f2ng",
  "transform.dedup": "X\u00f3a tr\u00f9ng l\u1eb7p",
  "transform.searchPlaceholder": "T\u00ecm ph\u00e9p bi\u1ebfn \u0111\u1ed5i...",
  "transform.noResults": "Kh\u00f4ng c\u00f3 k\u1ebft qu\u1ea3",

  // AI Transforms
  "transform.aiSection": "Bi\u1ebfn \u0111\u1ed5i AI",
  "transform.aiLoading": "\u0110ang x\u1eed l\u00fd...",
  "transform.aiError": "L\u1ed7i AI: {error}",
  "transform.noApiKey": "\u0110\u1eb7t kh\u00f3a API OpenAI trong C\u00e0i \u0111\u1eb7t",

  // AI Builtin prompt names
  "ai.grammar": "S\u1eeda ng\u1eef ph\u00e1p",
  "ai.grammarDesc":
    "S\u1eeda l\u1ed7i ng\u1eef ph\u00e1p m\u00e0 kh\u00f4ng thay \u0111\u1ed5i ngh\u0129a",
  "ai.translate": "D\u1ecbch sang ti\u1ebfng Anh",
  "ai.translateDesc":
    "T\u1ef1 \u0111\u1ed9ng nh\u1eadn di\u1ec7n ng\u00f4n ng\u1eef v\u00e0 d\u1ecbch sang ti\u1ebfng Anh",
  "ai.summarize": "T\u00f3m t\u1eaft",
  "ai.summarizeDesc": "R\u00fat g\u1ecdn th\u00e0nh 2-3 c\u00e2u ch\u00ednh",
  "ai.professional": "Chuy\u00ean nghi\u1ec7p h\u00f3a",
  "ai.professionalDesc":
    "Vi\u1ebft l\u1ea1i v\u1edbi gi\u1ecdng \u0111i\u1ec7u chuy\u00ean nghi\u1ec7p, r\u00f5 r\u00e0ng",
  "ai.codeFormat": "\u0110\u1ecbnh d\u1ea1ng m\u00e3",
  "ai.codeFormatDesc":
    "\u00c1p d\u1ee5ng th\u1ee5t l\u1ec1 v\u00e0 \u0111\u1ecbnh d\u1ea1ng \u0111\u00fang chu\u1ea9n",
  "ai.bulletPoints": "Danh s\u00e1ch g\u1ea1ch \u0111\u1ea7u d\u00f2ng",
  "ai.bulletPointsDesc":
    "Chuy\u1ec3n v\u0103n b\u1ea3n th\u00e0nh danh s\u00e1ch g\u1ea1ch \u0111\u1ea7u d\u00f2ng",
  "ai.simplify": "\u0110\u01a1n gi\u1ea3n h\u00f3a",
  "ai.simplifyDesc":
    "Vi\u1ebft l\u1ea1i b\u1eb1ng ng\u00f4n ng\u1eef \u0111\u01a1n gi\u1ea3n, d\u1ec5 hi\u1ec3u",
  "ai.makeShorter": "R\u00fat ng\u1eafn",
  "ai.makeShorterDesc":
    "R\u00fat g\u1ecdn c\u00f2n kho\u1ea3ng m\u1ed9t n\u1eeda \u0111\u1ed9 d\u00e0i",
  "ai.explain": "Gi\u1ea3i th\u00edch",
  "ai.explainDesc": "Gi\u1ea3i th\u00edch \u0111\u01a1n gi\u1ea3n cho m\u1ecdi ng\u01b0\u1eddi",
  "ai.extractData": "Tr\u00edch xu\u1ea5t d\u1eef li\u1ec7u",
  "ai.extractDataDesc": "Tr\u00edch xu\u1ea5t t\u00ean, ng\u00e0y, s\u1ed1, URL",
  "ai.readText": "\u0110\u1ecdc v\u0103n b\u1ea3n",
  "ai.readTextDesc": "Tr\u00edch xu\u1ea5t v\u0103n b\u1ea3n t\u1eeb \u1ea3nh",
  "ai.describe": "M\u00f4 t\u1ea3 \u1ea3nh",
  "ai.describeDesc": "M\u00f4 t\u1ea3 n\u1ed9i dung \u1ea3nh",
  "ai.extractImageData": "Tr\u00edch xu\u1ea5t d\u1eef li\u1ec7u",
  "ai.extractImageDataDesc":
    "Tr\u00edch xu\u1ea5t b\u1ea3ng v\u00e0 danh s\u00e1ch t\u1eeb \u1ea3nh",
  "ai.summarizeImage": "T\u00f3m t\u1eaft \u1ea3nh",
  "ai.summarizeImageDesc": "T\u00f3m t\u1eaft n\u1ed9i dung \u1ea3nh",
  "ai.translateImage": "D\u1ecbch v\u0103n b\u1ea3n \u1ea3nh",
  "ai.translateImageDesc":
    "Tr\u00edch xu\u1ea5t v\u00e0 d\u1ecbch v\u0103n b\u1ea3n t\u1eeb \u1ea3nh",

  // Preview
  "preview.title": "Xem tr\u01b0\u1edbc",
  "preview.chars": "k\u00fd t\u1ef1",
  "preview.char": "k\u00fd t\u1ef1",
  "preview.words": "t\u1eeb",
  "preview.word": "t\u1eeb",
  "preview.lines": "d\u00f2ng",
  "preview.line": "d\u00f2ng",
  "preview.copy": "Sao ch\u00e9p v\u00e0o clipboard",
  "preview.failed": "Kh\u00f4ng th\u1ec3 t\u1ea3i h\u00ecnh \u1ea3nh",
  "preview.loading": "\u0110ang t\u1ea3i...",
  "preview.sourceApp": "Ngu\u1ed3n",
  "preview.sourceTitle": "C\u1eeda s\u1ed5",
  "preview.fit": "V\u1eeba",

  // Shortcuts
  "shortcuts.title": "Ph\u00edm t\u1eaft b\u00e0n ph\u00edm",
  "shortcuts.paste": "D\u00e1n m\u1ee5c \u0111\u00e3 ch\u1ecdn",
  "shortcuts.copy": "Sao chép mục đã chọn",
  "shortcuts.preview": "Xem tr\u01b0\u1edbc m\u1ee5c \u0111\u00e3 ch\u1ecdn",
  "shortcuts.transform": "Bi\u1ebfn \u0111\u1ed5i v\u0103n b\u1ea3n",
  "shortcuts.pin": "G\u1eafn sao / b\u1ecf sao",
  "shortcuts.deleteItem": "X\u00f3a m\u1ee5c \u0111\u00e3 ch\u1ecdn",
  "shortcuts.quickPaste": "D\u00e1n nhanh theo v\u1ecb tr\u00ed",
  "shortcuts.multiSelect": "Ch\u1ecdn nhi\u1ec1u m\u1ee5c",
  "shortcuts.contextMenu": "Menu ng\u1eef c\u1ea3nh",
  "shortcuts.navigate": "Di chuy\u1ec3n trong danh s\u00e1ch",
  "shortcuts.closeWindow": "\u0110\u00f3ng c\u1eeda s\u1ed5",
  "shortcuts.pinWindow": "Ghim / b\u1ecf ghim c\u1eeda s\u1ed5",
  "shortcuts.followCursor": "B\u1eadt/t\u1eaft theo con tr\u1ecf",

  // Onboarding
  "onboarding.step1.title": "Ch\u00e0o m\u1eebng \u0111\u1ebfn Beetroot",
  "onboarding.step1.desc":
    "Tr\u00ecnh qu\u1ea3n l\u00fd clipboard th\u00f4ng minh. Beetroot ghi l\u1ea1i m\u1ecdi th\u1ee9 b\u1ea1n sao ch\u00e9p v\u00e0 s\u1eafp x\u1ebfp ch\u00fang v\u1edbi t\u00ecm ki\u1ebfm, b\u1ed9 l\u1ecdc v\u00e0 bi\u1ebfn \u0111\u1ed5i AI.",
  "onboarding.step2.title": "Nh\u1ea5n {hotkey} \u0111\u1ec3 m\u1edf",
  "onboarding.step2.desc":
    "Beetroot n\u1eb1m trong khay h\u1ec7 th\u1ed1ng v\u00e0 ghi l\u1ea1i m\u1ecdi th\u1ee9 b\u1ea1n sao ch\u00e9p. D\u00f9ng ph\u00edm t\u1eaft n\u00e0y \u0111\u1ec3 hi\u1ec7n ho\u1eb7c \u1ea9n c\u1eeda s\u1ed5 ngay l\u1eadp t\u1ee9c.",
  "onboarding.step3.title": "T\u00ecm ki\u1ebfm th\u00f4ng minh",
  "onboarding.step3.desc":
    "G\u00f5 \u0111\u1ec3 t\u00ecm trong l\u1ecbch s\u1eed clipboard. Nh\u1ea5n Space \u0111\u1ec3 xem tr\u01b0\u1edbc. B\u1eadt .* \u0111\u1ec3 t\u00ecm ki\u1ebfm regex.",
  "onboarding.step4.title": "Bi\u1ebfn \u0111\u1ed5i AI",
  "onboarding.step4.desc":
    "Ch\u1ecdn b\u1ea5t k\u1ef3 m\u1ee5c v\u0103n b\u1ea3n n\u00e0o v\u00e0 nh\u1ea5n Alt+T \u0111\u1ec3 bi\u1ebfn \u0111\u1ed5i b\u1eb1ng AI \u2014 t\u00f3m t\u1eaft, d\u1ecbch, s\u1eeda ng\u1eef ph\u00e1p v\u00e0 nhi\u1ec1u h\u01a1n.",
  "onboarding.step5.title": "B\u1ea1n \u0111\u00e3 s\u1eb5n s\u00e0ng!",
  "onboarding.step5.desc":
    "Nh\u1ea5p v\u00e0o m\u1ee5c b\u1ea5t k\u1ef3 \u0111\u1ec3 d\u00e1n. Nh\u1ea5p chu\u1ed9t ph\u1ea3i \u0111\u1ec3 xem c\u00e1c t\u00f9y ch\u1ecdn nh\u01b0 g\u1eafn sao, xem tr\u01b0\u1edbc, bi\u1ebfn \u0111\u1ed5i v\u00e0 OCR. M\u1edf C\u00e0i \u0111\u1eb7t \u0111\u1ec3 t\u00f9y ch\u1ec9nh giao di\u1ec7n, ph\u00edm t\u1eaft v\u00e0 nhi\u1ec1u h\u01a1n.",
  "onboarding.skip": "B\u1ecf qua",
  "onboarding.next": "Ti\u1ebfp",
  "onboarding.getStarted": "B\u1eaft \u0111\u1ea7u",

  // Clipboard item
  "item.type.url": "URL",
  "item.type.email": "Email",
  "item.type.code": "M\u00e3",
  "item.type.json": "JSON",
  "item.type.color": "M\u00e0u",
  "item.type.text": "Văn bản",
  "item.type.image": "Hình ảnh",
  "item.pin": "G\u1eafn sao",
  "item.unpin": "B\u1ecf sao",
  "item.deleteHint": "X\u00f3a (Alt+Del)",
  "item.hasNote": "Có ghi chú",
  "item.image": "H\u00ecnh \u1ea3nh",
  "item.imageError": "L\u1ed7i",
  "item.imageLoading": "\u0110ang t\u1ea3i...",
  "item.imageAlt": "H\u00ecnh \u1ea3nh clipboard",
  "preview.imageAlt": "Xem tr\u01b0\u1edbc h\u00ecnh \u1ea3nh clipboard",

  // Date groups
  "group.today": "H\u00f4m nay",
  "group.yesterday": "H\u00f4m qua",
  "group.thisWeek": "Tu\u1ea7n n\u00e0y",
  "group.older": "C\u0169 h\u01a1n",

  // Aria labels
  "aria.clipboardHistory": "L\u1ecbch s\u1eed clipboard",
  "aria.contextMenu": "Menu ng\u1eef c\u1ea3nh",
  "aria.closeSettings": "\u0110\u00f3ng c\u00e0i \u0111\u1eb7t",
  "aria.onboarding": "H\u01b0\u1edbng d\u1eabn ch\u00e0o m\u1eebng",
  "aria.previewPanel": "B\u1ea3ng xem tr\u01b0\u1edbc n\u1ed9i dung",
  "aria.transformMenu": "Menu bi\u1ebfn \u0111\u1ed5i v\u0103n b\u1ea3n",
  "aria.languageGroup": "Ng\u00f4n ng\u1eef",
  "aria.themeGroup": "Giao di\u1ec7n",
  "aria.historyLimitGroup": "Gi\u1edbi h\u1ea1n l\u1ecbch s\u1eed",
  "aria.hotkeyGroup": "Ph\u00edm t\u1eaft",
  "aria.pasteModeGroup": "Thao t\u00e1c khi nh\u1ea5p m\u1ee5c",
  "aria.pasteFormatGroup": "\u0110\u1ecbnh d\u1ea1ng d\u00e1n",
  "aria.fontSizeGroup": "C\u1ee1 ch\u1eef",
  "aria.autoDeleteGroup": "T\u1ef1 x\u00f3a sau",
  "aria.listCount": "{count} m\u1ee5c",
  "aria.aiModelGroup": "M\u00f4 h\u00ecnh AI",
  "aria.windowPositionGroup": "Vị trí cửa sổ",

  // Error boundary
  "error.title": "\u0110\u00e3 x\u1ea3y ra l\u1ed7i",
  "error.retry": "Th\u1eed l\u1ea1i",
  "error.dbCorrupted":
    "C\u01a1 s\u1edf d\u1eef li\u1ec7u b\u1ecb h\u1ecfng. Kh\u1edfi \u0111\u1ed9ng l\u1ea1i Beetroot \u0111\u1ec3 t\u1ef1 ph\u1ee5c h\u1ed3i.",
  "error.dbBusy":
    "C\u01a1 s\u1edf d\u1eef li\u1ec7u \u0111ang b\u1eadn. Vui l\u00f2ng th\u1eed l\u1ea1i sau.",
  "error.dbGeneric": "L\u1ed7i c\u01a1 s\u1edf d\u1eef li\u1ec7u: {0}",
  "warning.unstableDrive":
    "Lo\u1ea1i \u1ed5 \u0111\u0129a n\u00e0y (USB/m\u1ea1ng) c\u00f3 th\u1ec3 g\u00e2y h\u1ecfng c\u01a1 s\u1edf d\u1eef li\u1ec7u. Khuy\u1ebfn ngh\u1ecb d\u00f9ng \u1ed5 \u0111\u0129a c\u1ee5c b\u1ed9.",
  "warning.cloudSync":
    "Ph\u00e1t hi\u1ec7n \u0111\u1ed3ng b\u1ed9 {service}. Th\u01b0 m\u1ee5c \u0111\u1ed3ng b\u1ed9 \u0111\u00e1m m\u00e2y c\u00f3 th\u1ec3 l\u00e0m h\u1ecfng c\u01a1 s\u1edf d\u1eef li\u1ec7u. H\u00e3y ch\u1ecdn th\u01b0 m\u1ee5c c\u1ee5c b\u1ed9.",
  "notification.dbRestored":
    "C\u01a1 s\u1edf d\u1eef li\u1ec7u \u0111\u00e3 \u0111\u01b0\u1ee3c kh\u00f4i ph\u1ee5c t\u1eeb b\u1ea3n sao l\u01b0u. M\u1ed9t s\u1ed1 m\u1ee5c g\u1ea7n \u0111\u00e2y c\u00f3 th\u1ec3 b\u1ecb thi\u1ebfu.",
  "notification.dbFreshCreated":
    "C\u01a1 s\u1edf d\u1eef li\u1ec7u b\u1ecb h\u1ecfng v\u00e0 kh\u00f4ng th\u1ec3 kh\u00f4i ph\u1ee5c. \u0110\u00e3 t\u1ea1o c\u01a1 s\u1edf d\u1eef li\u1ec7u m\u1edbi.",
  "notification.dbCorrupted":
    "Ph\u00e1t hi\u1ec7n c\u01a1 s\u1edf d\u1eef li\u1ec7u b\u1ecb h\u1ecfng. Vui l\u00f2ng kh\u1edfi \u0111\u1ed9ng l\u1ea1i Beetroot \u0111\u1ec3 t\u1ef1 ph\u1ee5c h\u1ed3i.",

  // Update
  "update.available": "C\u00f3 b\u1ea3n c\u1eadp nh\u1eadt: v{version}",
  "update.downloading": "\u0110ang t\u1ea3i b\u1ea3n c\u1eadp nh\u1eadt...",
  "update.ready":
    "B\u1ea3n c\u1eadp nh\u1eadt s\u1eb5n s\u00e0ng. Kh\u1edfi \u0111\u1ed9ng l\u1ea1i \u0111\u1ec3 \u00e1p d\u1ee5ng.",
  "update.restart": "Kh\u1edfi \u0111\u1ed9ng l\u1ea1i ngay",
  "update.later": "\u0110\u1ec3 sau",
  "update.error": "C\u1eadp nh\u1eadt th\u1ea5t b\u1ea1i: {error}",
  "update.checking": "\u0110ang ki\u1ec3m tra c\u1eadp nh\u1eadt...",
  "update.upToDate": "B\u1ea1n \u0111ang d\u00f9ng phi\u00ean b\u1ea3n m\u1edbi nh\u1ea5t",
  "update.download": "T\u1ea3i v\u00e0 c\u00e0i \u0111\u1eb7t",

  // Context menu notes
  "ctx.addNote": "Th\u00eam ghi ch\u00fa",
  "ctx.editNote": "S\u1eeda ghi ch\u00fa",

  // Preview notes
  "preview.note": "Ghi ch\u00fa",
  "preview.addNote": "Th\u00eam ghi ch\u00fa...",
  "preview.addNoteShort": "Thêm ghi chú",
  "preview.copyImage": "Sao chép hình ảnh",
  "preview.transform": "Chuyển đổi",
  "preview.ocr": "OCR",
  "preview.ai": "AI",
  "preview.wrap": "Xuống dòng",
  "preview.paste": "Dán",
  "preview.copyPlain": "Sao chép dạng văn bản",
  "preview.delete": "Xóa",

  // Context menu URL
  "ctx.openUrl": "M\u1edf trong tr\u00ecnh duy\u1ec7t",

  // Welcome guide
  "settings.welcomeGuide": "H\u01b0\u1edbng d\u1eabn ch\u00e0o m\u1eebng",
  "settings.showWelcomeGuide": "Hi\u1ec3n h\u01b0\u1edbng d\u1eabn ch\u00e0o m\u1eebng",

  // Window effect
  "settings.windowEffect": "Hi\u1ec7u \u1ee9ng c\u1eeda s\u1ed5",
  "settings.effectMica": "Mica",
  "settings.effectAcrylic": "Acrylic",
  "settings.effectSolid": "\u0110\u1eb7c",
  "settings.shortcutGlobalHotkey": "Ph\u00edm t\u1eaft to\u00e0n c\u1ee5c",
  "settings.shortcutPlainText": "Ph\u00edm t\u1eaft d\u00e1n v\u0103n b\u1ea3n thu\u1ea7n",
  "settings.shortcutPinWindow": "Ghim c\u1eeda s\u1ed5 l\u00ean tr\u00ean",
  "settings.shortcutFollowCursor": "Theo con tr\u1ecf",
  "settings.shortcutsGlobalHint":
    "Ph\u00edm t\u1eaft to\u00e0n c\u1ee5c ho\u1ea1t \u0111\u1ed9ng ngay c\u1ea3 khi Beetroot \u0111\u01b0\u1ee3c thu nh\u1ecf.",
  "settings.shortcutsLocalHint":
    "Ph\u00edm t\u1eaft c\u1ee5c b\u1ed9 ch\u1ec9 ho\u1ea1t \u0111\u1ed9ng khi Beetroot \u0111ang \u0111\u01b0\u1ee3c focus.",
  "settings.shortcutClear": "X\u00f3a",

  // Statistics
  "stats.totalItems": "T\u1ed5ng s\u1ed1 m\u1ee5c",
  "stats.textItems": "M\u1ee5c v\u0103n b\u1ea3n",
  "stats.imageItems": "M\u1ee5c h\u00ecnh \u1ea3nh",
  "stats.pinnedItems": "M\u1ee5c \u0111\u00e1nh d\u1ea5u sao",
  "stats.dbSize": "K\u00edch th\u01b0\u1edbc c\u01a1 s\u1edf d\u1eef li\u1ec7u",
  "stats.imagesDirSize": "K\u00edch th\u01b0\u1edbc th\u01b0 m\u1ee5c h\u00ecnh \u1ea3nh",
  "settings.aiProvider": "Nhà cung cấp AI",
  "settings.aiLocalPreset": "Cài đặt AI cục bộ",
  "settings.aiProviderOpenai": "OpenAI",
  "settings.aiProviderLocal": "Local LLM",
  "settings.localEndpoint": "Endpoint URL",
  "settings.localEndpointHint": "OpenAI-compatible (LM Studio, Ollama, llama.cpp)",
  "settings.localModel": "Model name",
  "settings.localModelHint": "Leave empty to auto-detect",
  "settings.localTestConnect": "Test",
  "settings.localConnectedShort": "Đã kết nối",
  "settings.localFailed": "Thất bại",
  "settings.localCustom": "Tùy chỉnh",
  "settings.aiProviderGemini": "Google Gemini",
  "settings.geminiDescription":
    "Yêu cầu khóa API Gemini của bạn (BYOK). Nhận tại aistudio.google.com.",
  "settings.geminiKeyPlaceholder": "AIza...",
  "settings.geminiModelFlashDesc":
    "Nhanh & thông minh — giá-hiệu suất tốt nhất cho tác vụ suy luận",
  "settings.geminiModelFlashLiteDesc": "Nhanh nhất & rẻ nhất — tác vụ nhẹ, khối lượng lớn",
  "settings.aiProviderAnthropic": "Anthropic",
  "settings.anthropicDescription":
    "Cần khóa API Anthropic riêng (BYOK). Lấy tại console.anthropic.com.",
  "settings.anthropicKeyPlaceholder": "sk-ant-...",
  "settings.anthropicModelHaikuDesc": "Nhanh nhất & rẻ nhất — tác vụ nhẹ, thông lượng cao",
  "settings.anthropicModelSonnetDesc":
    "Nhanh & thông minh — cân bằng tốt nhất giữa tốc độ và chất lượng",
  "settings.aiProviderDeepSeek": "DeepSeek",
  "settings.deepseekDescription":
    "Cần khóa API DeepSeek riêng (BYOK). Lấy tại platform.deepseek.com.",
  "settings.deepseekKeyPlaceholder": "sk-...",
  "settings.deepseekModelChatDesc": "Nhanh & đa năng — tốt nhất cho chuyển đổi văn bản hàng ngày",
  "settings.deepseekModelReasonerDesc": "Suy luận sâu — tác vụ phức tạp, phân tích chuỗi tư duy",
  "transform.noEndpoint": "Đặt endpoint LLM cục bộ trong Cài đặt",
  "settings.promptType": "Loại prompt",
  "settings.promptTypeText": "Văn bản",
  "settings.promptTypeImage": "Hình ảnh",
};

export default vi;
