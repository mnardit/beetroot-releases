//! Job queue and background worker thread for AI transforms.
//!
//! Manages a queue of AI transform jobs processed sequentially by a single
//! worker thread. Results are saved to the clipboard DB and emitted as
//! Tauri events (`job-completed` / `job-failed`).

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::Serialize;
use sha2::Digest;
use tauri::{Emitter, Manager};
use tracing::{error, info, warn};
use unicode_normalization::UnicodeNormalization;

use crate::ai::{self, AiRequest};
use crate::commands;
use crate::DbPool;

// ---------------------------------------------------------------------------
// Submit-time validation limits
// ---------------------------------------------------------------------------

/// Max queued+running jobs. Beyond this, submit() returns Err — the UI should
/// surface a "queue full, try again later" toast.
pub(crate) const MAX_QUEUED_JOBS: usize = 16;

// Per-payload byte limits live in `ai.rs` so the request-time check and the
// submit-time gate share one source of truth.
use crate::ai::{MAX_IMAGE_BASE64_LENGTH, MAX_INPUT_LENGTH};

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone)]
pub enum JobSource {
    User,
    Auto,
    Mcp,
}

struct Job {
    id: u64,
    status: JobStatus,
    request: AiRequest,
    source: JobSource,
    prompt_name: String,
    result: Option<String>,
    error: Option<String>,
    created_at: Instant,
}

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
struct JobCompletedEvent {
    id: u64,
    result: String,
    source: String,
    prompt_name: String,
    /// True if Rust already sent a native notification (window was hidden).
    notified: bool,
}

#[derive(Serialize, Clone)]
struct JobFailedEvent {
    id: u64,
    error: String,
    prompt_name: String,
    /// True if Rust already sent a native notification (window was hidden).
    notified: bool,
}

// ---------------------------------------------------------------------------
// Job snapshots for queue regression tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobInfo {
    pub id: u64,
    pub status: String,
    pub prompt_name: String,
    pub source: String,
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Convert a `JobSource` to its string representation.
pub fn source_str(source: &JobSource) -> &'static str {
    match source {
        JobSource::User => "user",
        JobSource::Auto => "auto",
        JobSource::Mcp => "mcp",
    }
}

/// Auto-incrementing job ID counter.
static NEXT_JOB_ID: AtomicU64 = AtomicU64::new(1);

