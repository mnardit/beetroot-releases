//! Shortcut parsing (legacy "Ctrl+V" + new "Ctrl+KeyV") and RegisterHotKey IPC.

use keyboard_types::{Code, Modifiers};
use tauri::Manager;
use tracing::{info, warn};

use crate::error::AppError;
use crate::hotkey::{self, HotkeyManager};

pub struct PlainTextShortcut(pub parking_lot::Mutex<String>);

pub(crate) trait ShortcutRegistrar {
    fn register(&self, id: i32, modifiers: u32, code: Code) -> Result<(), String>;
    fn unregister(&self, id: i32) -> Result<(), String>;
}

impl ShortcutRegistrar for HotkeyManager {
    fn register(&self, id: i32, modifiers: u32, code: Code) -> Result<(), String> {
        self.register(id, modifiers, code)
    }
    fn unregister(&self, id: i32) -> Result<(), String> {
        self.unregister(id)
    }
}

pub(crate) fn initialize_main_shortcut(
    manager: &impl ShortcutRegistrar,
) -> crate::CurrentShortcutStr {
    let shortcut = match manager.register(
        hotkey::ID_MAIN_PRIMARY,
        hotkey::MOD_CONTROL,
        Code::Backquote,
    ) {
        Ok(()) => "Ctrl+Backquote",
        Err(e) => {
            warn!(error = %e, "failed to register default hotkey Ctrl+Backquote");
            ""
        }
    };
    crate::CurrentShortcutStr(parking_lot::Mutex::new(shortcut.to_string()))
}

#[tauri::command]
pub fn retry_no_focus_navigation(app: tauri::AppHandle, vk: u32, generation: u64) {
    hotkey::retry_no_focus_navigation(app, vk, generation);
}

/// Parsed hotkey definition (replaces tauri_plugin_global_shortcut::Shortcut).
#[derive(Debug, Clone, PartialEq)]
struct HotkeyDef {
    code: Code,
    modifiers: Modifiers,
}

