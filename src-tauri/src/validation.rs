//! Path validation: canonicalizes the longest existing ancestor (symlink/junction
//! aware), strips Windows \\?\ prefixes, rejects UNC and system directories.

use std::path::PathBuf;

/// Blocked system-critical directories (lowercased).
pub(crate) const BLOCKED_DIRS: &[&str] = &[
    "c:\\windows",
    "c:\\program files",
    "c:\\program files (x86)",
    "c:\\programdata",
    "c:\\users\\all users",
    "c:\\$",
];

/// Canonicalize a non-existent path by finding the longest existing ancestor,
/// canonicalizing it, and appending the remaining components.
/// This prevents symlink/junction bypasses on non-existent paths.
fn canonicalize_with_ancestors(path: &PathBuf) -> Result<PathBuf, String> {
    let mut existing = path.clone();
    let mut remaining = Vec::new();
    let mut iterations = 0;
    const MAX_ITERATIONS: usize = 256;

    // Walk up until we find an ancestor that exists
    loop {
        iterations += 1;
        if iterations > MAX_ITERATIONS {
            return Err("Path too deeply nested to resolve".to_string());
        }
        if existing.exists() {
            let canonical_base = existing.canonicalize().map_err(|e| e.to_string())?;
            // Append all remaining components on top of the canonical base
            let mut result = canonical_base;
            for component in remaining.iter().rev() {
                result = result.join(component);
            }
            return Ok(result);
        }
        match existing.file_name() {
            Some(name) => {
                remaining.push(name.to_os_string());
                existing = existing
                    .parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| existing.clone());
            }
            None => {
                // Reached the root or an unresolvable path; return the original
                return Ok(path.clone());
            }
        }
        // Safety: if we've popped to root and it doesn't exist, bail out
        if existing == *path {
            return Ok(path.clone());
        }
    }
}

/// Validate that a data path is safe to use (not a system directory, not UNC, not root).
pub fn validate_data_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    // Block UNC/network paths
    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err("Network paths are not supported".to_string());
    }

    let p = PathBuf::from(trimmed);

    let canonical = if p.exists() {
        p.canonicalize().map_err(|e| e.to_string())?
    } else {
        // For non-existent paths, canonicalize the longest existing ancestor
        // and append remaining components. This prevents symlink/junction bypasses
        // where an attacker creates a symlink pointing to a blocked directory.
        canonicalize_with_ancestors(&p)?
    };

    let mut path_str = canonical.to_string_lossy().to_lowercase();
    // Strip Windows extended path prefix (\\?\) added by canonicalize
    if path_str.starts_with("\\\\?\\") {
        path_str = path_str[4..].to_string();
    }

    for b in BLOCKED_DIRS {
        if path_str.starts_with(b) {
            return Err(format!("Cannot use system directory: {}", b));
        }
    }

    // Block root directories (e.g. "C:\")
    if path_str.len() <= 3 && path_str.contains(':') {
        return Err("Cannot use drive root as data directory".to_string());
    }

    // Strip \\?\ prefix from canonical path for clean return value
    let clean = if canonical.to_string_lossy().starts_with("\\\\?\\") {
        PathBuf::from(&canonical.to_string_lossy()[4..])
    } else {
        canonical
    };
    Ok(clean)
}

/// Check that a data path is safe (non-validating variant for startup checks).
pub fn is_safe_data_path(path: &str) -> bool {
    validate_data_path(path).is_ok()
}

const CLOUD_SYNC_MARKERS: &[(&str, &str)] = &[
    ("onedrive", "OneDrive"),
    ("dropbox", "Dropbox"),
    ("google drive", "Google Drive"),
    ("icloud", "iCloud"),
];

/// Check if path is inside a cloud sync folder. Returns service name or None.
pub fn detect_cloud_sync(path: &str) -> Option<&'static str> {
    let lower = path.to_lowercase();
    for (pattern, service) in CLOUD_SYNC_MARKERS {
        // Require path separator before pattern, and word boundary after
        // (not alphanumeric/underscore) to avoid false positives like "onedrive_backup"
        for sep in ['\\', '/'] {
            let needle = format!("{}{}", sep, pattern);
            if let Some(pos) = lower.find(&needle) {
                let after = pos + needle.len();
                if after >= lower.len() || !is_word_char(lower.as_bytes()[after]) {
                    return Some(service);
                }
            }
        }
    }
    None
}

