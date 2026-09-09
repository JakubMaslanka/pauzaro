use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

use crate::db::settings::SettingsRepository;
use crate::error::AppError;
use crate::models::Settings;
use crate::AppState;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = SettingsRepository::new(db.connection());
    repo.get()
}

#[tauri::command]
pub fn set_autostart(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<Settings, AppError> {
    // Persist to DB first
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = SettingsRepository::new(db.connection());
    repo.set_autostart(enabled)?;

    // Register/unregister OS login item
    let autolaunch = app.autolaunch();
    let result = if enabled {
        autolaunch.enable()
    } else {
        autolaunch.disable()
    };

    if let Err(e) = result {
        // Rollback DB on plugin failure
        let _ = repo.set_autostart(!enabled);
        return Err(AppError::Autostart(format!(
            "Failed to {} autostart: {e}",
            if enabled { "enable" } else { "disable" }
        )));
    }

    repo.get()
}