fn parse_shortcut(shortcut_str: &str) -> Result<HotkeyDef, AppError> {
    if shortcut_str.len() > 50 {
        return Err(AppError::Validation("Shortcut string too long".to_string()));
    }

    let parts: Vec<&str> = shortcut_str.split('+').map(|s| s.trim()).collect();
    let mut modifiers = Modifiers::empty();
    let mut code: Option<Code> = None;

    for part in &parts {
        match part.to_lowercase().as_str() {
            // Modifiers
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" | "altgr" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "super" | "win" | "cmd" => modifiers |= Modifiers::META,
            // Letters A-Z (single letter legacy + e.code format)
            "a" | "keya" => code = Some(Code::KeyA),
            "b" | "keyb" => code = Some(Code::KeyB),
            "c" | "keyc" => code = Some(Code::KeyC),
            "d" | "keyd" => code = Some(Code::KeyD),
            "e" | "keye" => code = Some(Code::KeyE),
            "f" if code.is_none() => code = Some(Code::KeyF),
            "keyf" => code = Some(Code::KeyF),
            "g" | "keyg" => code = Some(Code::KeyG),
            "h" | "keyh" => code = Some(Code::KeyH),
            "i" | "keyi" => code = Some(Code::KeyI),
            "j" | "keyj" => code = Some(Code::KeyJ),
            "k" | "keyk" => code = Some(Code::KeyK),
            "l" | "keyl" => code = Some(Code::KeyL),
            "m" | "keym" => code = Some(Code::KeyM),
            "n" | "keyn" => code = Some(Code::KeyN),
            "o" | "keyo" => code = Some(Code::KeyO),
            "p" | "keyp" => code = Some(Code::KeyP),
            "q" | "keyq" => code = Some(Code::KeyQ),
            "r" | "keyr" => code = Some(Code::KeyR),
            "s" | "keys" => code = Some(Code::KeyS),
            "t" | "keyt" => code = Some(Code::KeyT),
            "u" | "keyu" => code = Some(Code::KeyU),
            "v" | "keyv" => code = Some(Code::KeyV),
            "w" | "keyw" => code = Some(Code::KeyW),
            "x" | "keyx" => code = Some(Code::KeyX),
            "y" | "keyy" => code = Some(Code::KeyY),
            "z" | "keyz" => code = Some(Code::KeyZ),
            // Digits 0-9 (legacy + e.code format)
            "0" | "digit0" => code = Some(Code::Digit0),
            "1" | "digit1" => code = Some(Code::Digit1),
            "2" | "digit2" => code = Some(Code::Digit2),
            "3" | "digit3" => code = Some(Code::Digit3),
            "4" | "digit4" => code = Some(Code::Digit4),
            "5" | "digit5" => code = Some(Code::Digit5),
            "6" | "digit6" => code = Some(Code::Digit6),
            "7" | "digit7" => code = Some(Code::Digit7),
            "8" | "digit8" => code = Some(Code::Digit8),
            "9" | "digit9" => code = Some(Code::Digit9),
            // Function keys
            "f1" => code = Some(Code::F1),
            "f2" => code = Some(Code::F2),
            "f3" => code = Some(Code::F3),
            "f4" => code = Some(Code::F4),
            "f5" => code = Some(Code::F5),
            "f6" => code = Some(Code::F6),
            "f7" => code = Some(Code::F7),
            "f8" => code = Some(Code::F8),
            "f9" => code = Some(Code::F9),
            "f10" => code = Some(Code::F10),
            "f11" => code = Some(Code::F11),
            "f12" => code = Some(Code::F12),
            // Special keys
            "`" | "backquote" => code = Some(Code::Backquote),
            "space" => code = Some(Code::Space),
            // Punctuation keys (QWERTY symbols for legacy + e.code names)
            ";" | "semicolon" => code = Some(Code::Semicolon),
            "," | "comma" => code = Some(Code::Comma),
            "." | "period" => code = Some(Code::Period),
            "/" | "slash" => code = Some(Code::Slash),
            "-" | "minus" => code = Some(Code::Minus),
            "=" | "equal" => code = Some(Code::Equal),
            "[" | "bracketleft" => code = Some(Code::BracketLeft),
            "]" | "bracketright" => code = Some(Code::BracketRight),
            "\\" | "backslash" => code = Some(Code::Backslash),
            "'" | "quote" => code = Some(Code::Quote),
            "<" | "intlbackslash" => code = Some(Code::IntlBackslash),
            _ => return Err(AppError::Validation("Invalid shortcut".to_string())),
        }
    }

    let code =
        code.ok_or_else(|| AppError::Validation("No key specified in shortcut".to_string()))?;
    if !modifiers.intersects(Modifiers::CONTROL | Modifiers::ALT | Modifiers::META) {
        return Err(AppError::Validation(
            "Shortcut requires Ctrl, Alt or Win; Shift alone is reserved for typing".to_string(),
        ));
    }
    Ok(HotkeyDef { code, modifiers })
}

/// Returns true if the shortcut uses Alt without Ctrl (needs AltGr companion).
fn needs_altgr_variant(def: &HotkeyDef) -> bool {
    def.modifiers.contains(Modifiers::ALT) && !def.modifiers.contains(Modifiers::CONTROL)
}