/// Compute SHA-256 hash of NFC-normalized text, matching the frontend's `hashText()`.
///
/// Frontend does: `text.normalize("NFC")` -> `TextEncoder.encode()` ->
/// `crypto.subtle.digest("SHA-256")` -> hex.
fn sha256_hash(text: &str) -> String {
    let normalized: String = text.nfc().collect();
    let mut hasher = sha2::Sha256::new();
    hasher.update(normalized.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ---------------------------------------------------------------------------
// JobManager
// ---------------------------------------------------------------------------

/// Thread-safe job queue managed as Tauri state.
pub struct JobManager {
    jobs: Mutex<Vec<Job>>,
    signal: parking_lot::Condvar,
    shutdown: AtomicBool,
}

impl Default for JobManager {
    fn default() -> Self {
        Self::new()
    }
}

impl JobManager {
    pub fn new() -> Self {
        Self {
            jobs: Mutex::new(Vec::new()),
            signal: parking_lot::Condvar::new(),
            shutdown: AtomicBool::new(false),
        }
    }

    /// Add a job to the queue after validating size and queue depth.
    pub fn submit(
        &self,
        request: AiRequest,
        source: JobSource,
        prompt_name: String,
    ) -> Result<u64, String> {
        if request.input_text.len() > MAX_INPUT_LENGTH {
            return Err(format!(
                "Text too long for AI transform (max {} bytes)",
                MAX_INPUT_LENGTH
            ));
        }
        if let Some(ref b64) = request.image_base64 {
            if b64.len() > MAX_IMAGE_BASE64_LENGTH {
                return Err("Image too large for AI vision (max ~10MB)".into());
            }
        }

        let mut jobs = self.jobs.lock();
        let active_count = jobs
            .iter()
            .filter(|j| matches!(j.status, JobStatus::Queued | JobStatus::Running))
            .count();
        if active_count >= MAX_QUEUED_JOBS {
            return Err("AI job queue is full, try again in a moment".into());
        }

        let id = NEXT_JOB_ID.fetch_add(1, Ordering::Relaxed);
        let job = Job {
            id,
            status: JobStatus::Queued,
            request,
            source,
            prompt_name,
            result: None,
            error: None,
            created_at: Instant::now(),
        };
        jobs.push(job);
        self.signal.notify_one();
        Ok(id)
    }

    /// Cancel a queued job. Returns `true` if the job was Queued and is now Cancelled.
    /// Also scrubs the payload (input_text / image_base64) since
    /// Cancelled is a terminal status — same hygiene as complete()/fail().
    pub fn cancel(&self, job_id: u64) -> bool {
        let mut jobs = self.jobs.lock();
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            if job.status == JobStatus::Queued {
                job.status = JobStatus::Cancelled;
                job.request.input_text.clear();
                job.request.image_base64 = None;
                return true;
            }
        }
        false
    }

    /// Find the first Queued job, set it to Running, and return its ID.
    pub fn take_next(&self) -> Option<u64> {
        let mut jobs = self.jobs.lock();
        if let Some(job) = jobs.iter_mut().find(|j| j.status == JobStatus::Queued) {
            job.status = JobStatus::Running;
            Some(job.id)
        } else {
            None
        }
    }

    /// Block until a queued job is available, the timeout passes, or stop() is
    /// called. Marks the returned job Running. None = timeout or shutdown.
    pub fn wait_next(&self, timeout: Duration) -> Option<u64> {
        let mut jobs = self.jobs.lock();
        loop {
            if self.is_shutdown() {
                return None;
            }
            if let Some(job) = jobs.iter_mut().find(|j| j.status == JobStatus::Queued) {
                job.status = JobStatus::Running;
                return Some(job.id);
            }
            if self.signal.wait_for(&mut jobs, timeout).timed_out() {
                return None;
            }
        }
    }

    /// Signal shutdown: the worker stops taking jobs and stops writing to the DB.
    pub fn stop(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
        let _jobs = self.jobs.lock(); // close the check-to-park window
        self.signal.notify_all();
    }

    pub fn is_shutdown(&self) -> bool {
        self.shutdown.load(Ordering::SeqCst)
    }

    /// Clone the request data for a given job (used by the worker thread).
    pub fn get_request(&self, job_id: u64) -> Option<(AiRequest, JobSource, String)> {
        let jobs = self.jobs.lock();
        jobs.iter()
            .find(|j| j.id == job_id)
            .map(|j| (j.request.clone(), j.source.clone(), j.prompt_name.clone()))
    }

    /// Mark a job as Completed and store the result text.
    pub fn complete(&self, job_id: u64, result: String) {
        let mut jobs = self.jobs.lock();
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            job.status = JobStatus::Completed;
            job.result = Some(result);
        }
    }

    /// Mark a job as Failed and store the error message.
    pub fn fail(&self, job_id: u64, error: String) {
        let mut jobs = self.jobs.lock();
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            job.status = JobStatus::Failed;
            job.error = Some(error);
        }
    }

    /// Mark all Queued and Running jobs as Failed (e.g. after a worker panic).
    pub fn fail_all_queued(&self, error: &str) {
        let mut jobs = self.jobs.lock();
        for job in jobs.iter_mut() {
            if job.status == JobStatus::Queued || job.status == JobStatus::Running {
                job.status = JobStatus::Failed;
                job.error = Some(error.to_string());
            }
        }
    }

    /// Remove old completed/failed/cancelled jobs. Keeps the last 50, or any
    /// job younger than 5 minutes.
    pub fn prune(&self) {
        let mut jobs = self.jobs.lock();
        let cutoff = Instant::now() - Duration::from_secs(300);

        // Partition: active (Queued/Running) are always kept.
        // Done jobs (Completed/Failed/Cancelled) are candidates for pruning.
        let done_count = jobs
            .iter()
            .filter(|j| {
                matches!(
                    j.status,
                    JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled
                )
            })
            .count();

        if done_count <= 50 {
            return;
        }

        jobs.retain(|j| match j.status {
            JobStatus::Queued | JobStatus::Running => true,
            _ => j.created_at > cutoff,
        });

        // If still over 50 done jobs, keep only the 50 most recent
        let done_count = jobs
            .iter()
            .filter(|j| {
                matches!(
                    j.status,
                    JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled
                )
            })
            .count();

        if done_count > 50 {
            // Sort done jobs by created_at descending, remove oldest
            let mut done_indices: Vec<usize> = jobs
                .iter()
                .enumerate()
                .filter(|(_, j)| {
                    matches!(
                        j.status,
                        JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled
                    )
                })
                .map(|(i, _)| i)
                .collect();
            // Sort by created_at ascending (oldest first)
            done_indices.sort_by(|a, b| jobs[*a].created_at.cmp(&jobs[*b].created_at));
            // Remove the oldest ones (keep last 50)
            let to_remove = done_count - 50;
            let remove_set: std::collections::HashSet<usize> =
                done_indices[..to_remove].iter().copied().collect();
            let mut idx = 0;
            jobs.retain(|_| {
                let keep = !remove_set.contains(&idx);
                idx += 1;
                keep
            });
        }
    }

    /// Scrub all sensitive/heavy data from a job's request after a terminal
    /// status (Completed / Failed / Cancelled).
    ///
    /// Clears `input_text` and `image_base64` — the codebase has
    /// no retry mechanism, so holding onto these (megabytes for vision jobs)
    /// is pure memory pressure until the prune cycle. `result` is preserved
    /// because the UI displays it. If retry is added later, the frontend
    /// should submit a new job with whatever data it still has.
    pub fn scrub_payload(&self, job_id: u64) {
        let mut jobs = self.jobs.lock();
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            job.request.input_text.clear();
            job.request.image_base64 = None;
        }
    }

    /// Inspect queue state without exposing another renderer command.
    #[cfg(test)]
    pub fn list(&self) -> Vec<JobInfo> {
        let jobs = self.jobs.lock();
        jobs.iter()
            .map(|j| JobInfo {
                id: j.id,
                status: match j.status {
                    JobStatus::Queued => "queued".to_string(),
                    JobStatus::Running => "running".to_string(),
                    JobStatus::Completed => "completed".to_string(),
                    JobStatus::Failed => "failed".to_string(),
                    JobStatus::Cancelled => "cancelled".to_string(),
                },
                prompt_name: j.prompt_name.clone(),
                source: source_str(&j.source).to_string(),
                error: j.error.clone(),
            })
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Worker thread
// ---------------------------------------------------------------------------

/// Spawn the background worker thread that processes AI jobs sequentially.
pub fn start_worker(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        info!("job worker thread started");
        loop {
            let result = catch_unwind(AssertUnwindSafe(|| worker_loop(&app_handle)));
            if let Err(e) = result {
                let msg = if let Some(s) = e.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = e.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "unknown panic".to_string()
                };
                error!("job worker panicked: {msg}, restarting...");
                let manager = app_handle.state::<JobManager>();
                manager.fail_all_queued("Internal error, please retry");
            }
            if app_handle.state::<JobManager>().is_shutdown() {
                info!("job worker stopped");
                return;
            }
        }
    });
}

