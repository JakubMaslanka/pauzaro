import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { OnboardingWizard } from "../components/onboarding/OnboardingWizard";
import { getUserProfile } from "../lib/invoke";

export const Route = createFileRoute("/onboarding")({
	beforeLoad: async () => {
		try {
			const profile = await getUserProfile();
			if (profile?.onboarding_completed) {
				throw redirect({ to: "/dashboard" });
			}
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}
			console.error("Failed to check onboarding status:", error);
		}
	},
	component: OnboardingPage,
});

function OnboardingPage() {
	return <OnboardingWizard />;
}
