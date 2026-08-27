import { createRootRoute, Outlet } from "@tanstack/react-router";
import "../styles/global.css";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	return (
		<div className="app-root">
			<Outlet />
		</div>
	);
}
