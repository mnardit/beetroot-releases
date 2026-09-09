//! Text recognition via the Windows.Media.Ocr WinRT API.

use crate::error::AppError;
use tracing::{error, info};
use windows::core::HSTRING;
use windows::Graphics::Imaging::{BitmapDecoder, BitmapPixelFormat, SoftwareBitmap};
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;

/// Recognize text in an image file using the Windows OCR API.
///
/// Runs blocking WinRT calls on a dedicated thread to avoid blocking the IPC thread.
/// Requires Windows 10+ with at least one language pack installed.
pub fn recognize_text(image_path: &str) -> Result<String, AppError> {
    info!(path = image_path, "starting OCR");

    let path = HSTRING::from(image_path);

    let file = StorageFile::GetFileFromPathAsync(&path)
        .and_then(|op| op.get())
        .map_err(|e| {
            error!(error = %e, "OCR: failed to open file");
            AppError::Other(format!("OCR open file: {}", e))
        })?;

    let stream = file.OpenReadAsync().and_then(|op| op.get()).map_err(|e| {
        error!(error = %e, "OCR: failed to read stream");
        AppError::Other(format!("OCR read stream: {}", e))
    })?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .and_then(|op| op.get())
        .map_err(|e| {
            error!(error = %e, "OCR: failed to decode image");
            AppError::Other(format!("OCR decode image: {}", e))
        })?;

    let raw_bitmap = decoder
        .GetSoftwareBitmapAsync()
        .and_then(|op| op.get())
        .map_err(|e| {
            error!(error = %e, "OCR: failed to get bitmap");
            AppError::Other(format!("OCR get bitmap: {}", e))
        })?;

    // OCR engine requires BGRA8 pixel format — convert from whatever the decoder produced
    let bitmap = SoftwareBitmap::Convert(&raw_bitmap, BitmapPixelFormat::Bgra8).map_err(|e| {
        error!(error = %e, "OCR: failed to convert bitmap to BGRA8");
        AppError::Other(format!("OCR convert bitmap: {}", e))
    })?;

    // TryCreateFromUserProfileLanguages returns Ok(null) on Win10 without language packs.
    // The windows crate wraps null COM pointers — subsequent method calls will return E_POINTER.
    // We catch this at RecognizeAsync and give a clear error message.
    let engine = OcrEngine::TryCreateFromUserProfileLanguages().map_err(|e| {
        error!(error = %e, "OCR: no language packs available");
        AppError::Other(
            "OCR unavailable: no language packs installed. Add a language in Windows Settings → Language.".to_string(),
        )
    })?;

    let result = engine
        .RecognizeAsync(&bitmap)
        .and_then(|op| op.get())
        .map_err(|e| {
            error!(error = %e, "OCR: recognition failed");
            // E_POINTER (0x80004003) indicates null engine — no language packs
            if e.code().0 as u32 == 0x80004003 {
                AppError::Other(
                    "OCR unavailable: no language packs installed. Add a language in Windows Settings → Language."
                        .to_string(),
                )
            } else {
                AppError::Other(format!("OCR recognition: {}", e))
            }
        })?;

    let text = result.Text().map_err(|e| {
        error!(error = %e, "OCR: failed to get text");
        AppError::Other(format!("OCR get text: {}", e))
    })?;

    info!(text_len = text.len(), "OCR complete");
    Ok(text.to_string())
}
