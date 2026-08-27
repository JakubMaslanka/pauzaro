import { create } from "zustand";
import { listHabits } from "../lib/invoke";
import type { Habit } from "../types";

interface HabitState {
	habits: Habit[];
	loading: boolean;
	error: string | null;
	fetchHabits: () => Promise<void>;
	addHabit: (habit: Habit) => void;
}

export const useHabitStore = create<HabitState>((set) => ({
	habits: [],
	loading: false,
	error: null,
	fetchHabits: async () => {
		set({ loading: true, error: null });
		try {
			const habits = await listHabits();
			set({ habits, loading: false });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("Failed to fetch habits:", message);
			set({ error: message, loading: false });
		}
	},
	addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
}));
