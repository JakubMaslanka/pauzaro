import { invoke } from "@tauri-apps/api/core";
import type {
	Completion,
	CreateHabitInput,
	CreateUserProfileInput,
	Habit,
	HabitStatus,
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
