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
