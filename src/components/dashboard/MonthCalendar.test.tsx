import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import type { Completion } from "../../types";
import { buildCalendarGrid, MonthCalendar } from "./MonthCalendar";

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

function makeCompletion(
	date: string,
	time: string,
	status: "done" | "failed",
): Completion {
	return {
		id: `c-${date}-${time}`,
		habit_id: "h1",
		trigger_date: date,
		scheduled_time: time,
		status,
		completed_at: `${date}T${time}:00`,
	};
}

describe("MonthCalendar", () => {
	it("renders month name and year in header", () => {
		render(
			<MonthCalendar
				year={2026}
				month={7}
				completions={[]}
				scheduleDays={[1, 3, 5]}
				slotsPerDay={1}
				habitStartDate="2026-08-01"
				frozenDates={[]}
				weekStartDay="sunday"
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("August 2026")).toBeInTheDocument();
	});

	it("renders Sunday-first day headers", () => {
		render(
			<MonthCalendar
				year={2026}
				month={7}
				completions={[]}
				scheduleDays={[1, 3, 5]}
				slotsPerDay={1}
				habitStartDate="2026-08-01"
				frozenDates={[]}
				weekStartDay="sunday"
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		const headers = screen.getAllByText(/^(Su|Mo|Tu|We|Th|Fr|Sa)$/);
		expect(headers[0]).toHaveTextContent("Su");
		expect(headers[6]).toHaveTextContent("Sa");
	});

	it("renders Monday-first day headers", () => {
		render(
			<MonthCalendar
				year={2026}
				month={7}
				completions={[]}
				scheduleDays={[1, 3, 5]}
				slotsPerDay={1}
				habitStartDate="2026-08-01"
				frozenDates={[]}
				weekStartDay="monday"
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		const headers = screen.getAllByText(/^(Su|Mo|Tu|We|Th|Fr|Sa)$/);
		expect(headers[0]).toHaveTextContent("Mo");
		expect(headers[6]).toHaveTextContent("Su");
	});

	it("derives done status from completions", () => {
		const completions: Completion[] = [
			makeCompletion("2026-08-03", "10:00", "done"),
		];
		// Aug 3, 2026 is Monday (dow=1), schedule includes Monday
		const { container } = render(
			<MonthCalendar
				year={2026}
				month={7}
				completions={completions}
				scheduleDays={[1]}
				slotsPerDay={1}
				habitStartDate="2026-08-01"
				frozenDates={[]}
				weekStartDay="sunday"
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		// Should render a CircleCheck icon (svg) for done day
		const svgs = container.querySelectorAll("svg");
		// At least navigation chevrons (2) + done icon (1)
		expect(svgs.length).toBeGreaterThanOrEqual(3);
	});

	it("derives partial status for incomplete multi-slot day", () => {
		const completions: Completion[] = [
			makeCompletion("2026-08-03", "10:00", "done"),
			// Second slot missing
		];
		render(
			<MonthCalendar
				year={2026}
				month={7}
				completions={completions}
				scheduleDays={[1]}
				slotsPerDay={2}
				habitStartDate="2026-08-01"
				frozenDates={[]}
				weekStartDay="sunday"
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("1/2")).toBeInTheDocument();
	});

	it("disables previous button when at habit start month", () => {
		render(
			<MonthCalendar
				year={2026}
				month={7}
				completions={[]}
				scheduleDays={[1, 3, 5]}
				slotsPerDay={1}
				habitStartDate="2026-08-01"
				frozenDates={[]}
				weekStartDay="sunday"
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		const prevButton = screen.getByLabelText("Previous month");
		expect(prevButton).toBeDisabled();
	});

	it("calls onMonthChange when navigating back", () => {
		const onMonthChange = vi.fn();
		render(
			<MonthCalendar
				year={2026}
				month={8}
				completions={[]}
				scheduleDays={[1, 3, 5]}
				slotsPerDay={1}
				habitStartDate="2026-08-01"
				frozenDates={[]}
				weekStartDay="sunday"
				onMonthChange={onMonthChange}
			/>,
			{ wrapper: Wrapper },
		);
		const prevButton = screen.getByLabelText("Previous month");
		fireEvent.click(prevButton);
		expect(onMonthChange).toHaveBeenCalledWith(2026, 7);
	});
});

describe("buildCalendarGrid", () => {
	it("grid length is always a multiple of 7", () => {
		for (let month = 0; month < 12; month++) {
			const sundayGrid = buildCalendarGrid(2026, month, "sunday");
			const mondayGrid = buildCalendarGrid(2026, month, "monday");
			expect(sundayGrid.length % 7).toBe(0);
			expect(mondayGrid.length % 7).toBe(0);
		}
	});

	// September 2026 starts on Tuesday (getDay()=2)
	it("September 2026 Sunday-first: 2 padding cells", () => {
		const grid = buildCalendarGrid(2026, 8, "sunday");
		// Tuesday getDay()=2 means 2 cells before day 1
		const firstCurrentIdx = grid.findIndex((d) => d.isCurrentMonth);
		expect(firstCurrentIdx).toBe(2);
	});

	it("September 2026 Monday-first: 1 padding cell", () => {
		const grid = buildCalendarGrid(2026, 8, "monday");
		// Tuesday (getDay()=2), shifted: (2+6)%7=1, so 1 padding cell
		const firstCurrentIdx = grid.findIndex((d) => d.isCurrentMonth);
		expect(firstCurrentIdx).toBe(1);
	});

	// November 2026 starts on Sunday (getDay()=0)
	it("month starting on Sunday: Sunday-first has 0 padding, Monday-first has 6", () => {
		const sundayGrid = buildCalendarGrid(2026, 10, "sunday");
		const mondayGrid = buildCalendarGrid(2026, 10, "monday");

		const sundayFirstCurrent = sundayGrid.findIndex((d) => d.isCurrentMonth);
		const mondayFirstCurrent = mondayGrid.findIndex((d) => d.isCurrentMonth);

		expect(sundayFirstCurrent).toBe(0);
		expect(mondayFirstCurrent).toBe(6);
	});

	// June 2026 starts on Monday (getDay()=1)
	it("month starting on Monday: Sunday-first has 1 padding, Monday-first has 0", () => {
		const sundayGrid = buildCalendarGrid(2026, 5, "sunday");
		const mondayGrid = buildCalendarGrid(2026, 5, "monday");

		const sundayFirstCurrent = sundayGrid.findIndex((d) => d.isCurrentMonth);
		const mondayFirstCurrent = mondayGrid.findIndex((d) => d.isCurrentMonth);

		expect(sundayFirstCurrent).toBe(1);
		expect(mondayFirstCurrent).toBe(0);
	});

	it("all current-month days present in both modes", () => {
		// September 2026 has 30 days
		const sundayGrid = buildCalendarGrid(2026, 8, "sunday");
		const mondayGrid = buildCalendarGrid(2026, 8, "monday");

		const sundayCurrent = sundayGrid.filter((d) => d.isCurrentMonth);
		const mondayCurrent = mondayGrid.filter((d) => d.isCurrentMonth);

		expect(sundayCurrent.length).toBe(30);
		expect(mondayCurrent.length).toBe(30);
	});
});
