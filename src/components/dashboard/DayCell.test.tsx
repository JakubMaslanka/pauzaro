import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { theme } from "../../theme";
import { DayCell } from "./DayCell";

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

describe("DayCell", () => {
	it("renders done status with CircleCheck icon", () => {
		const { container } = render(
			<DayCell
				dayNumber={15}
				status="done"
				isToday={false}
				isCurrentMonth={true}
			/>,
			{ wrapper: Wrapper },
		);
		const svg = container.querySelector("svg");
		expect(svg).toBeTruthy();
	});

	it("renders failed status with CircleX icon", () => {
		const { container } = render(
			<DayCell
				dayNumber={10}
				status="failed"
				isToday={false}
				isCurrentMonth={true}
			/>,
			{ wrapper: Wrapper },
		);
		const svg = container.querySelector("svg");
		expect(svg).toBeTruthy();
	});

	it("renders partial status with fraction label", () => {
		render(
			<DayCell
				dayNumber={12}
				status="partial"
				isToday={false}
				isCurrentMonth={true}
				partialLabel="2/3"
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("2/3")).toBeInTheDocument();
	});

	it("renders not-scheduled status as dimmed day number", () => {
		render(
			<DayCell
				dayNumber={7}
				status="not-scheduled"
				isToday={false}
				isCurrentMonth={true}
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("7")).toBeInTheDocument();
	});

	it("renders future status with day number", () => {
		render(
			<DayCell
				dayNumber={28}
				status="future"
				isToday={false}
				isCurrentMonth={true}
			/>,
			{ wrapper: Wrapper },
		);
		expect(screen.getByText("28")).toBeInTheDocument();
	});

	it("renders today-pending with bold day number", () => {
		render(
			<DayCell
				dayNumber={31}
				status="today-pending"
				isToday={true}
				isCurrentMonth={true}
			/>,
			{ wrapper: Wrapper },
		);
		const text = screen.getByText("31");
		expect(text).toBeInTheDocument();
	});

	it("renders muted day number for out-of-month days", () => {
		render(
			<DayCell
				dayNumber={2}
				status="not-scheduled"
				isToday={false}
				isCurrentMonth={false}
			/>,
			{ wrapper: Wrapper },
		);
		const text = screen.getByText("2");
		expect(text).toBeInTheDocument();
		expect(text.style.opacity).toBe("0.3");
	});
});
