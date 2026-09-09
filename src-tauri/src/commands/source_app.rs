//! Source-app tracking: foreground process walk, exe description, GDI icon extraction.

use serde::Serialize;
use tracing::info;

use crate::error::AppError;

// --- Source app tracking ---

/// Runtime/host processes where the exe icon doesn't represent the actual app.
/// These are stable runtimes that rarely change — not application-specific.
#[cfg(target_os = "windows")]
const WRAPPER_RUNTIMES: &[&str] = &[
    "javaw.exe",
    "java.exe",
    "pythonw.exe",
    "python.exe",
    "python3.exe",
    "electron.exe",
    "msedgewebview2.exe",
    "cefsharp.browsersubprocess.exe",
];

#[derive(Debug, Serialize)]
pub struct SourceInfo {
    pub app: String,
    pub title: String,
    pub exe_name: String,
    pub exe_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppIconInfo {
    pub exe_name: String,
    pub display_name: String,
    pub icon_base64: Option<String>,
}

/// Get the source app of the current clipboard content.
/// Uses GetClipboardOwner or GetForegroundWindow fallback to identify the app.
/// For wrapper processes (javaw.exe, python.exe, etc.), extracts the real window
/// icon via WM_GETICON and persists it in the app_icons DB cache.
#[tauri::command]
pub async fn get_clipboard_source(app: tauri::AppHandle) -> Result<SourceInfo, AppError> {
    tauri::async_runtime::spawn_blocking(move || get_clipboard_source_inner(app))
        .await
        .map_err(|e| AppError::Other(format!("task failed to join: {e}")))?
}

fn get_clipboard_source_inner(app: tauri::AppHandle) -> Result<SourceInfo, AppError> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::System::DataExchange::GetClipboardOwner;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
        };

        // SAFETY: All Windows API calls in this block operate on HWNDs returned
        // by the OS itself (GetClipboardOwner, GetForegroundWindow) or previously
        // cached from OS callbacks — no user-supplied pointers are dereferenced.
        // GetWindowTextW writes into a caller-supplied stack buffer of known size.
        // GetWindowThreadProcessId writes into a caller-supplied u32 on the stack.
        // OpenProcess returns a kernel handle closed via CloseHandle.
        // The entire block is Windows-only (cfg guard in the parent function).
        unsafe {
            // Try clipboard owner first (race-free: returns who SET the clipboard).
            // Fall back to cached foreground HWND captured at clipboard change time
            // by the hotkey thread's WM_CLIPBOARDUPDATE handler — avoids the race
            // where GetForegroundWindow() returns a different window by the time
            // this async IPC call resolves (50-200ms later).
            let hwnd = GetClipboardOwner().unwrap_or_default();
            let hwnd = if hwnd == HWND::default() {
                let cached = crate::hotkey::last_clipboard_foreground();
                if cached != 0 {
                    HWND(cached as *mut _)
                } else {
                    GetForegroundWindow()
                }
            } else {
                hwnd
            };
            if hwnd == HWND::default() {
                return Ok(SourceInfo {
                    app: "Unknown".to_string(),
                    title: String::new(),
                    exe_name: String::new(),
                    exe_path: String::new(),
                });
            }

            // Get PID
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return Ok(SourceInfo {
                    app: "Unknown".to_string(),
                    title: String::new(),
                    exe_name: String::new(),
                    exe_path: String::new(),
                });
            }
            // Compute parent PID once (used for self-detection and wrapper fallback)
            let parent_pid = get_parent_pid(pid);

            // Detect our own process or child (WebView2 subprocess)
            let our_pid = std::process::id();
            let is_self = pid == our_pid || (parent_pid == Some(our_pid));
            if is_self {
                let our_exe = std::env::current_exe().ok();
                let our_exe_str = our_exe
                    .as_ref()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                let our_file = our_exe
                    .as_ref()
                    .and_then(|p| p.file_name())
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_default();
                let display = get_file_description(&our_exe_str).unwrap_or_else(|| {
                    our_file
                        .strip_suffix(".exe")
                        .unwrap_or(&our_file)
                        .to_string()
                });
                return Ok(SourceInfo {
                    app: display.clone(),
                    title: String::new(),
                    exe_name: display,
                    exe_path: our_exe_str,
                });
            }

            // Get exe path from PID
            let exe_path = get_exe_path_for_pid(pid)
                .map(|(_name, path)| path)
                .unwrap_or_default();

            // Get window title
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, &mut title_buf);
            let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

            // Extract exe name and display name from path
            let exe_name = std::path::Path::new(&exe_path)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();

            // Check if this is a known runtime/host process
            let is_wrapper = WRAPPER_RUNTIMES
                .iter()
                .any(|w| exe_name.eq_ignore_ascii_case(w));

            if is_wrapper {
                // For wrappers, get the visible foreground window for icon and title
                let fg_hwnd = GetForegroundWindow();
                let fg_title = if fg_hwnd != HWND::default() && fg_hwnd != hwnd {
                    let mut buf = [0u16; 512];
                    let len = GetWindowTextW(fg_hwnd, &mut buf);
                    let t = String::from_utf16_lossy(&buf[..len as usize]);
                    if t.is_empty() {
                        None
                    } else {
                        Some(t)
                    }
                } else {
                    None
                };
                let best_title = fg_title
                    .as_deref()
                    .filter(|t| !t.is_empty())
                    .unwrap_or(&title);
                let icon_hwnd = if fg_title.is_some() { fg_hwnd } else { hwnd };

                // Try WM_GETICON on the visible window (works for same-PID wrappers)
                let mut window_icon = extract_window_icon(icon_hwnd);
                // Fallback: try clipboard owner window
                if window_icon.is_none() && icon_hwnd != hwnd {
                    window_icon = extract_window_icon(hwnd);
                }
                // Fallback: for cross-PID wrappers (WebView2, CEF), get parent exe icon
                let mut parent_info = None;
                if window_icon.is_none() {
                    if let Some((parent_name, parent_path)) =
                        parent_pid.and_then(get_exe_path_for_pid)
                    {
                        let (_, icon) = extract_app_icon(&parent_name, Some(&parent_path));
                        if icon.is_some() {
                            parent_info = Some((parent_name, parent_path));
                            window_icon = icon;
                        }
                    }
                }

                let icon_title = best_title.to_string();
                let derived_name = derive_app_name_from_title(&icon_title);
                // If we got icon from parent process, use parent exe name as display
                let display_name = if let Some((ref pname, _)) = parent_info {
                    // Use FileDescription of parent exe for a nice name
                    get_file_description(
                        parent_info.as_ref().map(|(_, p)| p.as_str()).unwrap_or(""),
                    )
                    .unwrap_or_else(|| {
                        pname
                            .strip_suffix(".exe")
                            .or_else(|| pname.strip_suffix(".EXE"))
                            .unwrap_or(pname)
                            .to_string()
                    })
                } else if derived_name.is_empty() {
                    exe_name
                        .strip_suffix(".exe")
                        .or_else(|| exe_name.strip_suffix(".EXE"))
                        .unwrap_or(&exe_name)
                        .to_string()
                } else {
                    derived_name
                };

                // Persist the icon in app_icons cache under the display name
                if window_icon.is_some() {
                    let cache_exe_path = parent_info
                        .as_ref()
                        .map(|(_, p)| p.as_str())
                        .unwrap_or(&exe_path);
                    let _ = super::with_db(&app, |conn| {
                        conn.execute(
                            "INSERT OR REPLACE INTO app_icons (exe_name, display_name, icon_base64, exe_path, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))",
                            rusqlite::params![display_name, display_name, window_icon, cache_exe_path],
                        )?;
                        Ok(())
                    });
                }

                // Return derived name as exe_name so frontend uses it as source_app key
                Ok(SourceInfo {
                    app: display_name.clone(),
                    title: icon_title,
                    exe_name: display_name,
                    exe_path,
                })
            } else {
                // Regular process — use FileDescription
                let display_name = get_file_description(&exe_path).unwrap_or_else(|| {
                    exe_name
                        .strip_suffix(".exe")
                        .or_else(|| exe_name.strip_suffix(".EXE"))
                        .unwrap_or(&exe_name)
                        .to_string()
                });

                // Clipboard owner window often has no title (hidden message window).
                // Fall back to the foreground window title.
                let title = if title.is_empty() {
                    let fg = GetForegroundWindow();
                    if fg != HWND::default() && fg != hwnd {
                        let mut buf = [0u16; 512];
                        let len = GetWindowTextW(fg, &mut buf);
                        String::from_utf16_lossy(&buf[..len as usize])
                    } else {
                        title
                    }
                } else {
                    title
                };

                Ok(SourceInfo {
                    app: display_name,
                    title,
                    exe_name,
                    exe_path,
                })
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app; // suppress unused warning
        Ok(SourceInfo {
            app: "Unknown".to_string(),
            title: String::new(),
            exe_name: String::new(),
            exe_path: String::new(),
        })
    }
}

