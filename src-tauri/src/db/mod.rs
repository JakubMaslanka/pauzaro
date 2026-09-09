pub mod app_state;
pub mod completions;
pub mod freeze;
pub mod habits;
pub mod migrations;
pub mod pending_triggers;
pub mod settings;
pub mod user_profile;

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppError;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, AppError> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON")?;
        migrations::run_migrations(&conn)?;
        Ok(Self { conn })
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }
}
