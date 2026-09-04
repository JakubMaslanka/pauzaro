pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod scheduler;
pub mod streak;

use std::sync::{Arc, Mutex};

use chrono::Local;
use log::{error, info};
use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

use db::Database;
use db::app_state::{AppStateRepository, cleanup_stale_triggers};

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
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

            // Startup: read last_seen_at, update to now, cleanup stale triggers
            {
                let conn = db.connection();
                let app_state_repo = AppStateRepository::new(conn);
                let today = Local::now().format("%Y-%m-%d").to_string();

                match app_state_repo.get_last_seen() {
                    Ok(last_seen) => info!("Previous last_seen_at: {last_seen}"),
                    Err(e) => error!("Failed to read last_seen_at: {e}"),
                }

                let now_ts = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
                if let Err(e) = app_state_repo.update_last_seen(&now_ts) {
                    error!("Failed to update last_seen_at: {e}");
                }

                match cleanup_stale_triggers(conn, &today) {
                    Ok(count) if count > 0 => info!("Auto-failed {count} stale pending triggers"),
                    Ok(_) => {}
                    Err(e) => error!("Failed to cleanup stale triggers: {e}"),
                }
            }

            let db_arc = Arc::new(Mutex::new(db));

            app.manage(AppState {
                db: Arc::clone(&db_arc),
            });

            let sched = std::sync::Arc::new(scheduler::Scheduler::new());
            app.manage(sched.clone());

            let spawner: Arc<dyn scheduler::OverlaySpawner> =
                Arc::new(scheduler::TauriOverlaySpawner::new(app.handle().clone()));

            let sched_run = sched.clone();
            tauri::async_runtime::spawn(async move {
                sched_run.run(db_arc, spawner).await;
            });

            // System tray — keeps app alive when main window is closed
            let show = tauri::menu::MenuItemBuilder::with_id("show", "Show Dashboard")
                .build(app)?;
            let quit = tauri::menu::MenuItemBuilder::with_id("quit", "Quit Pauzaro")
                .build(app)?;
            let menu = tauri::menu::MenuBuilder::new(app)
                .items(&[&show, &quit])
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Pauzaro")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => show_main_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Hide main window on close — remove from dock, keep tray
            let main_window = app.get_webview_window("main")
                .expect("main window not found");
            let win = main_window.clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win.hide();

                    #[cfg(target_os = "macos")]
                    {
                        let _ = win.app_handle()
                            .set_activation_policy(tauri::ActivationPolicy::Accessory);
                    }
                }
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
            commands::habits::get_habit_status,
            commands::habits::get_all_habit_statuses,
            commands::habits::get_month_completions,
            commands::habits::update_habit,
            commands::habits::delete_habit,
            commands::habits::get_latest_completion,
            commands::overlay::mark_done,
            commands::overlay::snooze_habit,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            match event {
                // Prevent auto-exit when all windows hidden,
                // but allow explicit exit (app.exit() from tray Quit)
                tauri::RunEvent::ExitRequested { api, code, .. } => {
                    if code.is_none() {
                        api.prevent_exit();
                    }
                }
                // macOS: dock icon clicked while hidden — re-show
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen { .. } => {
                    show_main_window(app);
                }
                tauri::RunEvent::Exit => {
                    // Write last_seen_at on actual process exit (tray Quit or OS shutdown).
                    // Errors logged but don't block exit.
                    if let Some(state) = app.try_state::<AppState>() {
                        if let Ok(db) = state.db.lock() {
                            let repo = AppStateRepository::new(db.connection());
                            let now_ts = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
                            if let Err(e) = repo.update_last_seen(&now_ts) {
                                error!("Failed to write last_seen_at on exit: {e}");
                            }
                        }
                    }
                }
                _ => {}
            }
        });
}

fn show_main_window(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }

    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