/// Extract FileDescription from a PE file's version info.
#[cfg(target_os = "windows")]
fn get_file_description(exe_path: &str) -> Option<String> {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
    };

    if exe_path.is_empty() {
        return None;
    }

    // SAFETY: `wide_path` and `data` are valid, correctly-sized buffers that
    // outlive all calls in this block. `data.as_ptr()` is passed as `*const _`
    // to VerQueryValueW/GetFileVersionInfoW which treat it as read-only opaque
    // version-info storage. `trans_ptr` and `ptr` point into `data` (owned on
    // the stack) which remains live for the entire block; slice lengths come
    // directly from the API return values. The function is Windows-only.
    unsafe {
        let wide_path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
        let size = GetFileVersionInfoSizeW(PCWSTR(wide_path.as_ptr()), None);
        if size == 0 {
            return None;
        }

        let mut data = vec![0u8; size as usize];
        if GetFileVersionInfoW(
            PCWSTR(wide_path.as_ptr()),
            0,
            size,
            data.as_mut_ptr() as *mut _,
        )
        .is_err()
        {
            return None;
        }

        // Query actual language/codepage pairs from the PE version info
        let translation_key: Vec<u16> = "\\VarFileInfo\\Translation"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let mut trans_ptr = std::ptr::null_mut();
        let mut trans_len = 0u32;

        let mut sub_blocks: Vec<String> = Vec::new();

        if VerQueryValueW(
            data.as_ptr() as *const _,
            PCWSTR(translation_key.as_ptr()),
            &mut trans_ptr,
            &mut trans_len,
        )
        .as_bool()
            && trans_len >= 4
            && !trans_ptr.is_null()
        {
            // Each translation entry is 4 bytes: u16 lang_id + u16 codepage
            let count = trans_len as usize / 4;
            let entries = std::slice::from_raw_parts(trans_ptr as *const [u16; 2], count);
            for entry in entries {
                sub_blocks.push(format!(
                    "\\StringFileInfo\\{:04X}{:04X}\\FileDescription",
                    entry[0], entry[1]
                ));
            }
        }

        // Append common fallbacks in case Translation block is missing or incomplete
        for fallback in [
            "\\StringFileInfo\\040904B0\\FileDescription",
            "\\StringFileInfo\\040904E4\\FileDescription",
            "\\StringFileInfo\\000004B0\\FileDescription",
        ] {
            let s = fallback.to_string();
            if !sub_blocks.contains(&s) {
                sub_blocks.push(s);
            }
        }

        for sub_block in &sub_blocks {
            let wide_sub: Vec<u16> = sub_block.encode_utf16().chain(std::iter::once(0)).collect();
            let mut ptr = std::ptr::null_mut();
            let mut len = 0u32;
            if VerQueryValueW(
                data.as_ptr() as *const _,
                PCWSTR(wide_sub.as_ptr()),
                &mut ptr,
                &mut len,
            )
            .as_bool()
                && len > 0
                && !ptr.is_null()
            {
                let slice = std::slice::from_raw_parts(ptr as *const u16, len as usize);
                // Trim trailing null
                let end = slice.iter().position(|&c| c == 0).unwrap_or(slice.len());
                let desc = String::from_utf16_lossy(&slice[..end]);
                if !desc.is_empty() {
                    return Some(desc);
                }
            }
        }

        None
    }
}

/// Get the app icon for an executable, with caching in the app_icons table.
#[tauri::command]
pub async fn get_app_icon(
    app: tauri::AppHandle,
    exe_name: String,
    exe_path: Option<String>,
) -> Result<AppIconInfo, AppError> {
    tauri::async_runtime::spawn_blocking(move || get_app_icon_inner(app, exe_name, exe_path))
        .await
        .map_err(|e| AppError::Other(format!("task failed to join: {e}")))?
}