/// Main worker loop: poll for queued jobs, execute, save results.
fn worker_loop(app_handle: &tauri::AppHandle) {
    let manager = app_handle.state::<JobManager>();
    loop {
        if manager.is_shutdown() {
            return;
        }
        let Some(job_id) = manager.wait_next(Duration::from_secs(5)) else {
            continue;
        };

        let (request, source, prompt_name) = match manager.get_request(job_id) {
            Some(data) => data,
            None => continue,
        };

        let outcome = ai::execute_ai_request(&request).and_then(|response| {
            finalize_job(&manager, job_id, response.text, |text| {
                save_ai_result(app_handle, text, &prompt_name, &request.model)
            })
        });
        match outcome {
            Ok(text) => {
                // Check AFTER request (30-60s) — window state may have changed
                let hidden = !crate::WINDOW_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);
                if hidden {
                    // No English words — prompt_name is already localized by frontend
                    send_native_notification(app_handle, &format!("\u{2713} {prompt_name}"));
                }

                let _ = app_handle.emit(
                    "job-completed",
                    JobCompletedEvent {
                        id: job_id,
                        result: text,
                        source: source_str(&source).to_string(),
                        prompt_name: prompt_name.clone(),
                        notified: hidden,
                    },
                );
            }
            Err(err) => {
                // Terminal status on the error path too — free the payload.
                manager.fail(job_id, err.clone());
                manager.scrub_payload(job_id);

                let hidden = !crate::WINDOW_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);
                if hidden {
                    // Just prompt name + short error — no "failed:" English word
                    send_native_notification(app_handle, &format!("\u{2717} {prompt_name}"));
                }

                let _ = app_handle.emit(
                    "job-failed",
                    JobFailedEvent {
                        id: job_id,
                        error: err,
                        prompt_name: prompt_name.clone(),
                        notified: hidden,
                    },
                );
            }
        }

        manager.prune();
    }
}

