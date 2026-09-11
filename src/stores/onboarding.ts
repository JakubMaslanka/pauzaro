import { create } from "zustand";

interface OnboardingState {
	step: number;
	name: string;
	visitedSteps: Set<number>;
	setName: (name: string) => void;
	nextStep: () => void;
	prevStep: () => void;
	markVisited: (step: number) => void;
	reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
	step: 0,
	name: "",
	visitedSteps: new Set<number>(),
	setName: (name) => set({ name }),
	nextStep: () =>
		set((state) => {
			const visited = new Set(state.visitedSteps);
			visited.add(state.step);
			return { step: state.step + 1, visitedSteps: visited };
		}),
	prevStep: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
	markVisited: (step) =>
		set((state) => {
			const visited = new Set(state.visitedSteps);
			visited.add(step);
			return { visitedSteps: visited };
		}),
	reset: () => set({ step: 0, name: "", visitedSteps: new Set<number>() }),
}));
