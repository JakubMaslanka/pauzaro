import "@mantine/core/styles.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "../styles/global.css";

import { MantineProvider } from "@mantine/core";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { theme } from "../theme";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useEffect(() => {
		const handler = (e: MouseEvent) => e.preventDefault();
		document.addEventListener("contextmenu", handler);
		return () => document.removeEventListener("contextmenu", handler);
	}, []);

	return (
		<MantineProvider theme={theme}>
			<div className="app-root">
				<Outlet />
			</div>
		</MantineProvider>
	);
}
