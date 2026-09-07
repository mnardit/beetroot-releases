//! Keep development and native smoke runs separate from installed user data.

use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum BuildProfile {
    Production,
    Development,
    Smoke,
}

impl BuildProfile {
    pub(crate) const fn current() -> Self {
        if cfg!(feature = "smoke-test") {
            Self::Smoke
        } else if cfg!(debug_assertions) {
            Self::Development
        } else {
            Self::Production
        }
    }

    fn identifier(self, run_id: Option<&str>) -> Result<String, &'static str> {
        match self {
            Self::Production => Ok("com.beetroot.desktop".into()),
            Self::Development => Ok("com.beetroot.desktop.dev".into()),
            Self::Smoke => match run_id {
                None => Ok("com.beetroot.desktop.smoke".into()),
                Some(id) if id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit()) => {
                    Ok(format!("com.beetroot.desktop.smoke.{id}"))
                }
                Some(_) => Err("BEETROOT_SMOKE_RUN_ID must be a 32-character hexadecimal ID"),
            },
        }
    }
}

pub(crate) fn isolated() -> bool {
    BuildProfile::current() != BuildProfile::Production
}

pub(crate) fn identifier() -> &'static str {
    static IDENTIFIER: OnceLock<String> = OnceLock::new();
    IDENTIFIER.get_or_init(|| {
        BuildProfile::current()
            .identifier(std::env::var("BEETROOT_SMOKE_RUN_ID").ok().as_deref())
            .expect("invalid smoke profile configuration")
    })
}

pub(crate) fn configure(context: &mut tauri::Context<tauri::Wry>) {
    if isolated() {
        let config = context.config_mut();
        // Tauri derives the WebView2 directory and single-instance mutex from this ID.
        config.identifier = identifier().into();
        for window in &mut config.app.windows {
            window.title = if BuildProfile::current() == BuildProfile::Smoke {
                "Beetroot Smoke".into()
            } else {
                "Beetroot Dev".into()
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installed_identity_ignores_test_environment() {
        assert_eq!(
            BuildProfile::Production
                .identifier(Some("invalid"))
                .unwrap(),
            "com.beetroot.desktop"
        );
    }

    #[test]
    fn dev_identity_is_stable_and_separate() {
        assert_eq!(
            BuildProfile::Development
                .identifier(Some("ignored"))
                .unwrap(),
            "com.beetroot.desktop.dev"
        );
    }

    #[test]
    fn smoke_profiles_are_separate_per_run() {
        let first = BuildProfile::Smoke
            .identifier(Some(&"a".repeat(32)))
            .unwrap();
        let second = BuildProfile::Smoke
            .identifier(Some(&"b".repeat(32)))
            .unwrap();
        assert_ne!(first, second);
        assert!(first.starts_with("com.beetroot.desktop.smoke."));
        assert_eq!(
            BuildProfile::Smoke.identifier(None).unwrap(),
            "com.beetroot.desktop.smoke"
        );
    }

    #[test]
    fn smoke_identity_rejects_paths_and_empty_ids() {
        for value in ["", "../com.beetroot.desktop", "C:\\data", "not-a-uuid"] {
            assert!(BuildProfile::Smoke.identifier(Some(value)).is_err());
        }
    }

    #[test]
    fn context_uses_same_identity_as_database() {
        let mut context = tauri::generate_context!();
        configure(&mut context);
        assert_eq!(context.config().identifier, identifier());
        assert_eq!(crate::default_data_dir().file_name().unwrap(), identifier());
    }
}
