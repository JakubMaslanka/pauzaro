import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import { Dashboard } from "./Dashboard";

const mockGetUserProfile = vi.fn();
const mockListHabits = vi.fn();

vi.mock("../../lib/invoke", () => ({
	getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
	listHabits: (...args: unknown[]) => mockListHabits(...args),
}));

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

describe("Dashboard", () => {
	it("shows loading state initially", () => {
		mockGetUserProfile.mockReturnValue(new Promise(() => {}));
		mockListHabits.mockReturnValue(new Promise(() => {}));

		render(<Dashboard />, { wrapper: Wrapper });
		expect(screen.getByText("Loading your habits...")).toBeInTheDocument();
	});

	it("renders greeting and habits after load", async () => {
		mockGetUserProfile.mockResolvedValue({
			id: "u1",
			name: "Jakub",
			onboarding_completed: true,
			created_at: "2026-08-27T10:00:00Z",
		});
		mockListHabits.mockResolvedValue([
			{
				id: "h1",
				name: "Stretch Break",
				description: "Stand up and stretch",
				icon: "Dumbbell",
				icon_color: "#0d9488",
				icon_stroke_width: 2,
				start_date: "2026-08-27",
				end_date: null,
				is_active: true,
				created_at: "2026-08-27T10:00:00Z",
				schedule_days: [1, 3, 5],
				schedule_times: [{ start_time: "10:00", end_time: "10:15" }],
			},
		]);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(screen.getByText("Hey Jakub! 👋")).toBeInTheDocument();
		});
		expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		expect(
			screen.getByText("Here's what you're building 💪"),
		).toBeInTheDocument();
	});

	it("shows empty state when no habits", async () => {
		mockGetUserProfile.mockResolvedValue({
			id: "u1",
			name: "Jakub",
			onboarding_completed: true,
			created_at: "2026-08-27T10:00:00Z",
		});
		mockListHabits.mockResolvedValue([]);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(
				screen.getByText("No habits yet — let's fix that! 🚀"),
			).toBeInTheDocument();
		});
	});

	it("shows error state on failure", async () => {
		mockGetUserProfile.mockRejectedValue(new Error("DB connection failed"));
		mockListHabits.mockResolvedValue([]);

		render(<Dashboard />, { wrapper: Wrapper });

		await waitFor(() => {
			expect(screen.getByText("DB connection failed")).toBeInTheDocument();
		});
	});
});
