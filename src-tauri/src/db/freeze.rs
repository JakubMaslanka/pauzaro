use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::StreakFreeze;

pub struct FreezeRepository<'a> {
    conn: &'a Connection,
}

impl<'a> FreezeRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// List all freeze records for a habit.
    pub fn list_by_habit(&self, habit_id: &str) -> Result<Vec<StreakFreeze>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, habit_id, frozen_date, created_at
             FROM streak_freezes WHERE habit_id = ?1
             ORDER BY frozen_date ASC",
        )?;

        let freezes = stmt
            .query_map(params![habit_id], |row| Self::row_to_freeze(row))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(freezes)
    }

    /// List freeze records for a habit since a given date.
    pub fn list_by_habit_since(
        &self,
        habit_id: &str,
        from_date: &str,
    ) -> Result<Vec<StreakFreeze>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, habit_id, frozen_date, created_at
             FROM streak_freezes WHERE habit_id = ?1 AND frozen_date >= ?2
             ORDER BY frozen_date ASC",
        )?;

        let freezes = stmt
            .query_map(params![habit_id, from_date], |row| {
                Self::row_to_freeze(row)
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(freezes)
    }

    /// Insert a freeze record. Idempotent — ignores conflict on (habit_id, frozen_date).
    pub fn insert(
        &self,
        habit_id: &str,
        frozen_date: &str,
    ) -> Result<Option<StreakFreeze>, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        let rows = self.conn.execute(
            "INSERT OR IGNORE INTO streak_freezes (id, habit_id, frozen_date)
             VALUES (?1, ?2, ?3)",
            params![id, habit_id, frozen_date],
        )?;

        if rows == 0 {
            // Already existed — return existing record
            let existing = self.conn.query_row(
                "SELECT id, habit_id, frozen_date, created_at
                 FROM streak_freezes WHERE habit_id = ?1 AND frozen_date = ?2",
                params![habit_id, frozen_date],
                |row| Self::row_to_freeze(row),
            )?;
            return Ok(Some(existing));
        }

        let freeze = self.conn.query_row(
            "SELECT id, habit_id, frozen_date, created_at
             FROM streak_freezes WHERE id = ?1",
            params![id],
            |row| Self::row_to_freeze(row),
        )?;

        Ok(Some(freeze))
    }

    /// Count total freeze records for a habit (used for budget check).
    pub fn count_by_habit(&self, habit_id: &str) -> Result<usize, AppError> {
        let count: i32 = self.conn.query_row(
            "SELECT COUNT(*) FROM streak_freezes WHERE habit_id = ?1",
            params![habit_id],
            |row| row.get(0),
        )?;
        Ok(count as usize)
    }

    /// Delete all freeze records for a habit (replenish on streak reset).
    pub fn delete_all_by_habit(&self, habit_id: &str) -> Result<usize, AppError> {
        let rows = self.conn.execute(
            "DELETE FROM streak_freezes WHERE habit_id = ?1",
            params![habit_id],
        )?;
        Ok(rows)
    }

    fn row_to_freeze(row: &rusqlite::Row) -> Result<StreakFreeze, rusqlite::Error> {
        Ok(StreakFreeze {
            id: row.get(0)?,
            habit_id: row.get(1)?,
            frozen_date: row.get(2)?,
            created_at: row.get(3)?,
        })
    }
}
