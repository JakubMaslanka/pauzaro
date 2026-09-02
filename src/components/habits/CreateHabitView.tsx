import {
	Button,
	Container,
	Group,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { emit } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { createHabit } from "../../lib/invoke";
import type { TimeSlot } from "../../types";
import { IconPicker } from "../shared/IconPicker";
import { SchedulePicker } from "../shared/SchedulePicker";

type Step = "details" | "schedule";

interface HabitDetails {
	name: string;
	description: string;
	icon: { name: string; color: string; strokeWidth: number };
}

const DEFAULT_DETAILS: HabitDetails = {
	name: "",
	description: "",
	icon: { name: "Dumbbell", color: "#0d9488", strokeWidth: 2 },
};

export function CreateHabitView() {
	const navigate = useNavigate();
	const [step, setStep] = useState<Step>("details");
	const [details, setDetails] = useState<HabitDetails>(DEFAULT_DETAILS);
	const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
	const [scheduleTimes, setScheduleTimes] = useState<TimeSlot[]>([
		{ start_time: "10:00" },
	]);
	const [startDate, setStartDate] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	});
	const [endDate, setEndDate] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleDetailsNext = () => {
		if (!details.name.trim()) {
			setError("Every habit needs a name! 🏷️");
			return;
		}
		setError("");
		setStep("schedule");
	};

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
				name: details.name.trim(),
				description: details.description.trim() || undefined,
				icon: details.icon.name,
				icon_color: details.icon.color,
				icon_stroke_width: details.icon.strokeWidth,
				schedule_days: scheduleDays,
				schedule_times: scheduleTimes,
				start_date: startDate,
				end_date: endDate || undefined,
			});

			emit("habit-updated");
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
		<Container size="sm" py="xl">
			<Button
				variant="subtle"
				color="gray"
				radius="xl"
				leftSection={<ArrowLeft size={16} />}
				onClick={() => navigate({ to: "/dashboard" })}
				mb="md"
			>
				Back to dashboard
			</Button>

			{step === "details" ? (
				<motion.div
					key="details"
					initial={{ opacity: 0, x: 50 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -50 }}
					transition={{ duration: 0.3 }}
				>
					<Stack align="center" gap="lg" maw={420} mx="auto">
						<Stack gap={4} align="center">
							<Text size="xl">✨🦕</Text>
							<Title order={2} fw={800} ta="center">
								Create a new habit!
							</Title>
							<Text size="sm" c="dimmed" ta="center">
								Pick a name, icon, and give it some personality.
							</Text>
						</Stack>

						<Stack gap="md" w="100%">
							<TextInput
								label="Habit name"
								placeholder="e.g. Stretch break, Walk time, Eye rest"
								value={details.name}
								onChange={(e) =>
									setDetails({
										...details,
										name: e.currentTarget.value,
									})
								}
								error={error && step === "details" ? error : undefined}
								size="md"
								radius="lg"
								styles={{
									label: { fontWeight: 700, marginBottom: 4 },
								}}
							/>
							<Textarea
								label="Description (optional)"
								placeholder="What will you do? 🤸"
								value={details.description}
								onChange={(e) =>
									setDetails({
										...details,
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
									value={details.icon}
									onChange={(icon) => setDetails({ ...details, icon })}
								/>
							</div>
						</Stack>

						<Button color="teal" radius="xl" onClick={handleDetailsNext}>
							Next step 📅
						</Button>
					</Stack>
				</motion.div>
			) : (
				<motion.div
					key="schedule"
					initial={{ opacity: 0, x: 50 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -50 }}
					transition={{ duration: 0.3 }}
				>
					<Stack align="center" gap="lg" maw={460} mx="auto">
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

						{error ? (
							<Text size="sm" c="red" ta="center">
								{error}
							</Text>
						) : null}

						<Group>
							<Button
								variant="subtle"
								color="gray"
								radius="xl"
								onClick={() => {
									setError("");
									setStep("details");
								}}
							>
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
			)}
		</Container>
	);
}
