import { Button, Container, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { Bug } from "lucide-react";

export function DebugView() {
	const handleTriggerOverlay = () => {
		console.info("[debug] Overlay trigger — not yet wired");
	};

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
						leftSection={<Bug size={16} />}
					>
						Show Overlay Window
					</Button>
				</Stack>
			</motion.div>
		</Container>
	);
}
