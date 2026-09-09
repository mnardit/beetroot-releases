use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

use beetroot_lib::validation::{is_safe_data_path, validate_data_path, validate_image_path};

// --- validate_image_path with real temp directories ---

#[test]
fn image_path_accepts_file_in_images_dir() {
    let tmp = TempDir::new().unwrap();
    let images_dir = tmp.path().join("images");
    fs::create_dir_all(&images_dir).unwrap();
    let file = images_dir.join("test.png");
    fs::write(&file, b"fake png data").unwrap();

    let result = validate_image_path(&images_dir, &file.to_string_lossy());
    assert!(result.is_ok());
}

#[test]
fn image_path_accepts_file_in_subdirectory() {
    let tmp = TempDir::new().unwrap();
    let images_dir = tmp.path().join("images");
    let sub_dir = images_dir.join("2026-02");
    fs::create_dir_all(&sub_dir).unwrap();
    let file = sub_dir.join("abcdef1234567890.png");
    fs::write(&file, b"fake png data").unwrap();

    let result = validate_image_path(&images_dir, &file.to_string_lossy());
    assert!(result.is_ok());
}

#[test]
fn image_path_rejects_file_outside_images_dir() {
    let tmp = TempDir::new().unwrap();
    let images_dir = tmp.path().join("images");
    fs::create_dir_all(&images_dir).unwrap();

    let outside_file = tmp.path().join("outside.png");
    fs::write(&outside_file, b"not in images").unwrap();

    let result = validate_image_path(&images_dir, &outside_file.to_string_lossy());
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("outside"));
}

#[test]
fn image_path_rejects_path_traversal() {
    let tmp = TempDir::new().unwrap();
    let images_dir = tmp.path().join("images");
    fs::create_dir_all(&images_dir).unwrap();

    let outside_file = tmp.path().join("secret.txt");
    fs::write(&outside_file, b"secret data").unwrap();

    // Try path traversal via ../
    let traversal_path = images_dir.join("..").join("secret.txt");
    let result = validate_image_path(&images_dir, &traversal_path.to_string_lossy());
    assert!(result.is_err());
}

#[test]
fn image_path_rejects_nonexistent_file() {
    let tmp = TempDir::new().unwrap();
    let images_dir = tmp.path().join("images");
    fs::create_dir_all(&images_dir).unwrap();

    let result = validate_image_path(&images_dir, "/nonexistent/file.png");
    assert!(result.is_err());
}

// --- File write + read + delete operations ---

#[test]
fn write_read_delete_cycle() {
    let tmp = TempDir::new().unwrap();
    let images_dir = tmp.path().join("images").join("2026-02");
    fs::create_dir_all(&images_dir).unwrap();

    let file_path = images_dir.join("abcdef1234567890.png");

    // Write
    let data = b"PNG fake image data for testing";
    fs::write(&file_path, data).unwrap();
    assert!(file_path.exists());

    // Read
    let read_data = fs::read(&file_path).unwrap();
    assert_eq!(read_data, data);

    // Delete
    fs::remove_file(&file_path).unwrap();
    assert!(!file_path.exists());
}

#[test]
fn atomic_write_with_rename() {
    let tmp = TempDir::new().unwrap();
    let target = tmp.path().join("final.png");
    let temp = tmp.path().join("final.png.tmp");

    // Simulate the atomic write pattern used by save_image
    let data = b"atomic write test data";
    fs::write(&temp, data).unwrap();
    assert!(temp.exists());
    assert!(!target.exists());

    fs::rename(&temp, &target).unwrap();
    assert!(!temp.exists());
    assert!(target.exists());
    assert_eq!(fs::read(&target).unwrap(), data);
}

// --- validate_data_path ---

#[test]
fn data_path_rejects_empty_and_whitespace() {
    assert!(validate_data_path("").is_err());
    assert!(validate_data_path("   ").is_err());
}

#[test]
fn data_path_rejects_unc_paths() {
    assert!(validate_data_path("\\\\server\\share").is_err());
    assert!(validate_data_path("//server/share").is_err());
}

