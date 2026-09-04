import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import type { HabitRecoveryInfo } from "../../types";
import { RecoveryModal } from "./RecoveryModal";

const mockRecoverHabitDone = vi.fn();
const mockRecoverHabitDismiss = vi.fn();

vi.mock("../../lib/invoke", () => ({
	recoverHabitDone: (...args: unknown[]) => mockRecoverHabitDone(...args),
	recoverHabitDismiss: (...args: unknown[]) => mockRecoverHabitDismiss(...args),
}));

afterEach(() => {
	vi.restoreAllMocks();
});

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

const MOCK_RECOVERY: HabitRecoveryInfo = {
	habit_id: "h1",
	habit_name: "Stretch Break",
	habit_icon: "Coffee",
	habit_icon_color: "#0d9488",
	missed_reps: [
		{
			habit_id: "h1",
			habit_name: "Stretch Break",
			habit_icon: "Coffee",
			habit_icon_color: "#0d9488",
			trigger_date: "2026-09-02",
			scheduled_time: "10:00",
		},
		{
			habit_id: "h1",
			habit_name: "Stretch Break",
			habit_icon: "Coffee",
			habit_icon_color: "#0d9488",
			trigger_date: "2026-09-02",
			scheduled_time: "15:00",
		},
		{
			habit_id: "h1",
			habit_name: "Stretch Break",
			habit_icon: "Coffee",
			habit_icon_color: "#0d9488",
			trigger_date: "2026-09-03",
			scheduled_time: "10:00",
		},
	],
	streak_reset: false,
};

describe("RecoveryModal", () => {
	it("renders habit name and missed rep count", () => {
		render(
			<RecoveryModal
				habitRecovery={MOCK_RECOVERY}
				opened={true}
				onResolved={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		expect(screen.getByText("Stretch Break")).toBeInTheDocument();
		expect(
			screen.getByText(/3 scheduled repetitions were/),
		).toBeInTheDocument();
	});

	it("calls recoverHabitDone and onResolved on Done anyway click", async () => {
		mockRecoverHabitDone.mockResolvedValue(undefined);
		const onResolved = vi.fn();

		render(
			<RecoveryModal
				habitRecovery={MOCK_RECOVERY}
				opened={true}
				onResolved={onResolved}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("✅ Done anyway"));

		await waitFor(() => {
			expect(mockRecoverHabitDone).toHaveBeenCalledWith("h1", [
				{ trigger_date: "2026-09-02", scheduled_time: "10:00" },
				{ trigger_date: "2026-09-02", scheduled_time: "15:00" },
				{ trigger_date: "2026-09-03", scheduled_time: "10:00" },
			]);
			expect(onResolved).toHaveBeenCalled();
		});
	});

	it("calls recoverHabitDismiss and onResolved on Dismiss click", async () => {
		mockRecoverHabitDismiss.mockResolvedValue(undefined);
		const onResolved = vi.fn();

		render(
			<RecoveryModal
				habitRecovery={MOCK_RECOVERY}
				opened={true}
				onResolved={onResolved}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("❌ Dismiss"));

		await waitFor(() => {
			expect(mockRecoverHabitDismiss).toHaveBeenCalledWith("h1", [
				{ trigger_date: "2026-09-02", scheduled_time: "10:00" },
				{ trigger_date: "2026-09-02", scheduled_time: "15:00" },
				{ trigger_date: "2026-09-03", scheduled_time: "10:00" },
			]);
			expect(onResolved).toHaveBeenCalled();
		});
	});

	it("shows error message on action failure without calling onResolved", async () => {
		mockRecoverHabitDone.mockRejectedValue(new Error("DB write failed"));
		const onResolved = vi.fn();

		render(
			<RecoveryModal
				habitRecovery={MOCK_RECOVERY}
				opened={true}
				onResolved={onResolved}
			/>,
			{ wrapper: Wrapper },
		);

		fireEvent.click(screen.getByText("✅ Done anyway"));

		await waitFor(() => {
			expect(screen.getByText("DB write failed")).toBeInTheDocument();
		});

		expect(onResolved).not.toHaveBeenCalled();
	});

	it("renders singular form for single missed rep", () => {
		const singleRep: HabitRecoveryInfo = {
			...MOCK_RECOVERY,
			missed_reps: [MOCK_RECOVERY.missed_reps[0]],
		};

		render(
			<RecoveryModal
				habitRecovery={singleRep}
				opened={true}
				onResolved={vi.fn()}
			/>,
			{ wrapper: Wrapper },
		);

		expect(screen.getByText(/1 scheduled repetition was/)).toBeInTheDocument();
	});
});
