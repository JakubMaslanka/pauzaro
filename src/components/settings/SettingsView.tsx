import { Container, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";

export function SettingsView() {
	return (
		<Container size="sm" py="xl">
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<Stack align="center" gap="md" py={80}>
					<Settings size={48} color="var(--mantine-color-gray-5)" />
					<Title order={2} c="dimmed">
						Settings
					</Title>
					<Text c="dimmed" ta="center">
						Coming soon! 🚧
					</Text>
				</Stack>
			</motion.div>
		</Container>
	);
}
