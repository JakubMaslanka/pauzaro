import { createFileRoute } from "@tanstack/react-router";
import { OverlayPanel } from "../components/overlay/OverlayPanel";

export const Route = createFileRoute("/overlay/$habitId")({
	component: OverlayPage,
});

function OverlayPage() {
	const { habitId } = Route.useParams();
	return <OverlayPanel habitId={habitId} />;
}
