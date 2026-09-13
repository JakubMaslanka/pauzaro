import {
	Button,
	Collapse,
	Group,
	Stack,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { completeOnboarding, createHabit } from "../../lib/invoke";
import { useSettingsStore } from "../../stores/settings";
import type { TimeSlot } from "../../types";
import { MascotImage } from "../shared/MascotImage";
import { SchedulePicker } from "../shared/SchedulePicker";
import { SpeechBubble } from "../shared/SpeechBubble";

interface HabitDetails {
	name: string;
	description: string;
	icon: { name: string; color: string; strokeWidth: number };
}

interface ScheduleStepProps {
	habitDetails: HabitDetails;
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

export function ScheduleStep({
	habitDetails,
	onBack,
	animate,
}: ScheduleStepProps) {
	const navigate = useNavigate();
	const weekStartDay = useSettingsStore((s) => s.weekStartDay);
	const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
	const [scheduleTimes, setScheduleTimes] = useState<TimeSlot[]>([
		{ start_time: "10:00" },
	]);
	const [startDate] = useState(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	});
	const [endDate, setEndDate] = useState<string | null>(null);
	const [optionsOpen, setOptionsOpen] = useState(false);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [bubbleVisible, setBubbleVisible] = useState(!animate);

	useEffect(() => {
		if (!animate) return;
		const timer = setTimeout(() => setBubbleVisible(true), 350);
		return () => clearTimeout(timer);
	}, [animate]);

	const hasDuplicates = () => {
		const seen = new Set<string>();
		for (const slot of scheduleTimes) {
			if (seen.has(slot.start_time)) return true;
			seen.add(slot.start_time);
		}
		return false;
	};

	const handleSubmit = async () => {
		if (scheduleDays.length === 0) {
			setError("Pick at least one day!");
			return;
		}
		if (scheduleTimes.length === 0) {
			setError("Add at least one time slot!");
			return;
		}
		if (hasDuplicates()) {
			setError("Remove duplicate time slots first!");
			return;
		}

		setError("");
		setSubmitting(true);

		try {
			await createHabit({
				name: habitDetails.name.trim(),
				description: habitDetails.description.trim() || undefined,
				icon: habitDetails.icon.name,
				icon_color: habitDetails.icon.color,
				icon_stroke_width: habitDetails.icon.strokeWidth,
				schedule_days: scheduleDays,
				schedule_times: scheduleTimes,
				start_date: startDate,
				end_date: endDate || undefined,
			});

			await completeOnboarding();
			navigate({ to: "/dashboard" });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("Failed to create habit:", message);
			setError("Something went wrong. Try again?");
		} finally {
			setSubmitting(false);
		}
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
				height: "100%",
				padding: 32,
				overflowY: "auto",
			}}
		>
			<Stack align="center" gap="lg" maw={500} w="100%">
				{/* Mascot + bubble */}
				<motion.div {...stagger(0, animate)}>
					<div style={{ position: "relative", display: "inline-block" }}>
						<SpeechBubble
							message="Almost there! Tell me when to nudge you, I promise I'll be on time!"
							visible={bubbleVisible}
							offsetY={4}
						/>
						<MascotImage reaction="happy" size={100} />
					</div>
				</motion.div>

				{/* Title */}
				<motion.div {...stagger(2, animate)}>
					<Title order={2} fw={800} ta="center">
						When should we remind you?
					</Title>
				</motion.div>

				{/* Form */}
				<motion.div {...stagger(3, animate)} style={{ width: "100%" }}>
					<Stack gap="md" w="100%">
						<SchedulePicker
							days={scheduleDays}
							times={scheduleTimes}
							weekStartDay={weekStartDay}
							onDaysChange={setScheduleDays}
							onTimesChange={setScheduleTimes}
						/>

						<UnstyledButton
							onClick={() => setOptionsOpen((o) => !o)}
							style={{ alignSelf: "flex-start" }}
						>
							<Group gap={4}>
								<Text size="sm" fw={600} c="teal">
									Options
								</Text>
								<ChevronDown
									size={16}
									color="var(--mantine-color-teal-6)"
									style={{
										transform: optionsOpen ? "rotate(180deg)" : "rotate(0deg)",
										transition: "transform 200ms ease",
									}}
								/>
							</Group>
						</UnstyledButton>

						<Collapse expanded={optionsOpen}>
							<DateInput
								label="End date (optional)"
								placeholder="Pick an end date"
								clearable
								size="md"
								radius="lg"
								value={endDate}
								onChange={(value) => setEndDate(value)}
								styles={{
									label: {
										fontWeight: 700,
										marginBottom: 4,
									},
								}}
							/>
						</Collapse>
					</Stack>
				</motion.div>

				{error && (
					<Text size="sm" c="red" ta="center">
						{error}
					</Text>
				)}

				{/* Buttons */}
				<motion.div {...stagger(4, animate)}>
					<Group mt="sm">
						<Button variant="subtle" color="gray" radius="xl" onClick={onBack}>
							← Back
						</Button>
						<Button
							color="teal"
							radius="xl"
							size="md"
							onClick={handleSubmit}
							loading={submitting}
						>
							Create habit! 🎉
						</Button>
					</Group>
				</motion.div>
			</Stack>
		</motion.div>
	);
}
