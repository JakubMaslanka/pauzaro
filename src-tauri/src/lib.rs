pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod scheduler;
pub mod streak;

use std::sync::Mutex;

use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

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
