//! IPC surface for local AI endpoints and the background job queue.

use serde::Serialize;
use std::time::Duration;

use crate::error::AppError;

// ---------------------------------------------------------------------------
// Local LLM proxy commands (bypass mixed-content block in Tauri webview)
// ---------------------------------------------------------------------------

/// Validate that endpoint is loopback only. Delegates to `ai::validate_loopback`.
/// Adapter: converts the `String` error from `ai::validate_loopback` to `AppError`.
/// The canonical implementation lives in `crate::ai::validate_loopback` (returns `Result<(), String>`).
fn validate_loopback(endpoint: &str) -> Result<(), AppError> {
    crate::ai::validate_loopback(endpoint).map_err(AppError::Validation)
}

#[derive(Serialize)]
pub struct LocalTestResult {
    pub ok: bool,
    pub model: String,
    pub error: String,
}

/// Test connection to a local OpenAI-compatible endpoint.
/// Returns the first model ID on success.
#[tauri::command]
pub async fn test_local_endpoint(endpoint: String) -> LocalTestResult {
    let ep = endpoint.trim().trim_end_matches('/').to_string();
    if let Err(e) = validate_loopback(&ep) {
        return LocalTestResult {
            ok: false,
            model: String::new(),
            error: e.to_string(),
        };
    }
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!("{}/v1/models", ep);
        match crate::ai::local_agent()
            .get(&url)
            .timeout(Duration::from_secs(5))
            .call()
        {
            Ok(resp) => {
                if let Ok(json) = resp.into_json::<serde_json::Value>() {
                    let model = json["data"][0]["id"]
                        .as_str()
                        .or_else(|| json["data"][0]["name"].as_str())
                        .unwrap_or("")
                        .to_string();
                    LocalTestResult {
                        ok: true,
                        model,
                        error: String::new(),
                    }
                } else {
                    LocalTestResult {
                        ok: false,
                        model: String::new(),
                        error: "Invalid JSON response".into(),
                    }
                }
            }
            Err(e) => LocalTestResult {
                ok: false,
                model: String::new(),
                error: e.to_string(),
            },
        }
    })
    .await
    .unwrap_or_else(|e| LocalTestResult {
        ok: false,
        model: String::new(),
        error: format!("Task failed: {e}"),
    })
}

/// List all available models from a local OpenAI-compatible endpoint.
#[tauri::command]
pub async fn list_local_models(endpoint: String) -> Result<Vec<String>, AppError> {
    let ep = endpoint.trim().trim_end_matches('/').to_string();
    validate_loopback(&ep)?;
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!("{}/v1/models", ep);
        let resp = crate::ai::local_agent()
            .get(&url)
            .timeout(Duration::from_secs(5))
            .call()
            .map_err(|e| AppError::Validation(format!("Connection failed: {}", e)))?;
        let json: serde_json::Value = resp
            .into_json()
            .map_err(|e| AppError::Validation(format!("Invalid JSON: {}", e)))?;
        let models: Vec<String> = json["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| {
                        m["id"]
                            .as_str()
                            .or_else(|| m["name"].as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(models)
    })
    .await
    .unwrap_or_else(|e| Err(AppError::Other(format!("Task failed: {e}"))))
}

// ── Background Job IPC Commands ─────────────────────────────────────────

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SubmitJobParams {
    pub provider: String,
    pub model: String,
    pub endpoint: Option<String>,
    pub prompt: String,
    pub prompt_name: String,
    pub input_text: String,
    pub image_base64: Option<String>,
    pub image_mime: Option<String>,
    pub source: Option<String>, // "user" (default) | "auto" | "mcp"
}

