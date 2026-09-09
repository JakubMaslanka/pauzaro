use log::error;
use tauri::menu::CheckMenuItem;
use tauri::{Emitter, Manager, Wry};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::db::settings::SettingsRepository;
use crate::AppState;
use crate::models::Settings;

/// Managed state holding the tray CheckMenuItem handle for cross-component sync.
pub struct TrayState {
    pub autostart_item: CheckMenuItem<Wry>,
}

/// Build the system tray icon, menu, and close-to-tray window handler.
///
/// Called from `.setup()` after managed state (AppState) is registered.
pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Read initial autostart state from DB
    let autostart_checked = {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| format!("DB lock: {e}"))?;
        let repo = SettingsRepository::new(db.connection());
        repo.get().map(|s| s.autostart_enabled).unwrap_or(false)
    };

    // Menu items
    let show = tauri::menu::MenuItemBuilder::with_id("show", "Show Dashboard")
        .build(app)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Launch on startup",
        true,
        autostart_checked,
        None::<&str>,
    )?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = tauri::menu::MenuItemBuilder::with_id("quit", "Quit Pauzaro")
        .build(app)?;
    let menu = tauri::menu::MenuBuilder::new(app)
        .items(&[
            &show,
            &autostart,
            &separator,
            &quit,
        ])
        .build()?;

    // Store CheckMenuItem handle in managed state for cross-component sync
    app.manage(TrayState {
        autostart_item: autostart.clone(),
    });

    // Tray icon
    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Pauzaro")
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show" => show_main_window(app),
                "quit" => app.exit(0),
                "autostart" => handle_autostart_toggle(app),
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

            // Save window state before hiding — plugin's default close-based save
            // won't fire since we prevent the close
            let _ = win.app_handle().save_window_state(
                StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED,
            );

            let _ = win.hide();

            #[cfg(target_os = "macos")]
            {
                let _ = win.app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
        }
    });

    Ok(())
}

/// Handle tray "Launch on startup" toggle.
///
/// Reads new checked state, persists to DB, registers/unregisters OS login item,
/// emits sync event. On failure: reverts checkmark and emits error event.
fn handle_autostart_toggle(app: &tauri::AppHandle) {
    let tray_state = app.state::<TrayState>();
    let new_enabled = match tray_state.autostart_item.is_checked() {
        Ok(checked) => checked,
        Err(e) => {
            error!("Failed to read autostart check state: {e}");
            return;
        }
    };

    // Persist to DB
    let db_result = {
        let app_state = app.state::<AppState>();
        let db = match app_state.db.lock() {
            Ok(db) => db,
            Err(e) => {
                error!("DB lock failed: {e}");
                revert_checkmark(&tray_state.autostart_item, !new_enabled);
                return;
            }
        };
        let repo = SettingsRepository::new(db.connection());
        repo.set_autostart(new_enabled)
    };

    if let Err(e) = db_result {
        error!("Failed to persist autostart setting: {e}");
        revert_checkmark(&tray_state.autostart_item, !new_enabled);
        return;
    }

    // Register/unregister OS login item
    let autolaunch = app.autolaunch();
    let os_result = if new_enabled {
        autolaunch.enable()
    } else {
        autolaunch.disable()
    };

    if let Err(e) = os_result {
        error!("Autostart OS registration failed: {e}");

        // Rollback DB
        let app_state = app.state::<AppState>();
        if let Ok(db) = app_state.db.lock() {
            let repo = SettingsRepository::new(db.connection());
            let _ = repo.set_autostart(!new_enabled);
        }

        revert_checkmark(&tray_state.autostart_item, !new_enabled);

        // Emit error event for frontend to show dialog
        let _ = app.emit("autostart-error", format!(
            "Failed to {} autostart: {e}. Check System Settings > General > Login Items.",
            if new_enabled { "enable" } else { "disable" }
        ));
        return;
    }

    // Emit sync event for frontend
    let _ = app.emit("settings-changed", Settings {
        autostart_enabled: new_enabled,
    });
}

/// Revert CheckMenuItem to previous state on error.
fn revert_checkmark(item: &CheckMenuItem<Wry>, value: bool) {
    if let Err(e) = item.set_checked(value) {
        error!("Failed to revert autostart checkmark: {e}");
    }
}

/// Show the main window and restore macOS dock icon.
pub fn show_main_window(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }

    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
