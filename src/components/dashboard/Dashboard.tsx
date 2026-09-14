import {
	Alert,
	Box,
	Container,
	Grid,
	Group,
	Loader,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { emit, listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	getAllHabitStatuses,
	getLatestCompletion,
	getMissedRepetitions,
	getMonthCompletions,
	getUserProfile,
	listHabits,
	markDone,
} from "../../lib/invoke";
import { useDashboardStore } from "../../stores/dashboard";
import { useSettingsStore } from "../../stores/settings";
import type {
	Completion,
	Habit,
	HabitStatus,
	RecoveryResult,
} from "../../types";
import { DeleteHabitModal } from "./DeleteHabitModal";
import { HabitMenu } from "./HabitMenu";
import { MonthCalendar } from "./MonthCalendar";
import { MonthStats } from "./MonthStats";
import { RecoveryFlow } from "./RecoveryFlow";
import { RenameHabitModal } from "./RenameHabitModal";
import { StreakHero } from "./StreakHero";

type DashboardState =
	| { status: "loading" }
	| { status: "recovering"; recoveryResult: RecoveryResult }
	| { status: "error"; error: string }
	| {
			status: "ready";
			habits: Habit[];
			habitStatuses: Record<string, HabitStatus>;
	  };

function getCurrentMonth(): { year: number; month: number } {
	const now = new Date();
	return { year: now.getFullYear(), month: now.getMonth() };
}

function getMonthDateRange(year: number, month: number) {
	const fromDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
	const lastDay = new Date(year, month + 1, 0).getDate();
	const toDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { fromDate, toDate };
}

function countScheduledDaysInMonth(
	year: number,
	month: number,
	scheduleDays: number[],
	habitStartDate: string,
): number {
	const lastDay = new Date(year, month + 1, 0).getDate();
	const now = new Date();
	const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	let count = 0;
	for (let d = 1; d <= lastDay; d++) {
		const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		if (dateStr < habitStartDate || dateStr > todayStr) continue;
		const dateObj = new Date(year, month, d);
		const dow = dateObj.getDay();
		if (scheduleDays.includes(dow)) count++;
	}
	return count;
}

function countDaysPracticed(
	completions: Completion[],
	slotsPerDay: number,
): number {
	const byDate = new Map<string, number>();
	for (const c of completions) {
		if (c.status === "done") {
			byDate.set(c.trigger_date, (byDate.get(c.trigger_date) ?? 0) + 1);
		}
	}
	let count = 0;
	for (const doneCount of byDate.values()) {
		if (doneCount >= slotsPerDay) count++;
	}
	return count;
}

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour >= 5 && hour < 12) return "Good morning";
	if (hour >= 12 && hour < 17) return "Good afternoon";
	if (hour >= 17 && hour < 21) return "Good evening";
	return "Good night";
}

