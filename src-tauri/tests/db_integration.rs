mod common;

use common::{sample_habit_input, setup_db};
use pauzaro_lib::db::completions::CompletionRepository;
use pauzaro_lib::db::habits::HabitRepository;
use pauzaro_lib::db::user_profile::UserProfileRepository;
use pauzaro_lib::db::Database;
use pauzaro_lib::models::habit::{CreateHabitInput, TimeSlot};
use pauzaro_lib::models::user_profile::CreateUserProfileInput;
use pauzaro_lib::models::CompletionStatus;
use pauzaro_lib::AppState;
use std::sync::Mutex;
use tempfile::NamedTempFile;

// --- Schema / migration tests ---

#[test]
fn migration_runner_creates_schema_version_table() {
    let (_temp, db) = setup_db();

    let version: usize = db
        .connection()
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| {
            row.get(0)
        })
        .expect("schema_version table should exist");

    assert_eq!(version, 3, "version should be 3 after three migrations");
}

#[test]
fn database_open_is_idempotent() {
    let temp = NamedTempFile::new().expect("failed to create temp file");

    let db1 = Database::open(temp.path()).expect("first open should succeed");
    drop(db1);

    let db2 = Database::open(temp.path()).expect("second open should succeed");

    let version: usize = db2
        .connection()
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| {
            row.get(0)
        })
        .expect("schema_version table should exist after second open");

    assert_eq!(version, 3, "version should remain 3");
}

#[test]
fn app_state_wraps_database_in_mutex() {
    let (_temp, db) = setup_db();

    let state = AppState {
        db: Mutex::new(db),
    };

    let locked = state.db.lock().expect("mutex should not be poisoned");
    let version: usize = locked
        .connection()
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| {
            row.get(0)
        })
        .expect("should query through AppState");

    assert_eq!(version, 3);
}

// --- User profile tests ---

#[test]
fn create_user_profile_and_retrieve() {
    let (_temp, db) = setup_db();
    let repo = UserProfileRepository::new(db.connection());

    let input = CreateUserProfileInput {
        name: "Jakub".into(),
    };
    let profile = repo.create(&input).expect("should create profile");

    assert_eq!(profile.name, "Jakub");
    assert!(!profile.onboarding_completed);
    assert!(!profile.id.is_empty());
    assert!(!profile.created_at.is_empty());

    let retrieved = repo.get().expect("should get profile").expect("profile should exist");
    assert_eq!(retrieved.id, profile.id);
    assert_eq!(retrieved.name, "Jakub");
}

#[test]
fn complete_onboarding_flips_flag() {
    let (_temp, db) = setup_db();
    let repo = UserProfileRepository::new(db.connection());

    let input = CreateUserProfileInput {
        name: "Test User".into(),
    };
    repo.create(&input).expect("should create profile");

    repo.complete_onboarding().expect("should complete onboarding");

    let profile = repo.get().expect("should get profile").expect("profile should exist");
    assert!(profile.onboarding_completed);
}

#[test]
fn get_profile_returns_none_when_empty() {
    let (_temp, db) = setup_db();
    let repo = UserProfileRepository::new(db.connection());

    let result = repo.get().expect("should not error");
    assert!(result.is_none());
}

#[test]
fn create_profile_rejects_empty_name() {
    let (_temp, db) = setup_db();
    let repo = UserProfileRepository::new(db.connection());

    let input = CreateUserProfileInput {
        name: "   ".into(),
    };
    let result = repo.create(&input);
    assert!(result.is_err());
}

// --- Habit tests ---

#[test]
fn create_habit_with_schedule_and_retrieve() {
    let (_temp, db) = setup_db();
    let repo = HabitRepository::new(db.connection());

    let input = sample_habit_input();
    let habit = repo.create(&input).expect("should create habit");

    assert_eq!(habit.name, "Take a break");
    assert_eq!(habit.description, "Stand up and stretch");
    assert_eq!(habit.icon, "Coffee");
    assert_eq!(habit.icon_color, "#FF5733");
    assert!((habit.icon_stroke_width - 1.5).abs() < f64::EPSILON);
    assert_eq!(habit.start_date, "2026-08-27");
    assert!(habit.end_date.is_none());
    assert!(habit.is_active);
    assert_eq!(habit.schedule_days, vec![1, 3, 5]);
    assert_eq!(habit.schedule_times.len(), 2);
    assert_eq!(habit.schedule_times[0].start_time, "10:00");
}

#[test]
fn get_habit_by_id_returns_schedule_data() {
    let (_temp, db) = setup_db();
    let repo = HabitRepository::new(db.connection());

    let input = sample_habit_input();
    let created = repo.create(&input).expect("should create habit");

    let retrieved = repo.get(&created.id).expect("should get habit by id");
    assert_eq!(retrieved.id, created.id);
    assert_eq!(retrieved.schedule_days, vec![1, 3, 5]);
    assert_eq!(retrieved.schedule_times.len(), 2);
}

#[test]
fn get_habit_not_found() {
    let (_temp, db) = setup_db();
    let repo = HabitRepository::new(db.connection());

    let result = repo.get("nonexistent-id");
    assert!(result.is_err());
}

