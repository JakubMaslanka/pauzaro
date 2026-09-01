import { create } from "zustand";
import type { Habit } from "../types";

interface DashboardStore {
	habits: Habit[];
	activeHabitId: string | null;
	setHabits: (habits: Habit[]) => void;
	setActiveHabitId: (id: string | null) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
	habits: [],
	activeHabitId: null,
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
}));
