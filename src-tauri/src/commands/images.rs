//! Image file IPC: save/delete/read/thumbnail under the validated images dir; OCR entry.

use std::fs;
use tracing::warn;

use crate::error::AppError;

/// Maximum base64 payload size (~10 MB) to prevent DoS via memory exhaustion
const MAX_BASE64_SIZE: usize = 10 * 1024 * 1024;

/// Maximum image read size in bytes. Set to the maximum raw PNG size that
/// `save_image_core` can produce (= MAX_BASE64_SIZE * 3 / 4, rounded up). This
/// ensures every image the app has stored remains readable, while still
/// bounding `read_clipboard_image_file` reads from arbitrary FS paths to
/// roughly the same envelope as the frontend `MAX_IMAGE_SIZE` ingest cap.
const MAX_IMAGE_READ_SIZE: u64 = 7_864_320;

/// Defense in depth: verify decoded bytes are actually a PNG before writing
/// them with a `.png` extension. Frontend filters non-PNG ingest, but a
/// future direct IPC path or feature could otherwise persist arbitrary bytes.
/// `image` crate is PNG-only here — a non-PNG payload would corrupt
/// preview/OCR/AI downstream.
fn verify_png_magic(bytes: &[u8]) -> Result<(), AppError> {
    const PNG_MAGIC: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if !bytes.starts_with(PNG_MAGIC) {
        return Err(AppError::Validation(
            "save_image rejected non-PNG payload (missing PNG signature)".to_string(),
        ));
    }
    Ok(())
}

pub(crate) fn save_image_core(
    images_dir: &std::path::Path,
    base64_data: &str,
    hash: &str,
) -> Result<String, AppError> {
    use base64::Engine;
    use std::io::Write;

    // Validate hash: must be 16-128 hex characters only (no path traversal, no injection)
    if hash.len() < 16 || hash.len() > 128 {
        return Err(AppError::Validation("Invalid hash length".to_string()));
    }
    if !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::Validation(
            "Invalid hash format: must be hex only".to_string(),
        ));
    }

    // Reject oversized payloads before decoding
    if base64_data.len() > MAX_BASE64_SIZE {
        return Err(AppError::Validation("Image data too large".to_string()));
    }

    // Organize images into year-month subdirectories (e.g. images/2026-02/)
    let month_dir = images_dir.join(chrono::Local::now().format("%Y-%m").to_string());
    fs::create_dir_all(&month_dir)?;

    let file_path = month_dir.join(format!("{}.png", &hash[..16]));

    // If file already exists, return immediately (idempotent)
    if file_path.exists() {
        return Ok(file_path.to_string_lossy().to_string());
    }

    let bytes = base64::engine::general_purpose::STANDARD.decode(base64_data)?;

    verify_png_magic(&bytes)?;

    // Atomic write: write to temp file, then rename to prevent TOCTOU and partial writes
    let tmp_path = month_dir.join(format!("{}.png.tmp", &hash[..16]));
    let mut file = fs::File::create(&tmp_path)?;
    file.write_all(&bytes).map_err(|e| {
        if let Err(re) = fs::remove_file(&tmp_path) {
            warn!(error = %re, "failed to clean up temp file after write error");
        }
        AppError::Io(e)
    })?;
    drop(file); // flush and close before rename

    // rename is atomic on most filesystems; if target was created concurrently, overwrite is safe
    fs::rename(&tmp_path, &file_path).map_err(|e| {
        if let Err(re) = fs::remove_file(&tmp_path) {
            warn!(error = %re, "failed to clean up temp file after rename error");
        }
        AppError::Io(e)
    })?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_image(app: tauri::AppHandle, path: String) -> Result<(), AppError> {
    let validated = super::validate_image_path(&app, &path)?;
    fs::remove_file(&validated)?;
    Ok(())
}

/// Image file extensions recognized when reading clipboard file copies from Explorer.
///
/// PNG-only as defense in depth — the frontend's SUPPORTED_IMAGE_EXTENSIONS
/// in src/hooks/useClipboardMonitor.ts is the primary gate, but this
/// command is also reachable from other future paths (drag-drop, direct
/// IPC), so we mirror the restriction here. The Rust `image` crate is
/// built with PNG features only (Cargo.toml `default-features = false,
/// features = ["png"]`).
const IMAGE_EXTENSIONS: &[&str] = &["png"];

