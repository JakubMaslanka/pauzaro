use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub name: String,
    pub onboarding_completed: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserProfileInput {
    pub name: String,
}

impl CreateUserProfileInput {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.name.trim().is_empty() {
            return Err(AppError::Validation("Name cannot be empty".into()));
        }
        Ok(())
    }
}
