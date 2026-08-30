use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::PendingTrigger;

pub struct PendingTriggerRepository<'a> {
    conn: &'a Connection,
}

impl<'a> PendingTriggerRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn upsert(
        &self,
        habit_id: &str,
        trigger_date: &str,
        scheduled_time: &str,
        next_fire_at: &str,
    ) -> Result<PendingTrigger, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO pending_triggers (id, habit_id, trigger_date, scheduled_time, next_fire_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(habit_id, trigger_date, scheduled_time)
             DO UPDATE SET next_fire_at = excluded.next_fire_at",
            params![id, habit_id, trigger_date, scheduled_time, next_fire_at],
        )?;

        self.get_by_slot(habit_id, trigger_date, scheduled_time)?
            .ok_or_else(|| AppError::Database("Failed to upsert pending trigger".into()))
    }

    pub fn get_by_slot(
        &self,
        habit_id: &str,
        trigger_date: &str,
        scheduled_time: &str,
    ) -> Result<Option<PendingTrigger>, AppError> {
        let result = self.conn.query_row(
            "SELECT id, habit_id, trigger_date, scheduled_time, snooze_count, next_fire_at, created_at
             FROM pending_triggers
             WHERE habit_id = ?1 AND trigger_date = ?2 AND scheduled_time = ?3",
            params![habit_id, trigger_date, scheduled_time],
            |row| Self::row_to_pending_trigger(row),
        );

        match result {
            Ok(trigger) => Ok(Some(trigger)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::from(e)),
        }
    }

    pub fn list_active(&self) -> Result<Vec<PendingTrigger>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, habit_id, trigger_date, scheduled_time, snooze_count, next_fire_at, created_at
             FROM pending_triggers ORDER BY next_fire_at ASC",
        )?;

        let triggers = stmt
            .query_map([], |row| Self::row_to_pending_trigger(row))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(triggers)
    }

    pub fn delete(&self, id: &str) -> Result<bool, AppError> {
        let rows = self.conn.execute(
            "DELETE FROM pending_triggers WHERE id = ?1",
            params![id],
        )?;
        Ok(rows > 0)
    }

    pub fn increment_snooze(
        &self,
        id: &str,
        new_next_fire_at: &str,
    ) -> Result<PendingTrigger, AppError> {
        self.conn.execute(
            "UPDATE pending_triggers SET snooze_count = snooze_count + 1, next_fire_at = ?1
             WHERE id = ?2",
            params![new_next_fire_at, id],
        )?;

        self.conn
            .query_row(
                "SELECT id, habit_id, trigger_date, scheduled_time, snooze_count, next_fire_at, created_at
                 FROM pending_triggers WHERE id = ?1",
                params![id],
                |row| Self::row_to_pending_trigger(row),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::NotFound(format!("Pending trigger not found: {id}"))
                }
                other => AppError::from(other),
            })
    }

    fn row_to_pending_trigger(row: &rusqlite::Row) -> Result<PendingTrigger, rusqlite::Error> {
        Ok(PendingTrigger {
            id: row.get(0)?,
            habit_id: row.get(1)?,
            trigger_date: row.get(2)?,
            scheduled_time: row.get(3)?,
            snooze_count: row.get(4)?,
            next_fire_at: row.get(5)?,
            created_at: row.get(6)?,
        })
    }
}
