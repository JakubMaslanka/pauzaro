import { createFileRoute, redirect } from "@tanstack/react-router";
import { DebugView } from "../components/debug/DebugView";

export const Route = createFileRoute("/debug")({
	beforeLoad: () => {
		if (!import.meta.env.DEV) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: DebugView,
});
