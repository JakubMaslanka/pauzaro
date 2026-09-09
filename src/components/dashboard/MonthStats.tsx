import { Badge, Card, SimpleGrid, Stack, Text } from "@mantine/core";
import { Calendar, CircleCheck, Flame, Snowflake } from "lucide-react";

interface MonthStatsProps {
	daysPracticed: number;
	totalScheduledDays: number;
	streak: number;
	endDate?: string | null;
	frozenDates?: string[];
	currentYear?: number;
	currentMonth?: number;
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

function computeDaysLeft(endDate: string): number | null {
	const now = new Date();
	const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	if (endDate <= todayStr) return 0;

	const [ey, em, ed] = endDate.split("-").map(Number);
	const [ty, tm, td] = todayStr.split("-").map(Number);
	const endMs = new Date(ey, em - 1, ed).getTime();
	const todayMs = new Date(ty, tm - 1, td).getTime();
	return Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24));
}

export function MonthStats({
	daysPracticed,
	totalScheduledDays,
	streak,
	endDate,
	frozenDates = [],
	currentYear,
	currentMonth,
}: MonthStatsProps) {
	const badge = getPerformanceBadge(daysPracticed, totalScheduledDays);
	const daysLeft = endDate ? computeDaysLeft(endDate) : null;
	const showEndDate = daysLeft !== null;

	// Count frozen days in displayed month
	const frozenInMonth =
		currentYear !== undefined && currentMonth !== undefined
			? frozenDates.filter((d) => {
					const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-`;
					return d.startsWith(prefix);
				}).length
			: 0;

	return (
		<Stack gap="xs" align="center">
			<Badge variant="light" color={badge.color} size="lg" radius="xl">
				{badge.label}
			</Badge>
			<SimpleGrid
				cols={showEndDate ? 1 : 2}
				spacing="sm"
				style={{ width: "100%" }}
			>
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
				{showEndDate ? (
					<Card shadow="xs" padding="md" radius="md" withBorder>
						<Stack align="center" gap={4}>
							<Calendar size={24} color="#0d9488" />
							<Text fw={700} size="xl" lh={1}>
								{daysLeft}
							</Text>
							<Text size="xs" c="dimmed">
								Days left
							</Text>
						</Stack>
					</Card>
				) : null}
				{frozenInMonth > 0 ? (
					<Card shadow="xs" padding="md" radius="md" withBorder>
						<Stack align="center" gap={4}>
							<Snowflake size={24} color="#60a5fa" />
							<Text fw={700} size="xl" lh={1}>
								{frozenInMonth}
							</Text>
							<Text size="xs" c="dimmed">
								Days frozen
							</Text>
						</Stack>
					</Card>
				) : null}
			</SimpleGrid>
		</Stack>
	);
}
