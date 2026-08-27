use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeSlot {
    pub start_time: String,
    pub end_time: String,
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
