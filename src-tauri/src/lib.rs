pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod recovery;
pub mod scheduler;
pub mod streak;
pub mod tray;

use std::sync::{Arc, Mutex};

use chrono::{Datelike, Local};
use log::{error, info};
use tauri::Manager;

use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use db::Database;
use db::app_state::{AppStateRepository, cleanup_stale_triggers};
use db::completions::CompletionRepository;
use db::freeze::FreezeRepository;
use db::habits::HabitRepository;
use recovery::RecoveryResult;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}

pub struct RecoveryState(pub Mutex<Option<RecoveryResult>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
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

            // Startup: read last_seen_at, update to now, cleanup stale triggers, detect missed reps
            let recovery_result = {
                let conn = db.connection();
                let app_state_repo = AppStateRepository::new(conn);
                let today = Local::now().format("%Y-%m-%d").to_string();

                // Read previous last_seen_at for gap detection
                let last_seen_str = match app_state_repo.get_last_seen() {
                    Ok(ts) => {
                        info!("Previous last_seen_at: {ts}");
                        Some(ts)
                    }
                    Err(e) => {
                        error!("Failed to read last_seen_at: {e}");
                        None
                    }
                };

                // Update last_seen_at to now
                let now_ts = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
                if let Err(e) = app_state_repo.update_last_seen(&now_ts) {
                    error!("Failed to update last_seen_at: {e}");
                }

                // Cleanup stale pending triggers
                match cleanup_stale_triggers(conn, &today) {
                    Ok(count) if count > 0 => info!("Auto-failed {count} stale pending triggers"),
                    Ok(_) => {}
                    Err(e) => error!("Failed to cleanup stale triggers: {e}"),
                }

                // Compute missed repetitions
                last_seen_str.and_then(|ts| {
                    let last_seen = chrono::NaiveDateTime::parse_from_str(&ts, "%Y-%m-%dT%H:%M:%S")
                        .or_else(|_| chrono::NaiveDateTime::parse_from_str(&ts, "%Y-%m-%d %H:%M:%S"))
                        .map_err(|e| error!("Failed to parse last_seen_at '{ts}': {e}"))
                        .ok()?;
                    let now = Local::now().naive_local();

                    let habit_repo = HabitRepository::new(conn);
                    let habits = habit_repo.list_active_with_schedules().ok()?;

                    if habits.is_empty() {
                        return None;
                    }

                    // Fetch completions for the gap window
                    let from_date = last_seen.date().format("%Y-%m-%d").to_string();
                    let to_date = now.date().format("%Y-%m-%d").to_string();
                    let completion_repo = CompletionRepository::new(conn);
                    let freeze_repo = FreezeRepository::new(conn);

                    let mut all_completions = Vec::new();
                    for habit in &habits {
                        if let Ok(comps) = completion_repo.list_by_habit_in_range(
                            &habit.id, &from_date, &to_date,
                        ) {
                            all_completions.extend(comps);
                        }
                    }

                    // Auto-apply streak freezes to earliest missed days per habit
                    let mut all_frozen_dates = Vec::new();
                    for habit in &habits {
                        let existing = freeze_repo
                            .list_by_habit_since(&habit.id, &from_date)
                            .unwrap_or_default();
                        let mut frozen: Vec<chrono::NaiveDate> = existing
                            .iter()
                            .filter_map(|f| {
                                chrono::NaiveDate::parse_from_str(&f.frozen_date, "%Y-%m-%d").ok()
                            })
                            .collect();

                        let budget_remaining =
                            streak::MAX_FREEZES_PER_STREAK.saturating_sub(frozen.len());
                        if budget_remaining > 0 {
                            // Walk gap chronologically, freeze earliest incomplete days
                            let gap_start = (last_seen.date() + chrono::Duration::days(1))
                                .max(chrono::NaiveDate::parse_from_str(
                                    &habit.start_date, "%Y-%m-%d",
                                ).unwrap_or(last_seen.date()));
                            let gap_end = now.date();
                            let slots_per_day = habit.schedule_times.len();
                            let mut date = gap_start;
                            let mut applied = 0usize;

                            while date < gap_end && applied < budget_remaining {
                                let dow = date.weekday().num_days_from_sunday() as u8;
                                if habit.schedule_days.contains(&dow)
                                    && !frozen.contains(&date)
                                {
                                    let ds = date.format("%Y-%m-%d").to_string();
                                    let day_comps: Vec<_> = all_completions
                                        .iter()
                                        .filter(|c| {
                                            c.habit_id == habit.id && c.trigger_date == ds
                                        })
                                        .collect();

                                    let is_complete = if day_comps.is_empty() {
                                        false
                                    } else {
                                        let done = day_comps.iter().filter(|c| {
                                            c.status == crate::models::CompletionStatus::Done
                                        }).count();
                                        done >= slots_per_day
                                            && !day_comps.iter().any(|c| {
                                                c.status == crate::models::CompletionStatus::Failed
                                            })
                                    };

                                    if !is_complete {
                                        let _ = freeze_repo.insert(&habit.id, &ds);
                                        frozen.push(date);
                                        applied += 1;
                                    }
                                }
                                date += chrono::Duration::days(1);
                            }
                        }
                        all_frozen_dates.extend(frozen);
                    }

                    let result = recovery::compute_missed_repetitions(
                        last_seen, now, &habits, &all_completions, &all_frozen_dates,
                    );

                    if result.habits.is_empty() {
                        None
                    } else {
                        info!(
                            "Recovery: {} habits with missed reps detected",
                            result.habits.len()
                        );
                        Some(result)
                    }
                })
            };

            let db_arc = Arc::new(Mutex::new(db));

            app.manage(AppState {
                db: Arc::clone(&db_arc),
            });
            app.manage(RecoveryState(Mutex::new(recovery_result)));

            let sched = std::sync::Arc::new(scheduler::Scheduler::new());
            app.manage(sched.clone());

            let spawner: Arc<dyn scheduler::OverlaySpawner> =
                Arc::new(scheduler::TauriOverlaySpawner::new(app.handle().clone()));

            let sched_run = sched.clone();
            tauri::async_runtime::spawn(async move {
                sched_run.run(db_arc, spawner).await;
            });

            tray::setup_tray(app)?;

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
            commands::recovery::get_missed_repetitions,
            commands::recovery::recover_habit_done,
            commands::recovery::recover_habit_dismiss,
            commands::settings::get_settings,
            commands::settings::set_autostart,
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
                    tray::show_main_window(app);
                }
                tauri::RunEvent::Exit => {
                    // Save window state on exit — safety net for tray quit / OS shutdown
                    let _ = app.save_window_state(
                        StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED,
                    );

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
