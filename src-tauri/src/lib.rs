pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod scheduler;

use std::sync::Mutex;

use tauri::Manager;

use db::Database;

pub struct AppState {
    pub db: Mutex<Database>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db_path = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir")
                .join("pauzaro.db");

            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let db = Database::open(&db_path)
                .map_err(|e| format!("failed to open database: {e}"))?;

            app.manage(AppState {
                db: Mutex::new(db),
            });

            let sched = std::sync::Arc::new(scheduler::Scheduler::new());
            app.manage(sched.clone());

            let app_handle = app.handle().clone();
            let sched_run = sched.clone();
            tauri::async_runtime::spawn(async move {
                sched_run.run(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::user_profile::create_user_profile,
            commands::user_profile::get_user_profile,
            commands::user_profile::complete_onboarding,
            commands::habits::create_habit,
            commands::habits::get_habit,
            commands::habits::list_habits,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
