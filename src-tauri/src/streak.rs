use chrono::{Datelike, NaiveDate};

use crate::models::{Completion, CompletionStatus};

/// Calculate current streak for a habit.
///
/// Counts consecutive completed days backwards from today.
/// A day is "completed" when ALL scheduled slots for that day have a
/// completion with status='done'. Days with any 'failed' slot (or missing
/// completion for a scheduled slot) break the streak. Non-scheduled days
/// are skipped (don't break or extend streak).
pub fn calculate_streak(
    today: NaiveDate,
    schedule_days: &[u8],
    completions: &[Completion],
) -> u32 {
    if schedule_days.is_empty() {
        return 0;
    }

    let mut streak = 0u32;
    let mut check_date = today;

    // Look back up to 365 days
    for _ in 0..365 {
        let dow = check_date.weekday().num_days_from_sunday() as u8;

        if schedule_days.contains(&dow) {
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

            // All completions for this day are done
            let all_done = day_completions
                .iter()
                .all(|c| c.status == CompletionStatus::Done);

            if all_done {
                streak += 1;
            } else {
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
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], &[]);
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
        // Schedule: every day
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], &completions);
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
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], &completions);
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
        let result = calculate_streak(today, &[1, 3, 5], &completions);
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
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], &completions);
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
        let result = calculate_streak(today, &[0, 1, 2, 3, 4, 5, 6], &completions);
        assert_eq!(result, 2); // Yesterday and day before
    }

    #[test]
    fn empty_schedule_days_returns_zero() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let result = calculate_streak(today, &[], &[]);
        assert_eq!(result, 0);
    }
}
