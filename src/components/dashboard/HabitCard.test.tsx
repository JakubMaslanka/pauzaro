import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { theme } from "../../theme";
import type { Habit } from "../../types";
import { HabitCard } from "./HabitCard";

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

const MOCK_HABIT: Habit = {
	id: "habit-1",
	name: "Stretch Break",
	description: "Stand up and stretch for a few minutes",
	icon: "Dumbbell",
	icon_color: "#0d9488",
	icon_stroke_width: 2,
	start_date: "2026-08-27",
	end_date: null,
	is_active: true,
	created_at: "2026-08-27T10:00:00Z",
	schedule_days: [1, 3, 5],
	schedule_times: [{ start_time: "10:00" }],
};

describe("HabitCard", () => {
	it("renders habit name", () => {
		render(<HabitCard habit={MOCK_HABIT} />, { wrapper: Wrapper });
		expect(screen.getByText("Stretch Break")).toBeInTheDocument();
	});

	it("renders habit description", () => {
		render(<HabitCard habit={MOCK_HABIT} />, { wrapper: Wrapper });
		expect(
			screen.getByText("Stand up and stretch for a few minutes"),
		).toBeInTheDocument();
	});

	it("renders schedule summary with days and times", () => {
		render(<HabitCard habit={MOCK_HABIT} />, { wrapper: Wrapper });
		expect(screen.getByText("📅 Mon, Wed, Fri · 10:00")).toBeInTheDocument();
	});

	it("handles habit without description", () => {
		const noDesc = { ...MOCK_HABIT, description: "" };
		render(<HabitCard habit={noDesc} />, { wrapper: Wrapper });
		expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		expect(
			screen.queryByText("Stand up and stretch for a few minutes"),
		).not.toBeInTheDocument();
	});

	it("renders multiple time slots in summary", () => {
		const multiTime = {
			...MOCK_HABIT,
			schedule_times: [{ start_time: "09:00" }, { start_time: "14:00" }],
		};
		render(<HabitCard habit={multiTime} />, { wrapper: Wrapper });
		expect(
			screen.getByText("📅 Mon, Wed, Fri · 09:00, 14:00"),
		).toBeInTheDocument();
	});
});