fn get_app_icon_inner(
    app: tauri::AppHandle,
    exe_name: String,
    exe_path: Option<String>,
) -> Result<AppIconInfo, AppError> {
    if exe_name.is_empty() {
        return Err(AppError::Validation("Empty exe name".to_string()));
    }

    // Check cache first (single query: info + exe_path + updated_at)
    let cached: Option<(AppIconInfo, Option<String>, Option<String>)> = super::with_db(
        &app,
        |conn| {
            let mut stmt = conn.prepare(
                "SELECT exe_name, display_name, icon_base64, exe_path, updated_at FROM app_icons WHERE exe_name = ?1",
            )?;
            let result = stmt
                .query_row([&exe_name], |row| {
                    Ok((
                        AppIconInfo {
                            exe_name: row.get(0)?,
                            display_name: row.get(1)?,
                            icon_base64: row.get(2)?,
                        },
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                    ))
                })
                .ok();
            Ok(result)
        },
    )?;

    // Extract cached fields
    let cached_exe_path = cached.as_ref().and_then(|(_, p, _)| p.clone());
    let cached_updated_at = cached.as_ref().and_then(|(_, _, u)| u.clone());

    if let Some((ref info, _, _)) = cached {
        // If cached with icon, return it
        if info.icon_base64.is_some() {
            return Ok(info.clone());
        }
        // NULL icon — only retry if last attempt was >24h ago
        if let Some(ref ts) = cached_updated_at {
            if let Ok(last) = chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%d %H:%M:%S") {
                let now = chrono::Utc::now().naive_utc();
                if now.signed_duration_since(last).num_hours() < 24 {
                    return Ok(info.clone());
                }
            }
        }
    }

    // Resolve exe_path: prefer caller hint, then cached path
    let resolved_path = exe_path.or(cached_exe_path);

    // Cache miss — extract icon
    info!(exe_name = %exe_name, exe_path = ?resolved_path, "extracting app icon");
    #[cfg(target_os = "windows")]
    let (display_name, icon_base64) = extract_app_icon(&exe_name, resolved_path.as_deref());
    #[cfg(target_os = "windows")]
    info!(exe_name = %exe_name, display_name = %display_name, has_icon = icon_base64.is_some(), "icon extraction result");

    #[cfg(not(target_os = "windows"))]
    let (display_name, icon_base64): (String, Option<String>) = (exe_name.clone(), None);

    // Store in cache (including exe_path and timestamp for retry throttling)
    super::with_db(&app, |conn| {
        conn.execute(
            "INSERT OR REPLACE INTO app_icons (exe_name, display_name, icon_base64, exe_path, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))",
            rusqlite::params![exe_name, display_name, icon_base64, resolved_path],
        )?;
        Ok(())
    })?;

    Ok(AppIconInfo {
        exe_name,
        display_name,
        icon_base64,
    })
}

/// Get all cached app icons in one query (avoids N+1 IPC calls on startup).
#[tauri::command]
pub async fn get_all_app_icons(app: tauri::AppHandle) -> Result<Vec<AppIconInfo>, AppError> {
    tauri::async_runtime::spawn_blocking(move || get_all_app_icons_inner(app))
        .await
        .map_err(|e| AppError::Other(format!("task failed to join: {e}")))?
}

fn get_all_app_icons_inner(app: tauri::AppHandle) -> Result<Vec<AppIconInfo>, AppError> {
    super::with_db(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT exe_name, display_name, icon_base64 FROM app_icons WHERE icon_base64 IS NOT NULL",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(AppIconInfo {
                exe_name: row.get(0)?,
                display_name: row.get(1)?,
                icon_base64: row.get(2)?,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Default)]
#[allow(non_snake_case)]
struct MaskBitmapInfo {
    bmiHeader: windows::Win32::Graphics::Gdi::BITMAPINFOHEADER,
    bmiColors: [windows::Win32::Graphics::Gdi::RGBQUAD; 2],
}

#[cfg(all(test, target_os = "windows"))]
mod mask_layout_tests {
    use super::*;
    use windows::Win32::Graphics::Gdi::{
        CreateBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, BITMAPINFO,
        DIB_RGB_COLORS,
    };

    #[test]
    fn mask_palette_has_two_native_color_slots() {
        assert_eq!(std::mem::size_of::<MaskBitmapInfo>(), 48);
        assert_eq!(std::mem::align_of::<MaskBitmapInfo>(), 4);
        assert_eq!(std::mem::offset_of!(MaskBitmapInfo, bmiHeader), 0);
        assert_eq!(std::mem::offset_of!(MaskBitmapInfo, bmiColors), 40);
    }

    #[test]
    fn synthetic_mask_palette_stays_inside_production_layout() {
        #[repr(C)]
        struct Guarded {
            info: MaskBitmapInfo,
            canary: [u8; 8],
        }
        for width in [1u32, 16, 31, 32, 33, 256] {
            let mut guarded = Guarded {
                info: mask_bitmap_info(width, 1),
                canary: [0xa5; 8],
            };
            // CreateBitmap uses WORD-aligned input rows; GetDIBits uses DWORD alignment.
            let mut source = vec![0u8; (width.div_ceil(16) * 2) as usize];
            source[0] = 0x80;
            let mut pixels = vec![0u8; (width.div_ceil(32) * 4) as usize];
            // SAFETY: synthetic in-process bitmap/DC only. The WHOLE Guarded allocation
            // is >=52 bytes even for the old 44-byte type, so a two-color palette write
            // cannot overflow the test allocation. The trailing canary detects it safely.
            unsafe {
                let bitmap = CreateBitmap(width as i32, 1, 1, 1, Some(source.as_ptr().cast()));
                let dc = CreateCompatibleDC(None);
                assert!(!bitmap.is_invalid());
                assert!(!dc.is_invalid());
                let rows = GetDIBits(
                    dc,
                    bitmap,
                    0,
                    1,
                    Some(pixels.as_mut_ptr().cast()),
                    (&mut guarded as *mut Guarded).cast::<BITMAPINFO>(),
                    DIB_RGB_COLORS,
                );
                let _ = DeleteObject(bitmap);
                let _ = DeleteDC(dc);
                assert_eq!(rows, 1);
            }
            assert_eq!(pixels[0] & 0x80, 0x80);
            assert_eq!(guarded.canary, [0xa5; 8], "width {width}");
        }
    }
}

#[cfg(target_os = "windows")]
fn mask_bitmap_info(w: u32, h: u32) -> MaskBitmapInfo {
    use windows::Win32::Graphics::Gdi::{BITMAPINFOHEADER, BI_RGB};
    MaskBitmapInfo {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w as i32,
            biHeight: h as i32,
            biPlanes: 1,
            biBitCount: 1,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    }
}

