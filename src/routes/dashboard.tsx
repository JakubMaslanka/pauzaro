import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	return (
		<div>
			<h1>Dashboard</h1>
			<p>Dashboard will be implemented in Phase 4.</p>
		</div>
	);
}
