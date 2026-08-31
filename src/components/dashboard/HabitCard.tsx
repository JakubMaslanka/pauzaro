import { Card, Group, Stack, Text } from "@mantine/core";
import { motion } from "framer-motion";
import type { Habit } from "../../types";
import { DynamicIcon } from "../shared/DynamicIcon";

interface HabitCardProps {
	habit: Habit;
}

export function HabitCard({ habit }: HabitCardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ type: "spring", stiffness: 300, damping: 24 }}
		>
			<Card shadow="sm" padding="lg" radius="lg" withBorder>
				<Group gap="md" wrap="nowrap">
					<DynamicIcon
						name={habit.icon}
						color={habit.icon_color}
						strokeWidth={habit.icon_stroke_width}
						size={36}
					/>
					<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
						<Text fw={700} size="lg" truncate>
							{habit.name}
						</Text>
						{habit.description ? (
							<Text size="sm" c="dimmed" lineClamp={2}>
								{habit.description}
							</Text>
						) : null}
					</Stack>
				</Group>
			</Card>
		</motion.div>
	);
}
