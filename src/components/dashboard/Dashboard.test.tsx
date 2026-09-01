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
const mockGetUserProfile = vi.fn();
const mockGetLatestCompletion = vi.fn();

vi.mock("../../lib/invoke", () => ({
	getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
	listHabits: (...args: unknown[]) => mockListHabits(...args),
	getHabitStatus: vi.fn(),
	getAllHabitStatuses: (...args: unknown[]) => mockGetAllHabitStatuses(...args),
	getMonthCompletions: (...args: unknown[]) => mockGetMonthCompletions(...args),
	getLatestCompletion: (...args: unknown[]) => mockGetLatestCompletion(...args),
	markDone: vi.fn(),
	updateHabit: vi.fn(),
	deleteHabit: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
	listen: vi.fn(() => Promise.resolve(() => {})),
	emit: vi.fn(),
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

function setupMocks() {
	mockGetUserProfile.mockResolvedValue({
		id: "u1",
		name: "Jacob",
		onboarding_completed: true,
		created_at: "",
	});
	mockGetLatestCompletion.mockResolvedValue(null);
}

describe("Dashboard", () => {
	it("shows loading state initially", () => {
		mockListHabits.mockReturnValue(new Promise(() => {}));
		mockGetAllHabitStatuses.mockReturnValue(new Promise(() => {}));
		mockGetUserProfile.mockReturnValue(new Promise(() => {}));

		render(<Dashboard />, { wrapper: Wrapper });
		expect(screen.getByText("Loading your habits...")).toBeInTheDocument();
	});

	it("renders greeting, streak hero, and calendar after load", async () => {
		setupMocks();
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
			expect(
				screen.getAllByText("Stretch Break").length,
			).toBeGreaterThanOrEqual(1);
		});
		// Greeting with user name
		expect(screen.getByText(/Jacob/)).toBeInTheDocument();
		// Streak hero message
		expect(screen.getByText("Building momentum!")).toBeInTheDocument();
		// Streak number appears
		expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
		// MonthStats cards
		expect(screen.getByText("Days practiced")).toBeInTheDocument();
		expect(screen.getByText("Day streak")).toBeInTheDocument();
		// Calendar headers
		expect(screen.getByText("Su")).toBeInTheDocument();
		expect(screen.getByText("Mo")).toBeInTheDocument();
	});

	it("shows empty state when no habits", async () => {
		setupMocks();
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
		mockGetUserProfile.mockResolvedValue(null);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(screen.getByText("DB connection failed")).toBeInTheDocument();
		});
	});

	it("renders performance badge based on completions", async () => {
		setupMocks();
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
			expect(
				screen.getAllByText("Stretch Break").length,
			).toBeGreaterThanOrEqual(1);
		});
		const badge = screen.getByText(/KEEP GOING|NO DATA/);
		expect(badge).toBeInTheDocument();
	});
});
