//! MSIX-aware autostart: StartupTask API inside the Store sandbox, Run-key plugin otherwise.

/// Autostart enable: branches on MSIX context.
/// MSIX → ApplicationModel.StartupTask. Errors propagate string codes:
///   "disabled_by_user"   — user toggled off in Task Manager; cannot override.
///   "disabled_by_policy" — group policy / unsupported device.
/// Non-MSIX → forwards to `tauri-plugin-autostart` (Run key via auto-launch).
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn autostart_enable(app: tauri::AppHandle) -> Result<bool, crate::error::AppError> {
    if crate::build_profile::isolated() {
        return Err("Autostart is unavailable in development and smoke builds"
            .to_string()
            .into());
    }
    if crate::is_store_package() {
        let status = tauri::async_runtime::spawn_blocking(crate::startup_task::enable)
            .await
            .map_err(|e| format!("join error: {e}"))??;
        match status {
            crate::startup_task::AutostartStatus::Enabled => Ok(true),
            crate::startup_task::AutostartStatus::DisabledByUser => {
                Err("disabled_by_user".to_string().into())
            }
            crate::startup_task::AutostartStatus::DisabledByPolicy => {
                Err("disabled_by_policy".to_string().into())
            }
            crate::startup_task::AutostartStatus::Disabled => Err("not_enabled".to_string().into()),
        }
    } else {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch()
            .enable()
            .map_err(|e| format!("auto-launch enable: {e}"))?;
        Ok(true)
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn autostart_disable(app: tauri::AppHandle) -> Result<(), crate::error::AppError> {
    if crate::build_profile::isolated() {
        return Ok(());
    }
    if crate::is_store_package() {
        tauri::async_runtime::spawn_blocking(crate::startup_task::disable)
            .await
            .map_err(|e| crate::error::AppError::Other(format!("join error: {e}")))?
            .map_err(crate::error::AppError::Other)
    } else {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch()
            .disable()
            .map_err(|e| format!("auto-launch disable: {e}"))?;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn autostart_is_enabled(app: tauri::AppHandle) -> Result<bool, crate::error::AppError> {
    if crate::build_profile::isolated() {
        return Ok(false);
    }
    if crate::is_store_package() {
        let status = tauri::async_runtime::spawn_blocking(crate::startup_task::get_state)
            .await
            .map_err(|e| format!("join error: {e}"))??;
        Ok(matches!(
            status,
            crate::startup_task::AutostartStatus::Enabled
        ))
    } else {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch()
            .is_enabled()
            .map_err(|e| format!("auto-launch is_enabled: {e}"))
            .map_err(Into::into)
    }
}

#[cfg(all(test, target_os = "windows"))]
mod autostart_tests {
    #[test]
    fn startup_task_module_symbols_exist() {
        // Compile-time assertion: the symbols Task 5 depends on exist.
        // Catches accidental future removal of the module.
        let _ = crate::startup_task::get_state;
        let _ = crate::startup_task::enable;
        let _ = crate::startup_task::disable;
    }

    #[test]
    fn autostart_error_codes_serialize_bare() {
        let e: crate::error::AppError = "disabled_by_user".to_string().into();
        assert_eq!(serde_json::to_string(&e).unwrap(), "\"disabled_by_user\"");
    }
}
