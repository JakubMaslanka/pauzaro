use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::{Completion, CompletionStatus};

pub struct CompletionRepository<'a> {
    conn: &'a Connection,
}

impl<'a> CompletionRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn insert(
        &self,
        habit_id: &str,
        trigger_date: &str,
        scheduled_time: &str,
        status: &CompletionStatus,
    ) -> Result<Completion, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO completions (id, habit_id, trigger_date, scheduled_time, status)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, habit_id, trigger_date, scheduled_time, status.as_str()],
        )?;

        self.conn
            .query_row(
                "SELECT id, habit_id, trigger_date, scheduled_time, status, completed_at
                 FROM completions WHERE id = ?1",
                params![id],
                |row| Self::row_to_completion(row),
            )
            .map_err(AppError::from)
    }

    pub fn get_by_habit_and_date(
        &self,
        habit_id: &str,
        trigger_date: &str,
    ) -> Result<Vec<Completion>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, habit_id, trigger_date, scheduled_time, status, completed_at
             FROM completions WHERE habit_id = ?1 AND trigger_date = ?2",
        )?;

        let completions = stmt
            .query_map(params![habit_id, trigger_date], |row| {
                Self::row_to_completion(row)
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(completions)
    }

    pub fn list_by_habit_since(
        &self,
        habit_id: &str,
        from_date: &str,
    ) -> Result<Vec<Completion>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, habit_id, trigger_date, scheduled_time, status, completed_at
             FROM completions WHERE habit_id = ?1 AND trigger_date >= ?2
             ORDER BY trigger_date ASC, scheduled_time ASC",
        )?;

        let completions = stmt
            .query_map(params![habit_id, from_date], |row| {
                Self::row_to_completion(row)
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(completions)
    }

    pub fn list_by_habit_in_range(
        &self,
        habit_id: &str,
        from_date: &str,
        to_date: &str,
    ) -> Result<Vec<Completion>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, habit_id, trigger_date, scheduled_time, status, completed_at
             FROM completions WHERE habit_id = ?1 AND trigger_date >= ?2 AND trigger_date <= ?3
             ORDER BY trigger_date ASC, scheduled_time ASC",
        )?;

        let completions = stmt
            .query_map(params![habit_id, from_date, to_date], |row| {
                Self::row_to_completion(row)
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(completions)
    }

    pub fn has_completion_for_slot(
        &self,
        habit_id: &str,
        trigger_date: &str,
        scheduled_time: &str,
    ) -> Result<bool, AppError> {
        let count: i32 = self.conn.query_row(
            "SELECT COUNT(*) FROM completions
             WHERE habit_id = ?1 AND trigger_date = ?2 AND scheduled_time = ?3",
            params![habit_id, trigger_date, scheduled_time],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn delete_by_slot(
        &self,
        habit_id: &str,
        trigger_date: &str,
        scheduled_time: &str,
    ) -> Result<bool, AppError> {
        let rows = self.conn.execute(
            "DELETE FROM completions
             WHERE habit_id = ?1 AND trigger_date = ?2 AND scheduled_time = ?3",
            params![habit_id, trigger_date, scheduled_time],
        )?;
        Ok(rows > 0)
    }

    fn row_to_completion(row: &rusqlite::Row) -> Result<Completion, rusqlite::Error> {
        let status_str: String = row.get(4)?;
        let status = CompletionStatus::from_str(&status_str)
            .unwrap_or(CompletionStatus::Failed);

        Ok(Completion {
            id: row.get(0)?,
            habit_id: row.get(1)?,
            trigger_date: row.get(2)?,
            scheduled_time: row.get(3)?,
            status,
            completed_at: row.get(5)?,
        })
    }
}
