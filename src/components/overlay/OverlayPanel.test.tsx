import { MantineProvider } from "@mantine/core";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import { OverlayPanel } from "./OverlayPanel";

const mockGetHabit = vi.fn();
const mockMarkDone = vi.fn();
const mockSnoozeHabit = vi.fn();
const mockClose = vi.fn();

vi.mock("../../lib/invoke", () => ({
	getHabit: (...args: unknown[]) => mockGetHabit(...args),
	markDone: (...args: unknown[]) => mockMarkDone(...args),
	snoozeHabit: (...args: unknown[]) => mockSnoozeHabit(...args),
}));

vi.mock("@tauri-apps/api/window", () => ({
	getCurrentWindow: () => ({
		close: mockClose,
	}),
}));

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
	created_at: "2026-08-01T10:00:00",
	schedule_days: [1, 3, 5],
	schedule_times: [{ start_time: "10:00" }],
};

const PROPS = {
	habitId: "h1",
	triggerDate: "2026-09-02",
	scheduledTime: "10:00",
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("OverlayPanel", () => {
	it("renders loading state initially", () => {
		// getHabit never resolves — stays loading
		mockGetHabit.mockReturnValue(new Promise(() => {}));

		render(
			<Wrapper>
				<OverlayPanel {...PROPS} />
			</Wrapper>,
		);

		expect(document.querySelector(".mantine-Loader-root")).toBeInTheDocument();
	});

	it("done button calls markDone and closes window", async () => {
		mockGetHabit.mockResolvedValue(MOCK_HABIT);
		mockMarkDone.mockResolvedValue(undefined);
		mockClose.mockResolvedValue(undefined);

		render(
			<Wrapper>
				<OverlayPanel {...PROPS} />
			</Wrapper>,
		);

		await waitFor(() => {
			expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		});

		const doneButton = screen.getByRole("button", { name: /done/i });
		fireEvent.click(doneButton);

		await waitFor(() => {
			expect(mockMarkDone).toHaveBeenCalledWith({
				habit_id: "h1",
				trigger_date: "2026-09-02",
				scheduled_time: "10:00",
			});
		});

		expect(mockClose).toHaveBeenCalled();
	});

	it("snooze button calls snoozeHabit and closes window", async () => {
		mockGetHabit.mockResolvedValue(MOCK_HABIT);
		mockSnoozeHabit.mockResolvedValue({ status: "snoozed" });
		mockClose.mockResolvedValue(undefined);

		render(
			<Wrapper>
				<OverlayPanel {...PROPS} />
			</Wrapper>,
		);

		await waitFor(() => {
			expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		});

		const snoozeButton = screen.getByRole("button", { name: /snooze/i });
		fireEvent.click(snoozeButton);

		await waitFor(() => {
			expect(mockSnoozeHabit).toHaveBeenCalledWith({
				habit_id: "h1",
				trigger_date: "2026-09-02",
				scheduled_time: "10:00",
			});
		});

		expect(mockClose).toHaveBeenCalled();
	});

	it("auto-snooze fires after 2 minutes of inactivity", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });

		mockGetHabit.mockResolvedValue(MOCK_HABIT);
		mockSnoozeHabit.mockResolvedValue({ status: "snoozed" });
		mockClose.mockResolvedValue(undefined);

		render(
			<Wrapper>
				<OverlayPanel {...PROPS} />
			</Wrapper>,
		);

		await waitFor(() => {
			expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		});

		// Advance past auto-snooze threshold (2 minutes)
		await act(async () => {
			vi.advanceTimersByTime(2 * 60 * 1000);
		});

		await waitFor(() => {
			expect(mockSnoozeHabit).toHaveBeenCalled();
		});

		vi.useRealTimers();
	});
});
