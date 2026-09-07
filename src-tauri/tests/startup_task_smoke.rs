#![cfg(target_os = "windows")]

//! Smoke test: cargo test runs unpackaged, so StartupTask::GetAsync should
//! return an error which our wrapper maps to Err. We don't assert on Enabled —
//! that requires a packaged sideload (manual verification per Task 12).

use beetroot_lib::startup_task;

#[test]
fn get_state_in_unpackaged_process_returns_err() {
    let result = startup_task::get_state();
    assert!(
        result.is_err(),
        "unpackaged process should fail StartupTask::GetAsync, got {:?}",
        result
    );
}