/// Read an image file from an arbitrary filesystem path (e.g. copied via Explorer).
/// Only allows recognized image extensions and enforces a ~7.5 MB raw / ~10 MB base64
/// size limit (`MAX_IMAGE_READ_SIZE`).
/// Blocks UNC/network paths and system directories for defense-in-depth.
#[tauri::command]
pub async fn read_clipboard_image_file(path: String) -> Result<String, AppError> {
    use base64::Engine;

    let trimmed = path.trim();

    // Block UNC/network paths
    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err(AppError::Validation(
            "Network paths are not supported".to_string(),
        ));
    }

    let file_path = std::path::Path::new(trimmed);

    // Canonicalize to resolve .., symlinks, junctions — prevents traversal
    let canonical = file_path
        .canonicalize()
        .map_err(|_| AppError::Validation("File not found".to_string()))?;

    // Strip \\?\ prefix added by Windows canonicalize
    let canonical_str = canonical.to_string_lossy().to_lowercase();
    let clean_str = canonical_str
        .strip_prefix("\\\\?\\")
        .unwrap_or(&canonical_str);

    // Block system directories — reuse the canonical list from validation.rs
    for blocked in crate::validation::BLOCKED_DIRS {
        if clean_str.starts_with(blocked) {
            return Err(AppError::Validation(
                "Access denied: system directory".to_string(),
            ));
        }
    }

    if !canonical.is_file() {
        return Err(AppError::Validation("Not a file".to_string()));
    }

    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
        return Err(AppError::Validation(
            "Not a recognized image file type".to_string(),
        ));
    }

    let meta = fs::metadata(&canonical)?;
    if meta.len() > MAX_IMAGE_READ_SIZE {
        return Err(AppError::Validation("Image file too large".to_string()));
    }

    let bytes = fs::read(&canonical)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
pub async fn read_image_base64(app: tauri::AppHandle, path: String) -> Result<String, AppError> {
    use base64::Engine;
    let validated = super::validate_image_path(&app, &path)?;
    let meta = fs::metadata(&validated)?;
    if meta.len() > MAX_IMAGE_READ_SIZE {
        return Err(AppError::Validation("Image file too large".to_string()));
    }
    let bytes = fs::read(&validated)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// Read an image file, downscale to fit within `max_dim` × `max_dim` (preserving
/// aspect ratio), and return a PNG-encoded base64 data URL. For thumbnails in
/// the UI list — never use this for full-size preview; that's `read_image_base64`.
#[tauri::command]
pub async fn read_image_thumbnail(
    app: tauri::AppHandle,
    path: String,
    max_dim: u32,
) -> Result<String, AppError> {
    use base64::Engine;

    let max_dim = max_dim.clamp(32, 512);
    let validated = super::validate_image_path(&app, &path)?;
    let meta = fs::metadata(&validated)?;
    if meta.len() > MAX_IMAGE_READ_SIZE {
        return Err(AppError::Validation("Image file too large".to_string()));
    }
    let path_str = validated.to_string_lossy().into_owned();

    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let img = image::open(&path_str).map_err(|e| format!("open: {e}"))?;
        let resized = img.thumbnail(max_dim, max_dim);
        let mut out = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut out);
        resized
            .write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("encode: {e}"))?;
        Ok::<Vec<u8>, String>(out)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
    .map_err(AppError::Other)?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{b64}"))
}

