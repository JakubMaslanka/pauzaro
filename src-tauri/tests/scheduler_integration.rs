mod common;

use std::sync::{Arc, Mutex};

use chrono::Datelike;
use common::{sample_habit_input, setup_db};
use pauzaro_lib::db::completions::CompletionRepository;
use pauzaro_lib::db::habits::HabitRepository;
use pauzaro_lib::db::pending_triggers::PendingTriggerRepository;
use pauzaro_lib::models::CompletionStatus;
use pauzaro_lib::scheduler::{OverlaySpawner, Scheduler};

/// Mock overlay spawner that records calls instead of creating real windows.
struct MockOverlaySpawner {
    calls: Arc<Mutex<Vec<(String, String, String)>>>,
}

impl MockOverlaySpawner {
    fn new() -> Self {
        Self {
            calls: Arc::new(Mutex::new(Vec::new())),
        }
    }

    fn calls(&self) -> Vec<(String, String, String)> {
        self.calls.lock().unwrap().clone()
    }
}

impl OverlaySpawner for MockOverlaySpawner {
    fn spawn_overlay(
        &self,
        habit_id: &str,
        trigger_date: &str,
        scheduled_time: &str,
    ) -> Result<(), String> {
        self.calls.lock().unwrap().push((
            habit_id.to_string(),
            trigger_date.to_string(),
            scheduled_time.to_string(),
        ));
        Ok(())
    }

    fn is_overlay_open(&self, _habit_id: &str) -> bool {
        false
    }
}

#[tokio::test]
async fn scheduler_fires_overlay_at_scheduled_time() {
    tokio::time::pause();

    let (_temp, db) = setup_db();
    let db_arc = Arc::new(Mutex::new(db));

    // Insert habit scheduled for right now
    let now = chrono::Local::now();
    let current_dow = now.date_naive().weekday().num_days_from_sunday() as u8;
    let current_time = now.format("%H:%M").to_string();

    let mut input = sample_habit_input();
    input.schedule_days = vec![current_dow];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: current_time.clone(),
    }];

    {
        let db = db_arc.lock().unwrap();
        let repo = HabitRepository::new(db.connection());
        repo.create(&input).expect("should create habit");
    }

    let spawner = MockOverlaySpawner::new();
    let scheduler = Scheduler::new();

    scheduler
        .run_iteration(&db_arc, &spawner)
        .await
        .expect("run_iteration should succeed");

    let calls = spawner.calls();
    assert_eq!(calls.len(), 1, "spawner should have been called once");
    assert_eq!(calls[0].1, now.format("%Y-%m-%d").to_string());
    assert_eq!(calls[0].2, current_time);

    // Verify pending trigger was upserted in DB
    let db = db_arc.lock().unwrap();
    let pending_repo = PendingTriggerRepository::new(db.connection());
    let active = pending_repo.list_active().expect("should list active");
    assert_eq!(active.len(), 1, "pending trigger should have been upserted");
}

#[tokio::test]
async fn scheduler_re_evaluates_after_wake() {
    tokio::time::pause();

    let (_temp, db) = setup_db();
    let db_arc = Arc::new(Mutex::new(db));

    // Insert habit scheduled for far future (23:59, only on a day 2 days from now)
    let now = chrono::Local::now();
    let future_date = now.date_naive() + chrono::Duration::days(2);
    let future_dow = future_date.weekday().num_days_from_sunday() as u8;

    let mut input = sample_habit_input();
    input.schedule_days = vec![future_dow];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: "23:59".into(),
    }];

    {
        let db = db_arc.lock().unwrap();
        let repo = HabitRepository::new(db.connection());
        repo.create(&input).expect("should create habit");
    }

    let spawner = MockOverlaySpawner::new();
    let scheduler = Arc::new(Scheduler::new());

    // Spawn run_iteration in background — it will sleep until the far-future trigger
    let sched_clone = Arc::clone(&scheduler);
    let db_clone = Arc::clone(&db_arc);
    let spawner_arc = Arc::new(spawner);
    let spawner_for_task = Arc::clone(&spawner_arc);

    let handle = tokio::spawn(async move {
        sched_clone
            .run_iteration(&db_clone, &*spawner_for_task)
            .await
    });

    // Give the task a moment to start sleeping
    tokio::time::advance(std::time::Duration::from_millis(10)).await;
    tokio::task::yield_now().await;

    // Wake the scheduler — should cause re-evaluation and return
    scheduler.wake();

    let result = tokio::time::timeout(std::time::Duration::from_secs(5), handle)
        .await
        .expect("task should complete after wake")
        .expect("task should not panic");

    assert!(result.is_ok(), "run_iteration should succeed after wake");

    // Spawner should NOT have been called (trigger is in the future)
    assert!(
        spawner_arc.calls().is_empty(),
        "spawner should not be called — trigger is in the future"
    );
}

