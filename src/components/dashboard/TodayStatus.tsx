import { ActionIcon, Badge, Group, Text, Tooltip } from "@mantine/core";
import { RotateCcw } from "lucide-react";
import type { HabitStatus } from "../../types";

interface TodayStatusProps {
	habitStatus: HabitStatus;
	onMarkDone: (scheduledTime: string) => void;
}

const STATUS_ICONS: Record<string, string> = {
	done: "✅",
	pending: "⏳",
	failed: "❌",
};

export function TodayStatus({ habitStatus, onMarkDone }: TodayStatusProps) {
	if (habitStatus.today_slots.length === 0) {
		return null;
	}

	return (
		<Group gap="sm" mt="xs" align="center">
			{habitStatus.today_slots.map((slot) => (
				<Group key={slot.scheduled_time} gap={4} align="center">
					<Text size="xs" c="dimmed">
						{slot.scheduled_time}
					</Text>
					<Text size="sm">{STATUS_ICONS[slot.status] ?? "⏳"}</Text>
					{slot.status === "failed" ? (
						<Tooltip label="Mark as done (override)">
							<ActionIcon
								variant="subtle"
								color="teal"
								size="xs"
								radius="xl"
								aria-label="Mark as done"
								style={{ opacity: 0.5 }}
								onClick={() => onMarkDone(slot.scheduled_time)}
							>
								<RotateCcw size={12} />
							</ActionIcon>
						</Tooltip>
					) : null}
				</Group>
			))}
			<Badge
				variant="light"
				color="teal"
				size="sm"
				radius="xl"
				leftSection="🔥"
			>
				{habitStatus.streak}
			</Badge>
		</Group>
	);
}
