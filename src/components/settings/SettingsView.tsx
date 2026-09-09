import {
	Checkbox,
	Container,
	Group,
	Stack,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { Power, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getSettings, setAutostart } from "../../lib/invoke";
import type { Settings } from "../../types";
import classes from "./SettingsView.module.css";

export function SettingsView() {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [loading, setLoading] = useState(true);
	const [toggling, setToggling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getSettings()
			.then(setSettings)
			.catch((e) => console.error("Failed to load settings:", e))
			.finally(() => setLoading(false));
	}, []);

	// Sync with tray toggle via Tauri event
	useEffect(() => {
		const unlisten = listen<Settings>("settings-changed", (event) => {
			setSettings(event.payload);
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, []);

	// Listen for autostart errors from tray toggle
	useEffect(() => {
		const unlisten = listen<string>("autostart-error", (event) => {
			setError(event.payload);
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, []);

	const handleToggle = useCallback(async () => {
		if (!settings || toggling) return;

		setToggling(true);
		setError(null);

		try {
			const updated = await setAutostart(!settings.autostart_enabled);
			setSettings(updated);
		} catch (e) {
			const message =
				e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
			setError(
				message.includes("autostart") || message.includes("Autostart")
					? "Could not register login item. Check System Settings > General > Login Items."
					: `Failed to update setting: ${message}`,
			);
		} finally {
			setToggling(false);
		}
	}, [settings, toggling]);

	return (
		<Container size="sm" py="xl">
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<Stack gap="lg">
					<Group gap="sm">
						<SettingsIcon size={28} color="var(--mantine-color-teal-6)" />
						<Title order={2}>Settings</Title>
					</Group>

					{loading ? (
						<Text c="dimmed">Loading settings...</Text>
					) : (
						<UnstyledButton
							onClick={handleToggle}
							disabled={toggling}
							className={classes.card}
							data-checked={settings?.autostart_enabled || undefined}
						>
							<Group wrap="nowrap" align="flex-start" gap="md">
								<Checkbox
									checked={settings?.autostart_enabled ?? false}
									onChange={() => {}}
									tabIndex={-1}
									size="md"
									color="teal"
									className={classes.checkbox}
									aria-hidden
								/>
								<div>
									<Group gap="xs" mb={4}>
										<Power size={16} />
										<Text fw={600} size="sm">
											Launch on startup
										</Text>
									</Group>
									<Text size="sm" c="dimmed">
										Start Pauzaro automatically when you log in to your computer
									</Text>
								</div>
							</Group>
						</UnstyledButton>
					)}

					{error ? (
						<Text size="sm" c="red">
							⚠️ {error}
						</Text>
					) : null}
				</Stack>
			</motion.div>
		</Container>
	);
}
