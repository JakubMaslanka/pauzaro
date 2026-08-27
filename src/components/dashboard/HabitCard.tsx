import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { motion } from "framer-motion";
import type { Habit } from "../../types";
import { DynamicIcon } from "../shared/DynamicIcon";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatScheduleSummary(habit: Habit): string {
	const days = habit.schedule_days
		.slice()
		.sort((a, b) => a - b)
		.map((d) => DAY_LABELS[d])
		.join(", ");

	const times = habit.schedule_times
		.map((t) => `${t.start_time}–${t.end_time}`)
		.join(", ");

	return `${days} · ${times}`;
}

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
						<Badge
							variant="light"
							color="teal"
							size="sm"
							radius="xl"
							style={{ alignSelf: "flex-start" }}
						>
							📅 {formatScheduleSummary(habit)}
						</Badge>
					</Stack>
				</Group>
			</Card>
		</motion.div>
	);
}
