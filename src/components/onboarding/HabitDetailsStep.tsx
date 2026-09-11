import {
	Button,
	Group,
	Stack,
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
	animate: boolean;
}

function stagger(index: number, animate: boolean) {
	if (!animate) return { initial: false, animate: { opacity: 1, y: 0 } };
	return {
		initial: { opacity: 0, y: 15 },
		animate: { opacity: 1, y: 0 },
		transition: { delay: index * 0.2, duration: 0.3 },
	};
}

export function HabitDetailsStep({
	value,
	onChange,
	onNext,
	onBack,
	animate,
}: HabitDetailsStepProps) {
	const [error, setError] = useState("");
	const [bubbleVisible, setBubbleVisible] = useState(!animate);

	useEffect(() => {
		if (!animate) return;
		const timer = setTimeout(() => setBubbleVisible(true), 350);
		return () => clearTimeout(timer);
	}, [animate]);

	const handleNext = () => {
		if (!value.name.trim()) {
			setError("Every habit needs a name!");
			return;
		}
		setError("");
		onNext();
	};

	return (
		<motion.div
			initial={animate ? { opacity: 0, x: 50 } : false}
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
			<Stack align="center" gap="md" maw={420} w="100%">
				{/* Mascot + bubble */}
				<motion.div {...stagger(0, animate)}>
					<div
						style={{
							position: "relative",
							display: "inline-block",
							marginTop: 48,
							paddingBottom: -12,
						}}
					>
						<SpeechBubble
							message={`Let's create your first habit!\nPick something fun, I'll make sure you stick with it!`}
							visible={bubbleVisible}
							offsetY={-10}
							offsetX={-140}
							width={340}
						/>
						<MascotImage reaction="promising" size={140} />
					</div>
				</motion.div>

				{/* Title */}
				<motion.div {...stagger(2, animate)}>
					<Title order={2} fw={800} ta="center">
						Design your first habit!
					</Title>
				</motion.div>

				{/* Form */}
				<motion.div {...stagger(3, animate)} style={{ width: "100%" }}>
					<Stack gap="md" w="100%">
						<Group gap="sm" align="flex-end" wrap="nowrap">
							<TextInput
								label="Habit name"
								placeholder="e.g. Stretch break, Walk time, Eye rest"
								value={value.name}
								onChange={(e) =>
									onChange({
										...value,
										name: e.currentTarget.value.slice(0, 45),
									})
								}
								error={error}
								maxLength={45}
								size="md"
								radius="lg"
								style={{ flex: 1 }}
								styles={{
									label: { fontWeight: 700, marginBottom: 4 },
								}}
							/>
							<IconPicker
								value={value.icon}
								onChange={(icon) => onChange({ ...value, icon })}
							/>
						</Group>

						<Textarea
							label="Description (optional)"
							placeholder="What will you do?"
							value={value.description}
							onChange={(e) =>
								onChange({
									...value,
									description: e.currentTarget.value.slice(0, 255),
								})
							}
							maxLength={255}
							size="md"
							radius="lg"
							rows={2}
							styles={{
								label: { fontWeight: 700, marginBottom: 4 },
							}}
						/>
					</Stack>
				</motion.div>

				{/* Buttons */}
				<motion.div {...stagger(4, animate)}>
					<Group mt="sm">
						<Button variant="subtle" color="gray" radius="xl" onClick={onBack}>
							← Back
						</Button>
						<Button color="teal" radius="xl" onClick={handleNext}>
							Next step 📅
						</Button>
					</Group>
				</motion.div>
			</Stack>
		</motion.div>
	);
}
