import { Alert, Container, Loader, Stack, Text } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import {
	getAllHabitStatuses,
	getMonthCompletions,
	listHabits,
} from "../../lib/invoke";
import type { Completion, Habit, HabitStatus } from "../../types";
import { HabitCard } from "./HabitCard";
import { MonthCalendar } from "./MonthCalendar";
import { MonthStats } from "./MonthStats";
import { StreakHero } from "./StreakHero";

type DashboardState =
	| { status: "loading" }
	| { status: "error"; error: string }
	| {
			status: "ready";
			habits: Habit[];
			habitStatuses: Record<string, HabitStatus>;
	  };

function getCurrentUTCMonth(): { year: number; month: number } {
	const now = new Date();
	return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

function getMonthDateRange(year: number, month: number) {
	const fromDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
	const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const toDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { fromDate, toDate };
}

function countScheduledDaysInMonth(
	year: number,
	month: number,
	scheduleDays: number[],
	habitStartDate: string,
): number {
	const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const now = new Date();
	const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
	let count = 0;
	for (let d = 1; d <= lastDay; d++) {
		const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		if (dateStr < habitStartDate || dateStr > todayStr) continue;
		const dateObj = new Date(Date.UTC(year, month, d));
		const dow = dateObj.getUTCDay();
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

export function Dashboard() {
	const [state, setState] = useState<DashboardState>({ status: "loading" });
	const [currentMonth, setCurrentMonth] = useState(getCurrentUTCMonth);
	const [completions, setCompletions] = useState<Completion[]>([]);

	const loadData = useCallback(async () => {
		try {
			const [habits, allStatuses] = await Promise.all([
				listHabits(),
				getAllHabitStatuses(),
			]);

			const statuses: Record<string, HabitStatus> = {};
			for (const s of allStatuses) {
				statuses[s.habit_id] = s;
			}

			setState({ status: "ready", habits, habitStatuses: statuses });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("Dashboard load failed:", message);
			setState({ status: "error", error: message });
		}
	}, []);

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

	// Load completions when habit or month changes
	useEffect(() => {
		if (state.status !== "ready" || state.habits.length === 0) return;
		const habit = state.habits[0];
		loadCompletions(habit.id, currentMonth.year, currentMonth.month);
	}, [state, currentMonth, loadCompletions]);

	// Listen for habit-updated events from overlay interactions
	useEffect(() => {
		const unlisten = listen("habit-updated", () => {
			loadData();
			if (state.status === "ready" && state.habits.length > 0) {
				loadCompletions(
					state.habits[0].id,
					currentMonth.year,
					currentMonth.month,
				);
			}
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, [loadData, loadCompletions, state, currentMonth]);

	const handleMonthChange = useCallback((year: number, month: number) => {
		setCurrentMonth({ year, month });
	}, []);

	if (state.status === "loading") {
		return (
			<Container size="sm" py="xl">
				<Stack align="center" gap="md" py={80}>
					<Loader size="lg" color="teal" />
					<Text c="dimmed">Loading your habits...</Text>
				</Stack>
			</Container>
		);
	}

	if (state.status === "error") {
		return (
			<Container size="sm" py="xl">
				<Alert color="red" title="Oops! Something went wrong 😵">
					{state.error}
				</Alert>
			</Container>
		);
	}

	const { habits, habitStatuses } = state;

	if (habits.length === 0) {
		return (
			<Container size="sm" py="xl">
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

	const habit = habits[0];
	const status = habitStatuses[habit.id];
	const streak = status?.streak ?? 0;
	const slotsPerDay = habit.schedule_times.length;
	const totalScheduledDays = countScheduledDaysInMonth(
		currentMonth.year,
		currentMonth.month,
		habit.schedule_days,
		habit.start_date,
	);
	const daysPracticed = countDaysPracticed(completions, slotsPerDay);

	return (
		<Container size="sm" py="xl">
			<Stack gap="md">
				<HabitCard habit={habit} />
				<StreakHero streak={streak} />
				<MonthStats
					daysPracticed={daysPracticed}
					totalScheduledDays={totalScheduledDays}
					streak={streak}
				/>
				<MonthCalendar
					year={currentMonth.year}
					month={currentMonth.month}
					completions={completions}
					scheduleDays={habit.schedule_days}
					slotsPerDay={slotsPerDay}
					habitStartDate={habit.start_date}
					onMonthChange={handleMonthChange}
				/>
			</Stack>
		</Container>
	);
}
