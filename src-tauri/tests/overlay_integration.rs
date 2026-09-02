use pauzaro_lib::db::completions::CompletionRepository;
use pauzaro_lib::db::habits::HabitRepository;
use pauzaro_lib::db::pending_triggers::PendingTriggerRepository;
use pauzaro_lib::db::Database;
use pauzaro_lib::models::habit::{CreateHabitInput, TimeSlot};
use pauzaro_lib::models::CompletionStatus;
use tempfile::NamedTempFile;

fn setup_db() -> (NamedTempFile, Database) {
    let temp = NamedTempFile::new().expect("failed to create temp file");
    let db = Database::open(temp.path()).expect("failed to open database");
    (temp, db)
}

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
            },
            TimeSlot {
                start_time: "15:00".into(),
            },
        ],
        start_date: "2026-08-27".into(),
        end_date: None,
    }
}

// --- PendingTriggerRepository tests ---

#[test]
fn pending_trigger_upsert_and_retrieve() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");

    let trigger = pending_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:00:00")
        .expect("should upsert pending trigger");

    assert_eq!(trigger.habit_id, habit.id);
    assert_eq!(trigger.trigger_date, "2026-09-01");
    assert_eq!(trigger.scheduled_time, "10:00");
    assert_eq!(trigger.snooze_count, 0);
    assert_eq!(trigger.next_fire_at, "2026-09-01T10:00:00");

    let retrieved = pending_repo
        .get_by_slot(&habit.id, "2026-09-01", "10:00")
        .expect("should query")
        .expect("should find trigger");

    assert_eq!(retrieved.id, trigger.id);
    assert_eq!(retrieved.snooze_count, 0);
}

#[test]
fn pending_trigger_upsert_is_idempotent() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");

    let first = pending_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:00:00")
        .expect("first upsert");

    let second = pending_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:09:00")
        .expect("second upsert");

    // Same slot — should update next_fire_at, not duplicate
    assert_eq!(second.next_fire_at, "2026-09-01T10:09:00");
    assert_eq!(second.snooze_count, 0); // Count not affected by upsert

    // Verify only one trigger exists for this slot
    let retrieved = pending_repo
        .get_by_slot(&habit.id, "2026-09-01", "10:00")
        .expect("should query")
        .expect("should find trigger");
    assert_eq!(retrieved.next_fire_at, "2026-09-01T10:09:00");

    // list_active should return exactly one
    let active = pending_repo.list_active().expect("should list active");
    assert_eq!(active.len(), 1);
    assert_eq!(active[0].habit_id, first.habit_id);
}

#[test]
fn pending_trigger_increment_snooze_bumps_count() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");

    let trigger = pending_repo
        .upsert(&habit.id, "2026-09-01", "10:00", "2026-09-01T10:00:00")
        .expect("should upsert");

    let updated = pending_repo
        .increment_snooze(&trigger.id, "2026-09-01T10:09:00")
        .expect("should increment snooze");

    assert_eq!(updated.snooze_count, 1);
    assert_eq!(updated.next_fire_at, "2026-09-01T10:09:00");

    // Increment again
    let updated2 = pending_repo
        .increment_snooze(&trigger.id, "2026-09-01T10:18:00")
        .expect("should increment snooze again");

    assert_eq!(updated2.snooze_count, 2);
    assert_eq!(updated2.next_fire_at, "2026-09-01T10:18:00");
}

// --- Snooze auto-fail flow tests ---
// Replicates the DB operation sequence from commands/overlay.rs:88-123

#[test]
fn snooze_three_times_triggers_auto_fail() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");
    let trigger_date = "2026-09-01";
    let scheduled_time = "10:00";

    // Simulate snooze_habit flow from overlay.rs:
    // 1. First call: no pending trigger exists, so upsert creates one (overlay.rs:88-97)
    let pt = pending_repo
        .upsert(&habit.id, trigger_date, scheduled_time, "2026-09-01T10:00:00")
        .expect("upsert for first snooze");

    // Snooze 1: new_count = 0 + 1 = 1 < 3 → increment (overlay.rs:112-119)
    pending_repo
        .increment_snooze(&pt.id, "2026-09-01T10:09:00")
        .expect("first increment");

    // Snooze 2: new_count = 1 + 1 = 2 < 3 → increment
    pending_repo
        .increment_snooze(&pt.id, "2026-09-01T10:18:00")
        .expect("second increment");

    // Verify state before auto-fail: count should be 2
    let before_fail = pending_repo
        .get_by_slot(&habit.id, trigger_date, scheduled_time)
        .expect("should query")
        .expect("should still exist");
    assert_eq!(before_fail.snooze_count, 2);

    // Snooze 3: new_count = 2 + 1 = 3 >= MAX_SNOOZE_COUNT (3)
    // → delete pending trigger, insert Failed completion (overlay.rs:101-108)
    pending_repo.delete(&pt.id).expect("should delete pending trigger");
    completion_repo
        .insert(&habit.id, trigger_date, scheduled_time, &CompletionStatus::Failed)
        .expect("should insert Failed completion");

    // Verify: pending trigger is gone
    let after = pending_repo
        .get_by_slot(&habit.id, trigger_date, scheduled_time)
        .expect("should query");
    assert!(after.is_none(), "pending trigger should be deleted after auto-fail");

    // Verify: Failed completion exists
    let completions = completion_repo
        .get_by_habit_and_date(&habit.id, trigger_date)
        .expect("should query completions");
    assert_eq!(completions.len(), 1);
    assert_eq!(completions[0].status, CompletionStatus::Failed);
    assert_eq!(completions[0].scheduled_time, scheduled_time);
}

