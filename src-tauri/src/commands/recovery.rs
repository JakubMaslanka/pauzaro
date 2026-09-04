use chrono::NaiveDate;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::completions::CompletionRepository;
use crate::error::AppError;
use crate::models::CompletionStatus;
use crate::recovery::RecoveryResult;
use crate::AppState;
use crate::RecoveryState;

#[derive(Debug, Deserialize)]
pub struct SlotInput {
    pub trigger_date: String,
    pub scheduled_time: String,
}

impl SlotInput {
    pub fn validate(&self) -> Result<(), AppError> {
        NaiveDate::parse_from_str(&self.trigger_date, "%Y-%m-%d").map_err(|_| {
            AppError::Validation(format!(
                "Invalid trigger_date format: '{}'",
                self.trigger_date
            ))
        })?;

        let parts: Vec<&str> = self.scheduled_time.split(':').collect();
        if parts.len() != 2
            || parts[0].parse::<u8>().map_or(true, |h| h > 23)
            || parts[1].parse::<u8>().map_or(true, |m| m > 59)
        {
            return Err(AppError::Validation(format!(
                "Invalid scheduled_time format: '{}'",
                self.scheduled_time
            )));
        }

        Ok(())
    }
}

/// Return missed repetitions computed at startup. Consumed on first call —
/// subsequent calls return empty result.
#[tauri::command(rename_all = "snake_case")]
pub async fn get_missed_repetitions(
    recovery: State<'_, RecoveryState>,
) -> Result<RecoveryResult, AppError> {
    let mut guard = recovery.0.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire recovery lock: {e}"))
    })?;

    Ok(guard.take().unwrap_or(RecoveryResult { habits: vec![] }))
}

/// Bulk-insert `Done` completions for missed slots (backfill).
#[tauri::command(rename_all = "snake_case")]
pub async fn recover_habit_done(
    app: AppHandle,
    habit_id: String,
    slots: Vec<SlotInput>,
) -> Result<(), AppError> {
    for slot in &slots {
        slot.validate()?;
    }

    let app_clone = app.clone();

    tokio::task::spawn_blocking(move || {
        let db = app_clone.state::<AppState>();
        let db = db.db.lock().map_err(|e| {
            AppError::Database(format!("Failed to acquire database lock: {e}"))
        })?;
        let conn = db.connection();
        let tx = conn.unchecked_transaction().map_err(|e| AppError::Database(e.to_string()))?;

        {
            let completion_repo = CompletionRepository::new(&tx);
            for slot in &slots {
                // Delete any existing failed completion for this slot before inserting done
                completion_repo.delete_by_slot(&habit_id, &slot.trigger_date, &slot.scheduled_time)?;
                completion_repo.insert(
                    &habit_id,
                    &slot.trigger_date,
                    &slot.scheduled_time,
                    &CompletionStatus::Done,
                )?;
            }
        }

        tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Database(format!("spawn_blocking failed: {e}")))??;

    let _ = app.emit("habit-updated", ());

    Ok(())
}

/// Bulk-insert `Failed` completions for missed slots (dismiss).
#[tauri::command(rename_all = "snake_case")]
pub async fn recover_habit_dismiss(
    app: AppHandle,
    habit_id: String,
    slots: Vec<SlotInput>,
) -> Result<(), AppError> {
    for slot in &slots {
        slot.validate()?;
    }

    let app_clone = app.clone();

    tokio::task::spawn_blocking(move || {
        let db = app_clone.state::<AppState>();
        let db = db.db.lock().map_err(|e| {
            AppError::Database(format!("Failed to acquire database lock: {e}"))
        })?;
        let conn = db.connection();
        let tx = conn.unchecked_transaction().map_err(|e| AppError::Database(e.to_string()))?;

        {
            let completion_repo = CompletionRepository::new(&tx);
            for slot in &slots {
                if !completion_repo.has_completion_for_slot(
                    &habit_id,
                    &slot.trigger_date,
                    &slot.scheduled_time,
                )? {
                    completion_repo.insert(
                        &habit_id,
                        &slot.trigger_date,
                        &slot.scheduled_time,
                        &CompletionStatus::Failed,
                    )?;
                }
            }
        }

        tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Database(format!("spawn_blocking failed: {e}")))??;

    let _ = app.emit("habit-updated", ());

    Ok(())
}
