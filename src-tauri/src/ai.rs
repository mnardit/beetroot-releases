//! Blocking HTTP requests for four cloud AI providers and local models.
//!
//! Providers: OpenAI, Gemini, Anthropic, DeepSeek, Local (loopback-only).
//! All functions are blocking (intended for use from a worker thread).

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tracing::warn;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_TEXT: &str = "You are a text transformation assistant. \
    Apply the following instruction to the user's text. Return ONLY the \
    transformed text with no explanation, no quotes, no markdown formatting.";

const SYSTEM_PROMPT_VISION: &str = "You are an image analysis assistant. \
    Apply the following instruction to the provided image. Return ONLY the \
    result as plain text with no explanation, no quotes, no markdown formatting.";

/// Maximum text bytes accepted into the AI request payload. Re-imported by
/// `jobs.rs` so submit-time and request-time gates share one source of truth.
pub(crate) const MAX_INPUT_LENGTH: usize = 100_000;

/// Maximum base64 bytes for vision payloads (~10 MB image → ~14 MB base64,
/// within all providers' limits). Re-imported by `jobs.rs`.
pub(crate) const MAX_IMAGE_BASE64_LENGTH: usize = 14_000_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct AiRequest {
    pub provider: String,
    pub model: String,
    pub endpoint: Option<String>,
    pub prompt: String,
    pub input_text: String,
    pub image_base64: Option<String>,
    pub image_mime: Option<String>,
}

impl std::fmt::Debug for AiRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AiRequest")
            .field("provider", &self.provider)
            .field("model", &self.model)
            .field("prompt", &self.prompt)
            .finish()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiResponse {
    pub text: String,
}

// ---------------------------------------------------------------------------
// strip_think_tags — remove ALL <think>...</think> blocks via regex
// ---------------------------------------------------------------------------

/// Remove ALL `<think>...</think>` blocks (including multiline) from AI output.
/// Handles unclosed `<think>` tags as best-effort. Uses the `regex` crate.
pub fn strip_think_tags(text: &str) -> String {
    // Remove all closed <think>...</think> blocks (dotall via (?s))
    static RE_THINK: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"(?s)<think>.*?</think>").expect("valid regex"));
    let result = RE_THINK.replace_all(text, "");
    // Handle unclosed leading <think> (model ran out of tokens during reasoning)
    let trimmed = result.trim();
    if let Some(stripped) = trimmed.strip_prefix("<think>") {
        stripped.trim().to_string()
    } else {
        trimmed.to_string()
    }
}

// ---------------------------------------------------------------------------
// Anthropic model ID mapping
// ---------------------------------------------------------------------------