/// Save an AI transform result to the clipboard database.
fn finalize_job(
    manager: &JobManager,
    job_id: u64,
    text: String,
    persist: impl FnOnce(&str) -> Result<(), String>,
) -> Result<String, String> {
    let saved = if manager.is_shutdown() {
        Err("application is shutting down".into())
    } else {
        persist(&text)
    };
    manager.scrub_payload(job_id);
    match saved {
        Ok(()) => {
            manager.complete(job_id, text.clone());
            Ok(text)
        }
        Err(error) => {
            let error = format!("AI output was not saved: {error}");
            manager.fail(job_id, error.clone());
            if let Some(job) = manager.jobs.lock().iter_mut().find(|job| job.id == job_id) {
                job.result = Some(text);
            }
            Err(error)
        }
    }
}

fn save_ai_result(
    app_handle: &tauri::AppHandle,
    text: &str,
    prompt_name: &str,
    model: &str,
) -> Result<(), String> {
    let pool = app_handle.state::<DbPool>();
    let conn = pool.0.lock();
    persist_ai_result(
        &conn,
        &app_handle.state::<JobManager>(),
        text,
        prompt_name,
        model,
    )?;
    drop(conn); // release lock before backup
    let db_path = app_handle.state::<crate::DataDir>().0.join("clipboard.db");
    crate::backup::maybe_backup(app_handle, &db_path);
    info!(prompt_name, model, "saved AI result to DB");
    Ok(())
}

