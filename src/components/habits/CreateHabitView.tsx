import { Container, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

export function CreateHabitView() {
	return (
		<Container size="sm" py="xl">
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<Stack align="center" gap="md" py={80}>
					<Plus size={48} color="var(--mantine-color-teal-6)" />
					<Title order={2}>Create Habit</Title>
					<Text c="dimmed" ta="center">
						Full creation wizard coming in Phase 6 🧙
					</Text>
				</Stack>
			</motion.div>
		</Container>
	);
}