/// Convert an HICON to base64-encoded PNG.
/// If `destroy_icon` is true, calls DestroyIcon after extraction (for owned icons).
/// For borrowed icons (from WM_GETICON), pass `destroy_icon = false`.
#[cfg(target_os = "windows")]
unsafe fn hicon_to_base64(
    hicon: windows::Win32::UI::WindowsAndMessaging::HICON,
    destroy_icon: bool,
) -> Option<String> {
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    let mut icon_info = ICONINFO::default();
    if GetIconInfo(hicon, &mut icon_info).is_err() {
        if destroy_icon {
            let _ = DestroyIcon(hicon);
        }
        return None;
    }

    let hdc = CreateCompatibleDC(None);
    if hdc.is_invalid() {
        if destroy_icon {
            let _ = DestroyIcon(hicon);
        }
        if !icon_info.hbmColor.is_invalid() {
            let _ = DeleteObject(icon_info.hbmColor);
        }
        if !icon_info.hbmMask.is_invalid() {
            let _ = DeleteObject(icon_info.hbmMask);
        }
        return None;
    }

    let bitmap_handle = if !icon_info.hbmColor.is_invalid() {
        icon_info.hbmColor
    } else {
        icon_info.hbmMask
    };

    let mut bm = BITMAP::default();
    if GetObjectW(
        bitmap_handle,
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bm as *mut _ as *mut _),
    ) == 0
    {
        let _ = DeleteDC(hdc);
        if destroy_icon {
            let _ = DestroyIcon(hicon);
        }
        if !icon_info.hbmColor.is_invalid() {
            let _ = DeleteObject(icon_info.hbmColor);
        }
        if !icon_info.hbmMask.is_invalid() {
            let _ = DeleteObject(icon_info.hbmMask);
        }
        return None;
    }

    let w = bm.bmWidth as u32;
    let h = bm.bmHeight as u32;
    if w == 0 || h == 0 || w > 256 || h > 256 {
        let _ = DeleteDC(hdc);
        if destroy_icon {
            let _ = DestroyIcon(hicon);
        }
        if !icon_info.hbmColor.is_invalid() {
            let _ = DeleteObject(icon_info.hbmColor);
        }
        if !icon_info.hbmMask.is_invalid() {
            let _ = DeleteObject(icon_info.hbmMask);
        }
        return None;
    }

    let mut bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w as i32,
            biHeight: h as i32,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };

    let mut pixels = vec![0u8; (w * h * 4) as usize];
    let scan_result = GetDIBits(
        hdc,
        bitmap_handle,
        0,
        h,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bmi,
        DIB_RGB_COLORS,
    );

    let mut mask_pixels: Option<Vec<u8>> = None;
    if scan_result != 0 && !icon_info.hbmMask.is_invalid() {
        let mask_row_bytes = (w.div_ceil(32) * 4) as usize;
        let mut mask_bmi = mask_bitmap_info(w, h);
        let mut mask_buf = vec![0u8; mask_row_bytes * h as usize];
        let mask_result = GetDIBits(
            hdc,
            icon_info.hbmMask,
            0,
            h,
            Some(mask_buf.as_mut_ptr() as *mut _),
            &mut mask_bmi as *mut MaskBitmapInfo as *mut BITMAPINFO,
            DIB_RGB_COLORS,
        );
        if mask_result != 0 {
            mask_pixels = Some(mask_buf);
        }
    }

    let _ = DeleteDC(hdc);
    if destroy_icon {
        let _ = DestroyIcon(hicon);
    }
    if !icon_info.hbmColor.is_invalid() {
        let _ = DeleteObject(icon_info.hbmColor);
    }
    if !icon_info.hbmMask.is_invalid() {
        let _ = DeleteObject(icon_info.hbmMask);
    }

    if scan_result == 0 {
        return None;
    }

    // Flip rows (bottom-up → top-down) and convert BGRA → RGBA
    let row_bytes = (w * 4) as usize;
    let mut flipped = Vec::with_capacity(pixels.len());
    let mut all_alpha_zero = true;
    for y in (0..h as usize).rev() {
        let row = &pixels[y * row_bytes..(y + 1) * row_bytes];
        for chunk in row.chunks_exact(4) {
            flipped.push(chunk[2]); // R
            flipped.push(chunk[1]); // G
            flipped.push(chunk[0]); // B
            flipped.push(chunk[3]); // A
            if chunk[3] != 0 {
                all_alpha_zero = false;
            }
        }
    }

    if all_alpha_zero {
        let mask_row_bytes = (w.div_ceil(32) * 4) as usize;
        if let Some(ref mask) = mask_pixels {
            for y in 0..h as usize {
                let mask_y = (h as usize - 1) - y;
                for x in 0..w as usize {
                    let byte_idx = mask_y * mask_row_bytes + x / 8;
                    let bit_idx = 7 - (x % 8);
                    let is_transparent = (mask[byte_idx] >> bit_idx) & 1 == 1;
                    let px_idx = (y * w as usize + x) * 4 + 3;
                    flipped[px_idx] = if is_transparent { 0 } else { 255 };
                }
            }
        } else {
            for px in flipped.chunks_exact_mut(4) {
                px[3] = 255;
            }
        }
    }

    encode_png_base64(&flipped, w, h)
}

/// Extract the window icon from a HWND using WM_GETICON.
/// Returns the icon as base64 PNG, or None if extraction fails.
#[cfg(target_os = "windows")]
unsafe fn extract_window_icon(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClassLongPtrW, GCLP_HICON, HICON, ICON_BIG, ICON_SMALL, WM_GETICON,
    };

    // Try ICON_BIG first (32x32), then ICON_SMALL (16x16), then class icon
    let hicon = {
        let mut result: usize = 0;
        let ok = windows::Win32::UI::WindowsAndMessaging::SendMessageTimeoutW(
            hwnd,
            WM_GETICON,
            windows::Win32::Foundation::WPARAM(ICON_BIG as usize),
            windows::Win32::Foundation::LPARAM(0),
            windows::Win32::UI::WindowsAndMessaging::SMTO_ABORTIFHUNG,
            100, // 100ms timeout
            Some(&mut result as *mut usize),
        );
        if ok.0 != 0 && result != 0 {
            HICON(result as *mut _)
        } else {
            // Try ICON_SMALL
            result = 0;
            let ok = windows::Win32::UI::WindowsAndMessaging::SendMessageTimeoutW(
                hwnd,
                WM_GETICON,
                windows::Win32::Foundation::WPARAM(ICON_SMALL as usize),
                windows::Win32::Foundation::LPARAM(0),
                windows::Win32::UI::WindowsAndMessaging::SMTO_ABORTIFHUNG,
                100,
                Some(&mut result as *mut usize),
            );
            if ok.0 != 0 && result != 0 {
                HICON(result as *mut _)
            } else {
                // Last resort: class icon
                let ptr = GetClassLongPtrW(hwnd, GCLP_HICON);
                if ptr != 0 {
                    HICON(ptr as *mut _)
                } else {
                    return None;
                }
            }
        }
    };

    if hicon.is_invalid() {
        return None;
    }

    // WM_GETICON returns a borrowed handle — do NOT destroy it
    hicon_to_base64(hicon, false)
}

