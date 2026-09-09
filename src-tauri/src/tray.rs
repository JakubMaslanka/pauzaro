use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

use tauri_plugin_window_state::{AppHandleExt, StateFlags};

/// Build the system tray icon, menu, and close-to-tray window handler.
///
/// Called from `.setup()` after managed state is registered.
pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Menu items
    let show = tauri::menu::MenuItemBuilder::with_id("show", "Show Dashboard")
        .build(app)?;
    let quit = tauri::menu::MenuItemBuilder::with_id("quit", "Quit Pauzaro")
        .build(app)?;
    let menu = tauri::menu::MenuBuilder::new(app)
        .items(&[&show, &quit])
        .build()?;

    // Tray icon
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
