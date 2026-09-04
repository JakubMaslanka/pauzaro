import { Button, Group, Modal, Stack, Text, ThemeIcon } from "@mantine/core";
import { useCallback, useState } from "react";
import { recoverHabitDismiss, recoverHabitDone } from "../../lib/invoke";
import type { HabitRecoveryInfo } from "../../types";
import { DynamicIcon } from "../shared/DynamicIcon";

interface RecoveryModalProps {
	habitRecovery: HabitRecoveryInfo;
	opened: boolean;
	onResolved: () => void;
}

export function RecoveryModal({
	habitRecovery,
	opened,
	onResolved,
}: RecoveryModalProps) {
	const [loading, setLoading] = useState<"done" | "dismiss" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const slots = habitRecovery.missed_reps.map((rep) => ({
		trigger_date: rep.trigger_date,
		scheduled_time: rep.scheduled_time,
	}));

	const handleDoneAnyway = useCallback(async () => {
		setLoading("done");
		setError(null);
		try {
			await recoverHabitDone(habitRecovery.habit_id, slots);
			onResolved();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("Recovery (done) failed:", message);
			setError(message);
		} finally {
			setLoading(null);
		}
	}, [habitRecovery.habit_id, slots, onResolved]);

	const handleDismiss = useCallback(async () => {
		setLoading("dismiss");
		setError(null);
		try {
			await recoverHabitDismiss(habitRecovery.habit_id, slots);
			onResolved();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("Recovery (dismiss) failed:", message);
			setError(message);
		} finally {
			setLoading(null);
		}
	}, [habitRecovery.habit_id, slots, onResolved]);

	const count = habitRecovery.missed_reps.length;

	return (
		<Modal
			opened={opened}
			onClose={() => {}}
			closeOnClickOutside={false}
			closeOnEscape={false}
			withCloseButton={false}
			centered
			radius="lg"
			title="Missed Repetitions 📋"
		>
			<Stack gap="md">
				<Group gap="sm" align="center">
					<ThemeIcon
						size="lg"
						radius="xl"
						color={habitRecovery.habit_icon_color}
						variant="light"
					>
						<DynamicIcon
							name={habitRecovery.habit_icon}
							color={habitRecovery.habit_icon_color}
							size={20}
						/>
					</ThemeIcon>
					<Text fw={700} size="lg">
						{habitRecovery.habit_name}
					</Text>
				</Group>

				<Text>
					While you were away,{" "}
					<Text span fw={700} c="teal">
						{count} scheduled{" "}
						{count === 1 ? "repetition was" : "repetitions were"}
					</Text>{" "}
					missed. Did you do them offline, or should we skip them?
				</Text>

				{error ? (
					<Text c="red" size="sm">
						{error}
					</Text>
				) : null}

				<Group justify="flex-end" gap="sm">
					<Button
						variant="subtle"
						color="red"
						loading={loading === "dismiss"}
						disabled={loading === "done"}
						onClick={handleDismiss}
					>
						❌ Dismiss
					</Button>
					<Button
						color="teal"
						loading={loading === "done"}
						disabled={loading === "dismiss"}
						onClick={handleDoneAnyway}
					>
						✅ Done anyway
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
