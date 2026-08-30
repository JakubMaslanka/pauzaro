import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getUserProfile } from "../lib/invoke";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		// Detect overlay window and redirect to overlay route
		try {
			const label = getCurrentWindow().label;
			if (label.startsWith("overlay-")) {
				const habitId = label.replace("overlay-", "");
				throw redirect({ to: "/overlay/$habitId", params: { habitId } });
			}
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}
			// Not in Tauri context or label check failed — continue normal flow
		}

		try {
			const profile = await getUserProfile();
			if (profile?.onboarding_completed) {
				throw redirect({ to: "/dashboard" });
			}
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}
			console.error("Failed to check profile:", error);
		}
		throw redirect({ to: "/onboarding" });
	},
});
