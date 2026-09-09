export interface UserProfile {
	id: string;
	name: string;
	onboarding_completed: boolean;
	created_at: string;
}

export interface TimeSlot {
	start_time: string;
}

export interface Habit {
	id: string;
	name: string;
	description: string;
	icon: string;
	icon_color: string;
	icon_stroke_width: number;
	start_date: string;
	end_date: string | null;
	is_active: boolean;
	created_at: string;
	schedule_days: number[];
	schedule_times: TimeSlot[];
}

export interface CreateUserProfileInput {
	name: string;
}

export interface CreateHabitInput {
	name: string;
	description?: string;
	icon: string;
	icon_color?: string;
	icon_stroke_width?: number;
	schedule_days: number[];
	schedule_times: TimeSlot[];
	start_date: string;
	end_date?: string;
}

export type CompletionStatus = "done" | "failed";

export interface Completion {
	id: string;
	habit_id: string;
	trigger_date: string;
	scheduled_time: string;
	status: CompletionStatus;
	completed_at: string;
}

export interface SlotStatus {
	scheduled_time: string;
	status: "pending" | "done" | "failed";
}

export interface HabitStatus {
	habit_id: string;
	streak: number;
	today_slots: SlotStatus[];
	today_date: string;
}

export interface MissedRepetition {
	habit_id: string;
	habit_name: string;
	habit_icon: string;
	habit_icon_color: string;
	trigger_date: string;
	scheduled_time: string;
}

export interface HabitRecoveryInfo {
	habit_id: string;
	habit_name: string;
	habit_icon: string;
	habit_icon_color: string;
	missed_reps: MissedRepetition[];
	streak_reset: boolean;
}

export interface RecoveryResult {
	habits: HabitRecoveryInfo[];
}

export interface Settings {
	autostart_enabled: boolean;
}
