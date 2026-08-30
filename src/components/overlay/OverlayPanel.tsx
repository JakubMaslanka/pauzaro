import { Button, Card, Group, Loader, Stack, Text } from "@mantine/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { getHabit, markDone, snoozeHabit } from "../../lib/invoke";
import type { Habit } from "../../types";
import { DynamicIcon } from "../shared/DynamicIcon";

const AUTO_SNOOZE_MS = 2 * 60 * 1000; // 2 minutes

interface OverlayPanelProps {
	habitId: string;
}

type OverlayState =
	| { status: "loading" }
	| { status: "ready"; habit: Habit }
	| { status: "auto_failed" }
	| { status: "error"; message: string };

export function OverlayPanel({ habitId }: OverlayPanelProps) {
	const [state, setState] = useState<OverlayState>({ status: "loading" });
	const [processing, setProcessing] = useState(false);
	const autoSnoozeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearAutoSnooze = useCallback(() => {
		if (autoSnoozeRef.current) {
			clearTimeout(autoSnoozeRef.current);
			autoSnoozeRef.current = null;
		}
	}, []);

	const closeWindow = useCallback(() => {
		getCurrentWindow().close().catch(console.error);
	}, []);

	useEffect(() => {
		async function load() {
			try {
				const habit = await getHabit(habitId);
				setState({ status: "ready", habit });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("Failed to load habit:", message);
				setState({ status: "error", message });
			}
		}
		load();
	}, [habitId]);

	const handleDone = useCallback(async () => {
		clearAutoSnooze();
		setProcessing(true);

		const today = new Date().toISOString().split("T")[0];
		try {
			const habit = (state as { status: "ready"; habit: Habit }).habit;
			const scheduledTime = habit.schedule_times[0]?.start_time ?? "00:00";

			await markDone({
				habit_id: habitId,
				trigger_date: today,
				scheduled_time: scheduledTime,
			});
			closeWindow();
		} catch (error) {
			console.error("Failed to mark done:", error);
			setProcessing(false);
		}
	}, [habitId, state, clearAutoSnooze, closeWindow]);

	const handleSnooze = useCallback(async () => {
		clearAutoSnooze();
		setProcessing(true);

		const today = new Date().toISOString().split("T")[0];
		try {
			const habit = (state as { status: "ready"; habit: Habit }).habit;
			const scheduledTime = habit.schedule_times[0]?.start_time ?? "00:00";

			const result = await snoozeHabit({
				habit_id: habitId,
				trigger_date: today,
				scheduled_time: scheduledTime,
			});

			if (result.status === "auto_failed") {
				setState({ status: "auto_failed" });
				setTimeout(closeWindow, 2000);
			} else {
				closeWindow();
			}
		} catch (error) {
			console.error("Failed to snooze:", error);
			setProcessing(false);
		}
	}, [habitId, state, clearAutoSnooze, closeWindow]);

	// Auto-snooze timer: fires if no interaction within 2 minutes
	useEffect(() => {
		if (state.status !== "ready") return;

		autoSnoozeRef.current = setTimeout(() => {
			handleSnooze();
		}, AUTO_SNOOZE_MS);

		return clearAutoSnooze;
	}, [state.status, clearAutoSnooze, handleSnooze]);

	if (state.status === "loading") {
		return (
			<OverlayCard>
				<Stack align="center" gap="md" py="xl">
					<Loader size="md" color="teal" />
				</Stack>
			</OverlayCard>
		);
	}

	if (state.status === "error") {
		return (
			<OverlayCard>
				<Stack align="center" gap="md" py="md">
					<Text size="lg">😵</Text>
					<Text size="sm" c="red">
						{state.message}
					</Text>
				</Stack>
			</OverlayCard>
		);
	}

	if (state.status === "auto_failed") {
		return (
			<OverlayCard>
				<Stack align="center" gap="md" py="xl">
					<Text size="xl">😔</Text>
					<Text fw={700} size="lg" ta="center">
						Marked as failed
					</Text>
					<Text size="sm" c="dimmed">
						Too many snoozes — try again next time!
					</Text>
				</Stack>
			</OverlayCard>
		);
	}

	const { habit } = state;

	return (
		<OverlayCard>
			<Stack align="center" gap="lg" py="md">
				<DynamicIcon
					name={habit.icon}
					color={habit.icon_color}
					strokeWidth={habit.icon_stroke_width}
					size={48}
				/>
				<Text fw={800} size="xl" ta="center">
					{habit.name}
				</Text>
				{habit.description ? (
					<Text size="sm" c="dimmed" ta="center">
						{habit.description}
					</Text>
				) : null}
				<Group gap="md" mt="sm">
					<Button
						color="teal"
						radius="xl"
						size="lg"
						onClick={handleDone}
						loading={processing}
					>
						✅ Done
					</Button>
					<Button
						variant="light"
						color="gray"
						radius="xl"
						size="lg"
						onClick={handleSnooze}
						loading={processing}
					>
						💤 Snooze 9 min
					</Button>
				</Group>
			</Stack>
		</OverlayCard>
	);
}

function OverlayCard({ children }: { children: React.ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
				padding: 16,
				background: "transparent",
			}}
		>
			<Card
				shadow="xl"
				padding="xl"
				radius="xl"
				withBorder
				style={{
					width: "100%",
					maxWidth: 360,
					background: "var(--mantine-color-body)",
				}}
			>
				{children}
			</Card>
		</div>
	);
}
