import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { Dashboard } from "../components/dashboard/Dashboard";
import { getUserProfile } from "../lib/invoke";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async () => {
		try {
			const profile = await getUserProfile();
			if (!profile?.onboarding_completed) {
				throw redirect({ to: "/onboarding" });
			}
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}
			console.error("Failed to check onboarding status:", error);
			throw redirect({ to: "/onboarding" });
		}
	},
	component: Dashboard,
});