/// Pin the Haiku 4.5 alias; dateless 4.6 IDs are already canonical API model IDs.
pub fn anthropic_model_id(short: &str) -> &str {
    match short {
        "claude-haiku-4-5" => "claude-haiku-4-5-20251001",
        _ => short,
    }
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

/// Execute an AI request by dispatching to the appropriate provider.
/// Blocking — call from a worker thread (e.g. `spawn_blocking`).
pub fn execute_ai_request(req: &AiRequest) -> Result<AiResponse, String> {
    if req.input_text.len() > MAX_INPUT_LENGTH {
        return Err(format!(
            "Text too long for AI transform (max {} bytes)",
            MAX_INPUT_LENGTH
        ));
    }

    // Limit image base64 size (~10MB file → ~14MB base64, within all providers' limits)
    if let Some(ref b64) = req.image_base64 {
        if b64.len() > MAX_IMAGE_BASE64_LENGTH {
            return Err("Image too large for AI vision (max ~10MB)".into());
        }
    }

    let is_vision = req.image_base64.is_some();
    let system_prompt = if is_vision {
        SYSTEM_PROMPT_VISION
    } else {
        SYSTEM_PROMPT_TEXT
    };
    let timeout = if is_vision {
        Duration::from_secs(60)
    } else {
        Duration::from_secs(30)
    };

    let api_key = if req.provider == "local" {
        String::new()
    } else {
        crate::secrets::required(crate::secrets::CloudProvider::parse(&req.provider)?)?
    };
    let raw = match req.provider.as_str() {
        "openai" => openai_request(req, &api_key, system_prompt, timeout),
        "gemini" => gemini_request(req, &api_key, system_prompt, timeout),
        "anthropic" => anthropic_request(req, &api_key, system_prompt, timeout),
        "deepseek" => openai_compatible_request(req, &api_key, system_prompt, timeout, "DeepSeek"),
        "local" => local_request_transform(req, system_prompt, timeout),
        other => Err(format!("Unknown AI provider: {other}")),
    }?;

    let text = strip_think_tags(&raw);
    if text.is_empty() {
        return Err(format!("Empty response from {}", req.provider));
    }

    // Detect soft errors from models that return 200 but with an error message
    // (e.g. Ollama "The image could not be processed"). Only check short responses
    // to avoid false positives on real content like "Your browser does not support WebGL".
    if req.image_base64.is_some() && text.len() < 150 {
        let lower = text.to_lowercase();
        if lower.contains("could not be processed")
            || lower.contains("cannot process image")
            || lower.contains("unable to process")
            || lower.contains("image is not supported")
            || lower.contains("model does not support")
            || lower.contains("does not support image")
        {
            return Err(
                "This model doesn't support image analysis. Try a vision model (llava, minicpm-v, GPT-4o, Claude, Gemini)"
                    .into(),
            );
        }
    }

    Ok(AiResponse { text })
}

/// Validate the saved credential without sending clipboard content or generating tokens.
pub fn validate_saved_key(provider: crate::secrets::CloudProvider) -> Result<(), String> {
    use crate::secrets::CloudProvider;
    let key = crate::secrets::required(provider)?;
    let url = match provider {
        CloudProvider::Openai => "https://api.openai.com/v1/models",
        CloudProvider::Gemini => "https://generativelanguage.googleapis.com/v1beta/openai/models",
        CloudProvider::Anthropic => "https://api.anthropic.com/v1/models",
        CloudProvider::Deepseek => "https://api.deepseek.com/models",
    };
    let agent = ureq::AgentBuilder::new()
        .redirects(0)
        .timeout(Duration::from_secs(15))
        .build();
    let request = agent.get(url);
    let request = if matches!(provider, CloudProvider::Anthropic) {
        request
            .set("x-api-key", &key)
            .set("anthropic-version", "2023-06-01")
    } else {
        request.set("Authorization", &format!("Bearer {key}"))
    };
    match request.call() {
        Ok(response) if (200..300).contains(&response.status()) => Ok(()),
        Ok(response) => Err(format!(
            "Provider validation returned HTTP {}",
            response.status()
        )),
        Err(ureq::Error::Status(status, _)) => {
            Err(format!("Provider validation returned HTTP {status}"))
        }
        Err(ureq::Error::Transport(_)) => Err("Cannot connect to the AI provider".into()),
    }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

fn openai_request(
    req: &AiRequest,
    api_key: &str,
    system_prompt: &str,
    timeout: Duration,
) -> Result<String, String> {
    let user_content = build_openai_user_message(req);
    let body = json!({
        "model": req.model,
        "messages": [
            { "role": "developer", "content": system_prompt },
            { "role": "user", "content": user_content },
        ],
        "max_completion_tokens": 4096,
        "reasoning_effort": "low",
    });
    call_openai_compatible(
        "https://api.openai.com/v1/chat/completions",
        api_key,
        &body,
        timeout,
        "OpenAI",
        req.image_base64.is_some(),
    )
}

// ---------------------------------------------------------------------------
// OpenAI-compatible (shared for DeepSeek)
// ---------------------------------------------------------------------------

fn openai_compatible_request(
    req: &AiRequest,
    api_key: &str,
    system_prompt: &str,
    timeout: Duration,
    provider_name: &str,
) -> Result<String, String> {
    let endpoint = match provider_name {
        "DeepSeek" => "https://api.deepseek.com/chat/completions".to_string(),
        _ => format!(
            "{}/v1/chat/completions",
            req.endpoint
                .as_deref()
                .unwrap_or("")
                .trim()
                .trim_end_matches('/')
        ),
    };
    let user_content = build_openai_user_message(req);
    let body = json!({
        "model": req.model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_content },
        ],
        "max_tokens": 4096,
    });
    call_openai_compatible(
        &endpoint,
        api_key,
        &body,
        timeout,
        provider_name,
        req.image_base64.is_some(),
    )
}

// ---------------------------------------------------------------------------
// Gemini (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------

fn gemini_request(
    req: &AiRequest,
    api_key: &str,
    system_prompt: &str,
    timeout: Duration,
) -> Result<String, String> {
    let user_content = build_openai_user_message(req);
    let body = json!({
        "model": req.model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_content },
        ],
        "max_tokens": 4096,
        "temperature": 0.3,
    });
    call_openai_compatible(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        api_key,
        &body,
        timeout,
        "Gemini",
        req.image_base64.is_some(),
    )
}

// ---------------------------------------------------------------------------
// Anthropic (native Messages API)
// ---------------------------------------------------------------------------

fn anthropic_request(
    req: &AiRequest,
    api_key: &str,
    system_prompt: &str,
    timeout: Duration,
) -> Result<String, String> {
    let is_vision = req.image_base64.is_some();
    let model_id = anthropic_model_id(&req.model);
    let user_text = if is_vision {
        req.prompt.clone()
    } else {
        format!(
            "Instruction: {}\n\nText to transform:\n{}",
            req.prompt, req.input_text
        )
    };

    let user_content = if let (Some(b64), Some(mime)) = (&req.image_base64, &req.image_mime) {
        json!([
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime,
                    "data": b64,
                }
            },
            { "type": "text", "text": user_text },
        ])
    } else {
        json!(user_text)
    };

    let body = json!({
        "model": model_id,
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": user_content },
        ],
        "max_tokens": 4096,
    });

    let result = ureq::post("https://api.anthropic.com/v1/messages")
        .set("Content-Type", "application/json")
        .set("x-api-key", api_key)
        .set("anthropic-version", "2023-06-01")
        .timeout(timeout)
        .send_json(&body);

    match result {
        Ok(resp) => {
            let json: Value = resp
                .into_json()
                .map_err(|e| format!("Invalid JSON from Anthropic: {e}"))?;
            parse_anthropic_body(&json)
        }
        Err(err) => Err(map_ureq_error("Anthropic", err, is_vision)),
    }
}

// ---------------------------------------------------------------------------
// Local (loopback-only, OpenAI-compatible)
// ---------------------------------------------------------------------------

