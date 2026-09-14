export type MascotReaction =
	| "sad"
	| "promising"
	| "happy"
	| "successful"
	| "successful-glow"
	| "freeze"
	| "greeter"
	| "noteing"
	| "exercising";

export interface MascotState {
	streak: number;
	isFrozen: boolean;
}

/**
 * Maps current streak + freeze status to a mascot reaction identifier.
 *
 * Thresholds:
 *   frozen     → "freeze"
 *   streak 0   → "sad"
 *   streak 1-2 → "promising"
 *   streak 3-4 → "exercising"
 *   streak 5-8 → "happy"
 *   streak 9-13  → "successful"
 *   streak 14+ → "successful-glow"
 */
export function getMascotReaction(state: MascotState): MascotReaction {
	if (state.isFrozen) return "freeze";
	if (state.streak <= 0) return "sad";
	if (state.streak <= 2) return "promising";
	if (state.streak <= 4) return "exercising";
	if (state.streak <= 8) return "happy";
	if (state.streak <= 13) return "successful";
	return "successful-glow";
}
