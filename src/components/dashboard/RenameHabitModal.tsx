import {
	Button,
	Group,
	Modal,
	Stack,
	Textarea,
	TextInput,
} from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { updateHabit } from "../../lib/invoke";
import type { Habit } from "../../types";

interface RenameHabitModalProps {
	habit: Habit;
	opened: boolean;
	onClose: () => void;
	onRenamed: () => void;
}

export function RenameHabitModal({
	habit,
	opened,
	onClose,
	onRenamed,
}: RenameHabitModalProps) {
	const [name, setName] = useState(habit.name);
	const [description, setDescription] = useState(habit.description);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (opened) {
			setName(habit.name);
			setDescription(habit.description);
			setError(null);
			setSaving(false);
		}
	}, [opened, habit.name, habit.description]);

	const handleSubmit = useCallback(async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Name cannot be empty");
			return;
		}

		setSaving(true);
		setError(null);
		try {
			await updateHabit(habit.id, trimmed, description);
			onRenamed();
			onClose();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("Failed to rename habit:", message);
			setError(message);
		} finally {
			setSaving(false);
		}
	}, [habit.id, name, description, onRenamed, onClose]);

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title="Rename Habit ✏️"
			centered
			radius="lg"
		>
			<Stack gap="md">
				<TextInput
					label="Name"
					value={name}
					onChange={(e) => setName(e.currentTarget.value)}
					error={error}
					required
					data-autofocus
				/>
				<Textarea
					label="Description"
					value={description}
					onChange={(e) => setDescription(e.currentTarget.value)}
					autosize
					minRows={2}
					maxRows={4}
				/>
				<Group justify="flex-end" gap="sm">
					<Button variant="subtle" color="gray" onClick={onClose}>
						Cancel
					</Button>
					<Button color="teal" loading={saving} onClick={handleSubmit}>
						Save
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