/// Local LLM request for AI transform pipeline — wraps individual AiRequest fields.
/// Called internally by `execute_ai_request` for the "local" provider.
///
/// Vision path: tries Ollama-native `/api/chat` (with `images` array) first.
/// On 404, falls back to OpenAI-compatible `/v1/chat/completions` (LM Studio).
/// Text path: uses OpenAI-compatible format unchanged.
fn local_request_transform(
    req: &AiRequest,
    system_prompt: &str,
    timeout: Duration,
) -> Result<String, String> {
    let ep = req
        .endpoint
        .as_deref()
        .unwrap_or("")
        .trim()
        .trim_end_matches('/');
    if ep.is_empty() {
        return Err("Local LLM endpoint not configured".into());
    }

    validate_loopback(ep)?;

    // Auto-detect model if empty
    let model = if req.model.is_empty() {
        auto_detect_model(ep)?
    } else {
        req.model.clone()
    };

    // Vision: use Ollama-native /api/chat format with images array
    if let Some(ref b64) = req.image_base64 {
        let body = json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": req.prompt, "images": [b64] },
            ],
            "stream": false,
        });

        // Try Ollama-native endpoint first (falls through to OpenAI format if server returns error)
        let url = format!("{ep}/api/chat");
        let result = local_agent()
            .post(&url)
            .set("Content-Type", "application/json")
            .timeout(timeout)
            .send_json(&body);

        match result {
            Ok(resp) => {
                let json: Value = resp
                    .into_json()
                    .map_err(|e| format!("Invalid JSON from local endpoint: {e}"))?;

                // LM Studio returns 200 + {"error": "..."} on unsupported endpoints
                if json.get("error").is_some() {
                    // Not a real Ollama server — fall through to OpenAI format
                } else {
                    return parse_local_chat_body(&json);
                }
            }
            Err(ureq::Error::Status(404, _)) => {
                // /api/chat not found — fall through to OpenAI-compatible format
            }
            Err(e) => {
                return Err(map_ureq_error("local LLM", e, true));
            }
        }

        // Fallback: OpenAI-compatible format for LM Studio and similar
        let user_content = build_openai_user_message(req);
        let body = json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_content },
            ],
        });
        let fallback_url = format!("{ep}/v1/chat/completions");
        let resp = local_agent()
            .post(&fallback_url)
            .set("Content-Type", "application/json")
            .timeout(timeout)
            .send_json(&body)
            .map_err(|e| map_ureq_error("local LLM", e, true))?;

        let json: Value = resp
            .into_json()
            .map_err(|e| format!("Invalid JSON from local endpoint: {e}"))?;

        // LM Studio can also return 200 + {"error": "..."} on /v1/chat/completions
        // (e.g. model not loaded, context exceeded). Surface the real error
        // instead of the generic "Empty response" fallback.
        if json.get("error").is_some() {
            // Delegate to parse_local_chat_body which surfaces the real error message
            return parse_local_chat_body(&json);
        }

        return parse_openai_compatible_body(&json, "local LLM").map_err(|error| {
            if error == "Empty response from local LLM" {
                format!("{error}. For vision, ensure your model supports images (e.g. llava, minicpm-v, qwen-vl)")
            } else {
                error
            }
        });
    }

    // Text-only: use OpenAI-compatible format (existing path)
    let user_text = format!(
        "Instruction: {}\n\nText to transform:\n{}",
        req.prompt, req.input_text
    );

    local_request(ep, &model, system_prompt, &user_text, timeout)
}

