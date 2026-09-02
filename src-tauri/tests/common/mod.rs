//! Shared test helpers for integration tests.
//!
//! Extracted when the third integration test file (`scheduler_integration.rs`)
//! triggered the "extract on 3rd file" rule from `testing-critical-path-backend`.

use pauzaro_lib::db::Database;
use pauzaro_lib::models::habit::{CreateHabitInput, TimeSlot};
use tempfile::NamedTempFile;

/// Create an isolated temporary SQLite database with migrations applied.
pub fn setup_db() -> (NamedTempFile, Database) {
    let temp = NamedTempFile::new().expect("failed to create temp file");
    let db = Database::open(temp.path()).expect("failed to open database");
    (temp, db)
}

/// Standard test fixture: a habit with MWF schedule at 10:00 and 15:00.
pub fn sample_habit_input() -> CreateHabitInput {
    CreateHabitInput {
        name: "Take a break".into(),
        description: Some("Stand up and stretch".into()),
        icon: "Coffee".into(),
        icon_color: Some("#FF5733".into()),
        icon_stroke_width: Some(1.5),
        schedule_days: vec![1, 3, 5],
        schedule_times: vec![
            TimeSlot {
                start_time: "10:00".into(),
            },
            TimeSlot {
                start_time: "15:00".into(),
            },
        ],
        start_date: "2026-08-27".into(),
        end_date: None,
    }
}