/// Get parent PID via Toolhelp32 snapshot.
#[cfg(target_os = "windows")]
fn get_parent_pid(pid: u32) -> Option<u32> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    // SAFETY: CreateToolhelp32Snapshot returns a kernel handle (or Err).
    // Process32FirstW/Process32NextW write into `entry` which is properly
    // initialised with dwSize; both functions accept the snapshot handle
    // returned by the same call. CloseHandle releases the handle exactly once.
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut parent_pid = None;
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID == pid {
                    parent_pid = Some(entry.th32ParentProcessID);
                    break;
                }
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = windows::Win32::Foundation::CloseHandle(snap);
        parent_pid
    }
}

/// Get exe path for a given PID. Returns (exe_name, exe_path) or None.
#[cfg(target_os = "windows")]
fn get_exe_path_for_pid(pid: u32) -> Option<(String, String)> {
    use windows::Win32::Foundation::{CloseHandle, MAX_PATH};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    // SAFETY: OpenProcess returns a kernel handle (or Err). `buf` is a
    // MAX_PATH-sized stack buffer; `size` is initialised to buf.len() and
    // QueryFullProcessImageNameW writes at most `size` wide chars into it.
    // CloseHandle releases the handle exactly once after the query.
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; MAX_PATH as usize];
        let mut size = buf.len() as u32;
        let path = if QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut size,
        )
        .is_ok()
        {
            Some(String::from_utf16_lossy(&buf[..size as usize]))
        } else {
            None
        };
        let _ = CloseHandle(handle);

        let full_path = path?;
        let name = std::path::Path::new(&full_path)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        Some((name, full_path))
    }
}

/// Derive an app name from a window title.
/// E.g. "MyProject - IntelliJ IDEA" → "IntelliJ IDEA"
/// E.g. "Screaming Frog SEO Spider 21.0" → "Screaming Frog SEO Spider"
#[cfg(target_os = "windows")]
fn derive_app_name_from_title(title: &str) -> String {
    let trimmed = title.trim();
    // Try "content - AppName" pattern (common in IDEs, editors, browsers)
    let base = if let Some(pos) = trimmed.rfind(" - ") {
        let after = trimmed[pos + 3..].trim();
        if after.is_empty() {
            trimmed
        } else {
            after
        }
    } else {
        trimmed
    };
    // Strip trailing parenthetical groups: "(Licensed)", "(x64)", "(Community Edition)"
    let mut s = base.to_string();
    for _ in 0..5 {
        let t = s.trim_end();
        if t.ends_with(')') {
            if let Some(open) = t.rfind('(') {
                let before = t[..open].trim();
                if before.len() >= 3 {
                    s = before.to_string();
                    continue;
                }
            }
        }
        break;
    }
    // Strip trailing version numbers: "App 21.0" → "App", "IDE 2025-03" → "IDE"
    // Guard: only strip if remainder is at least 3 chars
    let stripped = s
        .trim_end_matches(|c: char| c.is_ascii_digit() || c == '.' || c == '-')
        .trim();
    if stripped.len() >= 3 && stripped != s.as_str() {
        return stripped.to_string();
    }
    s
}

/// Crate-internal wrapper for extract_app_icon, used by lib.rs to cache the app's own icon.
#[cfg(target_os = "windows")]
pub(crate) fn extract_app_icon_pub(
    exe_name: &str,
    exe_path_hint: Option<&str>,
) -> (String, Option<String>) {
    extract_app_icon(exe_name, exe_path_hint)
}

/// Crate-internal wrapper for get_file_description, used by lib.rs for display name.
#[cfg(target_os = "windows")]
pub(crate) fn get_file_description_pub(exe_path: &str) -> Option<String> {
    get_file_description(exe_path)
}

/// Accept file hints only; directories must not shadow a matching executable.
#[cfg(target_os = "windows")]
fn resolve_icon_path(exe_name: &str, exe_path_hint: Option<&str>) -> String {
    match exe_path_hint {
        Some(path) if std::path::Path::new(path).is_file() => path.to_string(),
        _ => find_exe_path(exe_name),
    }
}

#[cfg(target_os = "windows")]
fn extract_resource_icon(exe_path: &str) -> Option<String> {
    use windows::Win32::UI::Shell::ExtractIconExW;
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, HICON};

    if !std::path::Path::new(exe_path).is_file() {
        return None;
    }
    let path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
    let mut icon = HICON::default();
    // SAFETY: The terminated path and single output slot outlive the call. Every
    // returned owned HICON is destroyed directly or by hicon_to_base64, never shared.
    unsafe {
        let count = ExtractIconExW(
            windows::core::PCWSTR(path.as_ptr()),
            0,
            Some(&mut icon),
            None,
            1,
        );
        if icon.is_invalid() {
            return None;
        }
        if count != 1 {
            let _ = DestroyIcon(icon);
            return None;
        }
        hicon_to_base64(icon, true)
    }
}

/// Prefer Shell metadata; read the executable resource if Shell returns no icon.
#[cfg(target_os = "windows")]
fn extract_app_icon(exe_name: &str, exe_path_hint: Option<&str>) -> (String, Option<String>) {
    use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_DISPLAYNAME, SHGFI_ICON};
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;

    struct ComScope(bool);
    impl Drop for ComScope {
        fn drop(&mut self) {
            if self.0 {
                // SAFETY: This local guard stays on the calling thread and balances
                // exactly one successful CoInitializeEx, including S_FALSE.
                unsafe { CoUninitialize() };
            }
        }
    }

    // SAFETY: No reserved pointer is supplied. The guard cannot escape this
    // synchronous function or move to another thread. An existing STA is reused
    // without uninitializing the caller's COM apartment.
    // Background workers do not pump messages, so they must not create an STA.
    let com_result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    let _com = ComScope(com_result.is_ok());
    if com_result.is_err() && com_result != RPC_E_CHANGED_MODE {
        info!(exe_name = %exe_name, hresult = com_result.0, "extract_app_icon: COM initialization failed");
        return (
            exe_name
                .strip_suffix(".exe")
                .unwrap_or(exe_name)
                .to_string(),
            None,
        );
    }

    // SAFETY: `wide_path` is a NUL-terminated UTF-16 path that outlives the
    // block. SHGetFileInfoW fills `info` (properly zeroed beforehand);
    // `info.hIcon` is owned and destroyed here or via hicon_to_base64
    // (destroy_icon=true). The function is Windows-only.
    unsafe {
        let exe_path = resolve_icon_path(exe_name, exe_path_hint);
        info!(exe_name = %exe_name, resolved_path = %exe_path, "extract_app_icon: resolved exe path");
        let wide_path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();

        let mut info = SHFILEINFOW::default();
        let result = SHGetFileInfoW(
            windows::core::PCWSTR(wide_path.as_ptr()),
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_DISPLAYNAME,
        );

        if result == 0 || info.hIcon.is_invalid() {
            info!(exe_name = %exe_name, shgetfileinfo_result = result, "extract_app_icon: SHGetFileInfoW failed");
            if !info.hIcon.is_invalid() {
                let _ = DestroyIcon(info.hIcon);
            }
            let fallback_name = exe_name
                .strip_suffix(".exe")
                .unwrap_or(exe_name)
                .to_string();
            return (fallback_name, extract_resource_icon(&exe_path));
        }

        let display_name = {
            let end = info
                .szDisplayName
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(info.szDisplayName.len());
            let name = String::from_utf16_lossy(&info.szDisplayName[..end]);
            if name.is_empty() {
                exe_name
                    .strip_suffix(".exe")
                    .unwrap_or(exe_name)
                    .to_string()
            } else {
                name
            }
        };

        // SHGetFileInfoW gives us an owned icon — destroy_icon = true
        let icon_b64 =
            hicon_to_base64(info.hIcon, true).or_else(|| extract_resource_icon(&exe_path));
        (display_name, icon_b64)
    }
}