#[test]
fn list_habits_returns_all_with_schedules() {
    let (_temp, db) = setup_db();
    let repo = HabitRepository::new(db.connection());

    let input1 = sample_habit_input();
    repo.create(&input1).expect("should create habit 1");

    let input2 = CreateHabitInput {
        name: "Walk".into(),
        description: None,
        icon: "Footprints".into(),
        icon_color: None,
        icon_stroke_width: None,
        schedule_days: vec![0, 6],
        schedule_times: vec![TimeSlot {
            start_time: "08:00".into(),
        }],
        start_date: "2026-08-27".into(),
        end_date: Some("2026-12-31".into()),
    };
    repo.create(&input2).expect("should create habit 2");

    let habits = repo.list().expect("should list habits");
    assert_eq!(habits.len(), 2);

    // Both created in same second, so order may vary. Check by name.
    let break_habit = habits.iter().find(|h| h.name == "Take a break").expect("should find break habit");
    let walk_habit = habits.iter().find(|h| h.name == "Walk").expect("should find walk habit");

    assert_eq!(break_habit.schedule_days, vec![1, 3, 5]);
    assert_eq!(walk_habit.schedule_days, vec![0, 6]);
    assert_eq!(walk_habit.end_date, Some("2026-12-31".into()));
}

#[test]
fn create_habit_rejects_empty_name() {
    let (_temp, db) = setup_db();
    let repo = HabitRepository::new(db.connection());

    let input = CreateHabitInput {
        name: "".into(),
        description: None,
        icon: "Coffee".into(),
        icon_color: None,
        icon_stroke_width: None,
        schedule_days: vec![1],
        schedule_times: vec![TimeSlot {
            start_time: "10:00".into(),
        }],
        start_date: "2026-08-27".into(),
        end_date: None,
    };

    let result = repo.create(&input);
    assert!(result.is_err());
}

#[test]
fn create_habit_rejects_empty_schedule_days() {
    let (_temp, db) = setup_db();
    let repo = HabitRepository::new(db.connection());

    let input = CreateHabitInput {
        name: "Break".into(),
        description: None,
        icon: "Coffee".into(),
        icon_color: None,
        icon_stroke_width: None,
        schedule_days: vec![],
        schedule_times: vec![TimeSlot {
            start_time: "10:00".into(),
        }],
        start_date: "2026-08-27".into(),
        end_date: None,
    };

    let result = repo.create(&input);
    assert!(result.is_err());
}

#[test]
fn create_habit_rejects_empty_schedule_times() {
    let (_temp, db) = setup_db();
    let repo = HabitRepository::new(db.connection());

    let input = CreateHabitInput {
        name: "Break".into(),
        description: None,
        icon: "Coffee".into(),
        icon_color: None,
        icon_stroke_width: None,
        schedule_days: vec![1],
        schedule_times: vec![],
        start_date: "2026-08-27".into(),
        end_date: None,
    };

    let result = repo.create(&input);
    assert!(result.is_err());
}

// --- Completion range query tests ---

#[test]
fn list_by_habit_in_range_returns_bounded_results() {
    let (_temp, db) = setup_db();
    let habit_repo = HabitRepository::new(db.connection());
    let comp_repo = CompletionRepository::new(db.connection());

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");

    comp_repo.insert(&habit.id, "2026-08-01", "10:00", &CompletionStatus::Done).unwrap();
    comp_repo.insert(&habit.id, "2026-08-15", "10:00", &CompletionStatus::Done).unwrap();
    comp_repo.insert(&habit.id, "2026-08-20", "10:00", &CompletionStatus::Failed).unwrap();
    comp_repo.insert(&habit.id, "2026-08-31", "10:00", &CompletionStatus::Done).unwrap();
    comp_repo.insert(&habit.id, "2026-09-01", "10:00", &CompletionStatus::Done).unwrap();

    let results = comp_repo
        .list_by_habit_in_range(&habit.id, "2026-08-01", "2026-08-31")
        .expect("should query range");

    assert_eq!(results.len(), 4, "should include Aug 1, 15, 20, 31 but not Sep 1");
    assert_eq!(results[0].trigger_date, "2026-08-01");
    assert_eq!(results[3].trigger_date, "2026-08-31");
}

#[test]
fn list_by_habit_in_range_returns_empty_for_no_matches() {
    let (_temp, db) = setup_db();
    let habit_repo = HabitRepository::new(db.connection());
    let comp_repo = CompletionRepository::new(db.connection());

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");
    comp_repo.insert(&habit.id, "2026-08-15", "10:00", &CompletionStatus::Done).unwrap();

    let results = comp_repo
        .list_by_habit_in_range(&habit.id, "2026-07-01", "2026-07-31")
        .expect("should query range");

    assert_eq!(results.len(), 0);
}

#[test]
fn list_by_habit_in_range_orders_by_date_then_time() {
    let (_temp, db) = setup_db();
    let habit_repo = HabitRepository::new(db.connection());
    let comp_repo = CompletionRepository::new(db.connection());

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");

    comp_repo.insert(&habit.id, "2026-08-10", "15:00", &CompletionStatus::Done).unwrap();
    comp_repo.insert(&habit.id, "2026-08-10", "10:00", &CompletionStatus::Done).unwrap();
    comp_repo.insert(&habit.id, "2026-08-09", "10:00", &CompletionStatus::Done).unwrap();

    let results = comp_repo
        .list_by_habit_in_range(&habit.id, "2026-08-09", "2026-08-10")
        .expect("should query range");

    assert_eq!(results.len(), 3);
    assert_eq!(results[0].trigger_date, "2026-08-09");
    assert_eq!(results[1].trigger_date, "2026-08-10");
    assert_eq!(results[1].scheduled_time, "10:00");
    assert_eq!(results[2].trigger_date, "2026-08-10");
    assert_eq!(results[2].scheduled_time, "15:00");
}
