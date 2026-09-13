import { invoke } from "@tauri-apps/api/core";
import type {
	Completion,
	CreateHabitInput,
	CreateUserProfileInput,
	Habit,
	HabitStatus,
	RecoveryResult,
	Settings,
	UserProfile,
	WeekStartDay,
} from "../types";

export async function createUserProfile(
	input: CreateUserProfileInput,
): Promise<UserProfile> {
	return invoke<UserProfile>("create_user_profile", { input });
}

export async function getUserProfile(): Promise<UserProfile | null> {
	return invoke<UserProfile | null>("get_user_profile");
}

export async function completeOnboarding(): Promise<void> {
	return invoke<void>("complete_onboarding");
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
	return invoke<Habit>("create_habit", { input });
}

export async function getHabit(id: string): Promise<Habit> {
	return invoke<Habit>("get_habit", { id });
}

export async function listHabits(): Promise<Habit[]> {
	return invoke<Habit[]>("list_habits");
}

export interface MarkDoneInput {
	habit_id: string;
	trigger_date: string;
	scheduled_time: string;
	override_failed?: boolean;
}

export async function markDone(input: MarkDoneInput): Promise<void> {
	return invoke<void>("mark_done", { ...input });
}

export interface SnoozeInput {
	habit_id: string;
	trigger_date: string;
	scheduled_time: string;
}

export interface SnoozeResult {
	status: "snoozed" | "auto_failed";
}

export async function snoozeHabit(input: SnoozeInput): Promise<SnoozeResult> {
	return invoke<SnoozeResult>("snooze_habit", { ...input });
}

export async function getHabitStatus(habitId: string): Promise<HabitStatus> {
	return invoke<HabitStatus>("get_habit_status", { habit_id: habitId });
}

export async function getAllHabitStatuses(): Promise<HabitStatus[]> {
	return invoke<HabitStatus[]>("get_all_habit_statuses");
}

export async function getMonthCompletions(
	habitId: string,
	fromDate: string,
	toDate: string,
): Promise<Completion[]> {
	return invoke<Completion[]>("get_month_completions", {
		habit_id: habitId,
		from_date: fromDate,
		to_date: toDate,
	});
}

export async function updateHabit(
	id: string,
	name: string,
	description: string,
): Promise<Habit> {
	return invoke<Habit>("update_habit", { id, name, description });
}

export async function deleteHabit(id: string): Promise<boolean> {
	return invoke<boolean>("delete_habit", { id });
}

export async function getLatestCompletion(
	habitId: string,
): Promise<Completion | null> {
	return invoke<Completion | null>("get_latest_completion", {
		habit_id: habitId,
	});
}

export async function getMissedRepetitions(): Promise<RecoveryResult> {
	return invoke<RecoveryResult>("get_missed_repetitions");
}

export interface RecoverySlot {
	trigger_date: string;
	scheduled_time: string;
}

export async function recoverHabitDone(
	habitId: string,
	slots: RecoverySlot[],
): Promise<void> {
	return invoke<void>("recover_habit_done", {
		habit_id: habitId,
		slots,
	});
}

export async function recoverHabitDismiss(
	habitId: string,
	slots: RecoverySlot[],
): Promise<void> {
	return invoke<void>("recover_habit_dismiss", {
		habit_id: habitId,
		slots,
	});
}

export async function getSettings(): Promise<Settings> {
	return invoke<Settings>("get_settings");
}

export async function setAutostart(enabled: boolean): Promise<Settings> {
	return invoke<Settings>("set_autostart", { enabled });
}

export async function setWeekStart(day: WeekStartDay): Promise<Settings> {
	return invoke<Settings>("set_week_start", { day });
}

// --- Debug commands (dev-only) ---

export interface DebugDayState {
	habit_id: string;
	date: string;
	completions: { scheduled_time: string; status: string }[];
	is_frozen: boolean;
	freezes_total: number;
	last_seen_at: string;
}

export async function debugGetDayState(
	habitId: string,
	date: string,
): Promise<DebugDayState> {
	return invoke<DebugDayState>("debug_get_day_state", {
		habit_id: habitId,
		date,
	});
}

export async function debugInsertFreeze(
	habitId: string,
	date: string,
): Promise<string> {
	return invoke<string>("debug_insert_freeze", {
		input: { habit_id: habitId, date },
	});
}

export async function debugRemoveFreeze(
	habitId: string,
	date: string,
): Promise<number> {
	return invoke<number>("debug_remove_freeze", {
		habit_id: habitId,
		date,
	});
}

export async function debugClearAllFreezes(habitId: string): Promise<number> {
	return invoke<number>("debug_clear_all_freezes", {
		habit_id: habitId,
	});
}

export async function debugInsertCompletion(
	habitId: string,
	date: string,
	scheduledTime: string,
): Promise<string> {
	return invoke<string>("debug_insert_completion", {
		habit_id: habitId,
		date,
		scheduled_time: scheduledTime,
	});
}

export async function debugDeleteCompletionsForDate(
	habitId: string,
	date: string,
): Promise<number> {
	return invoke<number>("debug_delete_completions_for_date", {
		habit_id: habitId,
		date,
	});
}

export async function debugResetOnboarding(): Promise<void> {
	return invoke<void>("debug_reset_onboarding");
}

export async function debugBackdateLastSeen(daysAgo: number): Promise<string> {
	return invoke<string>("debug_backdate_last_seen", {
		days_ago: daysAgo,
	});
}
