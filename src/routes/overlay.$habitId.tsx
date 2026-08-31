import { createFileRoute } from "@tanstack/react-router";
import { OverlayPanel } from "../components/overlay/OverlayPanel";

interface OverlaySearch {
	triggerDate: string;
	scheduledTime: string;
}

export const Route = createFileRoute("/overlay/$habitId")({
	validateSearch: (search: Record<string, unknown>): OverlaySearch => ({
		triggerDate: String(search.triggerDate ?? ""),
		scheduledTime: String(search.scheduledTime ?? ""),
	}),
	component: OverlayPage,
});

function OverlayPage() {
	const { habitId } = Route.useParams();
	const { triggerDate, scheduledTime } = Route.useSearch();
	return (
		<OverlayPanel
			habitId={habitId}
			triggerDate={triggerDate}
			scheduledTime={scheduledTime}
		/>
	);
}