#[tauri::command]
pub async fn show_in_explorer(app: tauri::AppHandle, path: String) -> Result<(), AppError> {
    let validated = super::validate_image_path(&app, &path)?;
    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        let (done, mut result) = tauri::async_runtime::channel(1);
        let app_handle = app.clone();
        // Shell selection needs COM and permission to transfer foreground. Use
        // Tauri's OLE-initialized UI thread, releasing the no-focus lock first.
        app.run_on_main_thread(move || {
            let outcome = (|| {
                let win = app_handle
                    .get_webview_window("main")
                    .ok_or_else(|| AppError::Other("Main window unavailable".into()))?;
                let mode = *app_handle.state::<crate::CurrentWindowMode>().0.lock();
                reveal_with_handoff(
                    mode,
                    || crate::window::activate_no_focus_window(&win),
                    || reveal_image_path(&validated),
                    || crate::window::hide_and_clear_state(&win),
                )
            })();
            let _ = done.try_send(outcome);
        })
        .map_err(|error| AppError::Other(error.to_string()))?;
        result
            .recv()
            .await
            .ok_or_else(|| AppError::Other("Explorer handoff interrupted".into()))?
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(parent) = validated.parent() {
            opener::open(parent).map_err(|e| AppError::Other(e.to_string()))?;
        }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn reveal_with_handoff(
    mode: crate::WindowMode,
    activate: impl FnOnce(),
    reveal: impl FnOnce() -> Result<(), AppError>,
    hide: impl FnOnce(),
) -> Result<(), AppError> {
    if mode != crate::WindowMode::Pinned {
        activate();
    }
    reveal()?;
    if mode != crate::WindowMode::Pinned {
        hide();
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn reveal_image_path(validated: &std::path::Path) -> Result<(), AppError> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{ILCreateFromPathW, ILFree, SHOpenFolderAndSelectItems};

    // Strip \\?\ prefix — shell APIs (ILCreateFromPathW) don't support extended paths
    let path_str = validated.to_string_lossy();
    let clean = if let Some(stripped) = path_str.strip_prefix("\\\\?\\") {
        stripped
    } else {
        &path_str
    };
    let wide: Vec<u16> = clean.encode_utf16().chain(std::iter::once(0)).collect();

    // SAFETY: `wide` is a NUL-terminated UTF-16 path string that outlives
    // the block; ILCreateFromPathW either returns a valid PIDL or null
    // (checked immediately); ILFree takes ownership of the PIDL returned by
    // ILCreateFromPathW — no double-free because pidl is not used after ILFree.
    unsafe {
        let pidl = ILCreateFromPathW(PCWSTR(wide.as_ptr()));
        if pidl.is_null() {
            return Err(AppError::Other("Failed to resolve path".to_string()));
        }
        let hr = SHOpenFolderAndSelectItems(pidl, None, 0);
        ILFree(Some(pidl));
        hr.map_err(|e| AppError::Other(format!("SHOpenFolderAndSelectItems: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ocr_image(app: tauri::AppHandle, path: String) -> Result<String, AppError> {
    let validated = super::validate_image_path(&app, &path)?;
    let abs_path = validated.to_string_lossy().to_string();
    // Strip \\?\ prefix that Windows canonicalize() adds — WinRT StorageFile rejects it
    let clean_path = abs_path
        .strip_prefix(r"\\?\")
        .unwrap_or(&abs_path)
        .to_string();
    // Run blocking WinRT OCR on a dedicated thread to avoid blocking the IPC thread
    tauri::async_runtime::spawn_blocking(move || crate::ocr::recognize_text(&clean_path))
        .await
        .map_err(|e| AppError::Other(format!("OCR task failed: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn unpinned_reveal_activates_before_shell_and_hides_after_success() {
        for mode in [crate::WindowMode::Normal, crate::WindowMode::FollowCursor] {
            let events = std::cell::RefCell::new(Vec::new());
            reveal_with_handoff(
                mode,
                || events.borrow_mut().push("activate"),
                || {
                    events.borrow_mut().push("reveal");
                    Ok(())
                },
                || events.borrow_mut().push("hide"),
            )
            .unwrap();
            assert_eq!(*events.borrow(), ["activate", "reveal", "hide"]);
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn pinned_reveal_preserves_the_popup() {
        reveal_with_handoff(
            crate::WindowMode::Pinned,
            || panic!("pinned focus behavior must not change"),
            || Ok(()),
            || panic!("pinned popup must stay visible"),
        )
        .unwrap();
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn failed_reveal_keeps_the_popup_visible_for_the_error() {
        let err = reveal_with_handoff(
            crate::WindowMode::Normal,
            || {},
            || Err(AppError::Other("Shell failure".into())),
            || panic!("error toast must remain visible"),
        )
        .unwrap_err();
        assert!(err.to_string().contains("Shell failure"));
    }

    /// Helper: run async fn in a blocking context (no tokio dev-dependency needed).
    fn block_on<F: std::future::Future>(f: F) -> F::Output {
        tauri::async_runtime::block_on(f)
    }

    // --- read_clipboard_image_file tests ---

    #[test]
    fn clipboard_image_rejects_unc_path() {
        let err = block_on(read_clipboard_image_file(
            "\\\\server\\share\\img.png".to_string(),
        ))
        .unwrap_err();
        assert!(err.to_string().contains("Network paths"));
    }

    #[test]
    fn clipboard_image_rejects_unc_forward_slash() {
        let err = block_on(read_clipboard_image_file(
            "//server/share/img.png".to_string(),
        ))
        .unwrap_err();
        assert!(err.to_string().contains("Network paths"));
    }

    #[test]
    fn clipboard_image_rejects_nonexistent() {
        let err = block_on(read_clipboard_image_file(
            "C:\\nonexistent_dir_12345\\photo.png".to_string(),
        ))
        .unwrap_err();
        assert!(err.to_string().contains("File not found"));
    }

    #[test]
    fn clipboard_image_rejects_system_dir() {
        // C:\Windows\Web\Wallpaper may or may not exist — either way should fail
        let err = block_on(read_clipboard_image_file(
            "C:\\Windows\\Web\\Wallpaper\\Windows\\img0.jpg".to_string(),
        ));
        assert!(err.is_err());
    }

    #[test]
    fn clipboard_image_rejects_non_image_extension() {
        let dir = std::env::temp_dir().join("cliptest_imgcmd");
        std::fs::create_dir_all(&dir).ok();
        let txt = dir.join("secret.txt");
        std::fs::write(&txt, "secret data").ok();

        let err =
            block_on(read_clipboard_image_file(txt.to_string_lossy().to_string())).unwrap_err();
        assert!(err.to_string().contains("Not a recognized image file type"));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clipboard_image_rejects_traversal() {
        let dir = std::env::temp_dir().join("cliptest_traverse");
        std::fs::create_dir_all(&dir).ok();
        let evil_path = format!("{}\\..\\..\\Windows\\System32\\cmd.exe", dir.display());

        let err = block_on(read_clipboard_image_file(evil_path));
        assert!(err.is_err());

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clipboard_image_reads_valid_png() {
        let dir = std::env::temp_dir().join("cliptest_validimg");
        std::fs::create_dir_all(&dir).ok();
        let png = dir.join("test.png");
        std::fs::write(&png, b"fake png content").ok();

        let result = block_on(read_clipboard_image_file(png.to_string_lossy().to_string()));
        assert!(result.is_ok());
        let b64 = result.unwrap();
        assert!(!b64.is_empty());

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clipboard_image_rejects_empty_path() {
        let err = block_on(read_clipboard_image_file("".to_string())).unwrap_err();
        assert!(err.to_string().contains("File not found"));
    }

    // --- verify_png_magic tests ---

    #[test]
    fn verify_png_magic_accepts_valid_signature() {
        let png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0xDE, 0xAD];
        assert!(verify_png_magic(&png).is_ok());
    }

    #[test]
    fn verify_png_magic_rejects_jpeg_soi() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46];
        let err = verify_png_magic(&jpeg).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn verify_png_magic_rejects_webp_riff() {
        let webp = *b"RIFF\x00\x00\x00\x00WEBPVP8 ";
        assert!(verify_png_magic(&webp).is_err());
    }

    #[test]
    fn verify_png_magic_rejects_gif() {
        let gif = *b"GIF89a\x00\x00";
        assert!(verify_png_magic(&gif).is_err());
    }

    #[test]
    fn verify_png_magic_rejects_bmp() {
        let bmp = *b"BM\x00\x00\x00\x00\x00\x00";
        assert!(verify_png_magic(&bmp).is_err());
    }

    #[test]
    fn verify_png_magic_rejects_too_short() {
        assert!(verify_png_magic(&[0x89, 0x50, 0x4E]).is_err());
    }

    #[test]
    fn verify_png_magic_rejects_empty() {
        assert!(verify_png_magic(&[]).is_err());
    }
}
