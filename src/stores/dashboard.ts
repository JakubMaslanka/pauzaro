import { create } from "zustand";
import type { Habit } from "../types";

interface DashboardStore {
	habits: Habit[];
	activeHabitId: string | null;
	mascotStreak: number;
	mascotFrozen: boolean;
	setHabits: (habits: Habit[]) => void;
	setActiveHabitId: (id: string | null) => void;
	setMascotState: (streak: number, isFrozen: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
	habits: [],
	activeHabitId: null,
	mascotStreak: 0,
	mascotFrozen: false,
	setHabits: (habits) =>
		set((state) => {
			const currentStillExists =
				state.activeHabitId && habits.some((h) => h.id === state.activeHabitId);
			return {
				habits,
				activeHabitId: currentStillExists
					? state.activeHabitId
					: habits.length > 0
						? habits[0].id
						: null,
			};
		}),
	setActiveHabitId: (id) => set({ activeHabitId: id }),
	setMascotState: (streak, isFrozen) =>
		set({ mascotStreak: streak, mascotFrozen: isFrozen }),
}));
