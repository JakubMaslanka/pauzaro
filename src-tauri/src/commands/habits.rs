use chrono::{Datelike, NaiveDate};
use serde::Serialize;
use tauri::State;

use crate::db::completions::CompletionRepository;
use crate::db::freeze::FreezeRepository;
use crate::db::habits::HabitRepository;
use crate::error::AppError;
use crate::models::habit::{Completion, CreateHabitInput, Habit};
use crate::models::CompletionStatus;
use crate::streak::{self, calculate_streak};
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

#[derive(Debug, Serialize)]
pub struct SlotStatus {
    pub scheduled_time: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct HabitStatusResponse {
    pub habit_id: String,
    pub streak: u32,
    pub today_slots: Vec<SlotStatus>,
    pub today_date: String,
    pub freezes_remaining: u32,
    pub frozen_dates: Vec<String>,
}

fn build_habit_status(
    habit: &Habit,
    completion_repo: &CompletionRepository<'_>,
    freeze_repo: &FreezeRepository<'_>,
    today: NaiveDate,
    today_str: &str,
) -> Result<HabitStatusResponse, AppError> {
    let today_completions = completion_repo.get_by_habit_and_date(&habit.id, today_str)?;

    let today_dow = today.weekday().num_days_from_sunday() as u8;
    let is_scheduled_today = habit.schedule_days.contains(&today_dow);

    let today_slots: Vec<SlotStatus> = if is_scheduled_today {
        habit
            .schedule_times
            .iter()
            .map(|slot| {
                let completion = today_completions
                    .iter()
                    .find(|c| c.scheduled_time == slot.start_time);

                let status = match completion {
                    Some(c) => match c.status {
                        CompletionStatus::Done => "done",
                        CompletionStatus::Failed => "failed",
                    },
                    None => "pending",
                };

                SlotStatus {
                    scheduled_time: slot.start_time.clone(),
                    status: status.to_string(),
                }
            })
            .collect()
    } else {
        vec![]
    };

    let from_date = (today - chrono::Duration::days(90))
        .format("%Y-%m-%d")
        .to_string();
    let all_completions = completion_repo.list_by_habit_since(&habit.id, &from_date)?;
    let slots_per_day = habit.schedule_times.len();

    // --- Freeze consumption: detect missed days and auto-consume freezes ---
    let existing_freezes = freeze_repo.list_by_habit_since(&habit.id, &from_date)?;
    let mut frozen_dates: Vec<NaiveDate> = existing_freezes
        .iter()
        .filter_map(|f| NaiveDate::parse_from_str(&f.frozen_date, "%Y-%m-%d").ok())
        .collect();

    let budget_used = frozen_dates.len();
    let budget_remaining = streak::MAX_FREEZES_PER_STREAK.saturating_sub(budget_used);

    if budget_remaining > 0 && slots_per_day > 0 {
        let yesterday = today - chrono::Duration::days(1);
        let earliest = today - chrono::Duration::days(90);

        // Walk backwards from yesterday — collect consecutive missed days at streak tail
        let mut missed_tail: Vec<NaiveDate> = Vec::new();
        let mut check_date = yesterday;

        while check_date >= earliest {
            let dow = check_date.weekday().num_days_from_sunday() as u8;
            if habit.schedule_days.contains(&dow) {
                if frozen_dates.contains(&check_date) {
                    check_date -= chrono::Duration::days(1);
                    continue;
                }

                let date_str = check_date.format("%Y-%m-%d").to_string();
                let day_completions: Vec<&Completion> = all_completions
                    .iter()
                    .filter(|c| c.trigger_date == date_str)
                    .collect();

                let is_complete = if day_completions.is_empty() {
                    false
                } else {
                    let has_failed = day_completions
                        .iter()
                        .any(|c| c.status == CompletionStatus::Failed);
                    if has_failed {
                        false
                    } else {
                        day_completions
                            .iter()
                            .filter(|c| c.status == CompletionStatus::Done)
                            .count()
                            >= slots_per_day
                    }
                };

                if is_complete {
                    break;
                }
                missed_tail.push(check_date);
            }
            check_date -= chrono::Duration::days(1);
        }

        // Freeze earliest missed days first (chronological order)
        missed_tail.reverse();
        for date in missed_tail.into_iter().take(budget_remaining) {
            let date_str = date.format("%Y-%m-%d").to_string();
            freeze_repo.insert(&habit.id, &date_str)?;
            frozen_dates.push(date);
        }
    }

    let streak = calculate_streak(
        today,
        &habit.schedule_days,
        slots_per_day,
        &all_completions,
        &frozen_dates,
    );

    // Replenish freezes when streak resets to 0
    let (freezes_remaining, frozen_dates_strs) = if streak == 0 && !frozen_dates.is_empty() {
        freeze_repo.delete_all_by_habit(&habit.id)?;
        (streak::MAX_FREEZES_PER_STREAK as u32, vec![])
    } else {
        let strs: Vec<String> = frozen_dates
            .iter()
            .map(|d| d.format("%Y-%m-%d").to_string())
            .collect();
        let remaining =
            streak::MAX_FREEZES_PER_STREAK.saturating_sub(frozen_dates.len()) as u32;
        (remaining, strs)
    };

    Ok(HabitStatusResponse {
        habit_id: habit.id.clone(),
        streak,
        today_slots,
        today_date: today_str.to_string(),
        freezes_remaining,
        frozen_dates: frozen_dates_strs,
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_habit_status(
    state: State<'_, AppState>,
    habit_id: String,
) -> Result<HabitStatusResponse, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);
    let freeze_repo = FreezeRepository::new(conn);

    let habit = habit_repo.get(&habit_id)?;
    let today = chrono::Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    build_habit_status(&habit, &completion_repo, &freeze_repo, today, &today_str)
}

#[tauri::command]
pub fn get_all_habit_statuses(
    state: State<'_, AppState>,
) -> Result<Vec<HabitStatusResponse>, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);
    let freeze_repo = FreezeRepository::new(conn);

    let habits = habit_repo.list()?;
    let today = chrono::Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    habits
        .iter()
        .map(|habit| build_habit_status(habit, &completion_repo, &freeze_repo, today, &today_str))
        .collect()
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_month_completions(
    state: State<'_, AppState>,
    habit_id: String,
    from_date: String,
    to_date: String,
) -> Result<Vec<Completion>, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = CompletionRepository::new(db.connection());
    repo.list_by_habit_in_range(&habit_id, &from_date, &to_date)
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_habit(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: String,
) -> Result<Habit, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = HabitRepository::new(db.connection());
    repo.update(&id, &name, &description)
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_habit(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = HabitRepository::new(db.connection());
    repo.delete(&id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_latest_completion(
    state: State<'_, AppState>,
    habit_id: String,
) -> Result<Option<Completion>, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(format!("Failed to acquire database lock: {e}"))
    })?;
    let repo = CompletionRepository::new(db.connection());
    repo.get_latest_by_habit(&habit_id)
}
