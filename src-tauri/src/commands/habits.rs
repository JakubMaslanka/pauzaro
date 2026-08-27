use tauri::State;

use crate::db::habits::HabitRepository;
use crate::error::AppError;
use crate::models::habit::{CreateHabitInput, Habit};
use crate::AppState;

#[tauri::command]
pub fn create_habit(
    state: State<'_, AppState>,
    input: CreateHabitInput,
) -> Result<Habit, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = HabitRepository::new(db.connection());
    repo.create(&input)
}

#[tauri::command]
pub fn get_habit(
    state: State<'_, AppState>,
    id: String,
) -> Result<Habit, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = HabitRepository::new(db.connection());
    repo.get(&id)
}

#[tauri::command]
pub fn list_habits(
    state: State<'_, AppState>,
) -> Result<Vec<Habit>, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = HabitRepository::new(db.connection());
    repo.list()
}