#[test]
fn data_path_rejects_system_dirs() {
    assert!(validate_data_path("C:\\Windows\\Temp").is_err());
    assert!(validate_data_path("C:\\Program Files\\App").is_err());
    assert!(validate_data_path("C:\\ProgramData\\App").is_err());
}

#[test]
fn data_path_accepts_valid_directory() {
    let tmp = TempDir::new().unwrap();
    let result = validate_data_path(&tmp.path().to_string_lossy());
    assert!(result.is_ok());
}

#[test]
fn is_safe_mirrors_validate() {
    assert!(!is_safe_data_path(""));
    assert!(!is_safe_data_path("C:\\Windows"));

    let tmp = TempDir::new().unwrap();
    assert!(is_safe_data_path(&tmp.path().to_string_lossy()));
}

// --- Image directory structure ---

#[test]
fn nested_image_directory_structure() {
    let tmp = TempDir::new().unwrap();
    let images_dir = tmp.path().join("images");
    let month_dir = images_dir.join("2026-02");
    fs::create_dir_all(&month_dir).unwrap();

    // Write multiple files
    for i in 0..5 {
        let hash = format!("{:016x}", i);
        let file = month_dir.join(format!("{}.png", hash));
        fs::write(&file, format!("image data {}", i)).unwrap();
    }

    // Verify all files exist
    let files: Vec<PathBuf> = fs::read_dir(&month_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();
    assert_eq!(files.len(), 5);

    // Validate each is inside images_dir
    for file in &files {
        let result = validate_image_path(&images_dir, &file.to_string_lossy());
        assert!(result.is_ok(), "Expected {:?} to be valid", file);
    }
}

// --- check_data_path_relationship ---

use beetroot_lib::check_data_path_relationship;

#[test]
fn data_path_rejects_new_inside_current() {
    let tmp = TempDir::new().unwrap();
    let current = tmp.path().to_path_buf();
    let new = tmp.path().join("subdir");
    fs::create_dir_all(&new).unwrap();

    let current_canon = current.canonicalize().unwrap();
    let new_canon = new.canonicalize().unwrap();

    let result = check_data_path_relationship(&current_canon, &new_canon);
    assert!(result.is_err());
}

#[test]
fn data_path_rejects_current_inside_new() {
    let tmp = TempDir::new().unwrap();
    let new = tmp.path().to_path_buf();
    let current = tmp.path().join("subdir");
    fs::create_dir_all(&current).unwrap();

    let current_canon = current.canonicalize().unwrap();
    let new_canon = new.canonicalize().unwrap();

    let result = check_data_path_relationship(&current_canon, &new_canon);
    assert!(result.is_err());
}

#[test]
fn data_path_accepts_unrelated_paths() {
    let tmp1 = TempDir::new().unwrap();
    let tmp2 = TempDir::new().unwrap();

    let current_canon = tmp1.path().canonicalize().unwrap();
    let new_canon = tmp2.path().canonicalize().unwrap();

    let result = check_data_path_relationship(&current_canon, &new_canon);
    assert!(result.is_ok());
}

// --- read_clipboard_image_file size cap ---

use beetroot_lib::read_clipboard_image_file;

#[tokio::test]
async fn clipboard_image_file_rejects_over_cap() {
    let tmp = TempDir::new().unwrap();
    let big = tmp.path().join("big.png");
    // 8 MB > new 7.5 MB cap
    fs::write(&big, vec![0u8; 8 * 1024 * 1024]).unwrap();

    let result = read_clipboard_image_file(big.to_string_lossy().to_string()).await;
    assert!(result.is_err(), "expected rejection of 8MB file");
    let err = format!("{:?}", result.unwrap_err());
    assert!(
        err.contains("too large"),
        "expected 'too large' in error: {}",
        err
    );
}

#[tokio::test]
async fn clipboard_image_file_accepts_under_cap() {
    let tmp = TempDir::new().unwrap();
    let small = tmp.path().join("small.png");
    // 5 MB < 7.5 MB cap
    fs::write(&small, vec![0u8; 5 * 1024 * 1024]).unwrap();

    let result = read_clipboard_image_file(small.to_string_lossy().to_string()).await;
    assert!(
        result.is_ok(),
        "expected acceptance of 5MB file: {:?}",
        result
    );
}
