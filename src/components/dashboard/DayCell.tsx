import { Box, Text, Tooltip } from "@mantine/core";
import { CircleCheck, CircleX, Snowflake } from "lucide-react";

type DayCellStatus =
	| "done"
	| "failed"
	| "partial"
	| "frozen"
	| "not-scheduled"
	| "future"
	| "today-pending";

interface DayCellProps {
	dayNumber: number;
	status: DayCellStatus;
	isToday: boolean;
	isCurrentMonth: boolean;
	partialLabel?: string;
	tooltipLabel?: string;
}

const STATUS_CONFIG: Record<
	DayCellStatus,
	{
		bg: string;
		icon: React.ComponentType<{ size: number; color: string }> | null;
		outline?: boolean;
	}
> = {
	done: { bg: "#0d9488", icon: CircleCheck },
	failed: { bg: "#e03131", icon: CircleX },
	partial: { bg: "#E28743", icon: null },
	frozen: { bg: "#60a5fa", icon: Snowflake },
	"not-scheduled": { bg: "transparent", icon: null },
	future: { bg: "transparent", icon: null, outline: true },
	"today-pending": { bg: "transparent", icon: null, outline: true },
};

export function DayCell({
	dayNumber,
	status,
	isToday,
	isCurrentMonth,
	partialLabel,
	tooltipLabel,
}: DayCellProps) {
	if (!isCurrentMonth) {
		return (
			<Box
				style={{
					width: 40,
					height: 44,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Text size="xs" c="dimmed" style={{ opacity: 0.3 }}>
					{dayNumber}
				</Text>
			</Box>
		);
	}

	const config = STATUS_CONFIG[status];
	const hasIcon = config.icon !== null;
	const IconComponent = config.icon;
	const isPartial = status === "partial";
	const showTooltip =
		tooltipLabel &&
		(status === "done" ||
			status === "failed" ||
			status === "frozen" ||
			isPartial);

	const todayBorder = isToday ? "2px solid #0d9488" : "none";
	const todayShadow = isToday ? "0 0 0 2px rgba(13,148,136,0.25)" : "none";

	const cell = (
		<Box
			style={{
				width: 40,
				height: 44,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				position: "relative",
				cursor: showTooltip ? "default" : undefined,
			}}
		>
			{hasIcon && IconComponent ? (
				<Box
					style={{
						width: 32,
						height: 32,
						borderRadius: "50%",
						backgroundColor: config.bg,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						border: todayBorder,
						boxShadow: todayShadow,
					}}
				>
					<IconComponent size={18} color="white" />
				</Box>
			) : isPartial ? (
				<Box
					style={{
						width: 32,
						height: 32,
						borderRadius: "50%",
						backgroundColor: config.bg,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						border: todayBorder,
						boxShadow: todayShadow,
					}}
				>
					<Text size="xs" fw={700} c="white" lh={1}>
						{partialLabel}
					</Text>
				</Box>
			) : (
				<Box
					style={{
						width: 32,
						height: 32,
						borderRadius: "50%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						border:
							isToday || config.outline
								? `2px ${isToday ? "solid" : "dashed"} ${isToday ? "#0d9488" : "#c4b090"}`
								: "none",
					}}
				>
					<Text
						size="sm"
						fw={isToday ? 700 : 400}
						c={status === "not-scheduled" ? "dimmed" : undefined}
					>
						{dayNumber}
					</Text>
				</Box>
			)}
		</Box>
	);

	if (showTooltip) {
		return (
			<Tooltip
				label={tooltipLabel}
				position="top"
				withArrow
				transitionProps={{ duration: 150 }}
			>
				{cell}
			</Tooltip>
		);
	}

	return cell;
}
