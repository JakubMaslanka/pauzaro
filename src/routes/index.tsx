import { createFileRoute, redirect } from "@tanstack/react-router";
import { getUserProfile } from "../lib/invoke";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		try {
			const profile = await getUserProfile();
			if (profile?.onboarding_completed) {
				throw redirect({ to: "/dashboard" });
			}
		} catch (error) {
			if (error && typeof error === "object" && "to" in error) {
				throw error;
			}
			console.error("Failed to check profile:", error);
		}
		throw redirect({ to: "/onboarding" });
	},
});