/// Find the full path of an executable by searching common locations.
/// Tries with and without `.exe` extension to handle legacy DB entries.
#[cfg(target_os = "windows")]
fn find_exe_path(exe_name: &str) -> String {
    use std::env;

    // Known process→exe aliases (process name differs from registered exe name)
    let known_aliases: &[(&str, &str)] = &[("WindowsTerminal.exe", "wt.exe")];

    // Build candidate names: original + with .exe appended (if missing) + aliases
    let mut names = vec![exe_name.to_string()];
    if !exe_name.to_lowercase().ends_with(".exe") {
        names.push(format!("{}.exe", exe_name));
    }
    for (proc_name, alias) in known_aliases {
        if exe_name.eq_ignore_ascii_case(proc_name)
            && !names.iter().any(|n| n.eq_ignore_ascii_case(alias))
        {
            names.push(alias.to_string());
        }
    }

    for name in &names {
        // First try: use the name as-is (might be a full path already)
        if std::path::Path::new(name).is_file() {
            return name.clone();
        }

        // Try Windows root (explorer.exe lives here)
        let system_root = env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let winroot_path = format!("{}\\{}", system_root, name);
        if std::path::Path::new(&winroot_path).is_file() {
            return winroot_path;
        }

        // Try System32
        let system32_path = format!("{}\\System32\\{}", system_root, name);
        if std::path::Path::new(&system32_path).is_file() {
            return system32_path;
        }

        // Try App Paths registry — HKLM (Chrome, Firefox, etc.)
        for hive in [
            winreg::enums::HKEY_LOCAL_MACHINE,
            winreg::enums::HKEY_CURRENT_USER,
        ] {
            let root = winreg::RegKey::predef(hive);
            let app_paths_key = format!(
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{}",
                name
            );
            if let Ok(key) = root.open_subkey(&app_paths_key) {
                if let Ok(path) = key.get_value::<String, _>("") {
                    let path = path.trim_matches('"').to_string();
                    if std::path::Path::new(&path).is_file() {
                        return path;
                    }
                }
            }
        }

        // Walk PATH
        if let Ok(path_var) = env::var("PATH") {
            for dir in path_var.split(';') {
                let candidate = format!("{}\\{}", dir.trim(), name);
                if std::path::Path::new(&candidate).is_file() {
                    return candidate;
                }
            }
        }

        // Try Program Files directories (app subfolder matching exe base name)
        let base = name
            .strip_suffix(".exe")
            .or(name.strip_suffix(".EXE"))
            .unwrap_or(name);
        for pf in [
            env::var("ProgramFiles").unwrap_or_default(),
            env::var("ProgramFiles(x86)").unwrap_or_default(),
            env::var("LOCALAPPDATA").unwrap_or_default(),
        ] {
            if pf.is_empty() {
                continue;
            }
            let candidate = format!("{}\\{}\\{}", pf, base, name);
            if std::path::Path::new(&candidate).is_file() {
                return candidate;
            }
        }

        // Try AppData\Roaming\{base}\{name} (Telegram Desktop, etc.)
        if let Ok(appdata) = env::var("APPDATA") {
            let candidate = format!("{}\\{}\\{}", appdata, base, name);
            if std::path::Path::new(&candidate).is_file() {
                return candidate;
            }
        }

        // Try LocalAppData\Programs\{base}\{name} (VS Code pattern)
        if let Ok(local) = env::var("LOCALAPPDATA") {
            let candidate = format!("{}\\Programs\\{}\\{}", local, base, name);
            if std::path::Path::new(&candidate).is_file() {
                return candidate;
            }
        }

        // For names with spaces, try folder = full exe_name base (e.g. "Telegram Desktop")
        let exe_base = exe_name
            .strip_suffix(".exe")
            .or(exe_name.strip_suffix(".EXE"))
            .unwrap_or(exe_name);
        if exe_base != base {
            for dir in [
                env::var("APPDATA").unwrap_or_default(),
                env::var("LOCALAPPDATA").unwrap_or_default(),
                env::var("ProgramFiles").unwrap_or_default(),
                env::var("ProgramFiles(x86)").unwrap_or_default(),
            ] {
                if dir.is_empty() {
                    continue;
                }
                let candidate = format!("{}\\{}\\{}", dir, exe_base, name);
                if std::path::Path::new(&candidate).is_file() {
                    return candidate;
                }
            }
            // Also try LocalAppData\Programs with full name folder
            if let Ok(local) = env::var("LOCALAPPDATA") {
                let candidate = format!("{}\\Programs\\{}\\{}", local, exe_base, name);
                if std::path::Path::new(&candidate).is_file() {
                    return candidate;
                }
            }
        }

        // Try WindowsApps (UWP / Store app aliases)
        if let Ok(local) = env::var("LOCALAPPDATA") {
            let candidate = format!("{}\\Microsoft\\WindowsApps\\{}", local, name);
            if std::path::Path::new(&candidate).is_file() {
                return candidate;
            }
        }

        // Broad scan: search all subdirectories of common app roots for {name}
        // Handles cases like "Telegram Desktop\Telegram.exe" where folder ≠ exe name
        for root in [
            env::var("APPDATA").unwrap_or_default(),
            env::var("LOCALAPPDATA").unwrap_or_default(),
            format!("{}\\Programs", env::var("LOCALAPPDATA").unwrap_or_default()),
        ] {
            if root.is_empty() {
                continue;
            }
            if let Ok(entries) = std::fs::read_dir(&root) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        let candidate = entry.path().join(name);
                        if candidate.is_file() {
                            return candidate.to_string_lossy().to_string();
                        }
                    }
                }
            }
        }
    }

    // Store/UWP apps: scan WindowsApps subdirectories for matching exe
    // Handles apps like WindowsTerminal.exe living in package folders
    if let Ok(local) = env::var("LOCALAPPDATA") {
        let apps_dir = format!("{}\\Microsoft\\WindowsApps", local);
        if let Ok(entries) = std::fs::read_dir(&apps_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    for name in &names {
                        let candidate = entry.path().join(name);
                        if candidate.is_file() {
                            return candidate.to_string_lossy().to_string();
                        }
                    }
                }
            }
        }
    }

    // Store/UWP apps: query via PowerShell Get-AppxPackage (last resort, ~200ms)
    // Searches recursively because some apps put exe in subdirectories (e.g. Craft → app\Craft.exe)
    {
        let base = exe_name
            .strip_suffix(".exe")
            .or(exe_name.strip_suffix(".EXE"))
            .unwrap_or(exe_name);
        // Sanitize: only allow safe characters to prevent PowerShell injection
        let is_safe = |s: &str| {
            s.chars()
                .all(|c| c.is_alphanumeric() || " ._-()".contains(c))
        };
        if is_safe(base) && is_safe(exe_name) {
            let ps_result = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-NoLogo",
                    "-Command",
                    &format!(
                        "Get-AppxPackage -Name '*{}*' | Select-Object -First 1 -ExpandProperty InstallLocation | ForEach-Object {{ Get-ChildItem $_ -Recurse -Filter '{}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }}",
                        base,
                        exe_name
                    ),
                ])
                .output();
            if let Ok(output) = ps_result {
                let found_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !found_path.is_empty() && std::path::Path::new(&found_path).is_file() {
                    info!(exe_name = %exe_name, path = %found_path, "find_exe_path: found via Get-AppxPackage");
                    return found_path;
                }
            }
        }
    }

    // Fallback: just return the exe_name, SHGetFileInfo might still find it
    info!(exe_name = %exe_name, "find_exe_path: no match found, using exe_name as-is");
    exe_name.to_string()
}

