import { create } from "zustand";

interface OnboardingState {
	step: number;
	name: string;
	setName: (name: string) => void;
	nextStep: () => void;
	prevStep: () => void;
	reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
	step: 0,
	name: "",
	setName: (name) => set({ name }),
	nextStep: () => set((state) => ({ step: state.step + 1 })),
	prevStep: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
	reset: () => set({ step: 0, name: "" }),
}));
