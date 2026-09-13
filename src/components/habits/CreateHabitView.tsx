import {
	Button,
	Collapse,
	Group,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate } from "@tanstack/react-router";
import { emit } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { createHabit } from "../../lib/invoke";
import type { TimeSlot } from "../../types";
import { IconPicker } from "../shared/IconPicker";
import { MascotImage } from "../shared/MascotImage";
import { SchedulePicker } from "../shared/SchedulePicker";
import { SpeechBubble } from "../shared/SpeechBubble";

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

function stagger(index: number, animate: boolean) {
	if (!animate) return { initial: false, animate: { opacity: 1, y: 0 } };
	return {
		initial: { opacity: 0, y: 15 },
		animate: { opacity: 1, y: 0 },
		transition: { delay: index * 0.2, duration: 0.3 },
	};
}

export function CreateHabitView() {
	const navigate = useNavigate();
	const [step, setStep] = useState<Step>("details");
	const [details, setDetails] = useState<HabitDetails>(DEFAULT_DETAILS);
	const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
	const [scheduleTimes, setScheduleTimes] = useState<TimeSlot[]>([
		{ start_time: "10:00" },
	]);
	const [startDate] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	});
	const [endDate, setEndDate] = useState<string | null>(null);
	const [optionsOpen, setOptionsOpen] = useState(false);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [bubbleVisible, setBubbleVisible] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: step triggers bubble reset on step change
	useEffect(() => {
		setBubbleVisible(false);
		const timer = setTimeout(() => setBubbleVisible(true), 350);
		return () => clearTimeout(timer);
	}, [step]);

	const handleDetailsNext = () => {
		if (!details.name.trim()) {
			setError("Every habit needs a name!");
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
		<>
			{step === "details" ? (
				<motion.div
					key="details"
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
					<Stack align="center" gap="md" maw={420} w="100%">
						{/* Mascot + bubble */}
						<motion.div {...stagger(0, true)}>
							<div
								style={{
									position: "relative",
									display: "inline-block",
									marginTop: 48,
								}}
							>
								<SpeechBubble
									message={`Another great habit incoming!\nLet's set it up - you know the drill! 💪`}
									visible={bubbleVisible}
									offsetY={-10}
									offsetX={-140}
									width={340}
								/>
								<MascotImage reaction="promising" size={140} />
							</div>
						</motion.div>

						{/* Title */}
						<motion.div {...stagger(2, true)}>
							<Title order={2} fw={800} ta="center">
								Create a new habit!
							</Title>
						</motion.div>

						{/* Form */}
						<motion.div {...stagger(3, true)} style={{ width: "100%" }}>
							<Stack gap="md" w="100%">
								<Group gap="sm" align="flex-end" wrap="nowrap">
									<TextInput
										label="Habit name"
										placeholder="e.g. Stretch break, Walk time, Eye rest"
										value={details.name}
										onChange={(e) =>
											setDetails({
												...details,
												name: e.currentTarget.value.slice(0, 45),
											})
										}
										error={error && step === "details" ? error : undefined}
										maxLength={45}
										size="md"
										radius="lg"
										style={{ flex: 1 }}
										styles={{
											label: { fontWeight: 700, marginBottom: 4 },
										}}
									/>
									<IconPicker
										value={details.icon}
										onChange={(icon) => setDetails({ ...details, icon })}
									/>
								</Group>

								<Textarea
									label="Description (optional)"
									placeholder="What will you do? 🤸"
									value={details.description}
									onChange={(e) =>
										setDetails({
											...details,
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

						{/* Button */}
						<motion.div {...stagger(4, true)}>
							<Button color="teal" radius="xl" onClick={handleDetailsNext}>
								Next step 📅
							</Button>
						</motion.div>
					</Stack>
				</motion.div>
			) : (
				<motion.div
					key="schedule"
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
					<Stack align="center" gap="lg" maw={500} w="100%">
						{/* Mascot + bubble */}
						<motion.div {...stagger(0, true)}>
							<div style={{ position: "relative", display: "inline-block" }}>
								<SpeechBubble
									message="Pick your schedule and I'll keep you on track — as always! ⏰"
									visible={bubbleVisible}
									offsetY={4}
								/>
								<MascotImage reaction="happy" size={100} />
							</div>
						</motion.div>

						{/* Title */}
						<motion.div {...stagger(2, true)}>
							<Title order={2} fw={800} ta="center">
								When should we remind you?
							</Title>
						</motion.div>

						{/* Form */}
						<motion.div {...stagger(3, true)} style={{ width: "100%" }}>
							<Stack gap="md" w="100%">
								<SchedulePicker
									days={scheduleDays}
									times={scheduleTimes}
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
												transform: optionsOpen
													? "rotate(180deg)"
													: "rotate(0deg)",
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

						{error ? (
							<Text size="sm" c="red" ta="center">
								{error}
							</Text>
						) : null}

						{/* Buttons */}
						<motion.div {...stagger(4, true)}>
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
						</motion.div>
					</Stack>
				</motion.div>
			)}
		</>
	);
}
