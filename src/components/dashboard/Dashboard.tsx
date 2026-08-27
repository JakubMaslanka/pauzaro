import { Alert, Container, Loader, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getUserProfile, listHabits } from "../../lib/invoke";
import type { Habit, UserProfile } from "../../types";
import { HabitCard } from "./HabitCard";

type DashboardState =
	| { status: "loading" }
	| { status: "error"; error: string }
	| { status: "ready"; profile: UserProfile; habits: Habit[] };

export function Dashboard() {
	const [state, setState] = useState<DashboardState>({ status: "loading" });

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
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("Dashboard load failed:", message);
				setState({ status: "error", error: message });
			}
		}
		load();
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
					<HabitCard key={habit.id} habit={habit} />
				))}
			</Stack>
		</Container>
	);
}
