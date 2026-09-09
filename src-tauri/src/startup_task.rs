//! StartupTask wrapper for MSIX-packaged builds.
//!
//! Uses Windows `ApplicationModel.StartupTask` API which is the only autostart
//! mechanism Windows recognizes for MSIX packages. Run-key writes from inside
//! an MSIX sandbox are virtualized to a per-package hive and never appear in
//! the system startup list.
//!
//! Caller MUST verify `crate::is_store_package()` returns true before invoking
//! these functions — `StartupTask::GetAsync` returns an HRESULT error in
//! unpackaged processes.

use windows::core::HSTRING;
use windows::ApplicationModel::{StartupTask, StartupTaskState};

/// Must match `TaskId` in packaging/msix/AppxManifest.xml exactly.
const TASK_ID: &str = "BeetrootAutoStart";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AutostartStatus {
    Enabled,
    Disabled,
    /// User toggled the task off in Task Manager → Startup. App cannot
    /// programmatically re-enable; user must re-enable in Task Manager.
    DisabledByUser,
    /// Group policy or unsupported device. App cannot re-enable.
    DisabledByPolicy,
}

fn map_state(state: StartupTaskState) -> AutostartStatus {
    match state {
        StartupTaskState::Enabled => AutostartStatus::Enabled,
        StartupTaskState::Disabled => AutostartStatus::Disabled,
        StartupTaskState::DisabledByUser => AutostartStatus::DisabledByUser,
        StartupTaskState::DisabledByPolicy => AutostartStatus::DisabledByPolicy,
        // Admin policy enabled the task. Functionally on; Disable() may be
        // a no-op on managed devices, but the toggle reflects "currently on".
        StartupTaskState::EnabledByPolicy => AutostartStatus::Enabled,
        // Catch-all for future windows-rs variants.
        _ => AutostartStatus::Enabled,
    }
}

fn get_task() -> Result<StartupTask, String> {
    StartupTask::GetAsync(&HSTRING::from(TASK_ID))
        .map_err(|e| format!("StartupTask::GetAsync: {e}"))?
        .get()
        .map_err(|e| format!("StartupTask::GetAsync await: {e}"))
}

pub fn get_state() -> Result<AutostartStatus, String> {
    let task = get_task()?;
    let state = task.State().map_err(|e| format!("State: {e}"))?;
    Ok(map_state(state))
}

pub fn enable() -> Result<AutostartStatus, String> {
    let task = get_task()?;
    let new_state = task
        .RequestEnableAsync()
        .map_err(|e| format!("RequestEnableAsync: {e}"))?
        .get()
        .map_err(|e| format!("RequestEnableAsync await: {e}"))?;
    Ok(map_state(new_state))
}

pub fn disable() -> Result<(), String> {
    let task = get_task()?;
    task.Disable().map_err(|e| format!("Disable: {e}"))?;

    // Re-query: Disable() is a no-op when the task is EnabledByPolicy
    // (admin/group policy override). Surface that as disabled_by_policy
    // so the UI doesn't lie about what actually happened.
    let state = task
        .State()
        .map_err(|e| format!("State after Disable: {e}"))?;
    match map_state(state) {
        AutostartStatus::Enabled | AutostartStatus::DisabledByPolicy => {
            Err("disabled_by_policy".to_string())
        }
        _ => Ok(()),
    }
}
