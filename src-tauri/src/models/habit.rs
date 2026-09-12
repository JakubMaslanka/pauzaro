use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeSlot {
    pub start_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CompletionStatus {
    Done,
    Failed,
}

impl CompletionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CompletionStatus::Done => "done",
            CompletionStatus::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, AppError> {
        match s {
            "done" => Ok(CompletionStatus::Done),
            "failed" => Ok(CompletionStatus::Failed),
            other => Err(AppError::Validation(format!("Invalid completion status: {other}"))),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Completion {
    pub id: String,
    pub habit_id: String,
    pub trigger_date: String,
    pub scheduled_time: String,
    pub status: CompletionStatus,
    pub completed_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingTrigger {
    pub id: String,
    pub habit_id: String,
    pub trigger_date: String,
    pub scheduled_time: String,
    pub snooze_count: i32,
    pub next_fire_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub icon_color: String,
    pub icon_stroke_width: f64,
    pub start_date: String,
    pub end_date: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub schedule_days: Vec<u8>,
    pub schedule_times: Vec<TimeSlot>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHabitInput {
    pub name: String,
    pub description: Option<String>,
    pub icon: String,
    pub icon_color: Option<String>,
    pub icon_stroke_width: Option<f64>,
    pub schedule_days: Vec<u8>,
    pub schedule_times: Vec<TimeSlot>,
    pub start_date: String,
    pub end_date: Option<String>,
}

impl CreateHabitInput {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.name.trim().is_empty() {
            return Err(AppError::Validation("Habit name cannot be empty".into()));
        }
        if self.schedule_days.is_empty() {
            return Err(AppError::Validation(
                "At least one schedule day is required".into(),
            ));
        }
        if self.schedule_times.is_empty() {
            return Err(AppError::Validation(
                "At least one time slot is required".into(),
            ));
        }
        if self.schedule_times.len() > 10 {
            return Err(AppError::Validation(
                "A maximum of 10 time slots per day is allowed".into(),
            ));
        }
        for &day in &self.schedule_days {
            if day > 6 {
                return Err(AppError::Validation(format!(
                    "Invalid day of week: {day}. Must be 0-6"
                )));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_input(time_slot_count: usize) -> CreateHabitInput {
        let schedule_times = (0..time_slot_count)
            .map(|i| TimeSlot {
                start_time: format!("{:02}:00", 8 + i),
            })
            .collect();

        CreateHabitInput {
            name: "Test habit".into(),
            description: None,
            icon: "dumbbell".into(),
            icon_color: None,
            icon_stroke_width: None,
            schedule_days: vec![1, 3, 5],
            schedule_times,
            start_date: "2026-09-12".into(),
            end_date: None,
        }
    }

    #[test]
    fn validate_accepts_10_time_slots() {
        let input = make_input(10);
        assert!(input.validate().is_ok());
    }

    #[test]
    fn validate_rejects_11_time_slots() {
        let input = make_input(11);
        let err = input.validate().unwrap_err();
        match err {
            AppError::Validation(msg) => {
                assert!(msg.contains("maximum"), "unexpected message: {msg}");
            }
            other => panic!("expected Validation error, got: {other:?}"),
        }
    }
}
