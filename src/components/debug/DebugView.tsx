import { Button, Container, Stack, Text, Title } from "@mantine/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { motion } from "framer-motion";
import { Bug, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { listHabits } from "../../lib/invoke";

export function DebugView() {
	const [status, setStatus] = useState<string>("");

	const handleTriggerOverlay = useCallback(async () => {
		try {
			const habits = await listHabits();
			if (habits.length === 0) {
				setStatus("No habits found — create one first!");
				return;
			}

			const habit = habits[0];
			const now = new Date();
			const triggerDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
			const scheduledTime = habit.schedule_times[0]?.start_time ?? "10:00";
			const label = `overlay-${habit.id}`;

			const url = `/overlay/${habit.id}?triggerDate=${triggerDate}&scheduledTime=${scheduledTime}`;

			const webview = new WebviewWindow(label, {
				url,
				title: "Pauzaro",
				width: 420,
				height: 380,
				alwaysOnTop: true,
				center: true,
				decorations: false,
				transparent: true,
			});

			webview.once("tauri://error", (e) => {
				console.error("Overlay window error:", e);
				setStatus(`Error: ${String(e.payload)}`);
			});

			setStatus(`Overlay opened for "${habit.name}"`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("Failed to trigger overlay:", message);
			setStatus(`Error: ${message}`);
		}
	}, []);

	return (
		<Container size="sm" py="xl">
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<Stack gap="md">
					<Stack align="center" gap="xs">
						<Bug size={48} color="var(--mantine-color-gray-5)" />
						<Title order={2} c="dimmed">
							Debug Panel
						</Title>
						<Text c="dimmed" size="sm">
							Dev-only tools 🛠️
						</Text>
					</Stack>

					<Button
						variant="outline"
						color="teal"
						onClick={handleTriggerOverlay}
						leftSection={<Play size={16} />}
					>
						Show Overlay Window
					</Button>

					{status ? (
						<Text size="sm" c="dimmed" ta="center">
							{status}
						</Text>
					) : null}
				</Stack>
			</motion.div>
		</Container>
	);
}
