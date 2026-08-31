import { Alert, Container, Loader, Stack, Text, Title } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import {
	getAllHabitStatuses,
	getHabitStatus,
	getUserProfile,
	listHabits,
	markDone,
} from "../../lib/invoke";
import type { Habit, HabitStatus, UserProfile } from "../../types";
import { HabitCard } from "./HabitCard";
import { TodayStatus } from "./TodayStatus";

type DashboardState =
	| { status: "loading" }
	| { status: "error"; error: string }
	| { status: "ready"; profile: UserProfile; habits: Habit[] };

export function Dashboard() {
	const [state, setState] = useState<DashboardState>({ status: "loading" });
	const [habitStatuses, setHabitStatuses] = useState<
		Record<string, HabitStatus>
	>({});

	const fetchStatuses = useCallback(async () => {
		try {
			const all = await getAllHabitStatuses();
			const statuses: Record<string, HabitStatus> = {};
			for (const s of all) {
				statuses[s.habit_id] = s;
			}
			setHabitStatuses(statuses);
		} catch (error) {
			console.error("Failed to fetch habit statuses:", error);
		}
	}, []);

	useEffect(() => {
		async function load() {
			try {
				const [profile, habits] = await Promise.all([
					getUserProfile(),
					listHabits(),
				]);

				if (!profile) {
					setState({ status: "error", error: "No user profile found" });
					return;
				}

				setState({ status: "ready", profile, habits });
				fetchStatuses();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("Dashboard load failed:", message);
				setState({ status: "error", error: message });
			}
		}
		load();
	}, [fetchStatuses]);

	// Listen for habit-updated events from overlay interactions
	useEffect(() => {
		const unlisten = listen("habit-updated", () => {
			fetchStatuses();
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, [fetchStatuses]);

	const handleLifebuoy = useCallback(
		async (habitId: string, scheduledTime: string) => {
			const status = habitStatuses[habitId];
			if (!status) return;
			try {
				await markDone({
					habit_id: habitId,
					trigger_date: status.today_date,
					scheduled_time: scheduledTime,
					override_failed: true,
				});
				// Re-fetch status for this habit
				const updated = await getHabitStatus(habitId);
				setHabitStatuses((prev) => ({ ...prev, [habitId]: updated }));
			} catch (error) {
				console.error("Lifebuoy failed:", error);
			}
		},
		[habitStatuses],
	);

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

	const { profile, habits } = state;

	return (
		<Container size="sm" py="xl">
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<Title order={2} mb="xs">
					Hey {profile.name}! 👋
				</Title>
				<Text c="dimmed" mb="lg">
					{habits.length > 0
						? "Here's what you're building 💪"
						: "No habits yet — let's fix that! 🚀"}
				</Text>
			</motion.div>

			<Stack gap="md">
				{habits.map((habit) => (
					<div key={habit.id}>
						<HabitCard habit={habit} />
						{habitStatuses[habit.id] ? (
							<TodayStatus
								habitStatus={habitStatuses[habit.id]}
								onMarkDone={(time) => handleLifebuoy(habit.id, time)}
							/>
						) : null}
					</div>
				))}
			</Stack>
		</Container>
	);
}
