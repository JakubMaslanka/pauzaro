use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::completions::CompletionRepository;
use crate::db::pending_triggers::PendingTriggerRepository;
use crate::error::AppError;
use crate::models::CompletionStatus;
use crate::scheduler::Scheduler;
use crate::AppState;

const MAX_SNOOZE_COUNT: i32 = 3;
const SNOOZE_MINUTES: i64 = 9;

#[derive(Debug, Serialize, Clone)]
pub struct SnoozeResult {
    pub status: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn mark_done(
    app: AppHandle,
    scheduler: State<'_, Arc<Scheduler>>,
    habit_id: String,
    trigger_date: String,
    scheduled_time: String,
    override_failed: Option<bool>,
) -> Result<(), AppError> {
    let sched = scheduler.inner().clone();
    let app_clone = app.clone();

    tokio::task::spawn_blocking(move || {
        let state = app_clone.state::<AppState>();
        let db = state.db.lock().map_err(|e| {
            AppError::Database(format!("Failed to acquire database lock: {e}"))
        })?;
        let conn = db.connection();
        let completion_repo = CompletionRepository::new(conn);
        let pending_repo = PendingTriggerRepository::new(conn);

        if override_failed.unwrap_or(false) {
            completion_repo.delete_by_slot(&habit_id, &trigger_date, &scheduled_time)?;
        }

        if let Some(pt) = pending_repo.get_by_slot(&habit_id, &trigger_date, &scheduled_time)? {
            pending_repo.delete(&pt.id)?;
        }

        completion_repo.insert(
            &habit_id,
            &trigger_date,
            &scheduled_time,
            &CompletionStatus::Done,
        )?;

        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Database(format!("spawn_blocking failed: {e}")))??;

    sched.wake();
    let _ = app.emit("habit-updated", ());

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn snooze_habit(
    app: AppHandle,
    scheduler: State<'_, Arc<Scheduler>>,
    habit_id: String,
    trigger_date: String,
    scheduled_time: String,
) -> Result<SnoozeResult, AppError> {
    let sched = scheduler.inner().clone();
    let app_clone = app.clone();

    let result = tokio::task::spawn_blocking(move || {
        let state = app_clone.state::<AppState>();
        let db = state.db.lock().map_err(|e| {
            AppError::Database(format!("Failed to acquire database lock: {e}"))
        })?;
        let conn = db.connection();
        let completion_repo = CompletionRepository::new(conn);
        let pending_repo = PendingTriggerRepository::new(conn);

        let pt = match pending_repo.get_by_slot(&habit_id, &trigger_date, &scheduled_time)? {
            Some(pt) => pt,
            None => {
                let now_str = chrono::Local::now()
                    .naive_local()
                    .format("%Y-%m-%dT%H:%M:%S")
                    .to_string();
                pending_repo.upsert(&habit_id, &trigger_date, &scheduled_time, &now_str)?
            }
        };

        let new_count = pt.snooze_count + 1;

        if new_count >= MAX_SNOOZE_COUNT {
            pending_repo.delete(&pt.id)?;
            completion_repo.insert(
                &habit_id,
                &trigger_date,
                &scheduled_time,
                &CompletionStatus::Failed,
            )?;
            Ok::<SnoozeResult, AppError>(SnoozeResult {
                status: "auto_failed".to_string(),
            })
        } else {
            let next_fire = chrono::Local::now()
                + chrono::Duration::minutes(SNOOZE_MINUTES);
            let next_fire_str = next_fire
                .naive_local()
                .format("%Y-%m-%dT%H:%M:%S")
                .to_string();
            pending_repo.increment_snooze(&pt.id, &next_fire_str)?;
            Ok(SnoozeResult {
                status: "snoozed".to_string(),
            })
        }
    })
    .await
    .map_err(|e| AppError::Database(format!("spawn_blocking failed: {e}")))??;

    sched.wake();
    let _ = app.emit("habit-updated", ());

    Ok(result)
}
