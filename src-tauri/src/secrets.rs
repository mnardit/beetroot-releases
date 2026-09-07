//! API credentials stay in the Windows vault, scoped to the current build profile.

use keyring::{Entry, Error};
use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloudProvider {
    Openai,
    Gemini,
    Anthropic,
    Deepseek,
}

impl CloudProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::Gemini => "gemini",
            Self::Anthropic => "anthropic",
            Self::Deepseek => "deepseek",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "openai" => Ok(Self::Openai),
            "gemini" => Ok(Self::Gemini),
            "anthropic" => Ok(Self::Anthropic),
            "deepseek" => Ok(Self::Deepseek),
            _ => Err("Unknown cloud AI provider".into()),
        }
    }
}

// Serialize check-then-save migration with explicit saves/deletes and worker reads.
static VAULT_LOCK: parking_lot::Mutex<()> = parking_lot::Mutex::new(());

fn entry(provider: CloudProvider) -> Result<Entry, String> {
    #[cfg(target_os = "windows")]
    {
        Entry::new(crate::build_profile::identifier(), provider.as_str())
            .map_err(|_| "Cannot open Windows Credential Manager".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = provider;
        Err("API key storage requires Windows Credential Manager".into())
    }
}

fn read_entry(entry: &Entry) -> Result<Option<String>, String> {
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(Error::NoEntry) => Ok(None),
        // Some keyring errors contain raw credential bytes. Never serialize those errors.
        Err(_) => Err("Cannot read Windows Credential Manager".into()),
    }
}

fn normalize_key(key: &str) -> Result<&str, String> {
    let key = key.trim();
    let key = if key
        .get(..7)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("bearer "))
    {
        key[7..].trim()
    } else {
        key
    };
    if key.is_empty()
        || key.eq_ignore_ascii_case("bearer")
        || key.len() > 1024
        || !key.bytes().all(|b| b.is_ascii_graphic())
    {
        return Err("API key must contain 1-1024 non-whitespace ASCII characters".into());
    }
    Ok(key)
}

fn save_entry(entry: &Entry, key: &str, overwrite: bool) -> Result<(), String> {
    if !overwrite && read_entry(entry)?.is_some() {
        return Ok(());
    }
    let key = normalize_key(key)?;
    entry
        .set_password(key)
        .map_err(|_| "Cannot save API key in Windows Credential Manager".to_string())?;
    if read_entry(entry)?.as_deref() != Some(key) {
        return Err("Credential Manager did not retain the API key".into());
    }
    Ok(())
}

pub fn save(provider: CloudProvider, key: &str, overwrite: bool) -> Result<(), String> {
    let _guard = VAULT_LOCK.lock();
    save_entry(&entry(provider)?, key, overwrite)
}

pub fn load(provider: CloudProvider) -> Result<Option<String>, String> {
    let _guard = VAULT_LOCK.lock();
    read_entry(&entry(provider)?)
}

pub fn delete(provider: CloudProvider) -> Result<(), String> {
    let _guard = VAULT_LOCK.lock();
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(_) => Err("Cannot delete API key from Windows Credential Manager".into()),
    }
}

pub fn required(provider: CloudProvider) -> Result<String, String> {
    load(provider)?
        .filter(|key| !key.is_empty())
        .ok_or_else(|| format!("No API key configured for {}", provider.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_four_cloud_providers_are_accepted() {
        for provider in ["openai", "gemini", "anthropic", "deepseek"] {
            assert_eq!(CloudProvider::parse(provider).unwrap().as_str(), provider);
            assert!(serde_json::from_value::<CloudProvider>(serde_json::json!(provider)).is_ok());
        }
        for provider in ["", "local", "other", "OpenAI", "../openai"] {
            assert!(CloudProvider::parse(provider).is_err());
            assert!(serde_json::from_value::<CloudProvider>(serde_json::json!(provider)).is_err());
        }
    }

    #[test]
    fn normalizes_pasted_keys_and_rejects_invalid_headers() {
        assert_eq!(
            normalize_key("  bEaReR sk-example  ").unwrap(),
            "sk-example"
        );
        for key in ["", "  ", "Bearer ", "sk-key\r\nx-evil: value", "has spaces"] {
            assert!(normalize_key(key).is_err());
        }
        assert!(normalize_key(&"a".repeat(1025)).is_err());
    }

    #[test]
    fn migration_preserves_an_existing_key_but_explicit_save_replaces_it() {
        let entry = Entry::new_with_credential(Box::new(keyring::mock::MockCredential::default()));
        assert_eq!(read_entry(&entry).unwrap(), None);
        save_entry(&entry, "first", false).unwrap();
        save_entry(&entry, "stale-legacy", false).unwrap();
        assert_eq!(read_entry(&entry).unwrap().as_deref(), Some("first"));
        save_entry(&entry, "replacement", true).unwrap();
        assert_eq!(read_entry(&entry).unwrap().as_deref(), Some("replacement"));
        entry.delete_credential().unwrap();
        assert_eq!(read_entry(&entry).unwrap(), None);
    }
}
