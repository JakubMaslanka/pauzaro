import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardStore } from "../../stores/dashboard";
import { theme } from "../../theme";
import { Dashboard } from "./Dashboard";

const mockListHabits = vi.fn();
const mockGetAllHabitStatuses = vi.fn();
const mockGetMonthCompletions = vi.fn();

vi.mock("../../lib/invoke", () => ({
	getUserProfile: vi.fn(),
	listHabits: (...args: unknown[]) => mockListHabits(...args),
	getHabitStatus: vi.fn(),
	getAllHabitStatuses: (...args: unknown[]) => mockGetAllHabitStatuses(...args),
	getMonthCompletions: (...args: unknown[]) => mockGetMonthCompletions(...args),
	markDone: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
	listen: vi.fn(() => Promise.resolve(() => {})),
}));

afterEach(() => {
	useDashboardStore.setState({ habits: [], activeHabitId: null });
});

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

const MOCK_HABIT = {
	id: "h1",
	name: "Stretch Break",
	description: "Stand up and stretch",
	icon: "Dumbbell",
	icon_color: "#0d9488",
	icon_stroke_width: 2,
	start_date: "2026-08-01",
	end_date: null,
	is_active: true,
	created_at: "2026-08-01T10:00:00Z",
	schedule_days: [1, 3, 5],
	schedule_times: [{ start_time: "10:00" }],
};

describe("Dashboard", () => {
	it("shows loading state initially", () => {
		mockListHabits.mockReturnValue(new Promise(() => {}));
		mockGetAllHabitStatuses.mockReturnValue(new Promise(() => {}));

		render(<Dashboard />, { wrapper: Wrapper });
		expect(screen.getByText("Loading your habits...")).toBeInTheDocument();
	});

	it("renders streak hero and calendar after load", async () => {
		mockListHabits.mockResolvedValue([MOCK_HABIT]);
		mockGetAllHabitStatuses.mockResolvedValue([
			{
				habit_id: "h1",
				streak: 5,
				today_slots: [],
				today_date: "2026-08-31",
			},
		]);
		mockGetMonthCompletions.mockResolvedValue([]);
		useDashboardStore.getState().setHabits([MOCK_HABIT]);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		});
		// Streak hero shows streak message tier
		expect(screen.getByText("Building momentum!")).toBeInTheDocument();
		// Streak number appears (multiple elements have "5" — hero + stats + calendar day)
		expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
		// MonthStats shows days practiced
		expect(screen.getByText("Days practiced")).toBeInTheDocument();
		expect(screen.getByText("Day streak")).toBeInTheDocument();
		// Calendar day-of-week headers
		expect(screen.getByText("Su")).toBeInTheDocument();
		expect(screen.getByText("Mo")).toBeInTheDocument();
	});

	it("shows empty state when no habits", async () => {
		mockListHabits.mockResolvedValue([]);
		mockGetAllHabitStatuses.mockResolvedValue([]);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(
				screen.getByText("No habits yet — let's fix that! 🚀"),
			).toBeInTheDocument();
		});
	});

	it("shows error state on failure", async () => {
		mockListHabits.mockRejectedValue(new Error("DB connection failed"));
		mockGetAllHabitStatuses.mockResolvedValue([]);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(screen.getByText("DB connection failed")).toBeInTheDocument();
		});
	});

	it("renders performance badge based on completions", async () => {
		mockListHabits.mockResolvedValue([MOCK_HABIT]);
		mockGetAllHabitStatuses.mockResolvedValue([
			{
				habit_id: "h1",
				streak: 0,
				today_slots: [],
				today_date: "2026-08-31",
			},
		]);
		mockGetMonthCompletions.mockResolvedValue([]);
		useDashboardStore.getState().setHabits([MOCK_HABIT]);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		});
		// With 0 completions, badge should be KEEP GOING or NO DATA
		const badge = screen.getByText(/KEEP GOING|NO DATA/);
		expect(badge).toBeInTheDocument();
	});
});