/// Encode raw RGBA pixels as a base64 PNG (icon-sized; uses the `image` crate).
#[cfg(target_os = "windows")]
fn encode_png_base64(pixels: &[u8], width: u32, height: u32) -> Option<String> {
    use base64::Engine;
    let img: image::ImageBuffer<image::Rgba<u8>, Vec<u8>> =
        image::ImageBuffer::from_raw(width, height, pixels.to_vec())?;
    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Png).ok()?;
    Some(base64::engine::general_purpose::STANDARD.encode(out.into_inner()))
}

#[cfg(test)]
mod tests {
    #[test]
    fn encode_png_base64_produces_valid_png() {
        use base64::Engine;

        // 2x2 red pixels (RGBA)
        let pixels: Vec<u8> = vec![
            255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
        ];
        let b64 = super::encode_png_base64(&pixels, 2, 2).expect("should encode");
        let data = base64::engine::general_purpose::STANDARD
            .decode(&b64)
            .expect("valid base64");

        // PNG signature
        assert_eq!(
            &data[0..8],
            &[137, 80, 78, 71, 13, 10, 26, 10],
            "PNG signature"
        );
        // IHDR chunk type at offset 12
        assert_eq!(&data[12..16], b"IHDR");
        // Width and height in IHDR
        let width = u32::from_be_bytes(data[16..20].try_into().unwrap());
        let height = u32::from_be_bytes(data[20..24].try_into().unwrap());
        assert_eq!(width, 2);
        assert_eq!(height, 2);
        assert_eq!(data[24], 8, "bit depth");
        assert_eq!(data[25], 6, "color type RGBA");
    }

    #[test]
    fn encode_png_writes_valid_file() {
        use base64::Engine;

        // 16x16 gradient: red→green with full alpha
        let mut pixels = Vec::with_capacity(16 * 16 * 4);
        for y in 0..16u8 {
            for x in 0..16u8 {
                pixels.push(x * 16); // R
                pixels.push(y * 16); // G
                pixels.push(0); // B
                pixels.push(255); // A
            }
        }
        let b64 = super::encode_png_base64(&pixels, 16, 16).expect("should encode");
        let data = base64::engine::general_purpose::STANDARD
            .decode(&b64)
            .unwrap();

        // Write to temp file for manual inspection
        let path = std::env::temp_dir().join("beetroot_test_icon.png");
        std::fs::write(&path, &data).unwrap();
        eprintln!("PNG written to: {}", path.display());

        // Verify IDAT and IEND chunks exist
        let has_idat = data.windows(4).any(|w| w == b"IDAT");
        let has_iend = data.windows(4).any(|w| w == b"IEND");
        assert!(has_idat, "IDAT chunk must exist");
        assert!(has_iend, "IEND chunk must exist");
    }

    #[test]
    fn extract_real_icon_from_explorer() {
        // Test full icon extraction pipeline with explorer.exe (always exists)
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let explorer_path = format!("{}\\explorer.exe", system_root);
        let (display_name, icon_b64) =
            super::extract_app_icon("explorer.exe", Some(&explorer_path));
        eprintln!(
            "display_name={}, has_icon={}",
            display_name,
            icon_b64.is_some()
        );
        assert!(icon_b64.is_some(), "explorer.exe should produce an icon");
    }

    #[test]
    fn find_exe_path_finds_explorer_without_extension() {
        // "explorer" (no .exe) should resolve to C:\Windows\explorer.exe
        let path = super::find_exe_path("explorer");
        eprintln!("find_exe_path('explorer') = {}", path);
        assert!(
            path.to_lowercase().contains("explorer.exe"),
            "should find explorer.exe, got: {}",
            path
        );
    }

