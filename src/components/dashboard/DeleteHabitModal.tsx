import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useCallback, useState } from "react";
import { deleteHabit } from "../../lib/invoke";
import type { Habit } from "../../types";

interface DeleteHabitModalProps {
	habit: Habit;
	opened: boolean;
	onClose: () => void;
	onDeleted: () => void;
}

export function DeleteHabitModal({
	habit,
	opened,
	onClose,
	onDeleted,
}: DeleteHabitModalProps) {
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDelete = useCallback(async () => {
		setDeleting(true);
		setError(null);
		try {
			await deleteHabit(habit.id);
			onDeleted();
			onClose();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("Failed to delete habit:", message);
			setError(message);
		} finally {
			setDeleting(false);
		}
	}, [habit.id, onDeleted, onClose]);

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title="Delete Habit 🗑️"
			centered
			radius="lg"
		>
			<Stack gap="md">
				<Text>
					Are you sure you want to delete{" "}
					<Text span fw={700}>
						{habit.name}
					</Text>
					? All your progress and history will be erased forever.
				</Text>
				{error ? (
					<Text c="red" size="sm">
						{error}
					</Text>
				) : null}
				<Group justify="flex-end" gap="sm">
					<Button variant="subtle" color="gray" onClick={onClose}>
						Keep it
					</Button>
					<Button color="red" loading={deleting} onClick={handleDelete}>
						Delete forever
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
