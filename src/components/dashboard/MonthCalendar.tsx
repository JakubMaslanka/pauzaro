import { ActionIcon, Box, Group, SimpleGrid, Text } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import type { Completion, WeekStartDay } from "../../types";
import { DayCell } from "./DayCell";

interface MonthCalendarProps {
	year: number;
	month: number;
	completions: Completion[];
	scheduleDays: number[];
	slotsPerDay: number;
	habitStartDate: string;
	frozenDates: string[];
	weekStartDay: WeekStartDay;
	onMonthChange: (year: number, month: number) => void;
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

const DAY_HEADERS_SUNDAY: readonly string[] = [
	"Su",
	"Mo",
	"Tu",
	"We",
	"Th",
	"Fr",
	"Sa",
];
const DAY_HEADERS_MONDAY: readonly string[] = [
	"Mo",
	"Tu",
	"We",
	"Th",
	"Fr",
	"Sa",
	"Su",
];

function getDayHeaders(weekStart: WeekStartDay): readonly string[] {
	return weekStart === "sunday" ? DAY_HEADERS_SUNDAY : DAY_HEADERS_MONDAY;
}

interface CalendarDay {
	dayNumber: number;
	isCurrentMonth: boolean;
	date: string;
}

export function buildCalendarGrid(
	year: number,
	month: number,
	weekStart: WeekStartDay = "sunday",
): CalendarDay[] {
	const days: CalendarDay[] = [];

	// First day of month (local)
	const firstOfMonth = new Date(year, month, 1);
	const rawDow = firstOfMonth.getDay();
	// Sunday-first: getDay() directly. Monday-first: shift so Mon=0, Sun=6
	const startDow = weekStart === "sunday" ? rawDow : (rawDow + 6) % 7;

	// Last day of month
	const lastOfMonth = new Date(year, month + 1, 0);
	const daysInMonth = lastOfMonth.getDate();

	// Previous month fill
	if (startDow > 0) {
		const prevLast = new Date(year, month, 0);
		const prevDaysInMonth = prevLast.getDate();
		for (let i = startDow - 1; i >= 0; i--) {
			const d = prevDaysInMonth - i;
			const prevMonth = month === 0 ? 11 : month - 1;
			const prevYear = month === 0 ? year - 1 : year;
			days.push({
				dayNumber: d,
				isCurrentMonth: false,
				date: formatDateString(prevYear, prevMonth, d),
			});
		}
	}

	// Current month
	for (let d = 1; d <= daysInMonth; d++) {
		days.push({
			dayNumber: d,
			isCurrentMonth: true,
			date: formatDateString(year, month, d),
		});
	}

	// Next month fill to complete last week
	const remainder = days.length % 7;
	if (remainder > 0) {
		const fill = 7 - remainder;
		for (let d = 1; d <= fill; d++) {
			const nextMonth = month === 11 ? 0 : month + 1;
			const nextYear = month === 11 ? year + 1 : year;
			days.push({
				dayNumber: d,
				isCurrentMonth: false,
				date: formatDateString(nextYear, nextMonth, d),
			});
		}
	}

	return days;
}

function formatDateString(year: number, month: number, day: number): string {
	const m = String(month + 1).padStart(2, "0");
	const d = String(day).padStart(2, "0");
	return `${year}-${m}-${d}`;
}

function getTodayString(): string {
	const now = new Date();
	return formatDateString(now.getFullYear(), now.getMonth(), now.getDate());
}

type DayCellStatus =
	| "done"
	| "failed"
	| "partial"
	| "frozen"
	| "not-scheduled"
	| "future"
	| "today-pending";

interface DerivedDay {
	date: string;
	dayNumber: number;
	status: DayCellStatus;
	isToday: boolean;
	isCurrentMonth: boolean;
	partialLabel?: string;
	tooltipLabel?: string;
}

function deriveDayStatus(
	dateStr: string,
	isCurrentMonth: boolean,
	completionsByDate: Map<string, Completion[]>,
	scheduleDays: number[],
	slotsPerDay: number,
	todayStr: string,
	habitStartDate: string,
	frozenDates: string[],
): DerivedDay {
	const dayNumber = Number.parseInt(dateStr.slice(8, 10), 10);
	const isToday = dateStr === todayStr;

	if (!isCurrentMonth) {
		return {
			date: dateStr,
			dayNumber,
			status: "not-scheduled",
			isToday: false,
			isCurrentMonth: false,
		};
	}

	// Before habit start date
	if (dateStr < habitStartDate) {
		return {
			date: dateStr,
			dayNumber,
			status: "not-scheduled",
			isToday,
			isCurrentMonth: true,
		};
	}

	// Determine day-of-week from date string (local)
	const [y, m, d] = dateStr.split("-").map(Number);
	const dateObj = new Date(y, m - 1, d);
	const dow = dateObj.getDay();

	if (!scheduleDays.includes(dow)) {
		return {
			date: dateStr,
			dayNumber,
			status: "not-scheduled",
			isToday,
			isCurrentMonth: true,
		};
	}

	// Future date
	if (dateStr > todayStr) {
		return {
			date: dateStr,
			dayNumber,
			status: "future",
			isToday: false,
			isCurrentMonth: true,
		};
	}

	// Frozen day — streak freeze was consumed
	if (frozenDates.includes(dateStr)) {
		return {
			date: dateStr,
			dayNumber,
			status: "frozen",
			isToday,
			isCurrentMonth: true,
			tooltipLabel: "❄️ Streak freeze used",
		};
	}

	// Today with no completions yet
	const dayCompletions = completionsByDate.get(dateStr) ?? [];
	if (isToday && dayCompletions.length === 0) {
		return {
			date: dateStr,
			dayNumber,
			status: "today-pending",
			isToday: true,
			isCurrentMonth: true,
		};
	}

	const doneCount = dayCompletions.filter((c) => c.status === "done").length;

	if (doneCount >= slotsPerDay) {
		return {
			date: dateStr,
			dayNumber,
			status: "done",
			isToday,
			isCurrentMonth: true,
			tooltipLabel: `${doneCount}/${slotsPerDay} completed ✅`,
		};
	}

	if (doneCount > 0) {
		return {
			date: dateStr,
			dayNumber,
			status: "partial",
			isToday,
			isCurrentMonth: true,
			partialLabel: `${doneCount}/${slotsPerDay}`,
			tooltipLabel: `${doneCount}/${slotsPerDay} completed`,
		};
	}

	// Has completions but none done (all failed) or no completions on a past scheduled day
	if (dayCompletions.length > 0 || dateStr < todayStr) {
		return {
			date: dateStr,
			dayNumber,
			status: "failed",
			isToday,
			isCurrentMonth: true,
			tooltipLabel: `0/${slotsPerDay} completed`,
		};
	}

	return {
		date: dateStr,
		dayNumber,
		status: "today-pending",
		isToday,
		isCurrentMonth: true,
	};
}

export function MonthCalendar({
	year,
	month,
	completions,
	scheduleDays,
	slotsPerDay,
	habitStartDate,
	frozenDates,
	weekStartDay,
	onMonthChange,
}: MonthCalendarProps) {
	const todayStr = getTodayString();

	const completionsByDate = useMemo(() => {
		const map = new Map<string, Completion[]>();
		for (const c of completions) {
			const existing = map.get(c.trigger_date) ?? [];
			existing.push(c);
			map.set(c.trigger_date, existing);
		}
		return map;
	}, [completions]);

	const dayHeaders = useMemo(() => getDayHeaders(weekStartDay), [weekStartDay]);

	const calendarDays = useMemo(
		() => buildCalendarGrid(year, month, weekStartDay),
		[year, month, weekStartDay],
	);

	const derivedDays = useMemo(
		() =>
			calendarDays.map((day) =>
				deriveDayStatus(
					day.date,
					day.isCurrentMonth,
					completionsByDate,
					scheduleDays,
					slotsPerDay,
					todayStr,
					habitStartDate,
					frozenDates,
				),
			),
		[
			calendarDays,
			completionsByDate,
			scheduleDays,
			slotsPerDay,
			todayStr,
			habitStartDate,
			frozenDates,
		],
	);

	// Navigation bounds
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();
	const isCurrentMonth = year === currentYear && month === currentMonth;

	const [startY, startM] = habitStartDate.split("-").map(Number);
	const habitStartYear = startY;
	const habitStartMonth = startM - 1;
	const isAtStart = year === habitStartYear && month === habitStartMonth;

	const canGoBack = !isAtStart;
	const canGoForward = !isCurrentMonth;

	function handlePrev() {
		if (!canGoBack) return;
		if (month === 0) {
			onMonthChange(year - 1, 11);
		} else {
			onMonthChange(year, month - 1);
		}
	}

	function handleNext() {
		if (!canGoForward) return;
		if (month === 11) {
			onMonthChange(year + 1, 0);
		} else {
			onMonthChange(year, month + 1);
		}
	}

	return (
		<Box>
			<Group justify="space-between" mb="sm">
				<ActionIcon
					variant="subtle"
					color="teal"
					size="lg"
					radius="xl"
					onClick={handlePrev}
					disabled={!canGoBack}
					aria-label="Previous month"
				>
					<ChevronLeft size={20} />
				</ActionIcon>
				<Text fw={700} size="lg">
					{MONTH_NAMES[month]} {year}
				</Text>
				<ActionIcon
					variant="subtle"
					color="teal"
					size="lg"
					radius="xl"
					onClick={handleNext}
					disabled={!canGoForward}
					aria-label="Next month"
				>
					<ChevronRight size={20} />
				</ActionIcon>
			</Group>

			<SimpleGrid cols={7} spacing={0}>
				{dayHeaders.map((label) => (
					<Box
						key={label}
						style={{
							display: "flex",
							justifyContent: "center",
							paddingBottom: 4,
						}}
					>
						<Text size="xs" fw={600} c="dimmed">
							{label}
						</Text>
					</Box>
				))}
				{derivedDays.map((day) => (
					<Box
						key={day.date}
						style={{ display: "flex", justifyContent: "center" }}
					>
						<DayCell
							dayNumber={day.dayNumber}
							status={day.status}
							isToday={day.isToday}
							isCurrentMonth={day.isCurrentMonth}
							partialLabel={day.partialLabel}
							tooltipLabel={day.tooltipLabel}
						/>
					</Box>
				))}
			</SimpleGrid>
		</Box>
	);
}
