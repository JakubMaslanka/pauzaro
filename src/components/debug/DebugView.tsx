import {
	Badge,
	Box,
	Button,
	Card,
	Container,
	Divider,
	Group,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { motion } from "framer-motion";
import {
	Bug,
	CheckCircle,
	Play,
	RefreshCw,
	RotateCcw,
	Snowflake,
	Timer,
	Trash2,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	type DebugDayState,
	debugBackdateLastSeen,
	debugClearAllFreezes,
	debugDeleteCompletionsForDate,
	debugGetDayState,
	debugInsertCompletion,
	debugInsertFreeze,
	debugRemoveFreeze,
	debugResetOnboarding,
	listHabits,
} from "../../lib/invoke";
import type { Habit } from "../../types";

function formatToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatYesterday(): string {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DebugView() {
	const navigate = useNavigate();
	const [habits, setHabits] = useState<Habit[]>([]);
	const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
	const [selectedDate, setSelectedDate] = useState(formatYesterday);
	const [dayState, setDayState] = useState<DebugDayState | null>(null);
	const [completionTime, setCompletionTime] = useState("10:00");

	const selectedHabit = habits.find((h) => h.id === selectedHabitId);

	useEffect(() => {
		listHabits()
			.then((h) => {
				setHabits(h);
				if (h.length > 0 && !selectedHabitId) {
					setSelectedHabitId(h[0].id);
				}
			})
			.catch((err) => console.error("Failed to load habits:", err));
	}, [selectedHabitId]);

	const refreshDayState = useCallback(async () => {
		if (!selectedHabitId || !selectedDate) return;
		try {
			const state = await debugGetDayState(selectedHabitId, selectedDate);
			setDayState(state);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			notifications.show({ title: "Error", message, color: "red" });
			setDayState(null);
		}
	}, [selectedHabitId, selectedDate]);

	// Auto-refresh day state when habit or date changes
	useEffect(() => {
		if (selectedHabitId && selectedDate) {
			refreshDayState();
		}
	}, [selectedHabitId, selectedDate, refreshDayState]);

	// Set default completion time from habit schedule
	useEffect(() => {
		if (selectedHabit?.schedule_times[0]) {
			setCompletionTime(selectedHabit.schedule_times[0].start_time);
		}
	}, [selectedHabit]);

	const handleTriggerOverlay = useCallback(async () => {
		try {
			if (habits.length === 0) {
				notifications.show({
					message: "No habits found — create one first!",
					color: "orange",
				});
				return;
			}
			const habit = habits[0];
			const triggerDate = formatToday();
			const scheduledTime = habit.schedule_times[0]?.start_time ?? "10:00";
			const label = `overlay-${habit.id}`;
			const url = `/overlay/${habit.id}?triggerDate=${triggerDate}&scheduledTime=${scheduledTime}`;

			const webview = new WebviewWindow(label, {
				url,
				title: "Pauzaro",
				width: 400,
				height: 380,
				alwaysOnTop: true,
				center: true,
				decorations: false,
			});

			webview.once("tauri://error", (e) => {
				console.error("Overlay window error:", e);
				notifications.show({
					title: "Error",
					message: String(e.payload),
					color: "red",
				});
			});

			notifications.show({
				message: `Overlay opened for "${habit.name}"`,
				color: "teal",
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			notifications.show({ title: "Error", message, color: "red" });
		}
	}, [habits]);

	const withRefresh = useCallback(
		(action: () => Promise<string>) => async () => {
			try {
				const msg = await action();
				notifications.show({ message: msg, color: "teal" });
				await refreshDayState();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				notifications.show({ title: "Error", message, color: "red" });
			}
		},
		[refreshDayState],
	);

	const handleInsertCompletion = withRefresh(async () => {
		if (!selectedHabitId) return "Select a habit first";
		await debugInsertCompletion(selectedHabitId, selectedDate, completionTime);
		return `✅ Completion added for ${selectedDate} at ${completionTime}`;
	});

	const handleDeleteCompletions = withRefresh(async () => {
		if (!selectedHabitId) return "Select a habit first";
		const count = await debugDeleteCompletionsForDate(
			selectedHabitId,
			selectedDate,
		);
		return `🗑️ Deleted ${count} completion(s) for ${selectedDate}`;
	});

	const handleInsertFreeze = withRefresh(async () => {
		if (!selectedHabitId) return "Select a habit first";
		await debugInsertFreeze(selectedHabitId, selectedDate);
		return `❄️ Freeze inserted for ${selectedDate}`;
	});

	const handleRemoveFreeze = withRefresh(async () => {
		if (!selectedHabitId) return "Select a habit first";
		const rows = await debugRemoveFreeze(selectedHabitId, selectedDate);
		if (rows === 0) return `No freeze found for ${selectedDate}`;
		// Add completion so auto-consumption doesn't re-freeze this day
		await debugInsertCompletion(selectedHabitId, selectedDate, completionTime);
		return `🗑️ Freeze removed for ${selectedDate} (completion added to prevent re-freeze)`;
	});

	const handleClearAllFreezes = withRefresh(async () => {
		if (!selectedHabitId) return "Select a habit first";
		const count = await debugClearAllFreezes(selectedHabitId);
		return `🗑️ Cleared ${count} freeze(s) for habit (⚠️ missed days may re-freeze on next status query)`;
	});

	const handleSimulateMissedDay = withRefresh(async () => {
		if (!selectedHabitId) return "Select a habit first";
		const count = await debugDeleteCompletionsForDate(
			selectedHabitId,
			selectedDate,
		);
		const ts = await debugBackdateLastSeen(2);
		return `🕐 Deleted ${count} completion(s) for ${selectedDate}, backdated last_seen to ${ts}. Restart app to trigger freeze consumption.`;
	});

	const habitSelectData = habits.map((h) => ({
		value: h.id,
		label: h.name,
	}));

	const timeSlotData =
		selectedHabit?.schedule_times.map((s) => ({
			value: s.start_time,
			label: s.start_time,
		})) ?? [];

	return (
		<Container size="sm" py="xl">
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<Stack gap="lg">
					{/* Header */}
					<Stack align="center" gap="xs">
						<Bug size={48} color="var(--mantine-color-gray-5)" />
						<Title order={2} c="dimmed">
							Debug Panel
						</Title>
						<Text c="dimmed" size="sm">
							Dev-only tools 🛠️
						</Text>
					</Stack>

					{/* Quick actions */}
					<Group grow>
						<Button
							variant="outline"
							color="teal"
							onClick={handleTriggerOverlay}
							leftSection={<Play size={16} />}
						>
							Show Overlay Window
						</Button>
						<Button
							variant="outline"
							color="orange"
							onClick={async () => {
								try {
									await debugResetOnboarding();
									navigate({ to: "/onboarding" });
								} catch (error) {
									const message =
										error instanceof Error ? error.message : String(error);
									notifications.show({ title: "Error", message, color: "red" });
								}
							}}
							leftSection={<RotateCcw size={16} />}
						>
							Reset Onboarding
						</Button>
					</Group>

					<Divider label="🧪 Streak & Freeze Testing" labelPosition="center" />

					{/* Target selection */}
					<Group grow align="flex-end">
						<Select
							label="Target habit"
							data={habitSelectData}
							value={selectedHabitId}
							onChange={setSelectedHabitId}
							allowDeselect={false}
						/>
						<TextInput
							label="Target date"
							type="date"
							value={selectedDate}
							onChange={(e) => setSelectedDate(e.currentTarget.value)}
						/>
					</Group>

					{/* Day state inspector */}
					{dayState ? (
						<Card withBorder radius="md" p="sm">
							<Group justify="space-between" mb="xs">
								<Text fw={700} size="sm">
									📋 Day State: {dayState.date}
								</Text>
								<Button
									variant="subtle"
									size="compact-xs"
									onClick={refreshDayState}
									leftSection={<RefreshCw size={12} />}
								>
									Refresh
								</Button>
							</Group>
							<Stack gap={4}>
								<Group gap="xs">
									<Text size="xs" c="dimmed" w={100}>
										Frozen:
									</Text>
									<Badge
										color={dayState.is_frozen ? "blue" : "gray"}
										variant="light"
										size="sm"
									>
										{dayState.is_frozen ? "❄️ Yes" : "No"}
									</Badge>
								</Group>
								<Group gap="xs">
									<Text size="xs" c="dimmed" w={100}>
										Freezes used:
									</Text>
									<Badge color="blue" variant="light" size="sm">
										{dayState.freezes_total} / 2
									</Badge>
								</Group>
								<Group gap="xs">
									<Text size="xs" c="dimmed" w={100}>
										Completions:
									</Text>
									{dayState.completions.length === 0 ? (
										<Badge color="gray" variant="light" size="sm">
											None
										</Badge>
									) : (
										dayState.completions.map((c) => (
											<Badge
												key={c.scheduled_time}
												color={c.status === "done" ? "teal" : "red"}
												variant="light"
												size="sm"
											>
												{c.scheduled_time}: {c.status}
											</Badge>
										))
									)}
								</Group>
								<Group gap="xs">
									<Text size="xs" c="dimmed" w={100}>
										Last seen:
									</Text>
									<Text size="xs" ff="monospace">
										{dayState.last_seen_at}
									</Text>
								</Group>
							</Stack>
						</Card>
					) : null}

					{/* Completion actions */}
					<Box>
						<Text size="sm" fw={600} mb={4}>
							Completions
						</Text>
						<Group grow>
							<Group gap="xs" style={{ flex: 1 }}>
								{timeSlotData.length > 1 ? (
									<Select
										size="xs"
										data={timeSlotData}
										value={completionTime}
										onChange={(v) => v && setCompletionTime(v)}
										allowDeselect={false}
										style={{ flex: 1 }}
									/>
								) : null}
								<Button
									variant="outline"
									color="teal"
									size="xs"
									onClick={handleInsertCompletion}
									leftSection={<CheckCircle size={14} />}
									disabled={!selectedHabitId}
									style={{ flex: 1 }}
								>
									Add Done ({completionTime})
								</Button>
							</Group>
							<Button
								variant="outline"
								color="red"
								size="xs"
								onClick={handleDeleteCompletions}
								leftSection={<XCircle size={14} />}
								disabled={!selectedHabitId}
							>
								Delete All for Date
							</Button>
						</Group>
					</Box>

					{/* Freeze actions */}
					<Box>
						<Text size="sm" fw={600} mb={4}>
							Freezes
						</Text>
						<Stack gap="xs">
							<Group grow>
								<Button
									variant="outline"
									color="blue"
									size="xs"
									onClick={handleInsertFreeze}
									leftSection={<Snowflake size={14} />}
									disabled={!selectedHabitId}
								>
									Insert Freeze
								</Button>
								<Button
									variant="outline"
									color="red"
									size="xs"
									onClick={handleRemoveFreeze}
									leftSection={<Trash2 size={14} />}
									disabled={!selectedHabitId}
								>
									Remove Freeze
								</Button>
							</Group>
							<Button
								variant="outline"
								color="red"
								size="xs"
								onClick={handleClearAllFreezes}
								leftSection={<Trash2 size={14} />}
								disabled={!selectedHabitId}
								fullWidth
							>
								Clear All Freezes for Habit
							</Button>
						</Stack>
					</Box>

					{/* Simulate */}
					<Box>
						<Text size="sm" fw={600} mb={4}>
							Simulation
						</Text>
						<Button
							variant="outline"
							color="grape"
							size="xs"
							onClick={handleSimulateMissedDay}
							leftSection={<Timer size={14} />}
							disabled={!selectedHabitId}
							fullWidth
						>
							Simulate Missed Day (delete completions + backdate last_seen)
						</Button>
						<Text size="xs" c="dimmed" mt={4}>
							Restart app after to trigger real freeze consumption flow.
						</Text>
					</Box>
				</Stack>
			</motion.div>
		</Container>
	);
}
