use chrono::Datelike;
use serde::Serialize;
use tauri::State;

use crate::db::completions::CompletionRepository;
use crate::db::habits::HabitRepository;
use crate::error::AppError;
use crate::models::habit::{Completion, CreateHabitInput, Habit};
use crate::models::CompletionStatus;
use crate::streak::calculate_streak;
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
}

fn build_habit_status(
    habit: &Habit,
    completion_repo: &CompletionRepository<'_>,
    today: chrono::NaiveDate,
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
    let streak = calculate_streak(today, &habit.schedule_days, slots_per_day, &all_completions);

    Ok(HabitStatusResponse {
        habit_id: habit.id.clone(),
        streak,
        today_slots,
        today_date: today_str.to_string(),
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

    let habit = habit_repo.get(&habit_id)?;
    let today = chrono::Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    build_habit_status(&habit, &completion_repo, today, &today_str)
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

    let habits = habit_repo.list()?;
    let today = chrono::Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    habits
        .iter()
        .map(|habit| build_habit_status(habit, &completion_repo, today, &today_str))
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
