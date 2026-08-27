import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { completeOnboarding, createHabit } from "../../lib/invoke";
import type { TimeSlot } from "../../types";
import { SchedulePicker } from "../shared/SchedulePicker";

interface HabitDetails {
	name: string;
	description: string;
	icon: { name: string; color: string; strokeWidth: number };
}

interface ScheduleStepProps {
	habitDetails: HabitDetails;
	onBack: () => void;
}

export function ScheduleStep({ habitDetails, onBack }: ScheduleStepProps) {
	const navigate = useNavigate();
	const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
	const [scheduleTimes, setScheduleTimes] = useState<TimeSlot[]>([
		{ start_time: "10:00", end_time: "10:15" },
	]);
	const [startDate, setStartDate] = useState(
		new Date().toISOString().split("T")[0],
	);
	const [endDate, setEndDate] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const hasDuplicates = () => {
		const seen = new Set<string>();
		for (const slot of scheduleTimes) {
			const key = `${slot.start_time}-${slot.end_time}`;
			if (seen.has(key)) return true;
			seen.add(key);
		}
		return false;
	};

	const handleSubmit = async () => {
		if (scheduleDays.length === 0) {
			setError("Pick at least one day! 📅");
			return;
		}
		if (scheduleTimes.length === 0) {
			setError("Add at least one time slot! ⏰");
			return;
		}
		if (hasDuplicates()) {
			setError("Remove duplicate time slots first! 🔁");
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
			setError("Oops! Something went wrong. Try again? 🙈");
		} finally {
			setSubmitting(false);
		}
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
				height: "100%",
				padding: 32,
				overflowY: "auto",
			}}
		>
			<Stack align="center" gap="lg" maw={460} w="100%">
				<Stack gap={4} align="center">
					<Text size="xl">📅🦕</Text>
					<Title order={2} fw={800} ta="center">
						When should we remind you?
					</Title>
					<Text size="sm" c="dimmed" ta="center">
						Set your schedule — our dino will nudge you on time!
					</Text>
				</Stack>

				<Stack gap="md" w="100%">
					<SchedulePicker
						days={scheduleDays}
						times={scheduleTimes}
						onDaysChange={setScheduleDays}
						onTimesChange={setScheduleTimes}
					/>

					<Group grow>
						<div>
							<Text size="sm" fw={700} mb={4}>
								Start date
							</Text>
							<input
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								style={{
									width: "100%",
									padding: "8px 12px",
									border: "2px solid var(--mantine-color-gray-3)",
									borderRadius: "var(--mantine-radius-md)",
									fontSize: 14,
									fontFamily: "inherit",
									background: "white",
								}}
							/>
						</div>
						<div>
							<Text size="sm" fw={700} mb={4}>
								End date{" "}
								<Text span size="xs" c="dimmed">
									(optional)
								</Text>
							</Text>
							<input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								style={{
									width: "100%",
									padding: "8px 12px",
									border: "2px solid var(--mantine-color-gray-3)",
									borderRadius: "var(--mantine-radius-md)",
									fontSize: 14,
									fontFamily: "inherit",
									background: "white",
								}}
							/>
						</div>
					</Group>
				</Stack>

				{error && (
					<Text size="sm" c="red" ta="center">
						{error}
					</Text>
				)}

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
			</Stack>
		</motion.div>
	);
}
