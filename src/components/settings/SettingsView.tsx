import {
	Checkbox,
	Container,
	Group,
	Stack,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { Power, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settings";
import classes from "./SettingsView.module.css";

export function SettingsView() {
	const autostartEnabled = useSettingsStore((s) => s.autostartEnabled);
	const loaded = useSettingsStore((s) => s.loaded);

	const [toggling, setToggling] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState("");

	useEffect(() => {
		getVersion()
			.then(setVersion)
			.catch(() => setVersion(""));
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
		if (toggling) return;

		setToggling(true);
		setError(null);

		try {
			await useSettingsStore.getState().setAutostart(!autostartEnabled);
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
	}, [autostartEnabled, toggling]);

	return (
		<Container size="sm" py="xl">
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className={classes.wrapper}
			>
				<Stack gap="lg" className={classes.content}>
					<Group gap="sm">
						<SettingsIcon size={28} color="var(--mantine-color-teal-6)" />
						<Title order={2}>Settings</Title>
					</Group>

					{!loaded ? (
						<Text c="dimmed">Loading settings...</Text>
					) : (
						<UnstyledButton
							onClick={handleToggle}
							disabled={toggling}
							className={classes.card}
							data-checked={autostartEnabled || undefined}
						>
							<Group wrap="nowrap" align="flex-start" gap="md">
								<Checkbox
									checked={autostartEnabled}
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

				{version ? (
					<div className={classes.versionFooter}>
						<Text size="xs" c="dimmed">
							Pauzaro v{version}
						</Text>
					</div>
				) : null}
			</motion.div>
		</Container>
	);
}
