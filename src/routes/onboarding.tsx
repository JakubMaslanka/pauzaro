import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

function OnboardingPage() {
	return (
		<div>
			<h1>Onboarding</h1>
			<p>Wizard will be implemented in Phase 3.</p>
		</div>
	);
}