/// Register a hotkey with the HotkeyManager, including optional AltGr variant.
/// `primary_id` and `altgr_id` are the fixed hotkey IDs to use.
fn register_with_variants(
    manager: &impl ShortcutRegistrar,
    def: &HotkeyDef,
    primary_id: i32,
    altgr_id: i32,
) -> Result<(), String> {
    let win_mods = hotkey::parse_modifiers_to_win(def.modifiers);
    manager.register(primary_id, win_mods, def.code)?;

    if needs_altgr_variant(def) {
        let altgr_mods = win_mods | hotkey::MOD_CONTROL;
        if let Err(e) = manager.register(altgr_id, altgr_mods, def.code) {
            // Rollback primary
            manager.unregister(primary_id)?;
            return Err(e);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn change_hotkey(app: tauri::AppHandle, shortcut_str: String) -> Result<(), AppError> {
    info!(shortcut = %shortcut_str, "changing hotkey");
    parse_shortcut(&shortcut_str)?;
    let manager = app.state::<HotkeyManager>();
    let current = app.state::<crate::CurrentShortcutStr>();
    let mut current = current.0.lock();
    replace_shortcut(
        &*manager,
        &mut current,
        &shortcut_str,
        hotkey::ID_MAIN_PRIMARY,
        hotkey::ID_MAIN_ALTGR,
    )
    .map(|_| ())
}

#[tauri::command]
pub async fn register_plain_text_hotkey(
    app: tauri::AppHandle,
    shortcut_str: String,
) -> Result<(), AppError> {
    info!(shortcut = %shortcut_str, "registering plain text hotkey");
    parse_shortcut(&shortcut_str)?;
    let manager = app.state::<HotkeyManager>();
    let current = app.state::<PlainTextShortcut>();
    let mut current = current.0.lock();
    replace_shortcut(
        &*manager,
        &mut current,
        &shortcut_str,
        hotkey::ID_PLAIN_PRIMARY,
        hotkey::ID_PLAIN_ALTGR,
    )
    .map(|_| ())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HotkeyAction {
    Main,
    PlainText,
}

/// Replace or clear a registration, returning its predecessor under the same lock.
#[tauri::command]
pub async fn replace_hotkey(
    app: tauri::AppHandle,
    action: HotkeyAction,
    shortcut_str: String,
) -> Result<String, AppError> {
    let manager = app.state::<HotkeyManager>();
    match action {
        HotkeyAction::Main => {
            let current = app.state::<crate::CurrentShortcutStr>();
            let mut current = current.0.lock();
            replace_shortcut(
                &*manager,
                &mut current,
                &shortcut_str,
                hotkey::ID_MAIN_PRIMARY,
                hotkey::ID_MAIN_ALTGR,
            )
        }
        HotkeyAction::PlainText => {
            let current = app.state::<PlainTextShortcut>();
            let mut current = current.0.lock();
            replace_shortcut(
                &*manager,
                &mut current,
                &shortcut_str,
                hotkey::ID_PLAIN_PRIMARY,
                hotkey::ID_PLAIN_ALTGR,
            )
        }
    }
}

#[tauri::command]
pub async fn unregister_plain_text_hotkey(
    app: tauri::AppHandle,
    expected_shortcut: Option<String>,
) -> Result<(), AppError> {
    info!("unregistering plain text hotkey");
    let manager = app.state::<HotkeyManager>();
    let current = app.state::<PlainTextShortcut>();
    let mut current = current.0.lock();
    clear_plain_text_shortcut(&*manager, &mut current, expected_shortcut.as_deref())
}

fn clear_plain_text_shortcut(
    manager: &impl ShortcutRegistrar,
    current: &mut String,
    expected: Option<&str>,
) -> Result<(), AppError> {
    if let Some(expected) = expected {
        // Aliases share a physical key, but old cleanup does not own the new spelling.
        if current.is_empty() || expected != current {
            return Ok(());
        }
    }
    replace_shortcut(
        manager,
        current,
        "",
        hotkey::ID_PLAIN_PRIMARY,
        hotkey::ID_PLAIN_ALTGR,
    )
    .map(|_| ())
}

fn replace_shortcut(
    manager: &impl ShortcutRegistrar,
    current: &mut String,
    replacement: &str,
    primary: i32,
    altgr: i32,
) -> Result<String, AppError> {
    let parse = |value: &str| {
        if value.is_empty() {
            Ok(None)
        } else {
            parse_shortcut(value).map(Some)
        }
    };
    let old = parse(current)?;
    let new = parse(replacement)?;
    if old == new {
        return Ok(std::mem::replace(current, replacement.to_string()));
    }
    manager.unregister(primary).map_err(AppError::Other)?;
    manager.unregister(altgr).map_err(AppError::Other)?;
    if let Some(new) = new {
        if let Err(error) = register_with_variants(manager, &new, primary, altgr) {
            if let Some(old) = old {
                if let Err(rollback) = register_with_variants(manager, &old, primary, altgr) {
                    current.clear();
                    return Err(AppError::Other(format!("Failed to register hotkey: {error}. Rollback failed: {rollback}. No hotkey is active for this action. Restart the app.")));
                }
            }
            return Err(AppError::Other(format!(
                "Failed to register hotkey: {error}"
            )));
        }
    }
    Ok(std::mem::replace(current, replacement.to_string()))
}

/// Returns display characters for all known key codes on the current keyboard layout.
/// Frontend uses this to show layout-correct symbols (e.g. "²" instead of "`" on AZERTY).
#[tauri::command]
pub fn get_key_labels() -> std::collections::HashMap<String, String> {
    hotkey::get_layout_key_labels()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    #[derive(Default)]
    struct FakeRegistrar {
        active: RefCell<HashMap<i32, (u32, Code)>>,
        blocked: RefCell<Vec<(u32, Code)>>,
        calls: RefCell<Vec<(i32, bool)>>,
    }

    impl ShortcutRegistrar for FakeRegistrar {
        fn register(&self, id: i32, modifiers: u32, code: Code) -> Result<(), String> {
            self.calls.borrow_mut().push((id, true));
            let key = (modifiers, code);
            if self.blocked.borrow().contains(&key)
                || self.active.borrow().values().any(|v| *v == key)
            {
                return Err(format!("conflict: {code:?}/{modifiers}"));
            }
            assert!(
                !self.active.borrow().contains_key(&id),
                "old ID must be unregistered before replacement"
            );
            self.active.borrow_mut().insert(id, key);
            Ok(())
        }
        fn unregister(&self, id: i32) -> Result<(), String> {
            self.calls.borrow_mut().push((id, false));
            self.active.borrow_mut().remove(&id);
            Ok(())
        }
    }

    #[test]
    fn failed_default_bootstrap_restores_none_after_settings_storage_failure() {
        let registrar = FakeRegistrar::default();
        registrar
            .blocked
            .borrow_mut()
            .push((hotkey::MOD_CONTROL, Code::Backquote));
        let state = initialize_main_shortcut(&registrar);
        assert_eq!(*registrar.calls.borrow(), [(hotkey::ID_MAIN_PRIMARY, true)]);
        assert!(registrar.active.borrow().is_empty());

        let mut current = state.0.lock();
        let previous = replace_shortcut(&registrar, &mut current, "Ctrl+F9", 1, 2).unwrap();
        assert_eq!(
            *registrar.active.borrow(),
            HashMap::from([(1, (hotkey::MOD_CONTROL, Code::F9))])
        );
        let persist_settings = || Err::<(), _>("settings storage full");
        let rollback = persist_settings()
            .or_else(|_| replace_shortcut(&registrar, &mut current, &previous, 1, 2).map(|_| ()));
        assert!(rollback.is_ok(), "{rollback:?}");
        assert_eq!(previous, "");
        assert_eq!(*current, "");
        assert!(registrar.active.borrow().is_empty());
    }

    #[test]
    fn successful_default_bootstrap_restores_default_after_settings_storage_failure() {
        let registrar = FakeRegistrar::default();
        let state = initialize_main_shortcut(&registrar);
        let default_registration = HashMap::from([(1, (hotkey::MOD_CONTROL, Code::Backquote))]);
        assert_eq!(*registrar.active.borrow(), default_registration);

        let mut current = state.0.lock();
        let previous = replace_shortcut(&registrar, &mut current, "Ctrl+F9", 1, 2).unwrap();
        assert_eq!(
            *registrar.active.borrow(),
            HashMap::from([(1, (hotkey::MOD_CONTROL, Code::F9))])
        );
        let persist_settings = || Err::<(), _>("settings storage full");
        let rollback = persist_settings()
            .or_else(|_| replace_shortcut(&registrar, &mut current, &previous, 1, 2).map(|_| ()));
        assert!(rollback.is_ok(), "{rollback:?}");
        assert_eq!(previous, "Ctrl+Backquote");
        assert_eq!(*current, "Ctrl+Backquote");
        assert_eq!(*registrar.active.borrow(), default_registration);
    }

    #[test]
    fn replacement_failure_restores_primary_and_altgr_for_both_actions() {
        for (primary, altgr) in [
            (hotkey::ID_MAIN_PRIMARY, hotkey::ID_MAIN_ALTGR),
            (hotkey::ID_PLAIN_PRIMARY, hotkey::ID_PLAIN_ALTGR),
        ] {
            for blocked_modifiers in [hotkey::MOD_ALT, hotkey::MOD_ALT | hotkey::MOD_CONTROL] {
                let registrar = FakeRegistrar::default();
                let mut current = String::new();
                replace_shortcut(&registrar, &mut current, "Alt+F8", primary, altgr).unwrap();
                registrar
                    .blocked
                    .borrow_mut()
                    .push((blocked_modifiers, Code::F9));
                let error = replace_shortcut(&registrar, &mut current, "Alt+F9", primary, altgr)
                    .unwrap_err();
                assert!(error.to_string().contains("conflict"));
                assert_eq!(current, "Alt+F8");
                assert_eq!(
                    *registrar.active.borrow(),
                    HashMap::from([
                        (primary, (hotkey::MOD_ALT, Code::F8)),
                        (altgr, (hotkey::MOD_ALT | hotkey::MOD_CONTROL, Code::F8)),
                    ])
                );
            }
        }
    }

    #[test]
    fn replacement_clears_obsolete_altgr_and_equivalent_registration_is_noop() {
        let registrar = FakeRegistrar::default();
        let mut current = String::new();
        replace_shortcut(&registrar, &mut current, "Alt+F8", 3, 4).unwrap();
        replace_shortcut(&registrar, &mut current, "Ctrl+V", 3, 4).unwrap();
        assert_eq!(
            *registrar.active.borrow(),
            HashMap::from([(3, (hotkey::MOD_CONTROL, Code::KeyV))])
        );
        let calls = registrar.calls.borrow().len();
        replace_shortcut(&registrar, &mut current, "Ctrl+KeyV", 3, 4).unwrap();
        assert_eq!(registrar.calls.borrow().len(), calls);
        assert_eq!(current, "Ctrl+KeyV");
    }

    #[test]
    fn stale_plain_text_cleanup_cannot_unregister_a_saved_replacement() {
        let registrar = FakeRegistrar::default();
        let mut current = String::new();
        replace_shortcut(&registrar, &mut current, "Ctrl+F8", 3, 4).unwrap();
        replace_shortcut(&registrar, &mut current, "Alt+F9", 3, 4).unwrap();
        clear_plain_text_shortcut(&registrar, &mut current, Some("Ctrl+F8")).unwrap();
        assert_eq!(current, "Alt+F9");
        assert_eq!(registrar.active.borrow().len(), 2);
        clear_plain_text_shortcut(&registrar, &mut current, Some("Alt+F9")).unwrap();
        assert_eq!(current, "");
        assert!(registrar.active.borrow().is_empty());
        replace_shortcut(&registrar, &mut current, "Ctrl+F8", 3, 4).unwrap();
        clear_plain_text_shortcut(&registrar, &mut current, None).unwrap();
        assert!(registrar.active.borrow().is_empty());
    }

    #[test]
    fn delayed_legacy_cleanup_preserves_canonical_registration() {
        let registrar = FakeRegistrar::default();
        let mut current = String::new();
        replace_shortcut(&registrar, &mut current, "Ctrl+Shift+V", 3, 4).unwrap();
        let calls = registrar.calls.borrow().len();
        replace_shortcut(&registrar, &mut current, "Ctrl+Shift+KeyV", 3, 4).unwrap();
        replace_shortcut(&registrar, &mut current, "Ctrl+Shift+KeyV", 3, 4).unwrap();
        for _ in 0..2 {
            clear_plain_text_shortcut(&registrar, &mut current, Some("Ctrl+Shift+V")).unwrap();
        }
        assert_eq!(current, "Ctrl+Shift+KeyV");
        assert_eq!(registrar.calls.borrow().len(), calls);
        assert_eq!(
            *registrar.active.borrow(),
            HashMap::from([(3, (hotkey::MOD_CONTROL | hotkey::MOD_SHIFT, Code::KeyV))])
        );
        clear_plain_text_shortcut(&registrar, &mut current, Some("Ctrl+Shift+KeyV")).unwrap();
        assert!(registrar.active.borrow().is_empty());
    }

    #[test]
    fn replacement_returns_the_native_predecessor_for_compensation() {
        for (primary, altgr) in [(1, 2), (3, 4)] {
            for (previous, next) in [
                ("Ctrl+Backquote", "Alt+F9"),
                ("", "Alt+F9"),
                ("Alt+F8", ""),
                ("Ctrl+V", "Ctrl+KeyV"),
            ] {
                let registrar = FakeRegistrar::default();
                let mut current = String::new();
                replace_shortcut(&registrar, &mut current, previous, primary, altgr).unwrap();
                let before = registrar.active.borrow().clone();
                let result =
                    replace_shortcut(&registrar, &mut current, next, primary, altgr).unwrap();
                let response = serde_json::to_value(result).unwrap();
                assert_eq!(response, serde_json::json!(previous));
                assert_eq!(current, next);
                replace_shortcut(
                    &registrar,
                    &mut current,
                    response.as_str().unwrap(),
                    primary,
                    altgr,
                )
                .unwrap();
                assert_eq!(current, previous);
                assert_eq!(*registrar.active.borrow(), before);
            }
        }
    }

    #[test]
    fn failed_rollback_reports_loss_and_does_not_claim_old_registration() {
        let registrar = FakeRegistrar::default();
        let mut current = String::new();
        replace_shortcut(&registrar, &mut current, "Alt+F8", 3, 4).unwrap();
        registrar.blocked.borrow_mut().extend([
            (hotkey::MOD_ALT | hotkey::MOD_CONTROL, Code::F9),
            (hotkey::MOD_ALT | hotkey::MOD_CONTROL, Code::F8),
        ]);
        let error = replace_shortcut(&registrar, &mut current, "Alt+F9", 3, 4)
            .unwrap_err()
            .to_string();
        assert!(error.contains("Rollback failed"), "{error}");
        assert!(error.contains("F9") && error.contains("F8"), "{error}");
        assert!(current.is_empty());
        assert!(registrar.active.borrow().is_empty());
        registrar.blocked.borrow_mut().clear();
        replace_shortcut(&registrar, &mut current, "Alt+F8", 3, 4).unwrap();
        assert_eq!(registrar.active.borrow().len(), 2);
    }

    #[test]
    fn invalid_replacement_and_cross_action_conflict_leave_existing_keys() {
        let registrar = FakeRegistrar::default();
        let mut main = String::new();
        let mut plain = String::new();
        replace_shortcut(&registrar, &mut main, "Ctrl+F8", 1, 2).unwrap();
        replace_shortcut(&registrar, &mut plain, "Alt+F9", 3, 4).unwrap();
        let before = registrar.active.borrow().clone();
        assert!(replace_shortcut(&registrar, &mut main, "invalid", 1, 2).is_err());
        assert_eq!(*registrar.active.borrow(), before);
        assert!(replace_shortcut(&registrar, &mut main, "Alt+F9", 1, 2).is_err());
        assert_eq!(*registrar.active.borrow(), before);
        assert_eq!(main, "Ctrl+F8");
    }

    fn hk(modifiers: Modifiers, code: Code) -> HotkeyDef {
        HotkeyDef { code, modifiers }
    }

    #[test]
    fn parse_shortcut_ctrl_backquote() {
        let s = parse_shortcut("Ctrl+`").unwrap();
        assert_eq!(s, hk(Modifiers::CONTROL, Code::Backquote));
    }

    #[test]
    fn parse_shortcut_ctrl_shift_v() {
        let s = parse_shortcut("Ctrl+Shift+V").unwrap();
        assert_eq!(s, hk(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyV));
    }

    #[test]
    fn parse_shortcut_alt_v() {
        let s = parse_shortcut("Alt+V").unwrap();
        assert_eq!(s, hk(Modifiers::ALT, Code::KeyV));
    }

    #[test]
    fn parse_shortcut_alt_space() {
        let s = parse_shortcut("Alt+Space").unwrap();
        assert_eq!(s, hk(Modifiers::ALT, Code::Space));
    }

    #[test]
    fn parse_shortcut_rejects_too_long() {
        let long = "a".repeat(51);
        assert!(parse_shortcut(&long).is_err());
    }

    #[test]
    fn parse_shortcut_rejects_invalid_key() {
        assert!(parse_shortcut("Ctrl+Delete").is_err());
    }

    #[test]
    fn parse_shortcut_all_letters() {
        assert!(parse_shortcut("Ctrl+A").is_ok());
        assert!(parse_shortcut("Ctrl+Z").is_ok());
        assert!(parse_shortcut("Alt+M").is_ok());
    }

    #[test]
    fn parse_shortcut_digits() {
        assert!(parse_shortcut("Ctrl+1").is_ok());
        assert!(parse_shortcut("Alt+0").is_ok());
    }

    #[test]
    fn parse_shortcut_function_keys() {
        assert!(parse_shortcut("Ctrl+F1").is_ok());
        assert!(parse_shortcut("Alt+F12").is_ok());
    }

    #[test]
    fn parse_shortcut_rejects_no_key() {
        assert!(parse_shortcut("Ctrl+Shift").is_err());
    }

    #[test]
    fn parse_shortcut_rejects_typing_keys_without_command_modifier() {
        for shortcut in [
            "KeyV",
            "Space",
            "F1",
            "Shift+KeyV",
            "Shift+Space",
            "shift+shift+v",
        ] {
            assert!(parse_shortcut(shortcut).is_err(), "accepted {shortcut}");
        }
    }

    #[test]
    fn parse_shortcut_accepts_shift_with_command_modifiers() {
        for shortcut in [
            "Shift+Ctrl+KeyV",
            "Alt+Shift+Space",
            "AltGr+Shift+Digit1",
            "Win+Shift+F1",
        ] {
            assert!(parse_shortcut(shortcut).is_ok(), "rejected {shortcut}");
        }
    }

    #[test]
    fn parse_shortcut_case_insensitive() {
        let s = parse_shortcut("ctrl+shift+v").unwrap();
        assert_eq!(s, hk(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyV));
    }

    #[test]
    fn altgr_variant_alt_needs_companion() {
        let def = hk(Modifiers::ALT, Code::KeyM);
        assert!(needs_altgr_variant(&def));
    }

    #[test]
    fn altgr_variant_ctrl_no_companion() {
        let def = hk(Modifiers::CONTROL, Code::Backquote);
        assert!(!needs_altgr_variant(&def));
    }

    #[test]
    fn altgr_variant_ctrl_alt_no_companion() {
        let def = hk(Modifiers::CONTROL | Modifiers::ALT, Code::KeyV);
        assert!(!needs_altgr_variant(&def));
    }

    #[test]
    fn parse_shortcut_punctuation_symbols() {
        assert_eq!(
            parse_shortcut("Ctrl+;").unwrap(),
            hk(Modifiers::CONTROL, Code::Semicolon)
        );
        assert_eq!(
            parse_shortcut("Alt+,").unwrap(),
            hk(Modifiers::ALT, Code::Comma)
        );
        assert_eq!(
            parse_shortcut("Ctrl+.").unwrap(),
            hk(Modifiers::CONTROL, Code::Period)
        );
        assert_eq!(
            parse_shortcut("Alt+/").unwrap(),
            hk(Modifiers::ALT, Code::Slash)
        );
        assert_eq!(
            parse_shortcut("Ctrl+-").unwrap(),
            hk(Modifiers::CONTROL, Code::Minus)
        );
        assert_eq!(
            parse_shortcut("Ctrl+=").unwrap(),
            hk(Modifiers::CONTROL, Code::Equal)
        );
        assert_eq!(
            parse_shortcut("Alt+[").unwrap(),
            hk(Modifiers::ALT, Code::BracketLeft)
        );
        assert_eq!(
            parse_shortcut("Alt+]").unwrap(),
            hk(Modifiers::ALT, Code::BracketRight)
        );
        assert_eq!(
            parse_shortcut("Ctrl+<").unwrap(),
            hk(Modifiers::CONTROL, Code::IntlBackslash)
        );
    }

    #[test]
    fn parse_shortcut_punctuation_names() {
        assert_eq!(
            parse_shortcut("Ctrl+Semicolon").unwrap(),
            hk(Modifiers::CONTROL, Code::Semicolon)
        );
        assert_eq!(
            parse_shortcut("Alt+comma").unwrap(),
            hk(Modifiers::ALT, Code::Comma)
        );
    }

    #[test]
    fn parse_shortcut_ecode_format_letters() {
        assert_eq!(
            parse_shortcut("Ctrl+KeyV").unwrap(),
            hk(Modifiers::CONTROL, Code::KeyV)
        );
        assert_eq!(
            parse_shortcut("Alt+KeyM").unwrap(),
            hk(Modifiers::ALT, Code::KeyM)
        );
        assert_eq!(
            parse_shortcut("Ctrl+keya").unwrap(),
            hk(Modifiers::CONTROL, Code::KeyA)
        );
    }

    #[test]
    fn parse_shortcut_ecode_format_digits() {
        assert_eq!(
            parse_shortcut("Alt+Digit1").unwrap(),
            hk(Modifiers::ALT, Code::Digit1)
        );
        assert_eq!(
            parse_shortcut("Ctrl+Digit0").unwrap(),
            hk(Modifiers::CONTROL, Code::Digit0)
        );
    }

    #[test]
    fn parse_shortcut_ecode_backquote() {
        assert_eq!(
            parse_shortcut("Ctrl+Backquote").unwrap(),
            hk(Modifiers::CONTROL, Code::Backquote)
        );
        assert_eq!(
            parse_shortcut("Ctrl+`").unwrap(),
            hk(Modifiers::CONTROL, Code::Backquote)
        );
    }

    #[test]
    fn parse_shortcut_backward_compat() {
        assert_eq!(
            parse_shortcut("Ctrl+V").unwrap(),
            parse_shortcut("Ctrl+KeyV").unwrap()
        );
        assert_eq!(
            parse_shortcut("Alt+1").unwrap(),
            parse_shortcut("Alt+Digit1").unwrap()
        );
        assert_eq!(
            parse_shortcut("Ctrl+;").unwrap(),
            parse_shortcut("Ctrl+Semicolon").unwrap()
        );
    }

    #[test]
    fn parse_shortcut_win_modifier() {
        let s = parse_shortcut("Win+V").unwrap();
        assert_eq!(s, hk(Modifiers::META, Code::KeyV));
    }

    // ── AZERTY-specific tests (issue beetroot-releases#3) ──

    #[test]
    fn parse_shortcut_azerty_altgr_bang() {
        // AltGr+! on AZERTY: frontend records as "AltGr+Slash"
        let def = parse_shortcut("AltGr+Slash").unwrap();
        assert_eq!(def, hk(Modifiers::ALT, Code::Slash));
        // needs_altgr_variant registers Ctrl+Alt companion for AltGr
        assert!(needs_altgr_variant(&def));
    }

    #[test]
    fn parse_shortcut_altgr_backward_compat() {
        // Old format "Alt+Slash" still works (backward compat)
        let def = parse_shortcut("Alt+Slash").unwrap();
        assert_eq!(def, hk(Modifiers::ALT, Code::Slash));
        assert!(needs_altgr_variant(&def));
    }

    #[test]
    fn parse_shortcut_azerty_ctrl_intlbackslash() {
        // Ctrl+< on AZERTY (IntlBackslash key, scan 0x56)
        let def = parse_shortcut("Ctrl+IntlBackslash").unwrap();
        assert_eq!(def, hk(Modifiers::CONTROL, Code::IntlBackslash));
        assert!(!needs_altgr_variant(&def));
    }

    #[test]
    fn parse_shortcut_azerty_ctrl_backquote_ecode() {
        // Default hotkey in e.code format
        let def = parse_shortcut("Ctrl+Backquote").unwrap();
        assert_eq!(def, hk(Modifiers::CONTROL, Code::Backquote));
    }

    #[test]
    fn parse_shortcut_azerty_alt_comma_ecode() {
        // Alt+Comma via e.code (physical Comma key = ; on AZERTY)
        let def = parse_shortcut("Alt+Comma").unwrap();
        assert_eq!(def, hk(Modifiers::ALT, Code::Comma));
        assert!(needs_altgr_variant(&def));
    }

    #[test]
    fn parse_shortcut_azerty_all_punctuation_ecodes() {
        // All punctuation codes that AZERTY user might record via e.code
        let cases = [
            ("Ctrl+Semicolon", Code::Semicolon),
            ("Ctrl+Comma", Code::Comma),
            ("Ctrl+Period", Code::Period),
            ("Ctrl+Slash", Code::Slash),
            ("Ctrl+Minus", Code::Minus),
            ("Ctrl+Equal", Code::Equal),
            ("Ctrl+BracketLeft", Code::BracketLeft),
            ("Ctrl+BracketRight", Code::BracketRight),
            ("Ctrl+Backslash", Code::Backslash),
            ("Ctrl+Quote", Code::Quote),
            ("Ctrl+IntlBackslash", Code::IntlBackslash),
            ("Ctrl+Backquote", Code::Backquote),
            ("Ctrl+Space", Code::Space),
        ];
        for (input, expected_code) in cases {
            let def = parse_shortcut(input)
                .unwrap_or_else(|e| panic!("parse_shortcut({}) failed: {}", input, e));
            assert_eq!(
                def,
                hk(Modifiers::CONTROL, expected_code),
                "failed for {}",
                input
            );
        }
    }

    #[test]
    fn altgr_variant_alt_slash_needs_companion() {
        // AltGr+! recorded as Alt+Slash — needs Ctrl+Alt companion
        let def = hk(Modifiers::ALT, Code::Slash);
        assert!(needs_altgr_variant(&def));
    }

    #[test]
    fn altgr_variant_ctrl_intlbackslash_no_companion() {
        // Ctrl+< — has Ctrl, no AltGr companion needed
        let def = hk(Modifiers::CONTROL, Code::IntlBackslash);
        assert!(!needs_altgr_variant(&def));
    }

    #[test]
    fn altgr_variant_ctrl_alt_slash_no_companion() {
        // Real Ctrl+Alt+/ (not AltGr) — both Ctrl and Alt present, no companion
        let def = hk(Modifiers::CONTROL | Modifiers::ALT, Code::Slash);
        assert!(!needs_altgr_variant(&def));
    }
}