export function Dashboard() {
	const [state, setState] = useState<DashboardState>({ status: "loading" });
	const [currentMonth, setCurrentMonth] = useState(getCurrentMonth);
	const [completions, setCompletions] = useState<Completion[]>([]);
	const [userName, setUserName] = useState<string>("");
	const [latestCompletion, setLatestCompletion] = useState<Completion | null>(
		null,
	);
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const [recoveryChecked, setRecoveryChecked] = useState(false);

	const loadData = useCallback(async () => {
		try {
			// Check for missed repetitions on first load
			if (!recoveryChecked) {
				setRecoveryChecked(true);
				const recovery = await getMissedRepetitions();
				if (recovery.habits.length > 0) {
					setState({ status: "recovering", recoveryResult: recovery });
					return;
				}
			}

			const [habits, allStatuses, profile] = await Promise.all([
				listHabits(),
				getAllHabitStatuses(),
				getUserProfile(),
			]);

			const statuses: Record<string, HabitStatus> = {};
			for (const s of allStatuses) {
				statuses[s.habit_id] = s;
			}

			setUserName(profile?.name ?? "");
			setState({ status: "ready", habits, habitStatuses: statuses });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("Dashboard load failed:", message);
			setState({ status: "error", error: message });
		}
	}, [recoveryChecked]);

	const loadCompletions = useCallback(
		async (habitId: string, year: number, month: number) => {
			try {
				const { fromDate, toDate } = getMonthDateRange(year, month);
				const data = await getMonthCompletions(habitId, fromDate, toDate);
				setCompletions(data);
			} catch (error) {
				console.error("Failed to load completions:", error);
				setCompletions([]);
			}
		},
		[],
	);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const activeHabitId = useDashboardStore((s) => s.activeHabitId);
	const weekStartDay = useSettingsStore((s) => s.weekStartDay);

	const activeHabit = useMemo(() => {
		if (state.status !== "ready") return null;
		return state.habits.find((h) => h.id === activeHabitId) ?? null;
	}, [state, activeHabitId]);

	// Load completions + latest completion when active habit or month changes
	useEffect(() => {
		if (!activeHabit) return;
		loadCompletions(activeHabit.id, currentMonth.year, currentMonth.month);
		getLatestCompletion(activeHabit.id)
			.then(setLatestCompletion)
			.catch(() => setLatestCompletion(null));
	}, [activeHabit, currentMonth, loadCompletions]);

	// Listen for habit-updated events from overlay interactions
	useEffect(() => {
		const unlisten = listen("habit-updated", () => {
			loadData();
			const currentActiveId = useDashboardStore.getState().activeHabitId;
			if (currentActiveId) {
				loadCompletions(currentActiveId, currentMonth.year, currentMonth.month);
			}
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, [loadData, loadCompletions, currentMonth]);

	const handleMonthChange = useCallback((year: number, month: number) => {
		setCurrentMonth({ year, month });
	}, []);

	const handleRenamed = useCallback(() => {
		loadData();
		emit("habit-updated");
	}, [loadData]);

	const handleDeleted = useCallback(() => {
		loadData();
		emit("habit-updated");
	}, [loadData]);

	const handleMarkDone = useCallback(async () => {
		if (!latestCompletion || latestCompletion.status === "done") return;
		try {
			await markDone({
				habit_id: latestCompletion.habit_id,
				trigger_date: latestCompletion.trigger_date,
				scheduled_time: latestCompletion.scheduled_time,
				override_failed: true,
			});
			loadData();
			const currentActiveId = useDashboardStore.getState().activeHabitId;
			if (currentActiveId) {
				loadCompletions(currentActiveId, currentMonth.year, currentMonth.month);
			}
		} catch (error) {
			console.error("Failed to mark as done:", error);
		}
	}, [latestCompletion, loadData, loadCompletions, currentMonth]);

	const handleRecoveryComplete = useCallback(() => {
		setState({ status: "loading" });
		loadData();
	}, [loadData]);

	// Sync mascot state to store so AppNavbar can subscribe
	const setMascotState = useDashboardStore((s) => s.setMascotState);
	const mascotStatus = useMemo(() => {
		if (state.status !== "ready" || !activeHabit) return null;
		return state.habitStatuses[activeHabit.id] ?? null;
	}, [state, activeHabit]);

	useEffect(() => {
		if (!mascotStatus) return;
		const todayStr = new Date().toISOString().slice(0, 10);
		const frozenDates = mascotStatus.frozen_dates ?? [];
		const isFrozen = frozenDates.includes(todayStr);
		setMascotState(mascotStatus.streak ?? 0, isFrozen);
	}, [mascotStatus, setMascotState]);

	if (state.status === "loading") {
		return (
			<Container size="lg" py="xl">
				<Stack align="center" gap="md" py={80}>
					<Loader size="lg" color="teal" />
					<Text c="dimmed">Loading your habits...</Text>
				</Stack>
			</Container>
		);
	}

	if (state.status === "recovering") {
		return (
			<RecoveryFlow
				recoveryResult={state.recoveryResult}
				onComplete={handleRecoveryComplete}
			/>
		);
	}

	if (state.status === "error") {
		return (
			<Container size="lg" py="xl">
				<Alert color="red" title="Oops! Something went wrong 😵">
					{state.error}
				</Alert>
			</Container>
		);
	}

	const { habitStatuses } = state;

	if (!activeHabit) {
		return (
			<Container size="lg" py="xl">
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
				>
					<Text c="dimmed" ta="center" py={40}>
						No habits yet — let's fix that! 🚀
					</Text>
				</motion.div>
			</Container>
		);
	}

	const status = habitStatuses[activeHabit.id];
	const streak = status?.streak ?? 0;
	const freezesRemaining = status?.freezes_remaining ?? 2;
	const frozenDates = status?.frozen_dates ?? [];

	const slotsPerDay = activeHabit.schedule_times.length;
	const totalScheduledDays = countScheduledDaysInMonth(
		currentMonth.year,
		currentMonth.month,
		activeHabit.schedule_days,
		activeHabit.start_date,
	);
	const daysPracticed = countDaysPracticed(completions, slotsPerDay);
	const greeting = getGreeting();

	return (
		<Container size="lg" py="xl" px="xl">
			<style>
				{`@media (min-width: 48em) { .dashboard-right-col { padding-top: 8px; } }`}
			</style>
			<Grid gap="xl">
				{/* Left column: greeting + habit info + calendar */}
				<Grid.Col span={{ base: 12, sm: 8 }}>
					<Stack gap="md">
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4 }}
						>
							<Title order={2} fw={800} size="h2">
								{greeting}
								{userName ? `, ${userName}` : ""}! 👋
							</Title>
						</motion.div>

						<Box>
							<style>
								{`.habit-header:hover .habit-menu-trigger { opacity: 1 !important; }`}
							</style>
							<Group
								gap="xs"
								align="center"
								className="habit-header"
								style={{ width: "fit-content" }}
							>
								<Title order={3} fw={700}>
									Your progress on{" "}
									<Text span inherit c="teal">
										{activeHabit.name}
									</Text>
								</Title>
								<HabitMenu
									habit={activeHabit}
									latestCompletion={latestCompletion}
									onRename={() => setRenameOpen(true)}
									onDelete={() => setDeleteOpen(true)}
									onMarkDone={handleMarkDone}
								/>
							</Group>
							{activeHabit.description ? (
								<Text size="sm" c="dimmed" mt={2}>
									{activeHabit.description}
								</Text>
							) : null}
						</Box>

						<MonthCalendar
							year={currentMonth.year}
							month={currentMonth.month}
							completions={completions}
							scheduleDays={activeHabit.schedule_days}
							slotsPerDay={slotsPerDay}
							habitStartDate={activeHabit.start_date}
							frozenDates={frozenDates}
							weekStartDay={weekStartDay}
							onMonthChange={handleMonthChange}
						/>
					</Stack>
				</Grid.Col>

				{/* Right column: streak hero + stats */}
				<Grid.Col span={{ base: 12, sm: 4 }}>
					<Stack gap="md" className="dashboard-right-col">
						<StreakHero
							streak={streak}
							freezesRemaining={freezesRemaining}
							isFrozen={frozenDates.includes(
								new Date().toISOString().slice(0, 10),
							)}
						/>
						<MonthStats
							daysPracticed={daysPracticed}
							totalScheduledDays={totalScheduledDays}
							streak={streak}
							endDate={activeHabit.end_date}
							frozenDates={frozenDates}
							currentYear={currentMonth.year}
							currentMonth={currentMonth.month}
						/>
					</Stack>
				</Grid.Col>
			</Grid>

			<RenameHabitModal
				habit={activeHabit}
				opened={renameOpen}
				onClose={() => setRenameOpen(false)}
				onRenamed={handleRenamed}
			/>
			<DeleteHabitModal
				habit={activeHabit}
				opened={deleteOpen}
				onClose={() => setDeleteOpen(false)}
				onDeleted={handleDeleted}
			/>
		</Container>
	);
}
