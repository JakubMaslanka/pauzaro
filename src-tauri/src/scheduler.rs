use std::sync::Arc;

use chrono::{Datelike, Local, NaiveTime, TimeZone};
use tokio::sync::Notify;

use tauri::Manager;
use tauri::webview::WebviewWindowBuilder;

use crate::db::completions::CompletionRepository;
use crate::db::habits::HabitRepository;
use crate::db::pending_triggers::PendingTriggerRepository;
use crate::models::{Completion, Habit, PendingTrigger};
use crate::AppState;

/// Computed next trigger to fire.
#[derive(Debug, Clone)]
pub struct NextTrigger {
    pub habit_id: String,
    pub scheduled_time: String,
    pub trigger_date: String,
    pub fire_at: chrono::DateTime<Local>,
    pub pending_trigger_id: Option<String>,
}

pub struct Scheduler {
    notify: Arc<Notify>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self {
            notify: Arc::new(Notify::new()),
        }
    }

    /// Signal the scheduler to re-evaluate immediately.
    pub fn wake(&self) {
        self.notify.notify_one();
    }

    /// Main scheduler loop. Runs forever, sleeping between triggers.
    pub async fn run(&self, app: tauri::AppHandle) {
        log::info!("Scheduler started");

        loop {
            let app_clone = app.clone();
            let query_result = tokio::task::spawn_blocking(move || {
                let state = app_clone.state::<AppState>();
                let db = state.db.lock().map_err(|e| format!("DB lock failed: {e}"))?;
                let conn = db.connection();

                let habit_repo = HabitRepository::new(conn);
                let completion_repo = CompletionRepository::new(conn);
                let pending_repo = PendingTriggerRepository::new(conn);

                let habits = habit_repo
                    .list_active_with_schedules()
                    .map_err(|e| format!("Failed to list habits: {e}"))?;

                let pending = pending_repo
                    .list_active()
                    .map_err(|e| format!("Failed to list pending triggers: {e}"))?;

                let now = Local::now();
                let today = now.date_naive();
                let today_str = today.format("%Y-%m-%d").to_string();

                let mut all_completions = Vec::new();
                for habit in &habits {
                    let completions = completion_repo
                        .get_by_habit_and_date(&habit.id, &today_str)
                        .map_err(|e| format!("Failed to get completions: {e}"))?;
                    all_completions.extend(completions);
                }

                Ok::<_, String>((habits, pending, all_completions))
            })
            .await;

            let (habits, pending, completions_today) = match query_result {
                Ok(Ok(data)) => data,
                Ok(Err(e)) => {
                    log::error!("Scheduler query error: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                    continue;
                }
                Err(e) => {
                    log::error!("Scheduler spawn_blocking panic: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                    continue;
                }
            };

            let now = Local::now();
            match find_next_trigger(now, &habits, &pending, &completions_today) {
                Some(next) => {
                    let delay = next.fire_at.signed_duration_since(now);
                    let sleep_duration = if delay.num_milliseconds() <= 0 {
                        std::time::Duration::from_millis(0)
                    } else {
                        std::time::Duration::from_millis(delay.num_milliseconds() as u64)
                    };

                    log::info!(
                        "Next trigger: habit={} time={} in {:?}",
                        next.habit_id,
                        next.scheduled_time,
                        sleep_duration
                    );

                    tokio::select! {
                        _ = tokio::time::sleep(sleep_duration) => {
                            log::info!(
                                "TRIGGER FIRED: habit={} scheduled_time={}",
                                next.habit_id,
                                next.scheduled_time
                            );

                            // Upsert pending trigger if not already pending
                            if next.pending_trigger_id.is_none() {
                                let app_upsert = app.clone();
                                let habit_id = next.habit_id.clone();
                                let sched_time = next.scheduled_time.clone();
                                let trigger_date = next.trigger_date.clone();
                                let now_str = Local::now().naive_local()
                                    .format("%Y-%m-%dT%H:%M:%S").to_string();
                                let _ = tokio::task::spawn_blocking(move || {
                                    let state = app_upsert.state::<AppState>();
                                    let db = match state.db.lock() {
                                        Ok(db) => db,
                                        Err(e) => {
                                            log::error!("DB lock failed during trigger upsert: {e}");
                                            return;
                                        }
                                    };
                                    let repo = PendingTriggerRepository::new(db.connection());
                                    if let Err(e) = repo.upsert(&habit_id, &trigger_date, &sched_time, &now_str) {
                                        log::error!("Failed to upsert pending trigger: {e}");
                                    }
                                }).await;
                            }

                            // Create overlay window
                            let label = format!("overlay-{}", next.habit_id);
                            if app.get_webview_window(&label).is_some() {
                                log::info!("Overlay already open for {}", next.habit_id);
                                continue;
                            }

                            let url = format!(
                                "/#/overlay/{}?triggerDate={}&scheduledTime={}",
                                next.habit_id, next.trigger_date, next.scheduled_time
                            );
                            match WebviewWindowBuilder::new(
                                &app,
                                &label,
                                tauri::WebviewUrl::App(url.into()),
                            )
                            .title("Pauzaro")
                            .inner_size(420.0, 380.0)
                            .always_on_top(true)
                            .decorations(false)
                            .center()
                            .focused(true)
                            .build()
                            {
                                Ok(_) => log::info!("Overlay window created: {label}"),
                                Err(e) => log::error!("Failed to create overlay: {e}"),
                            }
                        }
                        _ = self.notify.notified() => {
                            log::info!("Scheduler woken — re-evaluating");
                            continue;
                        }
                    }
                }
                None => {
                    log::info!("No triggers scheduled — waiting for wake signal");
                    self.notify.notified().await;
                    log::info!("Scheduler woken — re-evaluating");
                }
            }
        }
    }
}

/// Pure function: given current time, active habits, pending triggers, and today's
/// completions, compute the earliest next trigger to fire.
pub fn find_next_trigger(
    now: chrono::DateTime<Local>,
    habits: &[Habit],
    pending: &[PendingTrigger],
    completions_today: &[Completion],
) -> Option<NextTrigger> {
    let mut earliest: Option<NextTrigger> = None;
    let today = now.date_naive();
    let current_dow = today.weekday().num_days_from_sunday() as u8;

    // Check pending triggers first (snooze re-fires)
    for pt in pending {
        if let Ok(fire_at) = pt.next_fire_at.parse::<chrono::NaiveDateTime>() {
            let fire_at_local = Local.from_local_datetime(&fire_at).single();
            if let Some(fire_at_local) = fire_at_local {
                let candidate = NextTrigger {
                    habit_id: pt.habit_id.clone(),
                    scheduled_time: pt.scheduled_time.clone(),
                    trigger_date: pt.trigger_date.clone(),
                    fire_at: fire_at_local,
                    pending_trigger_id: Some(pt.id.clone()),
                };
                if earliest.as_ref().is_none_or(|e| candidate.fire_at < e.fire_at) {
                    earliest = Some(candidate);
                }
            }
        }
    }

    // Check scheduled habit times for today and upcoming days
    for habit in habits {
        for slot in &habit.schedule_times {
            // Check today
            if habit.schedule_days.contains(&current_dow) {
                // Skip if already completed
                let already_completed = completions_today.iter().any(|c| {
                    c.habit_id == habit.id && c.scheduled_time == slot.start_time
                });
                // Skip if pending trigger exists (handled above)
                let has_pending = pending.iter().any(|pt| {
                    pt.habit_id == habit.id
                        && pt.trigger_date == today.format("%Y-%m-%d").to_string()
                        && pt.scheduled_time == slot.start_time
                });

                if !already_completed && !has_pending {
                    if let Ok(time) = NaiveTime::parse_from_str(&slot.start_time, "%H:%M") {
                        let fire_dt = today.and_time(time);
                        if let Some(fire_at_local) = Local.from_local_datetime(&fire_dt).single() {
                            let candidate = NextTrigger {
                                habit_id: habit.id.clone(),
                                scheduled_time: slot.start_time.clone(),
                                trigger_date: today.format("%Y-%m-%d").to_string(),
                                fire_at: fire_at_local,
                                pending_trigger_id: None,
                            };
                            if earliest.as_ref().is_none_or(|e| candidate.fire_at < e.fire_at) {
                                earliest = Some(candidate);
                            }
                        }
                    }
                }
            }

            // Check next 7 days for future triggers
            for day_offset in 1..=7u32 {
                let future_date = today + chrono::Duration::days(day_offset as i64);
                let future_dow = future_date.weekday().num_days_from_sunday() as u8;

                if habit.schedule_days.contains(&future_dow) {
                    if let Ok(time) = NaiveTime::parse_from_str(&slot.start_time, "%H:%M") {
                        let fire_dt = future_date.and_time(time);
                        if let Some(fire_at_local) = Local.from_local_datetime(&fire_dt).single() {
                            let candidate = NextTrigger {
                                habit_id: habit.id.clone(),
                                scheduled_time: slot.start_time.clone(),
                                trigger_date: future_date.format("%Y-%m-%d").to_string(),
                                fire_at: fire_at_local,
                                pending_trigger_id: None,
                            };
                            if earliest.as_ref().is_none_or(|e| candidate.fire_at < e.fire_at) {
                                earliest = Some(candidate);
                            }
                        }
                    }
                    break; // Only need the next occurrence per slot
                }
            }
        }
    }

    earliest
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Completion, CompletionStatus, Habit, PendingTrigger, TimeSlot};
    use chrono::Local;

    fn make_habit(id: &str, days: Vec<u8>, times: Vec<&str>) -> Habit {
        Habit {
            id: id.to_string(),
            name: format!("Habit {id}"),
            description: String::new(),
            icon: "Coffee".to_string(),
            icon_color: "#000".to_string(),
            icon_stroke_width: 2.0,
            start_date: "2026-01-01".to_string(),
            end_date: None,
            is_active: true,
            created_at: "2026-01-01T00:00:00".to_string(),
            schedule_days: days,
            schedule_times: times
                .into_iter()
                .map(|t| TimeSlot {
                    start_time: t.to_string(),
                })
                .collect(),
        }
    }

    fn make_completion(habit_id: &str, date: &str, time: &str, status: CompletionStatus) -> Completion {
        Completion {
            id: "c-1".to_string(),
            habit_id: habit_id.to_string(),
            trigger_date: date.to_string(),
            scheduled_time: time.to_string(),
            status,
            completed_at: "2026-01-01T10:00:00".to_string(),
        }
    }

    fn make_pending(id: &str, habit_id: &str, date: &str, time: &str, fire_at: &str, snooze_count: i32) -> PendingTrigger {
        PendingTrigger {
            id: id.to_string(),
            habit_id: habit_id.to_string(),
            trigger_date: date.to_string(),
            scheduled_time: time.to_string(),
            snooze_count,
            next_fire_at: fire_at.to_string(),
            created_at: "2026-01-01T10:00:00".to_string(),
        }
    }

    #[test]
    fn no_habits_returns_none() {
        let now = Local::now();
        let result = find_next_trigger(now, &[], &[], &[]);
        assert!(result.is_none());
    }

    #[test]
    fn habit_scheduled_current_minute_fires_immediately() {
        let now = Local::now();
        let current_dow = now.date_naive().weekday().num_days_from_sunday() as u8;
        let current_time = now.format("%H:%M").to_string();

        let habit = make_habit("h1", vec![current_dow], vec![current_time.as_str()]);
        let result = find_next_trigger(now, &[habit], &[], &[]);

        assert!(result.is_some());
        let trigger = result.unwrap();
        assert_eq!(trigger.habit_id, "h1");
        assert_eq!(trigger.scheduled_time, current_time);
        // Should fire at or before now (same minute)
        assert!(trigger.fire_at <= now + chrono::Duration::minutes(1));
    }

    #[test]
    fn habit_scheduled_tomorrow_correct_delay() {
        let now = Local::now();
        let tomorrow = now.date_naive() + chrono::Duration::days(1);
        let tomorrow_dow = tomorrow.weekday().num_days_from_sunday() as u8;

        let habit = make_habit("h1", vec![tomorrow_dow], vec!["09:00"]);
        let result = find_next_trigger(now, &[habit], &[], &[]);

        assert!(result.is_some());
        let trigger = result.unwrap();
        assert_eq!(trigger.habit_id, "h1");
        assert!(trigger.fire_at > now);
    }

    #[test]
    fn pending_trigger_respects_next_fire_at() {
        let now = Local::now();
        let fire_at = (now + chrono::Duration::minutes(5))
            .naive_local()
            .format("%Y-%m-%dT%H:%M:%S")
            .to_string();

        let pending = make_pending("pt1", "h1", "2026-08-30", "10:00", &fire_at, 1);
        let result = find_next_trigger(now, &[], &[pending], &[]);

        assert!(result.is_some());
        let trigger = result.unwrap();
        assert_eq!(trigger.pending_trigger_id, Some("pt1".to_string()));
    }

    #[test]
    fn completed_slot_skipped() {
        let now = Local::now();
        let current_dow = now.date_naive().weekday().num_days_from_sunday() as u8;
        let today_str = now.date_naive().format("%Y-%m-%d").to_string();

        let habit = make_habit("h1", vec![current_dow], vec!["10:00"]);
        let completion = make_completion("h1", &today_str, "10:00", CompletionStatus::Done);

        let result = find_next_trigger(now, &[habit], &[], &[completion]);
        // Should find no trigger for today (completed), might find next week
        if let Some(trigger) = &result {
            // If found, must be a future occurrence, not today
            assert!(trigger.fire_at.date_naive() > now.date_naive());
        }
    }

    #[test]
    fn multiple_habits_earliest_wins() {
        let now = Local::now();
        let current_dow = now.date_naive().weekday().num_days_from_sunday() as u8;

        let habit1 = make_habit("h1", vec![current_dow], vec!["23:59"]);
        let habit2 = make_habit("h2", vec![current_dow], vec!["23:58"]);

        let result = find_next_trigger(now, &[habit1, habit2], &[], &[]);
        assert!(result.is_some());

        let trigger = result.unwrap();
        // h2 at 23:58 is earlier than h1 at 23:59
        assert_eq!(trigger.habit_id, "h2");
    }

    #[test]
    fn past_unhandled_trigger_fires_immediately() {
        let now = Local::now();
        let current_dow = now.date_naive().weekday().num_days_from_sunday() as u8;

        // Schedule for earlier today (00:01) — already past
        let habit = make_habit("h1", vec![current_dow], vec!["00:01"]);
        let result = find_next_trigger(now, &[habit], &[], &[]);

        assert!(result.is_some());
        let trigger = result.unwrap();
        assert_eq!(trigger.habit_id, "h1");
        // Fire time is in the past — scheduler will fire immediately
        assert!(trigger.fire_at <= now);
    }
}
