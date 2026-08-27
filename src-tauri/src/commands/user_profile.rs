use tauri::State;

use crate::db::user_profile::UserProfileRepository;
use crate::error::AppError;
use crate::models::user_profile::{CreateUserProfileInput, UserProfile};
use crate::AppState;

#[tauri::command]
pub fn create_user_profile(
    state: State<'_, AppState>,
    input: CreateUserProfileInput,
) -> Result<UserProfile, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = UserProfileRepository::new(db.connection());
    repo.create(&input)
}

#[tauri::command]
pub fn get_user_profile(
    state: State<'_, AppState>,
) -> Result<Option<UserProfile>, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = UserProfileRepository::new(db.connection());
    repo.get()
}

#[tauri::command]
pub fn complete_onboarding(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = UserProfileRepository::new(db.connection());
    repo.complete_onboarding()
}
