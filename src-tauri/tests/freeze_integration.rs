mod common;

use chrono::NaiveDate;
use common::{sample_habit_input, setup_db};
use pauzaro_lib::db::completions::CompletionRepository;
use pauzaro_lib::db::freeze::FreezeRepository;
use pauzaro_lib::db::habits::HabitRepository;
use pauzaro_lib::models::CompletionStatus;
use pauzaro_lib::streak::{calculate_streak, MAX_FREEZES_PER_STREAK};

/// Insert completions for a range of dates (single slot at 10:00).
fn fill_completions(
    repo: &CompletionRepository,
    habit_id: &str,
    dates: &[&str],
) {
    for date in dates {
        repo.insert(habit_id, date, "10:00", &CompletionStatus::Done)
            .unwrap();
    }
}

#[test]
fn freeze_consumed_on_missed_day() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let mut input = sample_habit_input();
    // Daily schedule, 1 slot
    input.schedule_days = vec![0, 1, 2, 3, 4, 5, 6];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: "10:00".into(),
    }];
    input.start_date = "2026-09-01".into();
    let habit = habit_repo.create(&input).unwrap();

    let completion_repo = CompletionRepository::new(conn);
    let freeze_repo = FreezeRepository::new(conn);

    // Build 3-day streak: Sep 1, 2, 3 done
    fill_completions(&completion_repo, &habit.id, &["2026-09-01", "2026-09-02", "2026-09-03"]);

    // Sep 4 missed. Insert freeze for Sep 4.
    freeze_repo.insert(&habit.id, "2026-09-04").unwrap();

    // Verify freeze record exists
    let freezes = freeze_repo.list_by_habit(&habit.id).unwrap();
    assert_eq!(freezes.len(), 1);
    assert_eq!(freezes[0].frozen_date, "2026-09-04");

    // Calculate streak from Sep 5. Sep 4 frozen, Sep 3-1 done.
    let today = NaiveDate::from_ymd_opt(2026, 9, 5).unwrap();
    let comps = completion_repo.list_by_habit_since(&habit.id, "2026-08-01").unwrap();
    let frozen = vec![NaiveDate::from_ymd_opt(2026, 9, 4).unwrap()];
    let streak = calculate_streak(today, &input.schedule_days, 1, &comps, &frozen);
    assert_eq!(streak, 3, "streak preserved through frozen day");
}

#[test]
fn freeze_budget_exhausted_streak_breaks() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let mut input = sample_habit_input();
    input.schedule_days = vec![0, 1, 2, 3, 4, 5, 6];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: "10:00".into(),
    }];
    input.start_date = "2026-09-01".into();
    let habit = habit_repo.create(&input).unwrap();

    let completion_repo = CompletionRepository::new(conn);
    let freeze_repo = FreezeRepository::new(conn);

    // Build streak: Sep 1-3 done
    fill_completions(&completion_repo, &habit.id, &["2026-09-01", "2026-09-02", "2026-09-03"]);

    // Sep 4, 5 frozen; Sep 6 missed (no freeze left)
    freeze_repo.insert(&habit.id, "2026-09-04").unwrap();
    freeze_repo.insert(&habit.id, "2026-09-05").unwrap();

    assert_eq!(freeze_repo.list_by_habit(&habit.id).unwrap().len(), 2);

    // Calculate from Sep 7
    let today = NaiveDate::from_ymd_opt(2026, 9, 7).unwrap();
    let comps = completion_repo.list_by_habit_since(&habit.id, "2026-08-01").unwrap();
    let frozen = vec![
        NaiveDate::from_ymd_opt(2026, 9, 4).unwrap(),
        NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
    ];
    let streak = calculate_streak(today, &input.schedule_days, 1, &comps, &frozen);
    assert_eq!(streak, 0, "3rd missed day without freeze breaks streak");
}

#[test]
fn freezes_replenish_on_new_streak() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let mut input = sample_habit_input();
    input.schedule_days = vec![0, 1, 2, 3, 4, 5, 6];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: "10:00".into(),
    }];
    input.start_date = "2026-09-01".into();
    let habit = habit_repo.create(&input).unwrap();

    let freeze_repo = FreezeRepository::new(conn);

    // Simulate consumed freezes
    freeze_repo.insert(&habit.id, "2026-09-04").unwrap();
    freeze_repo.insert(&habit.id, "2026-09-05").unwrap();
    assert_eq!(freeze_repo.list_by_habit(&habit.id).unwrap().len(), 2);

    // Streak broke — replenish
    let deleted = freeze_repo.delete_all_by_habit(&habit.id).unwrap();
    assert_eq!(deleted, 2);

    // Verify fresh budget
    let count = freeze_repo.count_by_habit(&habit.id).unwrap();
    assert_eq!(count, 0);
    let remaining = MAX_FREEZES_PER_STREAK - count;
    assert_eq!(remaining, 2, "freezes replenished after streak reset");
}

#[test]
fn freeze_idempotent_on_repeated_calls() {
    let (_temp, db) = setup_db();
    let conn = db.connection();

    let habit_repo = HabitRepository::new(conn);
    let mut input = sample_habit_input();
    input.schedule_days = vec![0, 1, 2, 3, 4, 5, 6];
    input.schedule_times = vec![pauzaro_lib::models::habit::TimeSlot {
        start_time: "10:00".into(),
    }];
    input.start_date = "2026-09-01".into();
    let habit = habit_repo.create(&input).unwrap();

    let freeze_repo = FreezeRepository::new(conn);

    // Insert same freeze twice — should be idempotent
    let first = freeze_repo.insert(&habit.id, "2026-09-04").unwrap();
    let second = freeze_repo.insert(&habit.id, "2026-09-04").unwrap();

    assert!(first.is_some());
    assert!(second.is_some());

    // Only 1 record should exist
    let count = freeze_repo.count_by_habit(&habit.id).unwrap();
    assert_eq!(count, 1, "duplicate insert should not create second record");
}
