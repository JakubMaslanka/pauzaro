/**
 * seed.spec.ts — Risk #4 from context/foundation/test-plan.md
 *
 * Risk: "Dashboard shows stale state after overlay action — user marks
 *        done via overlay, dashboard still shows pending."
 *
 * What this proves: when the Rust backend emits "habit-updated" (after
 * the overlay calls mark_done), the dashboard re-fetches and re-renders
 * with the new streak and calendar state — without a page refresh.
 *
 * Conventions demonstrated (seed-test-pattern.md):
 *   1. Role-based locators: getByRole / getByText — zero CSS selectors
 *   2. Wait for state: toBeVisible() — no waitForTimeout
 *   3. Unique identifiers: Date.now() suffix in test data
 *   4. Independence: full setup → action → assertion — no shared state
 *
 * Tauri IPC: mocked via e2e/fixtures/tauri.ts (the Rust backend
 * is not running; Playwright drives the Vite dev server directly).
 */
import { test, expect } from "./fixtures/tauri";

/** Build today's date string in YYYY-MM-DD format (local time). */
function todayDateString(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

test.describe("Risk #4 — Dashboard reflects overlay completion without refresh", () => {
	test("habit-updated event triggers dashboard re-render with new streak", async ({
		page,
		tauriMock,
	}) => {
		const uid = String(Date.now());
		const habitId = `h-${uid}`;
		const habitName = `Stretch Break ${uid}`;
		const todayDate = todayDateString();
		const todayDow = new Date().getDay(); // 0=Sun … 6=Sat

		const habit = {
			id: habitId,
			name: habitName,
			description: "Stand up and stretch",
			icon: "Dumbbell",
			icon_color: "#0d9488",
			icon_stroke_width: 2,
			start_date: "2026-01-01",
			end_date: null,
			is_active: true,
			created_at: "2026-01-01T10:00:00",
			schedule_days: [todayDow], // includes today so today is a scheduled day
			schedule_times: [{ start_time: "10:00" }],
		};

		// ── Initial state: habit exists, streak = 0, today pending ──
		await tauriMock.setResponses({
			get_user_profile: {
				id: `u-${uid}`,
				name: "Tester",
				onboarding_completed: true,
				created_at: "2026-01-01T00:00:00",
			},
			list_habits: [habit],
			get_all_habit_statuses: [
				{
					habit_id: habitId,
					streak: 0,
					today_slots: [{ scheduled_time: "10:00", status: "pending" }],
					today_date: todayDate,
				},
			],
			get_month_completions: [],
			get_latest_completion: null,
			get_missed_repetitions: { habits: [] },
		});

		// ── Navigate to dashboard ──
		await page.goto("/dashboard");

		// Verify initial state: streak = 0 message and habit name visible
		await expect(page.getByText(habitName)).toBeVisible();
		await expect(page.getByText("Time to start!")).toBeVisible();

		// ── Simulate overlay completing the habit ──
		// 1. Update mock responses to post-completion state
		//    (next re-fetch from dashboard will get these values)
		await tauriMock.updateResponses({
			get_all_habit_statuses: [
				{
					habit_id: habitId,
					streak: 1,
					today_slots: [{ scheduled_time: "10:00", status: "done" }],
					today_date: todayDate,
				},
			],
			get_month_completions: [
				{
					id: `c-${uid}`,
					habit_id: habitId,
					trigger_date: todayDate,
					scheduled_time: "10:00",
					status: "done",
					completed_at: `${todayDate}T10:05:00`,
				},
			],
			get_latest_completion: {
				id: `c-${uid}`,
				habit_id: habitId,
				trigger_date: todayDate,
				scheduled_time: "10:00",
				status: "done",
				completed_at: `${todayDate}T10:05:00`,
			},
		});

		// 2. Emit habit-updated event (simulates Rust backend's
		//    app.emit("habit-updated", ()) after mark_done completes)
		await tauriMock.emitEvent("habit-updated", null);

		// ── Assert: dashboard re-renders with updated state ──
		// Streak hero should show 1 with "Nice start!" message.
		// This fails if the event listener → loadData → re-render chain is broken.
		await expect(page.getByText("Nice start!")).toBeVisible();

		// No cleanup needed — mock data lives only in this browser context.
		// Playwright creates a fresh context per test.
	});
});
