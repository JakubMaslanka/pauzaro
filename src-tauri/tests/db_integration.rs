mod common;

use common::{sample_habit_input, setup_db};
use pauzaro_lib::db::app_state::{cleanup_stale_triggers, AppStateRepository};
use pauzaro_lib::db::completions::CompletionRepository;
use pauzaro_lib::db::habits::HabitRepository;
use pauzaro_lib::db::pending_triggers::PendingTriggerRepository;
use pauzaro_lib::db::user_profile::UserProfileRepository;
use pauzaro_lib::db::Database;
use pauzaro_lib::models::habit::{CreateHabitInput, TimeSlot};
use pauzaro_lib::models::user_profile::CreateUserProfileInput;
use pauzaro_lib::models::CompletionStatus;
use pauzaro_lib::AppState;
use std::sync::{Arc, Mutex};
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

    assert_eq!(version, 4, "version should be 4 after four migrations");
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

    assert_eq!(version, 4, "version should remain 4");
}

#[test]
fn app_state_wraps_database_in_mutex() {
    let (_temp, db) = setup_db();

    let state = AppState {
        db: Arc::new(Mutex::new(db)),
    };

    let locked = state.db.lock().expect("mutex should not be poisoned");
    let version: usize = locked
        .connection()
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| {
            row.get(0)
        })
        .expect("should query through AppState");

    assert_eq!(version, 4);
}

// --- App state / last_seen_at tests ---

#[test]
fn migration_seeds_last_seen_at_on_fresh_db() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let repo = AppStateRepository::new(conn);

    let last_seen = repo.get_last_seen().expect("should read seeded last_seen_at");
    assert!(!last_seen.is_empty(), "last_seen_at should be non-empty after migration");
}

#[test]
fn update_last_seen_persists_timestamp() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let repo = AppStateRepository::new(conn);

    let ts = "2026-09-03T18:30:00";
    repo.update_last_seen(ts).expect("should update last_seen_at");

    let stored = repo.get_last_seen().expect("should read back last_seen_at");
    assert_eq!(stored, ts);
}

#[test]
fn update_last_seen_overwrites_previous_value() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let repo = AppStateRepository::new(conn);

    repo.update_last_seen("2026-09-01T10:00:00").unwrap();
    repo.update_last_seen("2026-09-03T18:00:00").unwrap();

    let stored = repo.get_last_seen().unwrap();
    assert_eq!(stored, "2026-09-03T18:00:00");
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

// --- Stale pending trigger tests ---

#[test]
fn list_stale_returns_triggers_before_today() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo
        .create(&sample_habit_input())
        .expect("should create habit");

    let trigger_repo = PendingTriggerRepository::new(conn);

    // Stale trigger from 3 days ago
    trigger_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:00:00")
        .unwrap();
    // Today's trigger — not stale
    trigger_repo
        .upsert(&habit.id, "2026-09-04", "10:00", "2026-09-04T10:00:00")
        .unwrap();

    let stale = trigger_repo
        .list_stale("2026-09-04")
        .expect("should list stale triggers");

    assert_eq!(stale.len(), 1);
    assert_eq!(stale[0].trigger_date, "2026-09-01");
}

#[test]
fn list_stale_returns_empty_when_no_stale_triggers() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo
        .create(&sample_habit_input())
        .expect("should create habit");

    let trigger_repo = PendingTriggerRepository::new(conn);

    // Only today's trigger
    trigger_repo
        .upsert(&habit.id, "2026-09-04", "15:00", "2026-09-04T15:00:00")
        .unwrap();

    let stale = trigger_repo.list_stale("2026-09-04").unwrap();
    assert!(stale.is_empty());
}

// --- Stale trigger cleanup tests ---

#[test]
fn cleanup_stale_triggers_inserts_failed_completions_and_deletes_triggers() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    let trigger_repo = PendingTriggerRepository::new(conn);
    // Two stale triggers from different days
    trigger_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:00:00")
        .unwrap();
    trigger_repo
        .upsert(&habit.id, "2026-09-02", "15:00", "2026-09-02T15:00:00")
        .unwrap();

    let cleaned = cleanup_stale_triggers(conn, "2026-09-04").unwrap();
    assert_eq!(cleaned, 2);

    // Triggers should be gone
    let remaining = trigger_repo.list_stale("2026-09-04").unwrap();
    assert!(remaining.is_empty());

    // Failed completions should exist
    let comp_repo = CompletionRepository::new(conn);
    let comps1 = comp_repo.get_by_habit_and_date(&habit.id, "2026-09-01").unwrap();
    assert_eq!(comps1.len(), 1);
    assert_eq!(comps1[0].status, CompletionStatus::Failed);
    assert_eq!(comps1[0].scheduled_time, "10:00");

    let comps2 = comp_repo.get_by_habit_and_date(&habit.id, "2026-09-02").unwrap();
    assert_eq!(comps2.len(), 1);
    assert_eq!(comps2[0].status, CompletionStatus::Failed);
}

#[test]
fn cleanup_stale_triggers_skips_slots_with_existing_completion() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    let comp_repo = CompletionRepository::new(conn);
    // Pre-existing done completion for this slot
    comp_repo
        .insert(&habit.id, "2026-09-01", "10:00", &CompletionStatus::Done)
        .unwrap();

    let trigger_repo = PendingTriggerRepository::new(conn);
    trigger_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:00:00")
        .unwrap();

    let cleaned = cleanup_stale_triggers(conn, "2026-09-04").unwrap();
    assert_eq!(cleaned, 1); // trigger still deleted

    // Original done completion preserved — no duplicate inserted
    let comps = comp_repo.get_by_habit_and_date(&habit.id, "2026-09-01").unwrap();
    assert_eq!(comps.len(), 1);
    assert_eq!(comps[0].status, CompletionStatus::Done);
}
