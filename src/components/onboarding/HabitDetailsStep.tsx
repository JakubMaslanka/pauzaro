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
import { useEffect, useState } from "react";
import { IconPicker } from "../shared/IconPicker";
import { MascotImage } from "../shared/MascotImage";
import { SpeechBubble } from "../shared/SpeechBubble";

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
	const [bubbleVisible, setBubbleVisible] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setBubbleVisible(true), 300);
		return () => clearTimeout(timer);
	}, []);

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
				<MascotImage reaction="promising" size={80} />
				<SpeechBubble
					message="Let's create your first habit! Pick something fun — I'll make sure you stick with it! ✨"
					visible={bubbleVisible}
					direction="top"
				/>
				<Title order={2} fw={800} ta="center">
					Design your first habit!
				</Title>

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
