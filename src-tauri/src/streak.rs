use chrono::{Datelike, NaiveDate};

use crate::models::{Completion, CompletionStatus};

/// Maximum streak freezes allowed per streak. Replenished when streak resets.
pub const MAX_FREEZES_PER_STREAK: usize = 2;

/// Calculate current streak for a habit.
///
/// Counts consecutive completed days backwards from today.
/// A day is "completed" when ALL scheduled slots for that day have a
/// completion with status='done'. Days with any 'failed' slot or fewer
/// 'done' completions than `slots_per_day` break the streak.
/// Non-scheduled days are skipped (don't break or extend streak).
/// Frozen days are skipped like non-scheduled days — they neither break
/// nor extend the streak.
pub fn calculate_streak(
    today: NaiveDate,
    schedule_days: &[u8],
    slots_per_day: usize,
    completions: &[Completion],
    frozen_dates: &[NaiveDate],
) -> u32 {
    if schedule_days.is_empty() || slots_per_day == 0 {
        return 0;
    }

    let mut streak = 0u32;
    let mut check_date = today;

    // Look back up to 365 days
    for _ in 0..365 {
        let dow = check_date.weekday().num_days_from_sunday() as u8;

        if schedule_days.contains(&dow) {
            // Frozen days are skipped like non-scheduled days
            if frozen_dates.contains(&check_date) {
                check_date -= chrono::Duration::days(1);
                continue;
            }

            let date_str = check_date.format("%Y-%m-%d").to_string();

            // Get completions for this date
            let day_completions: Vec<&Completion> = completions
                .iter()
                .filter(|c| c.trigger_date == date_str)
                .collect();

            if day_completions.is_empty() {
                // No completions at all — if this is today, skip (not yet due).
                // Otherwise, streak is broken.
                if check_date == today {
                    check_date -= chrono::Duration::days(1);
                    continue;
                }
                break;
            }

            // Check if any completion is failed
            let has_failed = day_completions
                .iter()
                .any(|c| c.status == CompletionStatus::Failed);

            if has_failed {
                // If today has a failed slot, skip (might still be overridden)
                if check_date == today {
                    check_date -= chrono::Duration::days(1);
                    continue;
                }
                break;
            }

            // Verify ALL slots are done — count must match expected slots_per_day
            let done_count = day_completions
                .iter()
                .filter(|c| c.status == CompletionStatus::Done)
                .count();

            if done_count >= slots_per_day {
                streak += 1;
            } else {
                // Partial completion — if today, skip (slots still pending).
                // Otherwise, streak is broken.
                if check_date == today {
                    check_date -= chrono::Duration::days(1);
                    continue;
                }
                break;
            }
        }

        check_date -= chrono::Duration::days(1);
    }

    streak
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CompletionStatus;

    fn make_completion(date: &str, time: &str, status: CompletionStatus) -> Completion {
        Completion {
            id: format!("c-{date}-{time}"),
            habit_id: "h1".to_string(),
            trigger_date: date.to_string(),
            scheduled_time: time.to_string(),
            status,
            completed_at: format!("{date}T{time}:00"),
        }
    }

    #[test]
    fn zero_completions_returns_zero() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap(); // Sunday
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 1, &[], &[]);
        assert_eq!(result, 0);
    }

    #[test]
    fn consecutive_days_correct_count() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap(); // Sunday = 0
        let completions = vec![
            make_completion("2026-08-30", "10:00", CompletionStatus::Done),
            make_completion("2026-08-29", "10:00", CompletionStatus::Done),
            make_completion("2026-08-28", "10:00", CompletionStatus::Done),
        ];
        // Schedule: every day, 1 slot
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 1, &completions, &[]);
        assert_eq!(result, 3);
    }

    #[test]
    fn gap_breaks_streak() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let completions = vec![
            make_completion("2026-08-30", "10:00", CompletionStatus::Done),
            // 2026-08-29 missing
            make_completion("2026-08-28", "10:00", CompletionStatus::Done),
        ];
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 1, &completions, &[]);
        assert_eq!(result, 1); // Only today counts
    }

    #[test]
    fn non_scheduled_days_skipped() {
        // Schedule: Mon=1, Wed=3, Fri=5
        let today = NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(); // Friday = 5
        let completions = vec![
            make_completion("2026-08-28", "10:00", CompletionStatus::Done), // Fri
            make_completion("2026-08-26", "10:00", CompletionStatus::Done), // Wed
            make_completion("2026-08-24", "10:00", CompletionStatus::Done), // Mon
        ];
        // Tue/Thu/Sat/Sun not scheduled — should be skipped
        let result = calculate_streak(today, &[1, 3, 5], 1, &completions, &[]);
        assert_eq!(result, 3);
    }

    #[test]
    fn failed_day_breaks_streak() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let completions = vec![
            make_completion("2026-08-30", "10:00", CompletionStatus::Done),
            make_completion("2026-08-29", "10:00", CompletionStatus::Failed),
            make_completion("2026-08-28", "10:00", CompletionStatus::Done),
        ];
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 1, &completions, &[]);
        assert_eq!(result, 1); // Only today, yesterday failed
    }

    #[test]
    fn today_incomplete_does_not_count() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let completions = vec![
            // No completion for today
            make_completion("2026-08-29", "10:00", CompletionStatus::Done),
            make_completion("2026-08-28", "10:00", CompletionStatus::Done),
        ];
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 1, &completions, &[]);
        assert_eq!(result, 2); // Yesterday and day before
    }

    #[test]
    fn empty_schedule_days_returns_zero() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let result = calculate_streak(today, &[], 1, &[], &[]);
        assert_eq!(result, 0);
    }

    #[test]
    fn partial_day_breaks_streak_multi_slot() {
        // Habit has 2 slots per day (10:00, 14:00)
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let completions = vec![
            // Today: both slots done
            make_completion("2026-08-30", "10:00", CompletionStatus::Done),
            make_completion("2026-08-30", "14:00", CompletionStatus::Done),
            // Yesterday: only 1 of 2 slots done — partial
            make_completion("2026-08-29", "10:00", CompletionStatus::Done),
            // Day before: both done
            make_completion("2026-08-28", "10:00", CompletionStatus::Done),
            make_completion("2026-08-28", "14:00", CompletionStatus::Done),
        ];
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 2, &completions, &[]);
        assert_eq!(result, 1); // Only today — yesterday partial breaks streak
    }

    #[test]
    fn multi_slot_all_done_counts() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let completions = vec![
            make_completion("2026-08-30", "10:00", CompletionStatus::Done),
            make_completion("2026-08-30", "14:00", CompletionStatus::Done),
            make_completion("2026-08-29", "10:00", CompletionStatus::Done),
            make_completion("2026-08-29", "14:00", CompletionStatus::Done),
        ];
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 2, &completions, &[]);
        assert_eq!(result, 2);
    }

    #[test]
    fn mixed_done_and_failed_same_day_breaks_streak() {
        // 2 slots per day. Yesterday: slot 1 Done, slot 2 Failed.
        // Failed takes precedence — yesterday breaks the streak.
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let completions = vec![
            make_completion("2026-08-30", "10:00", CompletionStatus::Done),
            make_completion("2026-08-30", "14:00", CompletionStatus::Done),
            make_completion("2026-08-29", "10:00", CompletionStatus::Done),
            make_completion("2026-08-29", "14:00", CompletionStatus::Failed),
            make_completion("2026-08-28", "10:00", CompletionStatus::Done),
            make_completion("2026-08-28", "14:00", CompletionStatus::Done),
        ];
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 2, &completions, &[]);
        assert_eq!(result, 1); // Only today — yesterday has a Failed slot
    }

    #[test]
    fn year_boundary_streak() {
        // Streak spanning Dec 31 → Jan 1 across year boundary.
        let today = NaiveDate::from_ymd_opt(2027, 1, 2).unwrap(); // Friday = 5
        let completions = vec![
            make_completion("2027-01-02", "10:00", CompletionStatus::Done),
            make_completion("2027-01-01", "10:00", CompletionStatus::Done),
            make_completion("2026-12-31", "10:00", CompletionStatus::Done),
            make_completion("2026-12-30", "10:00", CompletionStatus::Done),
        ];
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 1, &completions, &[]);
        assert_eq!(result, 4);
    }

    #[test]
    fn completions_on_non_scheduled_days_ignored() {
        // Schedule: Mon=1, Wed=3, Fri=5. Noise completions on Tue/Thu.
        let today = NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(); // Friday = 5
        let completions = vec![
            make_completion("2026-08-28", "10:00", CompletionStatus::Done), // Fri (scheduled)
            make_completion("2026-08-27", "10:00", CompletionStatus::Done), // Thu (noise)
            make_completion("2026-08-26", "10:00", CompletionStatus::Done), // Wed (scheduled)
            make_completion("2026-08-25", "10:00", CompletionStatus::Failed), // Tue (noise)
            make_completion("2026-08-24", "10:00", CompletionStatus::Done), // Mon (scheduled)
        ];
        // Tue/Thu not in schedule — their completions (even Failed!) are invisible.
        let result = calculate_streak(today, &[1, 3, 5], 1, &completions, &[]);
        assert_eq!(result, 3); // Fri + Wed + Mon, noise days skipped
    }

    #[test]
    fn long_streak_thirty_days() {
        // 30 consecutive days, all done. Verifies lookback handles longer streaks.
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let completions: Vec<_> = (0..30)
            .map(|i| {
                let date = today - chrono::Duration::days(i);
                let date_str = date.format("%Y-%m-%d").to_string();
                make_completion(&date_str, "10:00", CompletionStatus::Done)
            })
            .collect();
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], 1, &completions, &[]);
        assert_eq!(result, 30);
    }
}
