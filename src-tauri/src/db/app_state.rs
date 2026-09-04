use rusqlite::{params, Connection};

use crate::db::completions::CompletionRepository;
use crate::db::pending_triggers::PendingTriggerRepository;
use crate::error::AppError;
use crate::models::CompletionStatus;

pub struct AppStateRepository<'a> {
    conn: &'a Connection,
}

impl<'a> AppStateRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// Read the singleton `last_seen_at` timestamp.
    pub fn get_last_seen(&self) -> Result<String, AppError> {
        self.conn
            .query_row(
                "SELECT last_seen_at FROM app_state WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .map_err(AppError::from)
    }

    /// Update the singleton `last_seen_at` timestamp in place.
    pub fn update_last_seen(&self, timestamp: &str) -> Result<(), AppError> {
        self.conn.execute(
            "UPDATE app_state SET last_seen_at = ?1 WHERE id = 1",
            params![timestamp],
        )?;
        Ok(())
    }
}

/// Auto-fail stale pending triggers from before `today`.
///
/// For each stale trigger: insert a `Failed` completion preserving original
/// `trigger_date` and `scheduled_time`, then delete the trigger.
/// Returns count of cleaned-up triggers.
pub fn cleanup_stale_triggers(conn: &Connection, today: &str) -> Result<usize, AppError> {
    let trigger_repo = PendingTriggerRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);

    let stale = trigger_repo.list_stale(today)?;
    let count = stale.len();

    for trigger in &stale {
        // Skip if completion already exists for this slot
        if !completion_repo.has_completion_for_slot(
            &trigger.habit_id,
            &trigger.trigger_date,
            &trigger.scheduled_time,
        )? {
            completion_repo.insert(
                &trigger.habit_id,
                &trigger.trigger_date,
                &trigger.scheduled_time,
                &CompletionStatus::Failed,
            )?;
        }
        trigger_repo.delete(&trigger.id)?;
    }

    Ok(count)
}
