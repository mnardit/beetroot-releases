//! Unified IPC error type. Serializes to a plain string for the frontend;
//! maps SQLITE_CORRUPT/BUSY/FULL to user-readable messages.

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Security error: {0}")]
    Security(String),

    #[error("{0}")]
    Other(String),
}

// Tauri requires IntoResponse for command return types.
// Serialize as a string so the frontend gets a readable error message.
// SQLITE_CORRUPT and SQLITE_BUSY get user-friendly messages.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let msg = match self {
            AppError::Database(rusqlite::Error::SqliteFailure(err, _))
                if err.extended_code & 0xFF == 11 =>
            {
                "Database corrupted. Restart Beetroot to auto-recover.".to_string()
            }
            AppError::Database(rusqlite::Error::SqliteFailure(err, _))
                if err.extended_code & 0xFF == 5 =>
            {
                "Database is busy. Try again in a moment.".to_string()
            }
            // SQLITE_FULL (error code 13)
            // https://www.sqlite.org/rescode.html#full
            AppError::Database(rusqlite::Error::SqliteFailure(err, _))
                if err.extended_code & 0xFF == 13 =>
            {
                "Disk is full. Free some space and try again.".to_string()
            }
            other => other.to_string(),
        };
        serializer.serialize_str(&msg)
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Other(s)
    }
}

impl From<base64::DecodeError> for AppError {
    fn from(e: base64::DecodeError) -> Self {
        AppError::Validation(format!("Base64 decode error: {}", e))
    }
}
