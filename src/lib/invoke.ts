import { invoke } from "@tauri-apps/api/core";
import type {
	CreateHabitInput,
	CreateUserProfileInput,
	Habit,
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