/// Local LLM request — validates loopback, auto-detects model, OpenAI-compatible format.
/// Local chat completion used by background jobs.
pub fn local_request(
    endpoint: &str,
    model: &str,
    system_prompt: &str,
    user_message: &str,
    timeout: Duration,
) -> Result<String, String> {
    let ep = endpoint.trim().trim_end_matches('/');
    if ep.is_empty() {
        return Err("Local LLM endpoint not configured".into());
    }

    validate_loopback(ep)?;

    // Auto-detect model if empty
    let model = if model.is_empty() {
        auto_detect_model(ep)?
    } else {
        model.to_string()
    };

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_message },
        ],
    });

    let url = format!("{ep}/v1/chat/completions");
    let result = local_agent()
        .post(&url)
        .set("Content-Type", "application/json")
        .timeout(timeout)
        .send_json(&body);

    match result {
        Ok(resp) => {
            let json: Value = resp
                .into_json()
                .map_err(|e| format!("Invalid JSON from local endpoint: {e}"))?;
            parse_openai_compatible_body(&json, "local model")
        }
        Err(err) => Err(map_ureq_error("Local", err, false)),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Build the user message content for OpenAI-compatible APIs.
/// Returns a JSON value: plain string for text-only, array for image+text.
fn build_openai_user_message(req: &AiRequest) -> Value {
    let text = if req.image_base64.is_some() {
        // Vision: just the instruction, no "Text to transform:" wrapper
        req.prompt.clone()
    } else {
        format!(
            "Instruction: {}\n\nText to transform:\n{}",
            req.prompt, req.input_text
        )
    };
    if let (Some(b64), Some(mime)) = (&req.image_base64, &req.image_mime) {
        json!([
            {
                "type": "image_url",
                "image_url": {
                    "url": format!("data:{mime};base64,{b64}")
                }
            },
            { "type": "text", "text": text },
        ])
    } else {
        json!(text)
    }
}

/// Shared HTTP call for OpenAI-compatible chat completion endpoints.
/// Handles Authorization header, timeout, JSON parsing, empty response check,
/// content_filter finish_reason, and reasoning_content fallback.
fn call_openai_compatible(
    url: &str,
    api_key: &str,
    body: &Value,
    timeout: Duration,
    provider_name: &str,
    is_vision: bool,
) -> Result<String, String> {
    let result = ureq::post(url)
        .set("Content-Type", "application/json")
        .set("Authorization", &format!("Bearer {api_key}"))
        .timeout(timeout)
        .send_json(body);

    match result {
        Ok(resp) => {
            let json: Value = resp
                .into_json()
                .map_err(|e| format!("Invalid JSON from {provider_name}: {e}"))?;
            parse_openai_compatible_body(&json, provider_name)
        }
        Err(err) => Err(map_ureq_error(provider_name, err, is_vision)),
    }
}

/// Map ureq errors to human-readable messages.
fn map_ureq_error(provider: &str, err: ureq::Error, is_vision: bool) -> String {
    match err {
        ureq::Error::Status(status, resp) => {
            let body = resp.into_string().unwrap_or_default();
            map_status_error(provider, status, &body, is_vision)
        }
        ureq::Error::Transport(ref t) => {
            let kind = t.kind();
            match kind {
                ureq::ErrorKind::Io => {
                    let timeout_secs = if is_vision { 60 } else { 30 };
                    // ureq reports timeouts as Io errors with specific messages
                    let msg = t.to_string().to_lowercase();
                    if msg.contains("timed out")
                        || msg.contains("timeout")
                        || msg.contains("deadline")
                    {
                        format!("Request timed out ({timeout_secs}s)")
                    } else {
                        format!("Cannot reach {provider}. Check your internet connection")
                    }
                }
                ureq::ErrorKind::ConnectionFailed | ureq::ErrorKind::Dns => {
                    format!("Cannot reach {provider}. Check your internet connection")
                }
                _ => {
                    warn!(provider, error = %err, "AI request transport error");
                    format!("Cannot reach {provider}. Check your internet connection")
                }
            }
        }
    }
}

/// Validate that an endpoint is loopback only (localhost/127.0.0.1/[::1]).
/// Returns `Result<(), String>` (not `AppError`) so it can be used inside the AI pipeline
/// without depending on the commands crate. `commands/ai_cmds.rs` has a thin adapter that
/// maps the `String` error to `AppError::Validation`.
pub fn validate_loopback(endpoint: &str) -> Result<(), String> {
    let url = tauri::Url::parse(endpoint).map_err(|_| "Invalid local endpoint URL".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only http/https endpoints allowed".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Credentials are not allowed in local endpoints".into());
    }
    if matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")) {
        Ok(())
    } else {
        Err("Only loopback endpoints allowed (localhost/127.0.0.1/[::1])".into())
    }
}

/// Keep every local AI request on its validated endpoint, including discovery and vision.
pub(crate) fn local_agent() -> ureq::Agent {
    ureq::AgentBuilder::new().redirects(0).build()
}

/// Auto-detect model from a local endpoint's /v1/models.
fn auto_detect_model(endpoint: &str) -> Result<String, String> {
    let url = format!("{endpoint}/v1/models");
    let resp = local_agent()
        .get(&url)
        .timeout(Duration::from_secs(5))
        .call()
        .map_err(|e| format!("Failed to auto-detect model: {e}"))?;
    let json: Value = resp
        .into_json()
        .map_err(|e| format!("Invalid JSON from /v1/models: {e}"))?;
    json["data"][0]["id"]
        .as_str()
        .or_else(|| json["data"][0]["name"].as_str())
        .map(String::from)
        .ok_or_else(|| {
            "No model specified and auto-detect failed. \
             Enter a model name in Settings \u{2192} AI."
                .into()
        })
}

/// Truncate a string to at most `max_chars` Unicode scalar values, appending
/// `"…"` if truncated. Used to cap raw HTTP bodies in error messages.
fn truncate_chars(s: &str, max_chars: usize) -> String {
    let mut chars = s.chars();
    let collected: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        format!("{collected}…")
    } else {
        collected
    }
}

/// Parse an OpenAI-compatible chat completion JSON body into the result text.
/// Handles `content` / `reasoning_content` fallback and `content_filter` finish reason.
/// Falls back to `reasoning_content` when `content` is absent or empty (DeepSeek).
fn parse_openai_compatible_body(
    json: &serde_json::Value,
    provider_name: &str,
) -> Result<String, String> {
    let msg0 = &json["choices"][0]["message"];
    let content_raw = msg0["content"].as_str().unwrap_or("").trim();
    let content = if content_raw.is_empty() {
        msg0["reasoning_content"].as_str().unwrap_or("").trim()
    } else {
        content_raw
    };
    let finish_reason = json["choices"][0]["finish_reason"].as_str().unwrap_or("");
    if finish_reason == "length" {
        return Err(incomplete_output_error(provider_name));
    }

    if content.is_empty() {
        if finish_reason == "content_filter" {
            Err("Content was filtered by the AI provider's safety policy".into())
        } else {
            Err(format!("Empty response from {provider_name}"))
        }
    } else {
        Ok(content.to_string())
    }
}

