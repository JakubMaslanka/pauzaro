use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::{CreateUserProfileInput, UserProfile};

pub struct UserProfileRepository<'a> {
    conn: &'a Connection,
}

impl<'a> UserProfileRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(&self, input: &CreateUserProfileInput) -> Result<UserProfile, AppError> {
        input.validate()?;

        let id = uuid::Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO user_profile (id, name) VALUES (?1, ?2)",
            params![id, input.name.trim()],
        )?;

        self.get()?.ok_or_else(|| {
            AppError::Database("Failed to retrieve created profile".into())
        })
    }

    pub fn get(&self) -> Result<Option<UserProfile>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, onboarding_completed, created_at FROM user_profile LIMIT 1",
        )?;

        let profile = stmt
            .query_map([], |row| {
                let onboarding_completed: i32 = row.get(2)?;
                Ok(UserProfile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    onboarding_completed: onboarding_completed != 0,
                    created_at: row.get(3)?,
                })
            })?
            .next()
            .transpose()?;

        Ok(profile)
    }

    pub fn complete_onboarding(&self) -> Result<(), AppError> {
        let rows = self.conn.execute(
            "UPDATE user_profile SET onboarding_completed = 1",
            [],
        )?;

        if rows == 0 {
            return Err(AppError::NotFound("No user profile found".into()));
        }

        Ok(())
    }
}
