use pauzaro_lib::db::habits::HabitRepository;
use pauzaro_lib::db::user_profile::UserProfileRepository;
use pauzaro_lib::db::Database;
use pauzaro_lib::models::habit::{CreateHabitInput, TimeSlot};
use pauzaro_lib::models::user_profile::CreateUserProfileInput;
use pauzaro_lib::AppState;
use std::sync::Mutex;
use tempfile::NamedTempFile;

fn setup_db() -> (NamedTempFile, Database) {
    let temp = NamedTempFile::new().expect("failed to create temp file");
    let db = Database::open(temp.path()).expect("failed to open database");
    (temp, db)
}

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

    assert_eq!(version, 2, "version should be 2 after two migrations");
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

    assert_eq!(version, 2, "version should remain 2");
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

    assert_eq!(version, 2);
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

fn sample_habit_input() -> CreateHabitInput {
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
                end_time: "10:15".into(),
            },
            TimeSlot {
                start_time: "15:00".into(),
                end_time: "15:10".into(),
            },
        ],
        start_date: "2026-08-27".into(),
        end_date: None,
    }
}

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
    assert_eq!(habit.schedule_times[0].end_time, "10:15");
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
            end_time: "08:30".into(),
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
            end_time: "10:15".into(),
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
            end_time: "10:15".into(),
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