/// Map an HTTP status code + response body to a human-readable error string.
/// Extracted from the `ureq::Error::Status` branch of `map_ureq_error`.
fn map_status_error(provider: &str, status: u16, body: &str, is_vision: bool) -> String {
    match status {
        401 => "API key is invalid or expired".into(),
        429 => "Rate limited \u{2014} please wait a moment".into(),
        400 => {
            // Check for vision-related error keywords
            let lower = body.to_lowercase();
            let vision_keywords = [
                "image",
                "vision",
                "multimodal",
                "does not support",
                "not supported",
                "content type",
            ];
            if is_vision && vision_keywords.iter().any(|kw| lower.contains(kw)) {
                "This model doesn't support image analysis. \
                 Try GPT-4o, Claude, or Gemini"
                    .into()
            } else {
                // Try to parse error message from JSON
                if let Ok(json) = serde_json::from_str::<Value>(body) {
                    if let Some(msg) = json["error"]["message"].as_str() {
                        return msg.to_string();
                    }
                }
                format!("Bad request: {}", truncate_chars(body, 500))
            }
        }
        _ => {
            // Try to parse error message from JSON body
            if let Ok(json) = serde_json::from_str::<Value>(body) {
                if let Some(msg) = json["error"]["message"].as_str() {
                    return msg.to_string();
                }
            }
            format!("{provider} API error {status}")
        }
    }
}

/// Parse an Anthropic Messages API JSON body into the result text.
/// Finds the first content block with `"type": "text"` — Sonnet may return
/// thinking blocks before the text block.
fn parse_anthropic_body(json: &serde_json::Value) -> Result<String, String> {
    if json["stop_reason"].as_str() == Some("max_tokens") {
        return Err(incomplete_output_error("Anthropic"));
    }
    let content = json["content"]
        .as_array()
        .and_then(|blocks| {
            blocks.iter().find_map(|b| {
                if b["type"].as_str() == Some("text") {
                    b["text"].as_str()
                } else {
                    None
                }
            })
        })
        .unwrap_or("")
        .trim();
    if content.is_empty() {
        Err("Empty response from Anthropic".into())
    } else {
        Ok(content.to_string())
    }
}

