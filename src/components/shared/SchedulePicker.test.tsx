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
	it("renders all day chips", () => {
		render(
			<SchedulePicker
				days={[]}
				times={[{ start_time: "09:00" }]}
				weekStartDay="monday"
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
				times={[{ start_time: "09:00" }]}
				weekStartDay="monday"
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
				times={[{ start_time: "09:00" }]}
				weekStartDay="monday"
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
				times={[{ start_time: "09:00" }]}
				weekStartDay="monday"
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
				times={[{ start_time: "09:00" }]}
				weekStartDay="monday"
				onDaysChange={vi.fn()}
				onTimesChange={onTimesChange}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("+ Add time slot"));
		const newTimes = onTimesChange.mock.calls[0][0];
		expect(newTimes.length).toBe(2);
		// Second slot should not duplicate the first
		const keys = newTimes.map((s: { start_time: string }) => s.start_time);
		expect(new Set(keys).size).toBe(2);
	});

	it("shows duplicate warning for matching time slots", () => {
		render(
			<SchedulePicker
				days={[1]}
				times={[{ start_time: "09:00" }, { start_time: "09:00" }]}
				weekStartDay="monday"
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		const duplicateLabels = screen.getAllByText("Duplicate!");
		expect(duplicateLabels.length).toBeGreaterThan(0);
	});

	it("disables add button when 10 time slots exist", () => {
		const tenSlots = Array.from({ length: 10 }, (_, i) => ({
			start_time: `${String(i + 8).padStart(2, "0")}:00`,
		}));

		render(
			<SchedulePicker
				days={[1]}
				times={tenSlots}
				weekStartDay="monday"
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		const addButton = screen.getByText("+ Add time slot").closest("button");
		expect(addButton).toBeDisabled();
	});

	it("enables add button when fewer than 10 time slots exist", () => {
		const nineSlots = Array.from({ length: 9 }, (_, i) => ({
			start_time: `${String(i + 8).padStart(2, "0")}:00`,
		}));

		render(
			<SchedulePicker
				days={[1]}
				times={nineSlots}
				weekStartDay="monday"
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		const addButton = screen.getByText("+ Add time slot").closest("button");
		expect(addButton).not.toBeDisabled();
	});

	it("renders schedule limit info icon", () => {
		render(
			<SchedulePicker
				days={[1]}
				times={[{ start_time: "09:00" }]}
				weekStartDay="monday"
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		expect(
			screen.getByRole("button", { name: "Schedule limit info" }),
		).toBeInTheDocument();
	});
});

describe("SchedulePicker chip order", () => {
	it("Monday-first: first day label is Mon, last is Sun", () => {
		render(
			<SchedulePicker
				days={[]}
				times={[{ start_time: "09:00" }]}
				weekStartDay="monday"
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		const elements = dayNames.map((name) => screen.getByText(name));
		// Verify render order by DOM position
		for (let i = 0; i < elements.length - 1; i++) {
			const pos = elements[i].compareDocumentPosition(elements[i + 1]);
			// Node.DOCUMENT_POSITION_FOLLOWING = 4
			expect(pos & 4).toBeTruthy();
		}
	});

	it("Sunday-first: first day label is Sun, last is Sat", () => {
		render(
			<SchedulePicker
				days={[]}
				times={[{ start_time: "09:00" }]}
				weekStartDay="sunday"
				onDaysChange={vi.fn()}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const elements = dayNames.map((name) => screen.getByText(name));
		// Verify render order by DOM position
		for (let i = 0; i < elements.length - 1; i++) {
			const pos = elements[i].compareDocumentPosition(elements[i + 1]);
			expect(pos & 4).toBeTruthy();
		}
	});

	it("day toggle sends correct numeric values regardless of display order", () => {
		const onDaysChange = vi.fn();
		render(
			<SchedulePicker
				days={[]}
				times={[{ start_time: "09:00" }]}
				weekStartDay="sunday"
				onDaysChange={onDaysChange}
				onTimesChange={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		// Click "Sun" (first chip in Sunday-first mode, value=0)
		fireEvent.click(screen.getByText("Sun"));
		expect(onDaysChange).toHaveBeenCalledWith([0]);
	});
});