    #[test]
    fn find_exe_path_rejects_shadowing_directory() {
        let local_appdata = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(local_appdata.path().join("Microsoft").join("explorer")).unwrap();
        // Run the real resolver with an isolated profile, not process-global env changes.
        let output = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "commands::source_app::tests::find_exe_path_finds_explorer_without_extension",
                "--nocapture",
            ])
            .env("LOCALAPPDATA", local_appdata.path())
            .output()
            .unwrap();
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(
            output.status.success(),
            "resolver child failed:\n{stdout}\n{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(stdout.contains("1 passed; 0 failed"), "{stdout}");
    }

    #[test]
    fn extract_icon_rejects_directory_hint() {
        let _trace = tracing::subscriber::set_default(
            tracing_subscriber::fmt()
                .with_test_writer()
                .with_max_level(tracing::Level::INFO)
                .finish(),
        );
        let directory = tempfile::tempdir().unwrap();
        let expected = super::find_exe_path("explorer.exe");
        assert!(std::path::Path::new(&expected).is_file());
        assert_eq!(
            super::resolve_icon_path("explorer.exe", directory.path().to_str()),
            expected,
            "a directory is not an executable hint"
        );
        let actual = super::extract_app_icon("explorer.exe", directory.path().to_str());
        assert!(
            actual.1.is_some(),
            "resolved executable should produce an icon"
        );
    }

    #[test]
    fn resource_icon_decodes_on_workers_without_com() {
        use base64::Engine;

        let path = super::find_exe_path("explorer.exe");
        let workers: Vec<_> = (0..8)
            .map(|_| {
                let path = path.clone();
                std::thread::spawn(move || {
                    let icon =
                        super::extract_resource_icon(&path).expect("executable resource icon");
                    let png = base64::engine::general_purpose::STANDARD
                        .decode(icon)
                        .unwrap();
                    let image = image::load_from_memory(&png).unwrap();
                    assert!(image.width() > 0 && image.height() > 0);
                })
            })
            .collect();
        for worker in workers {
            worker.join().unwrap();
        }
    }

    #[test]
    fn resource_icon_rejects_missing_file_directory_and_non_icon_file() {
        let dir = tempfile::tempdir().unwrap();
        assert!(super::extract_resource_icon(dir.path().to_str().unwrap()).is_none());
        let missing = dir.path().join("missing.exe");
        assert!(super::extract_resource_icon(missing.to_str().unwrap()).is_none());
        let text = dir.path().join("no-icon.exe");
        std::fs::write(&text, b"not an executable").unwrap();
        assert!(super::extract_resource_icon(text.to_str().unwrap()).is_none());
    }

    #[test]
    fn find_exe_path_finds_ticktick() {
        // TickTick is in Program Files (x86)\TickTick\TickTick.exe
        let path = super::find_exe_path("TickTick");
        eprintln!("find_exe_path('TickTick') = {}", path);
        // If TickTick is installed, should find it; otherwise just returns "TickTick"
        if std::path::Path::new(r"C:\Program Files (x86)\TickTick\TickTick.exe").exists() {
            assert!(
                path.to_lowercase().contains("ticktick.exe"),
                "should find TickTick.exe, got: {}",
                path
            );
        }
    }

    #[test]
    fn extract_icon_for_name_without_exe() {
        // "explorer" (no .exe) should still produce an icon via find_exe_path
        let (display_name, icon_b64) = super::extract_app_icon("explorer", None);
        eprintln!(
            "explorer (no .exe): display_name={}, has_icon={}",
            display_name,
            icon_b64.is_some()
        );
        assert!(
            icon_b64.is_some(),
            "explorer without .exe should produce an icon"
        );
    }

    #[test]
    fn extract_icon_on_fresh_worker_threads() {
        use base64::Engine;

        let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
        let workers: Vec<_> = (0..8)
            .map(|_| {
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    for _ in 0..4 {
                        let (_, icon) = super::extract_app_icon("explorer", None);
                        let png = base64::engine::general_purpose::STANDARD
                            .decode(icon.expect("worker should extract an icon"))
                            .unwrap();
                        let image = image::load_from_memory(&png).unwrap();
                        assert!(image.width() > 0 && image.height() > 0);
                    }
                })
            })
            .collect();
        for worker in workers {
            worker.join().unwrap();
        }
    }

    #[test]
    fn extract_icon_preserves_callers_com_apartment() {
        use windows::Win32::Foundation::S_OK;
        use windows::Win32::System::Com::{
            CoGetApartmentType, CoInitializeEx, CoUninitialize, APTTYPE, APTTYPEQUALIFIER,
            COINIT_APARTMENTTHREADED, COINIT_MULTITHREADED,
        };

        for (model, other_model) in [
            (COINIT_APARTMENTTHREADED, COINIT_MULTITHREADED),
            (COINIT_MULTITHREADED, COINIT_APARTMENTTHREADED),
        ] {
            std::thread::spawn(move || {
                // SAFETY: All COM operations stay on this dedicated thread. Each
                // successful initialization is balanced before the thread exits.
                unsafe {
                    assert_eq!(CoInitializeEx(None, model), S_OK);
                    let mut original = APTTYPE::default();
                    let mut original_qualifier = APTTYPEQUALIFIER::default();
                    CoGetApartmentType(&mut original, &mut original_qualifier).unwrap();
                    let (_, icon) = super::extract_app_icon("explorer", None);
                    let mut actual = APTTYPE::default();
                    let mut qualifier = APTTYPEQUALIFIER::default();
                    let apartment_result = CoGetApartmentType(&mut actual, &mut qualifier);
                    CoUninitialize();
                    let switched = CoInitializeEx(None, other_model);
                    if switched.is_ok() {
                        CoUninitialize();
                    }
                    assert!(icon.is_some(), "initialized caller should get an icon");
                    apartment_result.unwrap();
                    assert_eq!(actual, original, "caller's apartment must be preserved");
                    assert_eq!(qualifier, original_qualifier);
                    assert_eq!(
                        switched, S_OK,
                        "icon extraction must not leak a COM reference"
                    );
                }
            })
            .join()
            .unwrap();
        }
    }

    #[test]
    fn encode_png_base64_rejects_wrong_size() {
        let pixels = vec![0u8; 10]; // wrong size for any w*h*4
        assert!(super::encode_png_base64(&pixels, 2, 2).is_none());
    }

    #[test]
    fn encode_png_base64_roundtrips_via_image_crate() {
        use base64::Engine;
        let px: Vec<u8> = vec![
            255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128,
        ]; // 2x2 RGBA
        let b64 = super::encode_png_base64(&px, 2, 2).unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .unwrap();
        let img = image::load_from_memory(&bytes).unwrap().to_rgba8();
        assert_eq!(img.dimensions(), (2, 2));
        assert_eq!(img.into_raw(), px);
    }

    #[test]
    fn derive_name_strips_parenthetical_and_version() {
        assert_eq!(
            super::derive_app_name_from_title("Screaming Frog SEO Spider 23.3 (Licensed)"),
            "Screaming Frog SEO Spider"
        );
    }

    #[test]
    fn derive_name_strips_multiple_parentheticals() {
        assert_eq!(
            super::derive_app_name_from_title("IntelliJ IDEA 2025.1 (Community Edition)"),
            "IntelliJ IDEA"
        );
    }

    #[test]
    fn derive_name_dash_pattern() {
        assert_eq!(
            super::derive_app_name_from_title("Document.txt - Notepad"),
            "Notepad"
        );
    }

    #[test]
    fn derive_name_dash_then_strip() {
        // Real Screaming Frog title: dash pattern + version + parenthetical
        assert_eq!(
            super::derive_app_name_from_title(
                "Untitled - Screaming Frog SEO Spider 23.3 (Licensed)"
            ),
            "Screaming Frog SEO Spider"
        );
    }

    #[test]
    fn derive_name_plain_title() {
        assert_eq!(super::derive_app_name_from_title("Telegram"), "Telegram");
    }
}
