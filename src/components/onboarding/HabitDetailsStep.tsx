import {
	Button,
	Group,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { motion } from "framer-motion";
import { useState } from "react";
import { IconPicker } from "../shared/IconPicker";

interface HabitDetails {
	name: string;
	description: string;
	icon: { name: string; color: string; strokeWidth: number };
}

interface HabitDetailsStepProps {
	value: HabitDetails;
	onChange: (details: HabitDetails) => void;
	onNext: () => void;
	onBack: () => void;
}

export function HabitDetailsStep({
	value,
	onChange,
	onNext,
	onBack,
}: HabitDetailsStepProps) {
	const [error, setError] = useState("");

	const handleNext = () => {
		if (!value.name.trim()) {
			setError("Every habit needs a name! 🏷️");
			return;
		}
		setError("");
		onNext();
	};

	return (
		<motion.div
			initial={{ opacity: 0, x: 50 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -50 }}
			transition={{ duration: 0.3 }}
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100%",
				padding: 32,
			}}
		>
			<Stack align="center" gap="lg" maw={420} w="100%">
				<Stack gap={4} align="center">
					<Text size="xl">✨🦕</Text>
					<Title order={2} fw={800} ta="center">
						Design your first habit!
					</Title>
					<Text size="sm" c="dimmed" ta="center">
						Pick a name, icon, and give it some personality.
					</Text>
				</Stack>

				<Stack gap="md" w="100%">
					<TextInput
						label="Habit name"
						placeholder="e.g. Stretch break, Walk time, Eye rest"
						value={value.name}
						onChange={(e) =>
							onChange({
								...value,
								name: e.currentTarget.value,
							})
						}
						error={error}
						size="md"
						radius="lg"
						styles={{
							label: { fontWeight: 700, marginBottom: 4 },
						}}
					/>

					<Textarea
						label="Description (optional)"
						placeholder="What will you do? 🤸"
						value={value.description}
						onChange={(e) =>
							onChange({
								...value,
								description: e.currentTarget.value,
							})
						}
						size="md"
						radius="lg"
						rows={2}
						styles={{
							label: { fontWeight: 700, marginBottom: 4 },
						}}
					/>

					<div>
						<Text size="sm" fw={700} mb={4}>
							Pick an icon
						</Text>
						<IconPicker
							value={value.icon}
							onChange={(icon) => onChange({ ...value, icon })}
						/>
					</div>
				</Stack>

				<Group mt="sm">
					<Button variant="subtle" color="gray" radius="xl" onClick={onBack}>
						← Back
					</Button>
					<Button color="teal" radius="xl" onClick={handleNext}>
						Next step 📅
					</Button>
				</Group>
			</Stack>
		</motion.div>
	);
}
