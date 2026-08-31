import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import type { Completion } from "../../types";
import { MonthCalendar } from "./MonthCalendar";

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
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("August 2026")).toBeInTheDocument();
	});

	it("renders day-of-week headers", () => {
		render(
			<MonthCalendar
				year={2026}
				month={7}
				completions={[]}
				scheduleDays={[1, 3, 5]}
				slotsPerDay={1}
				habitStartDate="2026-08-01"
				onMonthChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("Su")).toBeInTheDocument();
		expect(screen.getByText("Mo")).toBeInTheDocument();
		expect(screen.getByText("Sa")).toBeInTheDocument();
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
				onMonthChange={onMonthChange}
			/>,
			{ wrapper: Wrapper },
		);
		const prevButton = screen.getByLabelText("Previous month");
		fireEvent.click(prevButton);
		expect(onMonthChange).toHaveBeenCalledWith(2026, 7);
	});
});
