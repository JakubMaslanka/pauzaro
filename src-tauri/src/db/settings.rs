use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::Settings;

pub struct SettingsRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SettingsRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// Read the singleton settings row.
    pub fn get(&self) -> Result<Settings, AppError> {
        self.conn
            .query_row(
                "SELECT autostart_enabled FROM settings WHERE id = 1",
                [],
                |row| {
                    Ok(Settings {
                        autostart_enabled: row.get::<_, i32>(0)? != 0,
                    })
                },
            )
            .map_err(AppError::from)
    }

    /// Update the autostart preference.
    pub fn set_autostart(&self, enabled: bool) -> Result<(), AppError> {
        self.conn.execute(
            "UPDATE settings SET autostart_enabled = ?1 WHERE id = 1",
            params![enabled as i32],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON").unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn get_returns_default_settings() {
        let conn = setup_db();
        let repo = SettingsRepository::new(&conn);
        let settings = repo.get().unwrap();
        assert!(!settings.autostart_enabled);
    }

    #[test]
    fn set_autostart_persists() {
        let conn = setup_db();
        let repo = SettingsRepository::new(&conn);

        repo.set_autostart(true).unwrap();
        assert!(repo.get().unwrap().autostart_enabled);

        repo.set_autostart(false).unwrap();
        assert!(!repo.get().unwrap().autostart_enabled);
    }
}