fn persist_ai_result(
    conn: &rusqlite::Connection,
    manager: &JobManager,
    text: &str,
    prompt_name: &str,
    model: &str,
) -> Result<(), String> {
    // Re-check under the DB lock: stop() sets the flag BEFORE the Exit handler
    // requests this lock, so seeing it clear here guarantees the write lands
    // before the shutdown TRUNCATE checkpoint.
    if manager.is_shutdown() {
        warn!("shutdown in progress — skipping result DB write");
        return Err("application is shutting down".into());
    }
    let hash = sha256_hash(text);
    let label = format!("{prompt_name} \u{00b7} {model}");
    commands::upsert_item_core(conn, text, &hash, None, Some("AI"), Some(&label))
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// Send a minimal native Windows toast notification.
/// MSIX/Store: uses tauri-plugin-notification (icon from manifest automatically).
/// NSIS: uses tauri-winrt-notification directly (header from AUMID shortcut).
fn send_native_notification(app_handle: &tauri::AppHandle, text: &str) {
    if crate::is_store_package() {
        // MSIX: plugin works correctly, Windows resolves icon from package manifest
        use tauri_plugin_notification::NotificationExt;
        if let Err(e) = app_handle.notification().builder().title(text).show() {
            warn!("notification plugin failed: {e}");
        }
    } else {
        // NSIS: use winrt-notification directly for minimal toast
        let toast =
            tauri_winrt_notification::Toast::new(crate::build_profile::identifier()).text1(text);
        if let Err(e) = toast.show() {
            warn!("native notification failed: {e}");
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_hash_matches_frontend() {
        // "hello" -> known SHA-256 hex digest
        assert_eq!(
            sha256_hash("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn sha256_hash_nfc_normalization() {
        let nfd = "e\u{0301}"; // e + combining acute accent (NFD)
        let nfc = "\u{00e9}"; // e-acute precomposed (NFC)
        assert_eq!(sha256_hash(nfd), sha256_hash(nfc));
    }

    #[test]
    fn sha256_hash_empty_string() {
        // SHA-256 of empty string is well-known
        assert_eq!(
            sha256_hash(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn job_manager_submit_and_cancel() {
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Fix grammar".into(),
            input_text: "hello wrold".into(),
            image_base64: None,
            image_mime: None,
        };

        let id = mgr
            .submit(req, JobSource::User, "Fix grammar".into())
            .expect("submit ok");
        assert!(mgr.cancel(id));
        // Can't cancel a second time (already Cancelled)
        assert!(!mgr.cancel(id));
    }

    #[test]
    fn job_manager_take_next_skips_cancelled() {
        let mgr = JobManager::new();
        let make_req = || AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Fix".into(),
            input_text: "text".into(),
            image_base64: None,
            image_mime: None,
        };

        let id1 = mgr
            .submit(make_req(), JobSource::User, "Prompt A".into())
            .expect("submit ok");
        let id2 = mgr
            .submit(make_req(), JobSource::Auto, "Prompt B".into())
            .expect("submit ok");

        // Cancel the first one
        assert!(mgr.cancel(id1));

        // take_next should skip cancelled and return the second job
        let next = mgr.take_next();
        assert_eq!(next, Some(id2));
    }

    #[test]
    fn job_manager_take_next_returns_none_when_empty() {
        let mgr = JobManager::new();
        assert_eq!(mgr.take_next(), None);
    }

    #[test]
    fn job_manager_complete_and_fail() {
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Fix".into(),
            input_text: "text".into(),
            image_base64: None,
            image_mime: None,
        };

        let id1 = mgr
            .submit(req.clone(), JobSource::User, "A".into())
            .expect("submit ok");
        let id2 = mgr
            .submit(req, JobSource::User, "B".into())
            .expect("submit ok");

        // Take and complete the first
        assert_eq!(mgr.take_next(), Some(id1));
        mgr.complete(id1, "result".into());

        // Take and fail the second
        assert_eq!(mgr.take_next(), Some(id2));
        mgr.fail(id2, "error msg".into());

        // Verify via list
        let jobs = mgr.list();
        assert_eq!(jobs.len(), 2);
        assert_eq!(jobs[0].status, "completed");
        assert_eq!(jobs[1].status, "failed");
        assert_eq!(jobs[1].error.as_deref(), Some("error msg"));
    }

    #[test]
    fn job_manager_fail_all_queued() {
        let mgr = JobManager::new();
        let make_req = || AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Fix".into(),
            input_text: "text".into(),
            image_base64: None,
            image_mime: None,
        };

        let id1 = mgr
            .submit(make_req(), JobSource::User, "A".into())
            .expect("submit ok");
        let _id2 = mgr
            .submit(make_req(), JobSource::User, "B".into())
            .expect("submit ok");
        let _id3 = mgr
            .submit(make_req(), JobSource::User, "C".into())
            .expect("submit ok");

        // Take first (now Running)
        assert_eq!(mgr.take_next(), Some(id1));

        // Fail all queued and running — should affect A (Running), B and C (Queued)
        mgr.fail_all_queued("panic recovery");

        let jobs = mgr.list();
        assert_eq!(jobs[0].status, "failed");
        assert_eq!(jobs[0].error.as_deref(), Some("panic recovery"));
        assert_eq!(jobs[1].status, "failed");
        assert_eq!(jobs[1].error.as_deref(), Some("panic recovery"));
        assert_eq!(jobs[2].status, "failed");
    }

    #[test]
    fn job_manager_list_returns_all() {
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Translate".into(),
            input_text: "hello".into(),
            image_base64: None,
            image_mime: None,
        };
        mgr.submit(req, JobSource::Mcp, "Translate".into())
            .expect("submit ok");

        let list = mgr.list();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].source, "mcp");
        assert_eq!(list[0].status, "queued");
        assert_eq!(list[0].prompt_name, "Translate");
    }

    #[test]
    fn source_str_values() {
        assert_eq!(source_str(&JobSource::User), "user");
        assert_eq!(source_str(&JobSource::Auto), "auto");
        assert_eq!(source_str(&JobSource::Mcp), "mcp");
    }

    #[test]
    fn scrub_payload_clears_text_image_and_key_after_complete() {
        // Worker flow on success: take_next → get_request (clones for HTTP) →
        // complete() → scrub_payload(). All three sensitive/heavy fields must
        // be cleared; the in-memory result is preserved because the UI shows it.
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Describe image".into(),
            input_text: "summarize this".into(),
            image_base64: Some("iVBORw0KGgo...".into()),
            image_mime: Some("image/png".into()),
        };
        let id = mgr
            .submit(req, JobSource::User, "Describe image".into())
            .expect("submit ok");

        assert_eq!(mgr.take_next(), Some(id));
        mgr.complete(id, "result text".into());
        mgr.scrub_payload(id);

        let jobs = mgr.jobs.lock();
        let job = jobs.iter().find(|j| j.id == id).expect("job present");
        assert_eq!(job.request.input_text, "");
        assert!(job.request.image_base64.is_none());
        // Result is preserved (UI displays it).
        assert_eq!(job.result.as_deref(), Some("result text"));
    }

    #[test]
    fn scrub_payload_clears_after_fail() {
        // Same as above but exercising the fail() terminal path.
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Describe image".into(),
            input_text: "summarize".into(),
            image_base64: Some("iVBORw0KGgo...".into()),
            image_mime: Some("image/png".into()),
        };
        let id = mgr
            .submit(req, JobSource::User, "Describe image".into())
            .expect("submit ok");

        assert_eq!(mgr.take_next(), Some(id));
        mgr.fail(id, "API error".into());
        mgr.scrub_payload(id);

        let jobs = mgr.jobs.lock();
        let job = jobs.iter().find(|j| j.id == id).unwrap();
        assert_eq!(job.request.input_text, "");
        assert!(job.request.image_base64.is_none());
    }

    #[test]
    fn cancel_scrubs_payload_too() {
        // Cancelled is a terminal status — same hygiene as complete()/fail().
        // Without this scrub, cancelled vision jobs retain image_base64 in
        // memory until the 50-job prune kicks in.
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Describe image".into(),
            input_text: "before cancel".into(),
            image_base64: Some("iVBORw0KGgo...".into()),
            image_mime: Some("image/png".into()),
        };
        let id = mgr
            .submit(req, JobSource::User, "Describe image".into())
            .expect("submit ok");

        assert!(mgr.cancel(id), "cancel should succeed for queued job");

        let jobs = mgr.jobs.lock();
        let job = jobs.iter().find(|j| j.id == id).expect("job present");
        assert_eq!(job.status, JobStatus::Cancelled);
        assert_eq!(job.request.input_text, "");
        assert!(job.request.image_base64.is_none());
    }

    #[test]
    fn submit_rejects_oversize_input_text() {
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "p".into(),
            input_text: "x".repeat(MAX_INPUT_LENGTH + 1),
            image_base64: None,
            image_mime: None,
        };
        let result = mgr.submit(req, JobSource::User, "p".into());
        assert!(result.is_err());
    }

    #[test]
    fn submit_rejects_oversize_image_base64() {
        let mgr = JobManager::new();
        let req = AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "p".into(),
            input_text: "small".into(),
            image_base64: Some("a".repeat(MAX_IMAGE_BASE64_LENGTH + 1)),
            image_mime: Some("image/png".into()),
        };
        let result = mgr.submit(req, JobSource::User, "p".into());
        assert!(result.is_err());
    }

    fn test_request() -> AiRequest {
        AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "Fix grammar".into(),
            input_text: "hello world".into(),
            image_base64: None,
            image_mime: None,
        }
    }

    #[test]
    fn finalization_requires_persistence_before_success() {
        for fail_write in [false, true] {
            let manager = JobManager::new();
            let mut conn = rusqlite::Connection::open_in_memory().unwrap();
            crate::migrations::run_migrations(&mut conn).unwrap();
            if fail_write {
                conn.execute_batch("PRAGMA query_only=ON").unwrap();
            }
            let id = manager
                .submit(test_request(), JobSource::User, "Fix".into())
                .unwrap();
            assert_eq!(manager.take_next(), Some(id));
            let outcome = finalize_job(&manager, id, "provider output".into(), |text| {
                assert_eq!(
                    manager.list()[0].status,
                    "running",
                    "must not announce completion before DB commit"
                );
                persist_ai_result(&conn, &manager, text, "Fix", "fixture-model")
            });
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM clipboard_items", [], |row| row.get(0))
                .unwrap();
            assert_eq!(count, if fail_write { 0 } else { 1 });
            if fail_write {
                assert!(outcome.unwrap_err().contains("not saved"));
                assert_eq!(manager.list()[0].status, "failed");
            } else {
                assert_eq!(outcome.unwrap(), "provider output");
                assert_eq!(manager.list()[0].status, "completed");
            }
            let jobs = manager.jobs.lock();
            assert_eq!(jobs[0].result.as_deref(), Some("provider output"));
            assert!(jobs[0].request.input_text.is_empty());
            assert!(jobs[0].request.image_base64.is_none());
        }
    }

    #[test]
    fn finalization_during_shutdown_does_not_complete_or_write() {
        let manager = JobManager::new();
        let id = manager
            .submit(test_request(), JobSource::User, "Fix".into())
            .unwrap();
        manager.take_next();
        manager.stop();
        let outcome = finalize_job(&manager, id, "available output".into(), |_| {
            panic!("write during shutdown")
        });
        assert!(outcome.unwrap_err().contains("not saved"));
        assert_eq!(manager.list()[0].status, "failed");
        assert!(manager.jobs.lock()[0].request.input_text.is_empty());
    }

    #[test]
    fn finalization_rechecks_shutdown_at_the_database_boundary() {
        let manager = JobManager::new();
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::migrations::run_migrations(&mut conn).unwrap();
        let id = manager
            .submit(test_request(), JobSource::User, "Fix".into())
            .unwrap();
        manager.take_next();
        let outcome = finalize_job(&manager, id, "available output".into(), |text| {
            manager.stop();
            persist_ai_result(&conn, &manager, text, "Fix", "fixture-model")
        });
        assert!(outcome.unwrap_err().contains("not saved"));
        assert_eq!(manager.list()[0].status, "failed");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_items", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn stop_unblocks_wait_next() {
        let m = std::sync::Arc::new(JobManager::new());
        let m2 = m.clone();
        let h = std::thread::spawn(move || m2.wait_next(std::time::Duration::from_secs(30)));
        std::thread::sleep(std::time::Duration::from_millis(50));
        m.stop();
        assert_eq!(
            h.join().unwrap(),
            None,
            "stop() must wake the waiter with None"
        );
        assert!(m.is_shutdown());
    }

    #[test]
    fn submit_wakes_wait_next() {
        let m = std::sync::Arc::new(JobManager::new());
        let m2 = m.clone();
        let h = std::thread::spawn(move || m2.wait_next(std::time::Duration::from_secs(30)));
        std::thread::sleep(std::time::Duration::from_millis(50));
        let id = m
            .submit(test_request(), JobSource::Mcp, "p".into())
            .unwrap();
        assert_eq!(h.join().unwrap(), Some(id));
    }

    #[test]
    fn submit_rejects_when_queue_full() {
        let mgr = JobManager::new();
        let make_req = || AiRequest {
            provider: "openai".into(),
            model: "gpt-5-nano".into(),
            endpoint: None,
            prompt: "p".into(),
            input_text: "small".into(),
            image_base64: None,
            image_mime: None,
        };

        // Fill the queue.
        for _ in 0..MAX_QUEUED_JOBS {
            mgr.submit(make_req(), JobSource::User, "p".into())
                .expect("under limit");
        }

        // The next submit must be rejected.
        let result = mgr.submit(make_req(), JobSource::User, "p".into());
        assert!(result.is_err(), "queue full submit should fail");

        // Cancelling a queued job frees a slot.
        let jobs = mgr.list();
        let first_id = jobs[0].id;
        assert!(mgr.cancel(first_id));
        let result = mgr.submit(make_req(), JobSource::User, "p".into());
        assert!(result.is_ok(), "submit should succeed after cancel");
    }
}