/// Check if a byte is alphanumeric or underscore (word character).
fn is_word_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// Validate that a path is inside the given images directory (prevent path traversal).
pub fn validate_image_path(images_dir: &std::path::Path, path: &str) -> Result<PathBuf, String> {
    let canonical_images = images_dir.canonicalize().map_err(|e| e.to_string())?;
    let target = PathBuf::from(path);
    let canonical_target = target
        .canonicalize()
        .map_err(|_| "File not found".to_string())?;
    if !canonical_target.starts_with(&canonical_images) {
        return Err("Access denied: path outside images directory".to_string());
    }
    Ok(canonical_target)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- validate_data_path ---

    #[test]
    fn rejects_empty_path() {
        assert!(validate_data_path("").is_err());
        assert!(validate_data_path("   ").is_err());
    }

    #[test]
    fn rejects_unc_paths() {
        assert!(validate_data_path("\\\\server\\share").is_err());
        assert!(validate_data_path("//server/share").is_err());
    }

    #[test]
    fn rejects_system_directories() {
        assert!(validate_data_path("C:\\Windows\\Temp").is_err());
        assert!(validate_data_path("c:\\windows\\system32").is_err());
        assert!(validate_data_path("C:\\Program Files\\App").is_err());
        assert!(validate_data_path("c:\\program files (x86)\\App").is_err());
        assert!(validate_data_path("C:\\ProgramData\\App").is_err());
    }

    #[test]
    fn rejects_drive_roots() {
        assert!(validate_data_path("C:\\").is_err());
        assert!(validate_data_path("D:\\").is_err());
    }

    #[test]
    fn accepts_valid_paths() {
        // These paths don't need to exist for the non-canonicalizing branch
        let result = validate_data_path("D:\\MyData\\Beetroot");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PathBuf::from("D:\\MyData\\Beetroot"));
    }

    // --- is_safe_data_path ---

    #[test]
    fn is_safe_mirrors_validate() {
        assert!(!is_safe_data_path(""));
        assert!(!is_safe_data_path("C:\\Windows"));
        assert!(is_safe_data_path("D:\\safe\\path"));
    }

    // --- validate_image_path ---

    #[test]
    fn rejects_nonexistent_image_file() {
        let images_dir = std::env::temp_dir().join("cliptest_img");
        std::fs::create_dir_all(&images_dir).ok();
        let result = validate_image_path(&images_dir, "/nonexistent/file.png");
        assert!(result.is_err());
        std::fs::remove_dir_all(&images_dir).ok();
    }

    #[test]
    fn rejects_path_outside_images_dir() {
        let images_dir = std::env::temp_dir().join("cliptest_img2");
        std::fs::create_dir_all(&images_dir).ok();
        // Create a file outside images dir
        let outside = std::env::temp_dir().join("cliptest_outside.txt");
        std::fs::write(&outside, "test").ok();
        let result = validate_image_path(&images_dir, &outside.to_string_lossy());
        assert!(result.is_err());
        std::fs::remove_file(&outside).ok();
        std::fs::remove_dir_all(&images_dir).ok();
    }

    #[test]
    fn accepts_file_inside_images_dir() {
        let images_dir = std::env::temp_dir().join("cliptest_img3");
        std::fs::create_dir_all(&images_dir).ok();
        let file_inside = images_dir.join("test.png");
        std::fs::write(&file_inside, "fake png").ok();
        let result = validate_image_path(&images_dir, &file_inside.to_string_lossy());
        assert!(result.is_ok());
        std::fs::remove_dir_all(&images_dir).ok();
    }

    // --- detect_cloud_sync ---

    #[test]
    fn detects_onedrive_personal() {
        assert_eq!(
            detect_cloud_sync("C:\\Users\\Admin\\OneDrive\\Documents\\Data"),
            Some("OneDrive")
        );
    }

    #[test]
    fn detects_onedrive_business() {
        assert_eq!(
            detect_cloud_sync("C:\\Users\\Admin\\OneDrive - Company\\Data"),
            Some("OneDrive")
        );
    }

    #[test]
    fn detects_dropbox() {
        assert_eq!(
            detect_cloud_sync("C:\\Users\\Admin\\Dropbox\\Projects"),
            Some("Dropbox")
        );
    }

    #[test]
    fn detects_google_drive() {
        assert_eq!(
            detect_cloud_sync("G:\\My Drive\\Google Drive\\Data"),
            Some("Google Drive")
        );
    }

    #[test]
    fn detects_case_insensitive() {
        assert_eq!(
            detect_cloud_sync("C:\\Users\\Admin\\ONEDRIVE\\Data"),
            Some("OneDrive")
        );
    }

    #[test]
    fn detects_forward_slashes() {
        assert_eq!(
            detect_cloud_sync("C:/Users/Admin/OneDrive/Data"),
            Some("OneDrive")
        );
    }

    #[test]
    fn no_false_positive_on_substring() {
        // "myonedrive" should NOT match — requires path separator before "onedrive"
        assert_eq!(
            detect_cloud_sync("C:\\Users\\Admin\\myonedrive\\Data"),
            None
        );
        // "onedrive_backup" should NOT match — underscore continues the word
        assert_eq!(detect_cloud_sync("C:\\work\\onedrive_backup\\data"), None);
    }

    #[test]
    fn no_match_on_local_path() {
        assert_eq!(detect_cloud_sync("D:\\MyData\\Beetroot"), None);
    }
}
