import { Notification } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import type { RecoveryResult } from "../../types";
import { RecoveryModal } from "./RecoveryModal";

interface RecoveryFlowProps {
	recoveryResult: RecoveryResult;
	onComplete: () => void;
}

export function RecoveryFlow({
	recoveryResult,
	onComplete,
}: RecoveryFlowProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [showToast, setShowToast] = useState(false);

	const habitsWithMissedReps = recoveryResult.habits.filter(
		(h) => h.missed_reps.length > 0,
	);
	const hasStreakReset = recoveryResult.habits.some((h) => h.streak_reset);

	const handleResolved = useCallback(() => {
		const nextIndex = currentIndex + 1;
		if (nextIndex >= habitsWithMissedReps.length) {
			if (hasStreakReset) {
				setShowToast(true);
			} else {
				onComplete();
			}
		} else {
			setCurrentIndex(nextIndex);
		}
	}, [currentIndex, habitsWithMissedReps.length, hasStreakReset, onComplete]);

	// Auto-complete if no habits have missed reps (only streak resets)
	useEffect(() => {
		if (habitsWithMissedReps.length === 0) {
			if (hasStreakReset) {
				setShowToast(true);
			} else {
				onComplete();
			}
		}
	}, [habitsWithMissedReps.length, hasStreakReset, onComplete]);

	// Auto-dismiss toast after 5 seconds
	useEffect(() => {
		if (!showToast) return;
		const timer = setTimeout(() => {
			setShowToast(false);
			onComplete();
		}, 5000);
		return () => clearTimeout(timer);
	}, [showToast, onComplete]);

	const currentHabit = habitsWithMissedReps[currentIndex];

	return (
		<>
			{currentHabit ? (
				<RecoveryModal
					habitRecovery={currentHabit}
					opened={true}
					onResolved={handleResolved}
				/>
			) : null}

			{showToast ? (
				<Notification
					title="Welcome back! 👋"
					color="teal"
					onClose={() => {
						setShowToast(false);
						onComplete();
					}}
					style={{
						position: "fixed",
						top: 20,
						right: 20,
						zIndex: 9999,
						maxWidth: 400,
					}}
				>
					Your streak was reset after 30 days of inactivity. Let's start fresh!
					💪
				</Notification>
			) : null}
		</>
	);
}
