import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { CircleCheck, Flame } from "lucide-react";

interface MonthStatsProps {
	daysPracticed: number;
	totalScheduledDays: number;
	streak: number;
}

function getPerformanceBadge(
	daysPracticed: number,
	totalScheduledDays: number,
) {
	if (totalScheduledDays === 0) {
		return { label: "NO DATA", color: "gray" };
	}
	const ratio = daysPracticed / totalScheduledDays;
	if (ratio > 0.8) return { label: "GREAT", color: "teal" };
	if (ratio >= 0.5) return { label: "GOOD", color: "orange" };
	return { label: "KEEP GOING", color: "gray" };
}

export function MonthStats({
	daysPracticed,
	totalScheduledDays,
	streak,
}: MonthStatsProps) {
	const badge = getPerformanceBadge(daysPracticed, totalScheduledDays);

	return (
		<Stack gap="xs" align="center">
			<Badge variant="light" color={badge.color} size="lg" radius="xl">
				{badge.label}
			</Badge>
			<Group gap="sm" grow style={{ width: "100%" }}>
				<Card shadow="xs" padding="md" radius="md" withBorder>
					<Stack align="center" gap={4}>
						<CircleCheck size={24} color="#0d9488" />
						<Text fw={700} size="xl" lh={1}>
							{daysPracticed}
						</Text>
						<Text size="xs" c="dimmed">
							Days practiced
						</Text>
					</Stack>
				</Card>
				<Card shadow="xs" padding="md" radius="md" withBorder>
					<Stack align="center" gap={4}>
						<Flame size={24} color="#E28743" />
						<Text fw={700} size="xl" lh={1}>
							{streak}
						</Text>
						<Text size="xs" c="dimmed">
							Day streak
						</Text>
					</Stack>
				</Card>
			</Group>
		</Stack>
	);
}