#[tauri::command]
pub fn submit_job(
    state: tauri::State<'_, crate::jobs::JobManager>,
    params: SubmitJobParams,
) -> Result<u64, String> {
    let source = match params.source.as_deref() {
        Some("auto") => crate::jobs::JobSource::Auto,
        Some("mcp") => crate::jobs::JobSource::Mcp,
        _ => crate::jobs::JobSource::User,
    };
    let request = crate::ai::AiRequest {
        provider: params.provider,
        model: params.model,
        endpoint: params.endpoint,
        prompt: params.prompt,
        input_text: params.input_text,
        image_base64: params.image_base64,
        image_mime: params.image_mime,
    };
    state.submit(request, source, params.prompt_name)
}

#[tauri::command]
pub fn cancel_job(state: tauri::State<'_, crate::jobs::JobManager>, job_id: u64) -> bool {
    state.cancel(job_id)
}

#[tauri::command]
pub async fn save_api_key(
    provider: crate::secrets::CloudProvider,
    api_key: String,
    overwrite: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::secrets::save(provider, &api_key, overwrite)
    })
    .await
    .map_err(|_| "Credential task failed".to_string())?
}

#[tauri::command]
pub async fn delete_api_key(provider: crate::secrets::CloudProvider) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || crate::secrets::delete(provider))
        .await
        .map_err(|_| "Credential task failed".to_string())?
}

#[tauri::command]
pub async fn get_api_key_status(provider: crate::secrets::CloudProvider) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::secrets::load(provider).map(|key| key.is_some_and(|k| !k.is_empty()))
    })
    .await
    .map_err(|_| "Credential task failed".to_string())?
}

#[tauri::command]
pub async fn validate_api_key(provider: crate::secrets::CloudProvider) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || crate::ai::validate_saved_key(provider))
        .await
        .map_err(|_| "Provider validation task failed".to_string())?
}

#[cfg(test)]
mod local_endpoint_tests {
    use super::*;
    use crate::ai::local_test_support::LoopbackServer;

    #[tokio::test]
    async fn endpoint_test_does_not_follow_redirects() {
        for status in [301, 302, 303, 307, 308] {
            let server = LoopbackServer::new(vec![(status, "")]);
            let result = test_local_endpoint(server.endpoint.clone()).await;
            let requests = server.finish();
            assert_eq!(requests.len(), 1, "followed HTTP {status}");
            assert_eq!(requests[0].0, "GET /v1/models HTTP/1.1");
            assert!(!result.ok);
        }
    }

    #[tokio::test]
    async fn model_listing_does_not_follow_redirects() {
        for status in [301, 302, 303, 307, 308] {
            let server = LoopbackServer::new(vec![(status, "")]);
            let result = list_local_models(server.endpoint.clone()).await;
            let requests = server.finish();
            assert_eq!(requests.len(), 1, "followed HTTP {status}");
            assert_eq!(requests[0].0, "GET /v1/models HTTP/1.1");
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn local_model_commands_preserve_success() {
        let server = LoopbackServer::new(vec![
            (
                200,
                r#"{"data":[{"id":"first-model"},{"name":"second-model"}]}"#,
            ),
            (
                200,
                r#"{"data":[{"id":"first-model"},{"name":"second-model"}]}"#,
            ),
        ]);
        let tested = test_local_endpoint(server.endpoint.clone()).await;
        let listed = list_local_models(server.endpoint.clone()).await;
        let requests = server.finish();
        assert!(tested.ok, "{}", tested.error);
        assert_eq!(tested.model, "first-model");
        assert_eq!(listed.unwrap(), ["first-model", "second-model"]);
        assert_eq!(requests.len(), 2);
    }
}

#[cfg(test)]
mod keyless_ipc_tests {
    use super::*;

    #[test]
    fn job_payload_accepts_keyless_requests_and_rejects_renderer_secrets() {
        let mut payload = serde_json::json!({
            "provider": "openai", "model": "test-model", "prompt": "test",
            "promptName": "test", "inputText": "synthetic input"
        });
        assert!(serde_json::from_value::<SubmitJobParams>(payload.clone()).is_ok());
        payload["apiKey"] = serde_json::json!("renderer-secret");
        assert!(serde_json::from_value::<SubmitJobParams>(payload).is_err());
    }
}
