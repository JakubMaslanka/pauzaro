use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::app_state::AppStateRepository;
use crate::db::completions::CompletionRepository;
use crate::db::freeze::FreezeRepository;
use crate::error::AppError;
use crate::models::CompletionStatus;
use crate::AppState;

// --- Query: full day state for a habit on a date ---

#[derive(Debug, Serialize)]
pub struct DebugDayState {
    pub habit_id: String,
    pub date: String,
    pub completions: Vec<DebugCompletion>,
    pub is_frozen: bool,
    pub freezes_total: usize,
    pub last_seen_at: String,
}

#[derive(Debug, Serialize)]
pub struct DebugCompletion {
    pub scheduled_time: String,
    pub status: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn debug_get_day_state(
    state: State<'_, AppState>,
    habit_id: String,
    date: String,
) -> Result<DebugDayState, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let conn = db.connection();

    let completion_repo = CompletionRepository::new(conn);
    let freeze_repo = FreezeRepository::new(conn);
    let app_state_repo = AppStateRepository::new(conn);

    let completions = completion_repo.get_by_habit_and_date(&habit_id, &date)?;
    let debug_completions: Vec<DebugCompletion> = completions
        .iter()
        .map(|c| DebugCompletion {
            scheduled_time: c.scheduled_time.clone(),
            status: c.status.as_str().to_string(),
        })
        .collect();

    let freezes = freeze_repo.list_by_habit(&habit_id)?;
    let is_frozen = freezes.iter().any(|f| f.frozen_date == date);
    let freezes_total = freezes.len();

    let last_seen_at = app_state_repo
        .get_last_seen()
        .unwrap_or_else(|_| "unknown".to_string());

    Ok(DebugDayState {
        habit_id,
        date,
        completions: debug_completions,
        is_frozen,
        freezes_total,
        last_seen_at,
    })
}

// --- Mutations ---

#[derive(Debug, Deserialize)]
pub struct DebugFreezeInput {
    pub habit_id: String,
    pub date: String,
}

/// Insert a streak freeze record directly.
#[tauri::command]
pub fn debug_insert_freeze(
    state: State<'_, AppState>,
    input: DebugFreezeInput,
) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let freeze_repo = FreezeRepository::new(db.connection());
    freeze_repo.insert(&input.habit_id, &input.date)?;
    Ok(format!("Freeze inserted for {} on {}", input.habit_id, input.date))
}

/// Remove a freeze record for a habit on a specific date.
#[tauri::command(rename_all = "snake_case")]
pub fn debug_remove_freeze(
    state: State<'_, AppState>,
    habit_id: String,
    date: String,
) -> Result<usize, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let conn = db.connection();
    let rows = conn.execute(
        "DELETE FROM streak_freezes WHERE habit_id = ?1 AND frozen_date = ?2",
        rusqlite::params![habit_id, date],
    )?;
    Ok(rows)
}

/// Remove all freeze records for a habit.
#[tauri::command(rename_all = "snake_case")]
pub fn debug_clear_all_freezes(
    state: State<'_, AppState>,
    habit_id: String,
) -> Result<usize, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let freeze_repo = FreezeRepository::new(db.connection());
    freeze_repo.delete_all_by_habit(&habit_id)
}

/// Insert a completion (done) for a habit on a date+time.
#[tauri::command(rename_all = "snake_case")]
pub fn debug_insert_completion(
    state: State<'_, AppState>,
    habit_id: String,
    date: String,
    scheduled_time: String,
) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = CompletionRepository::new(db.connection());
    let completion = repo.insert(&habit_id, &date, &scheduled_time, &CompletionStatus::Done)?;
    Ok(completion.id)
}

/// Delete all completions for a habit on a specific date.
#[tauri::command(rename_all = "snake_case")]
pub fn debug_delete_completions_for_date(
    state: State<'_, AppState>,
    habit_id: String,
    date: String,
) -> Result<usize, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let conn = db.connection();
    let rows = conn.execute(
        "DELETE FROM completions WHERE habit_id = ?1 AND trigger_date = ?2",
        rusqlite::params![habit_id, date],
    )?;
    Ok(rows)
}

/// Reset onboarding_completed flag so the onboarding wizard shows again.
#[tauri::command]
pub fn debug_reset_onboarding(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let conn = db.connection();
    conn.execute("UPDATE user_profile SET onboarding_completed = 0", [])?;
    Ok(())
}

/// Backdate last_seen_at by N days to simulate an app-closed gap.
#[tauri::command(rename_all = "snake_case")]
pub fn debug_backdate_last_seen(
    state: State<'_, AppState>,
    days_ago: u32,
) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = AppStateRepository::new(db.connection());
    let backdated =
        chrono::Local::now() - chrono::Duration::days(i64::from(days_ago));
    let ts = backdated.format("%Y-%m-%dT%H:%M:%S").to_string();
    repo.update_last_seen(&ts)?;
    Ok(ts)
}
