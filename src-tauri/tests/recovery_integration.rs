mod common;

use common::{sample_habit_input, setup_db};
use pauzaro_lib::db::app_state::AppStateRepository;
use pauzaro_lib::db::completions::CompletionRepository;
use pauzaro_lib::db::habits::HabitRepository;
use pauzaro_lib::db::pending_triggers::PendingTriggerRepository;
use pauzaro_lib::models::CompletionStatus;
use pauzaro_lib::recovery::compute_missed_repetitions;

/// Parse a local datetime string into NaiveDateTime.
fn dt(s: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").unwrap()
}

// --- Recovery detection integration tests ---

#[test]
fn detects_missed_reps_after_3_day_gap() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    // Set last_seen to 3 days ago
    let app_state = AppStateRepository::new(conn);
    app_state
        .update_last_seen("2026-09-01T20:00:00")
        .unwrap();

    // Compute missed reps — habit is MWF (1,3,5) at 10:00 + 15:00
    // Gap: Sep 2 (Tue, not scheduled) through Sep 3 (Wed=3, scheduled)
    // Now = Sep 4 (Thu)
    let habits = habit_repo.list_active_with_schedules().unwrap();
    let completion_repo = CompletionRepository::new(conn);
    let completions = completion_repo
        .list_by_habit_in_range(&habit.id, "2026-09-01", "2026-09-04")
        .unwrap();

    let result = compute_missed_repetitions(
        dt("2026-09-01T20:00:00"),
        dt("2026-09-04T10:00:00"),
        &habits,
        &completions,
    );

    assert_eq!(result.habits.len(), 1);
    assert_eq!(result.habits[0].habit_id, habit.id);
    // Sep 3 (Wed=3) has 2 slots: 10:00 and 15:00
    assert_eq!(result.habits[0].missed_reps.len(), 2);
    assert!(!result.habits[0].streak_reset);
}

#[test]
fn recovery_done_inserts_completions_with_original_dates() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    let completion_repo = CompletionRepository::new(conn);

    // Simulate recover_habit_done: insert Done completions with historical dates
    let tx = conn.unchecked_transaction().unwrap();
    {
        let comp_in_tx = CompletionRepository::new(&tx);
        comp_in_tx
            .insert(&habit.id, "2026-09-03", "10:00", &CompletionStatus::Done)
            .unwrap();
        comp_in_tx
            .insert(&habit.id, "2026-09-03", "15:00", &CompletionStatus::Done)
            .unwrap();
    }
    tx.commit().unwrap();

    // Verify completions have correct dates
    let comps = completion_repo
        .get_by_habit_and_date(&habit.id, "2026-09-03")
        .unwrap();
    assert_eq!(comps.len(), 2);
    assert_eq!(comps[0].status, CompletionStatus::Done);
    assert_eq!(comps[0].trigger_date, "2026-09-03");
    assert_eq!(comps[1].status, CompletionStatus::Done);
}

#[test]
fn recovery_dismiss_inserts_failed_completions() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    let completion_repo = CompletionRepository::new(conn);

    // Simulate recover_habit_dismiss: insert Failed completions
    completion_repo
        .insert(&habit.id, "2026-09-03", "10:00", &CompletionStatus::Failed)
        .unwrap();

    let comps = completion_repo
        .get_by_habit_and_date(&habit.id, "2026-09-03")
        .unwrap();
    assert_eq!(comps.len(), 1);
    assert_eq!(comps[0].status, CompletionStatus::Failed);
}

#[test]
fn gap_over_30_days_sets_streak_reset() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    let habits = habit_repo.list_active_with_schedules().unwrap();

    let result = compute_missed_repetitions(
        dt("2026-08-01T20:00:00"),
        dt("2026-09-04T10:00:00"), // 34 days gap
        &habits,
        &[],
    );

    assert_eq!(result.habits.len(), 1);
    assert!(result.habits[0].streak_reset);
    assert!(
        result.habits[0].missed_reps.is_empty(),
        "streak reset should not list individual missed reps"
    );
}

#[test]
fn existing_completions_excluded_from_missed_list() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    // MWF schedule (1,3,5). Sep 2 2026 = Wed (DOW 3, scheduled).
    // Pre-existing done completion for 10:00 slot on Sep 2
    let completion_repo = CompletionRepository::new(conn);
    completion_repo
        .insert(&habit.id, "2026-09-02", "10:00", &CompletionStatus::Done)
        .unwrap();

    let habits = habit_repo.list_active_with_schedules().unwrap();
    let completions = completion_repo
        .list_by_habit_in_range(&habit.id, "2026-09-01", "2026-09-04")
        .unwrap();

    let result = compute_missed_repetitions(
        dt("2026-09-01T20:00:00"),
        dt("2026-09-04T10:00:00"),
        &habits,
        &completions,
    );

    // Only 15:00 slot on Sep 2 should be missed (10:00 already done)
    assert_eq!(result.habits[0].missed_reps.len(), 1);
    assert_eq!(result.habits[0].missed_reps[0].scheduled_time, "15:00");
    assert_eq!(result.habits[0].missed_reps[0].trigger_date, "2026-09-02");
}

#[test]
fn stale_triggers_cleaned_on_startup() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let habit = habit_repo.create(&sample_habit_input()).unwrap();

    let trigger_repo = PendingTriggerRepository::new(conn);
    trigger_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:00:00")
        .unwrap();

    let cleaned =
        pauzaro_lib::db::app_state::cleanup_stale_triggers(conn, "2026-09-04").unwrap();
    assert_eq!(cleaned, 1);

    // Trigger gone
    let remaining = trigger_repo.list_stale("2026-09-04").unwrap();
    assert!(remaining.is_empty());

    // Failed completion inserted
    let completion_repo = CompletionRepository::new(conn);
    let comps = completion_repo
        .get_by_habit_and_date(&habit.id, "2026-09-01")
        .unwrap();
    assert_eq!(comps.len(), 1);
    assert_eq!(comps[0].status, CompletionStatus::Failed);
}

#[test]
fn no_gap_returns_empty_recovery() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let _habit = habit_repo.create(&sample_habit_input()).unwrap();

    let habits = habit_repo.list_active_with_schedules().unwrap();

    // Same day — no gap
    let result = compute_missed_repetitions(
        dt("2026-09-04T08:00:00"),
        dt("2026-09-04T10:00:00"),
        &habits,
        &[],
    );

    assert!(result.habits.is_empty());
}