#[tokio::test]
async fn scheduler_re_fires_after_snooze_delay() {
    tokio::time::pause();

    let (_temp, db) = setup_db();
    let db_arc = Arc::new(Mutex::new(db));

    // Insert habit and a pending trigger with next_fire_at = now + 9 minutes
    let now = chrono::Local::now();
    let current_dow = now.date_naive().weekday().num_days_from_sunday() as u8;
    let today_str = now.format("%Y-%m-%d").to_string();
    let fire_at = (now + chrono::Duration::minutes(9))
        .naive_local()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    let mut input = sample_habit_input();
    input.schedule_days = vec![current_dow];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: "10:00".into(),
    }];

    {
        let db = db_arc.lock().unwrap();
        let habit_repo = HabitRepository::new(db.connection());
        let habit = habit_repo.create(&input).expect("should create habit");

        let pending_repo = PendingTriggerRepository::new(db.connection());
        pending_repo
            .upsert(&habit.id, &today_str, "10:00", &fire_at)
            .expect("should upsert pending trigger");
    }

    let spawner = MockOverlaySpawner::new();
    let scheduler = Scheduler::new();

    // Advance time by 9 minutes so the snooze delay expires
    tokio::time::advance(std::time::Duration::from_secs(9 * 60)).await;

    scheduler
        .run_iteration(&db_arc, &spawner)
        .await
        .expect("run_iteration should succeed");

    let calls = spawner.calls();
    assert_eq!(
        calls.len(),
        1,
        "spawner should fire after snooze delay expires"
    );
    assert_eq!(calls[0].2, "10:00");
}

#[tokio::test]
async fn scheduler_skips_completed_slot() {
    tokio::time::pause();

    let (_temp, db) = setup_db();
    let db_arc = Arc::new(Mutex::new(db));

    // Insert habit scheduled for right now, but also a "done" completion
    let now = chrono::Local::now();
    let current_dow = now.date_naive().weekday().num_days_from_sunday() as u8;
    let today_str = now.format("%Y-%m-%d").to_string();
    let current_time = now.format("%H:%M").to_string();

    let mut input = sample_habit_input();
    input.schedule_days = vec![current_dow];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: current_time.clone(),
    }];

    {
        let db = db_arc.lock().unwrap();
        let habit_repo = HabitRepository::new(db.connection());
        let habit = habit_repo.create(&input).expect("should create habit");

        let completion_repo = CompletionRepository::new(db.connection());
        completion_repo
            .insert(&habit.id, &today_str, &current_time, &CompletionStatus::Done)
            .expect("should insert completion");
    }

    let spawner = MockOverlaySpawner::new();
    let scheduler = Arc::new(Scheduler::new());

    // run_iteration will find the next-week occurrence (or none) — either way
    // it should NOT fire for the completed slot. We spawn it and wake to avoid
    // blocking on a future sleep.
    let sched_clone = Arc::clone(&scheduler);
    let db_clone = Arc::clone(&db_arc);
    let spawner_arc = Arc::new(spawner);
    let spawner_for_task = Arc::clone(&spawner_arc);

    let handle = tokio::spawn(async move {
        sched_clone
            .run_iteration(&db_clone, &*spawner_for_task)
            .await
    });

    // Give task time to start, then wake to break out of sleep
    tokio::time::advance(std::time::Duration::from_millis(10)).await;
    tokio::task::yield_now().await;
    scheduler.wake();

    let result = tokio::time::timeout(std::time::Duration::from_secs(5), handle)
        .await
        .expect("task should complete")
        .expect("task should not panic");

    assert!(result.is_ok());

    // Spawner should NOT have been called — slot was already completed
    assert!(
        spawner_arc.calls().is_empty(),
        "spawner should not fire for completed slot"
    );
}