/// Parse an Ollama `/api/chat` JSON response body.
/// Returns `Err` when the body contains an `"error"` field (LM Studio 200+error
/// gotcha) and `Ok(content)` for a real Ollama `{"message":{"content":"…"}}` reply.
fn parse_local_chat_body(json: &serde_json::Value) -> Result<String, String> {
    // LM Studio returns 200 + {"error": "..."} on unsupported endpoints
    if let Some(err) = json.get("error") {
        let msg = err
            .as_str()
            .map(|s| s.to_string())
            .or_else(|| {
                err.get("message")
                    .and_then(|m| m.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| err.to_string());
        return Err(format!("Local LLM error: {msg}"));
    }
    if json["done_reason"].as_str() == Some("length") {
        return Err(incomplete_output_error("Ollama"));
    }
    // Ollama response: { "message": { "content": "..." } }
    let content = json["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();
    if content.is_empty() {
        Err("Empty response from local LLM".into())
    } else {
        Ok(content)
    }
}

fn incomplete_output_error(provider: &str) -> String {
    format!("Incomplete response from {provider}: token limit reached. Try shorter input or request a shorter result.")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::local_test_support::LoopbackServer;
    use super::*;

    #[test]
    fn local_endpoint_rejects_userinfo_and_malformed_urls() {
        for endpoint in [
            "http://localhost:1234@remote.example",
            "http://127.0.0.1:1234@remote.example",
            "http://localhost:1234%40remote.example@remote.example",
            "http://localhost:1234@127.0.0.1:5678",
            "http://user:password@localhost:1234",
            "http://:password@[::1]:1234",
            "http://localhost.remote.example:1234",
            "http://localhost:invalid",
            "http://localhost:65536",
            "http://[::1]:1234@remote.example",
            "ftp://localhost:1234",
            "//localhost:1234",
        ] {
            assert!(validate_loopback(endpoint).is_err(), "accepted {endpoint}");
        }
    }

    #[test]
    fn local_endpoint_accepts_loopback_urls() {
        for endpoint in [
            "http://localhost:1234",
            "https://localhost:8443",
            "http://127.0.0.1:1234",
            "https://127.0.0.1:8443/api",
            "http://[::1]:1234",
            "https://[::1]:8443/",
            "http://localhost/api@v1",
            "HTTP://LOCALHOST:1234",
        ] {
            assert!(validate_loopback(endpoint).is_ok(), "rejected {endpoint}");
        }
    }

    fn local_transform_request(endpoint: &str, vision: bool) -> AiRequest {
        AiRequest {
            provider: "local".into(),
            model: "test-model".into(),
            endpoint: Some(endpoint.into()),
            prompt: "Summarize".into(),
            input_text: "synthetic input".into(),
            image_base64: vision.then(|| "c3ludGhldGlj".into()),
            image_mime: vision.then(|| "image/png".into()),
        }
    }

    #[test]
    fn local_chat_does_not_follow_redirects() {
        for status in [301, 302, 303, 307, 308] {
            let server = LoopbackServer::new(vec![(status, "")]);
            let result = local_request(
                &server.endpoint,
                "test-model",
                "test",
                "synthetic input",
                Duration::from_secs(2),
            );
            let requests = server.finish();
            assert_eq!(requests.len(), 1, "followed HTTP {status}");
            assert_eq!(requests[0].0, "POST /v1/chat/completions HTTP/1.1");
            assert!(result.is_err());
        }
    }

    #[test]
    fn local_auto_detect_does_not_follow_redirects() {
        for status in [301, 302, 303, 307, 308] {
            let server = LoopbackServer::new(vec![(status, "")]);
            let result = local_request(
                &server.endpoint,
                "",
                "test",
                "synthetic input",
                Duration::from_secs(2),
            );
            let requests = server.finish();
            assert_eq!(requests.len(), 1, "followed HTTP {status}");
            assert_eq!(requests[0].0, "GET /v1/models HTTP/1.1");
            assert!(result.is_err());
        }
    }

    #[test]
    fn local_ollama_vision_does_not_follow_redirects() {
        for status in [301, 302, 303, 307, 308] {
            let server = LoopbackServer::new(vec![(status, "")]);
            let result = execute_ai_request(&local_transform_request(&server.endpoint, true));
            let requests = server.finish();
            assert_eq!(requests.len(), 1, "followed HTTP {status}");
            assert_eq!(requests[0].0, "POST /api/chat HTTP/1.1");
            assert!(result.is_err());
        }
    }

    #[test]
    fn local_vision_fallback_does_not_follow_redirects() {
        for status in [301, 302, 303, 307, 308] {
            let server = LoopbackServer::new(vec![(404, ""), (status, "")]);
            let result = execute_ai_request(&local_transform_request(&server.endpoint, true));
            let requests = server.finish();
            assert_eq!(requests.len(), 2, "followed HTTP {status}");
            assert_eq!(requests[0].0, "POST /api/chat HTTP/1.1");
            assert_eq!(requests[1].0, "POST /v1/chat/completions HTTP/1.1");
            assert!(result.is_err());
        }
    }

    #[test]
    fn local_empty_model_discovers_and_submits_model_id() {
        for transform in [false, true] {
            let server = LoopbackServer::new(vec![
                (200, r#"{"data":[{"id":"discovered-model"}]}"#),
                (
                    200,
                    r#"{"choices":[{"message":{"content":"local answer"}}]}"#,
                ),
            ]);
            let result = if transform {
                let mut req = local_transform_request(&server.endpoint, false);
                req.model.clear();
                execute_ai_request(&req).map(|response| response.text)
            } else {
                local_request(
                    &server.endpoint,
                    "",
                    "test",
                    "synthetic input",
                    Duration::from_secs(2),
                )
            };
            let requests = server.finish();
            assert_eq!(result.unwrap(), "local answer");
            assert_eq!(requests.len(), 2);
            assert_eq!(requests[0].0, "GET /v1/models HTTP/1.1");
            assert_eq!(requests[1].0, "POST /v1/chat/completions HTTP/1.1");
            assert_eq!(requests[1].1["model"], "discovered-model");
        }
    }

    #[test]
    fn local_vision_preserves_ollama_and_openai_fallback() {
        for responses in [
            vec![(200, r#"{"message":{"content":"local answer"}}"#)],
            vec![
                (404, ""),
                (
                    200,
                    r#"{"choices":[{"message":{"content":"local answer"}}]}"#,
                ),
            ],
            vec![
                (200, r#"{"error":"unsupported endpoint"}"#),
                (
                    200,
                    r#"{"choices":[{"message":{"content":"local answer"}}]}"#,
                ),
            ],
        ] {
            let expected_count = responses.len();
            let server = LoopbackServer::new(responses);
            let result = execute_ai_request(&local_transform_request(&server.endpoint, true));
            let requests = server.finish();
            assert_eq!(result.unwrap().text, "local answer");
            assert_eq!(requests.len(), expected_count);
            assert_eq!(requests[0].1["messages"][1]["images"][0], "c3ludGhldGlj");
            if expected_count == 2 {
                assert_eq!(requests[1].0, "POST /v1/chat/completions HTTP/1.1");
                assert_eq!(
                    requests[1].1["messages"][1]["content"][0]["type"],
                    "image_url"
                );
            }
        }
    }

    #[test]
    fn strip_think_no_tags() {
        assert_eq!(strip_think_tags("Hello world"), "Hello world");
    }

    #[test]
    fn strip_think_single_block() {
        let input = "<think>some reasoning</think>\n\nHello world";
        assert_eq!(strip_think_tags(input), "Hello world");
    }

    #[test]
    fn strip_think_multiple_blocks() {
        let input = "<think>first</think>Hello <think>second</think>world";
        assert_eq!(strip_think_tags(input), "Hello world");
    }

    #[test]
    fn strip_think_unclosed_tag() {
        let input = "<think>reasoning with partial output...";
        assert_eq!(strip_think_tags(input), "reasoning with partial output...");
    }

    #[test]
    fn strip_think_multiline() {
        let input = "<think>\nline1\nline2\n</think>\n\nResult";
        assert_eq!(strip_think_tags(input), "Result");
    }

    #[test]
    fn strip_think_preserves_mid_text_angle_brackets() {
        let input = "Hello <b>world</b> test";
        assert_eq!(strip_think_tags(input), "Hello <b>world</b> test");
    }

    #[test]
    fn anthropic_model_id_maps_short_names() {
        assert_eq!(
            anthropic_model_id("claude-haiku-4-5"),
            "claude-haiku-4-5-20251001"
        );
        assert_eq!(anthropic_model_id("claude-sonnet-4-6"), "claude-sonnet-4-6");
        // Unknown models pass through
        assert_eq!(anthropic_model_id("claude-opus-5"), "claude-opus-5");
    }

    // ---------------------------------------------------------------------------
    // parse_openai_compatible_body tests
    // ---------------------------------------------------------------------------

    #[test]
    fn parse_openai_body_happy_path() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"choices":[{"message":{"content":"  result text  "},"finish_reason":"stop"}]}"#,
        )
        .unwrap();
        assert_eq!(
            parse_openai_compatible_body(&json, "OpenAI").unwrap(),
            "result text"
        );
    }

    #[test]
    fn parse_openai_body_reasoning_content_fallback() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"choices":[{"message":{"content":"","reasoning_content":"deep thought"},"finish_reason":"stop"}]}"#,
        )
        .unwrap();
        assert_eq!(
            parse_openai_compatible_body(&json, "DeepSeek").unwrap(),
            "deep thought"
        );
    }

    #[test]
    fn parse_openai_body_content_filter() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"choices":[{"message":{"content":""},"finish_reason":"content_filter"}]}"#,
        )
        .unwrap();
        let err = parse_openai_compatible_body(&json, "OpenAI").unwrap_err();
        assert!(err.contains("filtered"), "got: {err}");
    }

    #[test]
    fn parse_openai_body_missing_choices_is_empty_error() {
        let json: serde_json::Value = serde_json::from_str(r#"{"object":"list"}"#).unwrap();
        let err = parse_openai_compatible_body(&json, "LM Studio").unwrap_err();
        assert!(err.contains("Empty response from LM Studio"), "got: {err}");
    }

    // ---------------------------------------------------------------------------
    // map_status_error tests
    // ---------------------------------------------------------------------------

    #[test]
    fn map_status_error_401_and_429() {
        assert_eq!(
            map_status_error("OpenAI", 401, "", false),
            "API key is invalid or expired"
        );
        assert!(map_status_error("OpenAI", 429, "", false).contains("Rate limited"));
    }

    #[test]
    fn map_status_error_400_vision_keyword() {
        let msg = map_status_error(
            "OpenAI",
            400,
            r#"{"error":{"message":"model does not support image input"}}"#,
            true,
        );
        assert!(msg.contains("doesn't support image analysis"), "got: {msg}");
    }

    #[test]
    fn map_status_error_400_extracts_json_message() {
        let msg = map_status_error(
            "Gemini",
            400,
            r#"{"error":{"message":"invalid argument: contents"}}"#,
            false,
        );
        assert_eq!(msg, "invalid argument: contents");
    }

    #[test]
    fn map_status_error_400_raw_body_is_truncated() {
        let long = "y".repeat(2000);
        let msg = map_status_error("OpenAI", 400, &long, false);
        assert!(msg.starts_with("Bad request: "));
        assert!(
            msg.chars().count() < 600,
            "raw body must be truncated, got {}",
            msg.chars().count()
        );
    }

    #[test]
    fn map_status_error_500_falls_back_to_provider_and_code() {
        assert_eq!(
            map_status_error("Anthropic", 500, "not json", false),
            "Anthropic API error 500"
        );
    }

    // ---------------------------------------------------------------------------
    // parse_anthropic_body tests
    // ---------------------------------------------------------------------------

    #[test]
    fn parse_anthropic_body_happy_path() {
        let json: serde_json::Value =
            serde_json::from_str(r#"{"content":[{"type":"text","text":"  hello world  "}]}"#)
                .unwrap();
        assert_eq!(parse_anthropic_body(&json).unwrap(), "hello world");
    }

    #[test]
    fn parse_anthropic_body_skips_thinking_blocks() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"content":[{"type":"thinking","thinking":"my reasoning"},{"type":"text","text":"answer"}]}"#,
        )
        .unwrap();
        assert_eq!(parse_anthropic_body(&json).unwrap(), "answer");
    }

    #[test]
    fn parse_anthropic_body_empty_returns_err() {
        let json: serde_json::Value = serde_json::from_str(r#"{"content":[]}"#).unwrap();
        assert!(parse_anthropic_body(&json).is_err());
    }

    // ---------------------------------------------------------------------------
    // parse_local_chat_body tests
    // ---------------------------------------------------------------------------

    #[test]
    fn parse_local_chat_body_happy_path() {
        let json: serde_json::Value =
            serde_json::from_str(r#"{"message":{"content":"hello from ollama"}}"#).unwrap();
        assert_eq!(parse_local_chat_body(&json).unwrap(), "hello from ollama");
    }

    #[test]
    fn parse_local_chat_body_200_with_error_field() {
        // LM Studio returns HTTP 200 with {"error": "..."} body
        let json: serde_json::Value =
            serde_json::from_str(r#"{"error":"model not loaded"}"#).unwrap();
        let err = parse_local_chat_body(&json).unwrap_err();
        assert!(
            err.contains("model not loaded"),
            "expected error text, got: {err}"
        );
    }

    #[test]
    fn parse_local_chat_body_200_with_error_object() {
        let json: serde_json::Value =
            serde_json::from_str(r#"{"error":{"message":"context length exceeded"}}"#).unwrap();
        let err = parse_local_chat_body(&json).unwrap_err();
        assert!(err.contains("context length exceeded"), "got: {err}");
    }
}

#[cfg(test)]
pub(crate) mod local_test_support {
    use serde_json::Value;
    use std::io::{BufRead, BufReader, Read, Write};
    use std::net::TcpListener;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use std::thread::{self, JoinHandle};
    use std::time::{Duration, Instant};

    pub(crate) struct LoopbackServer {
        pub endpoint: String,
        stop: Arc<AtomicBool>,
        worker: JoinHandle<Vec<(String, Value)>>,
    }

    impl LoopbackServer {
        pub fn new(responses: Vec<(u16, &'static str)>) -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            listener.set_nonblocking(true).unwrap();
            let endpoint = format!("http://{}", listener.local_addr().unwrap());
            let redirect = format!("{endpoint}/redirected");
            let stop = Arc::new(AtomicBool::new(false));
            let worker_stop = stop.clone();
            let worker = thread::spawn(move || {
                let deadline = Instant::now() + Duration::from_secs(5);
                let mut responses = responses.into_iter();
                let mut requests = Vec::new();
                while !worker_stop.load(Ordering::SeqCst) && Instant::now() < deadline {
                    let (mut stream, _) = match listener.accept() {
                        Ok(connection) => connection,
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(5));
                            continue;
                        }
                        Err(e) => panic!("accept failed: {e}"),
                    };
                    stream.set_nonblocking(false).unwrap();
                    stream
                        .set_read_timeout(Some(Duration::from_secs(1)))
                        .unwrap();
                    stream
                        .set_write_timeout(Some(Duration::from_secs(1)))
                        .unwrap();
                    let mut reader = BufReader::new(&mut stream);
                    let mut request_line = String::new();
                    reader.read_line(&mut request_line).unwrap();
                    let mut content_length = 0;
                    loop {
                        let mut line = String::new();
                        reader.read_line(&mut line).unwrap();
                        if line == "\r\n" || line.is_empty() {
                            break;
                        }
                        if let Some((name, value)) = line.split_once(':') {
                            if name.eq_ignore_ascii_case("content-length") {
                                content_length = value.trim().parse::<usize>().unwrap();
                            }
                        }
                    }
                    let mut body = vec![0; content_length];
                    reader.read_exact(&mut body).unwrap();
                    let json = if body.is_empty() {
                        Value::Null
                    } else {
                        serde_json::from_slice(&body).unwrap()
                    };
                    requests.push((request_line.trim().to_string(), json));
                    // An unexpected redirected request gets a valid reply so the assertion detects it.
                    let (status, body) = responses.next().unwrap_or((200,
                        r#"{"data":[{"id":"redirected-model"}],"message":{"content":"redirected"},"choices":[{"message":{"content":"redirected"}}]}"#));
                    write!(stream,
                        "HTTP/1.1 {status} Test\r\nLocation: {redirect}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
                }
                requests
            });
            Self {
                endpoint,
                stop,
                worker,
            }
        }

        pub fn finish(self) -> Vec<(String, Value)> {
            self.stop.store(true, Ordering::SeqCst);
            self.worker.join().unwrap()
        }
    }
}
#[cfg(test)]
mod completion_tests {
    use super::*;

    #[test]
    fn token_limited_responses_are_not_successes() {
        for provider in ["OpenAI", "Gemini", "DeepSeek", "local model"] {
            for message in [
                json!({"content": "unfinished"}),
                json!({"reasoning_content": "unfinished"}),
            ] {
                let body = json!({"choices": [{"message": message, "finish_reason": "length"}]});
                let error = parse_openai_compatible_body(&body, provider).unwrap_err();
                assert!(error.contains("token limit"), "{error}");
                assert!(error.contains("shorter"), "{error}");
            }
        }
        let error = parse_anthropic_body(&json!({
            "content": [{"type": "text", "text": "unfinished"}], "stop_reason": "max_tokens"
        }))
        .unwrap_err();
        assert!(error.contains("token limit"), "{error}");
        let error = parse_local_chat_body(&json!({
            "message": {"content": "unfinished"}, "done": true, "done_reason": "length"
        }))
        .unwrap_err();
        assert!(error.contains("token limit"), "{error}");
    }

    #[test]
    fn local_vision_checks_completion_in_both_protocols() {
        use super::local_test_support::LoopbackServer;
        for (responses, expected) in [
            (
                vec![(
                    200,
                    r#"{"message":{"content":"unfinished"},"done":true,"done_reason":"length"}"#,
                )],
                Err("token limit"),
            ),
            (
                vec![
                    (404, "{}"),
                    (
                        200,
                        r#"{"choices":[{"message":{"content":"unfinished"},"finish_reason":"length"}]}"#,
                    ),
                ],
                Err("token limit"),
            ),
            (
                vec![
                    (200, r#"{"error":"unsupported"}"#),
                    (
                        200,
                        r#"{"choices":[{"message":{"content":"finished"},"finish_reason":"stop"}]}"#,
                    ),
                ],
                Ok("finished"),
            ),
            (
                vec![
                    (404, "{}"),
                    (200, r#"{"error":{"message":"model not loaded"}}"#),
                ],
                Err("model not loaded"),
            ),
            (
                vec![
                    (404, "{}"),
                    (
                        200,
                        r#"{"choices":[{"message":{"content":""},"finish_reason":"stop"}]}"#,
                    ),
                ],
                Err("supports images"),
            ),
            (
                vec![(
                    200,
                    r#"{"message":{"content":"finished"},"done":true,"done_reason":"stop"}"#,
                )],
                Ok("finished"),
            ),
        ] {
            let count = responses.len();
            let server = LoopbackServer::new(responses);
            let req = AiRequest {
                provider: "local".into(),
                model: "fixture-vision".into(),
                endpoint: Some(server.endpoint.clone()),
                prompt: "Describe".into(),
                input_text: String::new(),
                image_base64: Some("Zml4dHVyZQ==".into()),
                image_mime: Some("image/png".into()),
            };
            let result = local_request_transform(&req, "Describe", Duration::from_secs(2));
            let requests = server.finish();
            assert_eq!(requests.len(), count);
            assert_eq!(requests[0].0, "POST /api/chat HTTP/1.1");
            if count == 2 {
                assert_eq!(requests[1].0, "POST /v1/chat/completions HTTP/1.1");
            }
            match expected {
                Ok(text) => assert_eq!(result.unwrap(), text),
                Err(fragment) => assert!(result.unwrap_err().contains(fragment)),
            }
        }
    }
}
