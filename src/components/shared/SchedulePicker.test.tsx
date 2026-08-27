import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import { SchedulePicker } from "./SchedulePicker";

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

describe("SchedulePicker", () => {
	it("renders all day buttons", () => {
		render(
			<SchedulePicker
				days={[]}
				times={[{ start_time: "09:00", end_time: "09:15" }]}
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
			expect(screen.getByText(day)).toBeInTheDocument();
		}
	});

	it("toggles day selection", () => {
		const onDaysChange = vi.fn();
		render(
			<SchedulePicker
				days={[1, 3]}
				times={[{ start_time: "09:00", end_time: "09:15" }]}
				onDaysChange={onDaysChange}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("Fri"));
		expect(onDaysChange).toHaveBeenCalledWith([1, 3, 5]);
	});

	it("removes day on second click", () => {
		const onDaysChange = vi.fn();
		render(
			<SchedulePicker
				days={[1, 3, 5]}
				times={[{ start_time: "09:00", end_time: "09:15" }]}
				onDaysChange={onDaysChange}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("Wed"));
		expect(onDaysChange).toHaveBeenCalledWith([1, 5]);
	});

	it("adds time slot", () => {
		const onTimesChange = vi.fn();
		render(
			<SchedulePicker
				days={[1]}
				times={[{ start_time: "09:00", end_time: "09:15" }]}
				onDaysChange={vi.fn()}
				onTimesChange={onTimesChange}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("+ Add time slot"));
		expect(onTimesChange).toHaveBeenCalled();
		const newTimes = onTimesChange.mock.calls[0][0];
		expect(newTimes.length).toBe(2);
	});

	it("adds non-duplicate time slot when default already exists", () => {
		const onTimesChange = vi.fn();
		render(
			<SchedulePicker
				days={[1]}
				times={[{ start_time: "09:00", end_time: "09:15" }]}
				onDaysChange={vi.fn()}
				onTimesChange={onTimesChange}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("+ Add time slot"));
		const newTimes = onTimesChange.mock.calls[0][0];
		expect(newTimes.length).toBe(2);
		// Second slot should not duplicate the first
		const keys = newTimes.map(
			(s: { start_time: string; end_time: string }) =>
				`${s.start_time}-${s.end_time}`,
		);
		expect(new Set(keys).size).toBe(2);
	});

	it("shows duplicate warning for matching time slots", () => {
		render(
			<SchedulePicker
				days={[1]}
				times={[
					{ start_time: "09:00", end_time: "09:15" },
					{ start_time: "09:00", end_time: "09:15" },
				]}
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		const duplicateLabels = screen.getAllByText("Duplicate!");
		expect(duplicateLabels.length).toBeGreaterThan(0);
	});
});
