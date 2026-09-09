use chrono::{Datelike, NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

use crate::models::{Completion, Habit};

/// Maximum gap (in days) before streak auto-resets instead of showing recovery.
const MAX_RECOVERY_DAYS: i64 = 30;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MissedRepetition {
    pub habit_id: String,
    pub habit_name: String,
    pub habit_icon: String,
    pub habit_icon_color: String,
    pub trigger_date: String,
    pub scheduled_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitRecoveryInfo {
    pub habit_id: String,
    pub habit_name: String,
    pub habit_icon: String,
    pub habit_icon_color: String,
    pub missed_reps: Vec<MissedRepetition>,
    pub streak_reset: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecoveryResult {
    pub habits: Vec<HabitRecoveryInfo>,
}

/// Compute missed repetitions for each habit between `last_seen` and `now`.
///
/// Pure function — no DB access. Takes pre-fetched habits and completions.
/// Frozen dates (from streak freezes) are excluded — they don't count as missed.
///
/// For each active habit, iterates scheduled dates in the gap window
/// (day after last_seen through yesterday). Today is excluded — the normal
/// scheduler handles it. Dates outside habit's start/end range are skipped.
///
/// If gap > 30 days, sets `streak_reset = true` and returns no missed reps
/// for that habit (frontend shows toast instead of recovery modal).
pub fn compute_missed_repetitions(
    last_seen: NaiveDateTime,
    now: NaiveDateTime,
    habits: &[Habit],
    completions: &[Completion],
    frozen_dates: &[NaiveDate],
) -> RecoveryResult {
    let gap_start = last_seen.date();
    let gap_end = now.date(); // exclusive — today handled by scheduler
    let gap_days = (gap_end - gap_start).num_days();

    if gap_days <= 0 {
        return RecoveryResult { habits: vec![] };
    }

    let mut result_habits = Vec::new();

    for habit in habits {
        if !habit.is_active {
            continue;
        }

        let habit_start = NaiveDate::parse_from_str(&habit.start_date, "%Y-%m-%d")
            .unwrap_or(gap_start);
        let habit_end = habit
            .end_date
            .as_ref()
            .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

        let streak_reset = gap_days > MAX_RECOVERY_DAYS;

        let mut missed_reps = Vec::new();

        // Start from day after last_seen (last_seen day was covered while app ran)
        let scan_start = (gap_start + chrono::Duration::days(1)).max(habit_start);
        let scan_end = match habit_end {
            Some(end) => gap_end.min(end + chrono::Duration::days(1)),
            None => gap_end,
        };

        if !streak_reset {
            let mut date = scan_start;
            while date < scan_end {
                let dow = date.weekday().num_days_from_sunday() as u8;

                if habit.schedule_days.contains(&dow) {
                    // Skip frozen days — they're covered by streak freeze
                    if frozen_dates.contains(&date) {
                        date += chrono::Duration::days(1);
                        continue;
                    }

                    let date_str = date.format("%Y-%m-%d").to_string();

                    for slot in &habit.schedule_times {
                        let has_completion = completions.iter().any(|c| {
                            c.habit_id == habit.id
                                && c.trigger_date == date_str
                                && c.scheduled_time == slot.start_time
                        });

                        if !has_completion {
                            missed_reps.push(MissedRepetition {
                                habit_id: habit.id.clone(),
                                habit_name: habit.name.clone(),
                                habit_icon: habit.icon.clone(),
                                habit_icon_color: habit.icon_color.clone(),
                                trigger_date: date_str.clone(),
                                scheduled_time: slot.start_time.clone(),
                            });
                        }
                    }
                }

                date += chrono::Duration::days(1);
            }
        }

        // Only include habit if it has missed reps or needs streak reset
        if !missed_reps.is_empty() || streak_reset {
            result_habits.push(HabitRecoveryInfo {
                habit_id: habit.id.clone(),
                habit_name: habit.name.clone(),
                habit_icon: habit.icon.clone(),
                habit_icon_color: habit.icon_color.clone(),
                missed_reps,
                streak_reset,
            });
        }
    }

    RecoveryResult {
        habits: result_habits,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Completion, CompletionStatus, TimeSlot};

    fn make_habit(id: &str, days: Vec<u8>, times: Vec<&str>, start: &str) -> Habit {
        Habit {
            id: id.to_string(),
            name: format!("Habit {id}"),
            description: String::new(),
            icon: "Coffee".to_string(),
            icon_color: "#FF5733".to_string(),
            icon_stroke_width: 2.0,
            start_date: start.to_string(),
            end_date: None,
            is_active: true,
            created_at: "2026-08-01T00:00:00".to_string(),
            schedule_days: days,
            schedule_times: times
                .into_iter()
                .map(|t| TimeSlot {
                    start_time: t.to_string(),
                })
                .collect(),
        }
    }

    fn make_completion(habit_id: &str, date: &str, time: &str) -> Completion {
        Completion {
            id: format!("c-{date}-{time}"),
            habit_id: habit_id.to_string(),
            trigger_date: date.to_string(),
            scheduled_time: time.to_string(),
            status: CompletionStatus::Done,
            completed_at: format!("{date}T{time}:00"),
        }
    }

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").unwrap()
    }

    #[test]
    fn no_gap_returns_empty() {
        let now = dt("2026-09-04T10:00:00");
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");
        let result = compute_missed_repetitions(now, now, &[habit], &[], &[]);
        assert!(result.habits.is_empty());
    }

    #[test]
    fn one_day_gap_all_slots_missed() {
        // Last seen Sep 2, now Sep 4. Gap covers Sep 3 (Wednesday = DOW 3).
        let last = dt("2026-09-02T20:00:00");
        let now = dt("2026-09-04T10:00:00");
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00", "15:00"], "2026-08-01");

        let result = compute_missed_repetitions(last, now, &[habit], &[], &[]);

        assert_eq!(result.habits.len(), 1);
        assert_eq!(result.habits[0].missed_reps.len(), 2);
        assert_eq!(result.habits[0].missed_reps[0].trigger_date, "2026-09-03");
        assert_eq!(result.habits[0].missed_reps[0].scheduled_time, "10:00");
        assert_eq!(result.habits[0].missed_reps[1].scheduled_time, "15:00");
        assert!(!result.habits[0].streak_reset);
    }

    #[test]
    fn multi_day_gap_respects_schedule_days() {
        // MWF schedule (Mon=1, Wed=3, Fri=5). Last seen Sep 1 (Tue), now Sep 5 (Sat).
        // Scan: Sep 2 (Wed=3, scheduled), Sep 3 (Thu=4, skip), Sep 4 (Fri=5, scheduled).
        let last = dt("2026-09-01T20:00:00");
        let now = dt("2026-09-05T10:00:00");
        let habit = make_habit("h1", vec![1, 3, 5], vec!["10:00"], "2026-08-01");

        let result = compute_missed_repetitions(last, now, &[habit], &[], &[]);

        assert_eq!(result.habits.len(), 1);
        let missed: Vec<&str> = result.habits[0]
            .missed_reps
            .iter()
            .map(|m| m.trigger_date.as_str())
            .collect();
        assert_eq!(missed, vec!["2026-09-02", "2026-09-04"]);
    }

    #[test]
    fn partial_day_existing_completions_excluded() {
        let last = dt("2026-09-02T20:00:00");
        let now = dt("2026-09-04T10:00:00");
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00", "15:00"], "2026-08-01");

        // 10:00 slot already done on Sep 3
        let completions = vec![make_completion("h1", "2026-09-03", "10:00")];

        let result = compute_missed_repetitions(last, now, &[habit], &completions, &[]);

        assert_eq!(result.habits[0].missed_reps.len(), 1);
        assert_eq!(result.habits[0].missed_reps[0].scheduled_time, "15:00");
    }

    #[test]
    fn gap_exactly_30_days_shows_recovery() {
        let last = dt("2026-08-04T20:00:00");
        let now = dt("2026-09-04T10:00:00"); // 31 days later
        // But gap is 30 days (Aug 5 through Sep 3 = 30 dates, gap_days = 31)
        // Wait: gap_days = (Sep 4 - Aug 4).num_days() = 31
        // 31 > 30 means streak_reset = true

        // Let me use 30-day gap exactly:
        let last = dt("2026-08-05T20:00:00");
        let now = dt("2026-09-04T10:00:00"); // 30 days
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");

        let result = compute_missed_repetitions(last, now, &[habit], &[], &[]);

        assert_eq!(result.habits.len(), 1);
        assert!(!result.habits[0].streak_reset, "30-day gap should NOT reset");
        assert!(!result.habits[0].missed_reps.is_empty());
    }

    #[test]
    fn gap_31_days_resets_streak() {
        let last = dt("2026-08-04T20:00:00");
        let now = dt("2026-09-04T10:00:00"); // 31 days
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");

        let result = compute_missed_repetitions(last, now, &[habit], &[], &[]);

        assert_eq!(result.habits.len(), 1);
        assert!(result.habits[0].streak_reset);
        assert!(result.habits[0].missed_reps.is_empty(), "no missed reps when streak resets");
    }

    #[test]
    fn habit_start_date_after_gap_start() {
        // Gap starts Sep 1, habit starts Sep 3 — only Sep 3 checked
        let last = dt("2026-09-01T20:00:00");
        let now = dt("2026-09-05T10:00:00");
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-09-03");

        let result = compute_missed_repetitions(last, now, &[habit], &[], &[]);

        assert_eq!(result.habits[0].missed_reps.len(), 2); // Sep 3, Sep 4
        assert_eq!(result.habits[0].missed_reps[0].trigger_date, "2026-09-03");
        assert_eq!(result.habits[0].missed_reps[1].trigger_date, "2026-09-04");
    }

    #[test]
    fn habit_end_date_before_gap_end() {
        // Habit ends Sep 3, gap goes to Sep 5 — only Sep 2-3 checked
        let last = dt("2026-09-01T20:00:00");
        let now = dt("2026-09-05T10:00:00");
        let mut habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");
        habit.end_date = Some("2026-09-03".to_string());

        let result = compute_missed_repetitions(last, now, &[habit], &[], &[]);

        let dates: Vec<&str> = result.habits[0]
            .missed_reps
            .iter()
            .map(|m| m.trigger_date.as_str())
            .collect();
        assert_eq!(dates, vec!["2026-09-02", "2026-09-03"]);
    }

    #[test]
    fn multiple_habits_independent_recovery() {
        let last = dt("2026-09-02T20:00:00");
        let now = dt("2026-09-04T10:00:00");

        let h1 = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");
        let h2 = make_habit("h2", vec![0, 1, 2, 3, 4, 5, 6], vec!["09:00", "14:00"], "2026-08-01");

        let result = compute_missed_repetitions(last, now, &[h1, h2], &[], &[]);

        assert_eq!(result.habits.len(), 2);
        assert_eq!(result.habits[0].habit_id, "h1");
        assert_eq!(result.habits[0].missed_reps.len(), 1);
        assert_eq!(result.habits[1].habit_id, "h2");
        assert_eq!(result.habits[1].missed_reps.len(), 2);
    }

    #[test]
    fn inactive_habit_excluded() {
        let last = dt("2026-09-02T20:00:00");
        let now = dt("2026-09-04T10:00:00");

        let mut habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");
        habit.is_active = false;

        let result = compute_missed_repetitions(last, now, &[habit], &[], &[]);
        assert!(result.habits.is_empty());
    }

    // --- Freeze tests ---

    #[test]
    fn frozen_days_excluded_from_missed_reps() {
        // Gap covers Sep 3 (Wed). Frozen — should produce no missed reps.
        let last = dt("2026-09-02T20:00:00");
        let now = dt("2026-09-04T10:00:00");
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");
        let frozen = vec![NaiveDate::from_ymd_opt(2026, 9, 3).unwrap()];

        let result = compute_missed_repetitions(last, now, &[habit], &[], &frozen);
        assert!(result.habits.is_empty(), "frozen day should not produce missed reps");
    }

    #[test]
    fn mixed_frozen_and_missed_days() {
        // 3-day gap: Sep 2 (Wed=3), Sep 3 (Thu=4), Sep 4 (Fri=5).
        // Schedule: every day. Sep 2 and Sep 3 frozen. Sep 4 missed.
        // Wait — now = Sep 5, so gap is Sep 3-4. Let me set up properly.
        let last = dt("2026-09-01T20:00:00");
        let now = dt("2026-09-05T10:00:00");
        // Gap: Sep 2 (Tue), Sep 3 (Wed), Sep 4 (Thu). All scheduled.
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");
        let frozen = vec![
            NaiveDate::from_ymd_opt(2026, 9, 2).unwrap(),
            NaiveDate::from_ymd_opt(2026, 9, 3).unwrap(),
        ];

        let result = compute_missed_repetitions(last, now, &[habit], &[], &frozen);

        assert_eq!(result.habits.len(), 1);
        // Only Sep 4 should be missed (Sep 2 and Sep 3 frozen)
        assert_eq!(result.habits[0].missed_reps.len(), 1);
        assert_eq!(result.habits[0].missed_reps[0].trigger_date, "2026-09-04");
    }

    #[test]
    fn all_gap_days_frozen() {
        // 2-day gap, both frozen. No missed reps, no recovery.
        let last = dt("2026-09-01T20:00:00");
        let now = dt("2026-09-04T10:00:00");
        // Gap: Sep 2 (Tue), Sep 3 (Wed). Both frozen.
        let habit = make_habit("h1", vec![0, 1, 2, 3, 4, 5, 6], vec!["10:00"], "2026-08-01");
        let frozen = vec![
            NaiveDate::from_ymd_opt(2026, 9, 2).unwrap(),
            NaiveDate::from_ymd_opt(2026, 9, 3).unwrap(),
        ];

        let result = compute_missed_repetitions(last, now, &[habit], &[], &frozen);
        assert!(result.habits.is_empty(), "all gap days frozen = no recovery needed");
    }
}
