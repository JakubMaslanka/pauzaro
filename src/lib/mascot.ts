export type MascotReaction =
	| "sad"
	| "promising"
	| "happy"
	| "successful"
	| "successful-glow"
	| "freeze";

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
 *   streak 3-6 → "happy"
 *   streak 7-13  → "successful"
 *   streak 14+ → "successful-glow"
 */
export function getMascotReaction(state: MascotState): MascotReaction {
	if (state.isFrozen) return "freeze";
	if (state.streak <= 0) return "sad";
	if (state.streak <= 2) return "promising";
	if (state.streak <= 6) return "happy";
	if (state.streak <= 13) return "successful";
	return "successful-glow";
}