#[test]
fn snooze_twice_does_not_auto_fail() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");
    let trigger_date = "2026-09-01";
    let scheduled_time = "10:00";

    let pt = pending_repo
        .upsert(&habit.id, trigger_date, scheduled_time, "2026-09-01T10:00:00")
        .expect("upsert");

    // Snooze 1 and 2
    pending_repo.increment_snooze(&pt.id, "2026-09-01T10:09:00").expect("snooze 1");
    pending_repo.increment_snooze(&pt.id, "2026-09-01T10:18:00").expect("snooze 2");

    // After 2 snoozes: pending trigger still exists, count = 2, no completion
    let trigger = pending_repo
        .get_by_slot(&habit.id, trigger_date, scheduled_time)
        .expect("should query")
        .expect("trigger should still exist");
    assert_eq!(trigger.snooze_count, 2);

    let completions = completion_repo
        .get_by_habit_and_date(&habit.id, trigger_date)
        .expect("should query completions");
    assert!(completions.is_empty(), "no completion should exist after only 2 snoozes");
}

// --- Mark done flow tests ---
// Replicates the DB operation sequence from commands/overlay.rs:33-55

#[test]
fn mark_done_deletes_pending_and_inserts_completion() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");
    let trigger_date = "2026-09-01";
    let scheduled_time = "10:00";

    // Pending trigger exists (created by scheduler when overlay fires)
    let pt = pending_repo
        .upsert(&habit.id, trigger_date, scheduled_time, "2026-09-01T10:00:00")
        .expect("upsert");

    // mark_done flow (overlay.rs:46-55): delete pending, insert Done
    pending_repo.delete(&pt.id).expect("should delete pending");
    completion_repo
        .insert(&habit.id, trigger_date, scheduled_time, &CompletionStatus::Done)
        .expect("should insert Done completion");

    // Verify: pending gone
    let after = pending_repo
        .get_by_slot(&habit.id, trigger_date, scheduled_time)
        .expect("should query");
    assert!(after.is_none(), "pending trigger should be deleted after mark_done");

    // Verify: Done completion exists
    let completions = completion_repo
        .get_by_habit_and_date(&habit.id, trigger_date)
        .expect("should query completions");
    assert_eq!(completions.len(), 1);
    assert_eq!(completions[0].status, CompletionStatus::Done);
}

#[test]
fn mark_done_override_failed_replaces_completion() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");
    let trigger_date = "2026-09-01";
    let scheduled_time = "10:00";

    // Simulate: habit was auto-failed (3x snooze), then user uses lifebuoy
    completion_repo
        .insert(&habit.id, trigger_date, scheduled_time, &CompletionStatus::Failed)
        .expect("insert Failed completion");

    // mark_done with override_failed=true (overlay.rs:42-44): delete existing, then insert Done
    completion_repo
        .delete_by_slot(&habit.id, trigger_date, scheduled_time)
        .expect("should delete Failed completion");

    // Also clean up any pending trigger if present (overlay.rs:46-48)
    let pt = pending_repo.get_by_slot(&habit.id, trigger_date, scheduled_time).expect("query");
    assert!(pt.is_none()); // No pending trigger in this case

    completion_repo
        .insert(&habit.id, trigger_date, scheduled_time, &CompletionStatus::Done)
        .expect("should insert Done completion");

    // Verify: only Done completion exists for this slot
    let completions = completion_repo
        .get_by_habit_and_date(&habit.id, trigger_date)
        .expect("should query completions");
    assert_eq!(completions.len(), 1);
    assert_eq!(completions[0].status, CompletionStatus::Done);
}

#[test]
fn mark_done_without_pending_trigger_still_works() {
    let (_temp, db) = setup_db();
    let conn = db.connection();
    let habit_repo = HabitRepository::new(conn);
    let pending_repo = PendingTriggerRepository::new(conn);
    let completion_repo = CompletionRepository::new(conn);

    let habit = habit_repo.create(&sample_habit_input()).expect("should create habit");
    let trigger_date = "2026-09-01";
    let scheduled_time = "10:00";

    // No pending trigger — user marks done from dashboard, not overlay
    let pt = pending_repo
        .get_by_slot(&habit.id, trigger_date, scheduled_time)
        .expect("should query");
    assert!(pt.is_none(), "no pending trigger should exist");

    // mark_done flow still works: just insert completion
    completion_repo
        .insert(&habit.id, trigger_date, scheduled_time, &CompletionStatus::Done)
        .expect("should insert Done completion");

    let completions = completion_repo
        .get_by_habit_and_date(&habit.id, trigger_date)
        .expect("should query completions");
    assert_eq!(completions.len(), 1);
    assert_eq!(completions[0].status, CompletionStatus::Done);
}
