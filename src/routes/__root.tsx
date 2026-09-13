import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "../styles/global.css";

import { AppShell, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import {
	createRootRoute,
	Outlet,
	useLocation,
	useNavigate,
} from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { AppNavbar } from "../components/layout/AppNavbar";
import { ErrorBoundary } from "../components/shared/ErrorBoundary";
import { listHabits } from "../lib/invoke";
import { useDashboardStore } from "../stores/dashboard";
import { useSettingsStore } from "../stores/settings";
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

	const [isOverlay, setIsOverlay] = useState<boolean | null>(null);

	useEffect(() => {
		try {
			const label = getCurrentWindow().label;
			setIsOverlay(label.startsWith("overlay-"));
		} catch {
			setIsOverlay(false);
		}
	}, []);

	if (isOverlay === null) return null;

	if (isOverlay) {
		return (
			<MantineProvider theme={theme} defaultColorScheme="light">
				<Notifications position="bottom-right" />
				<ErrorBoundary>
					<div className="app-root">
						<Outlet />
					</div>
				</ErrorBoundary>
			</MantineProvider>
		);
	}

	return (
		<MantineProvider theme={theme} defaultColorScheme="light">
			<Notifications position="bottom-right" />
			<ErrorBoundary>
				<AppShellLayout />
			</ErrorBoundary>
		</MantineProvider>
	);
}

function AppShellLayout() {
	const navigate = useNavigate();
	const location = useLocation();
	const habits = useDashboardStore((s) => s.habits);
	const activeHabitId = useDashboardStore((s) => s.activeHabitId);
	const setHabits = useDashboardStore((s) => s.setHabits);

	const isOnboarding = location.pathname === "/onboarding";

	// Only show active habit highlight on dashboard route
	const isDashboard = location.pathname === "/dashboard";
	const visibleActiveId = isDashboard ? activeHabitId : null;

	// Initialize settings store on app start
	useEffect(() => {
		useSettingsStore.getState().init();
	}, []);

	const loadHabits = useCallback(async () => {
		try {
			const loaded = await listHabits();
			setHabits(loaded);
		} catch (error) {
			console.error("Failed to load habits:", error);
		}
	}, [setHabits]);

	useEffect(() => {
		loadHabits();
	}, [loadHabits]);

	useEffect(() => {
		const unlisten = listen("habit-updated", () => {
			loadHabits();
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, [loadHabits]);

	const handleSelectHabit = useCallback(
		(id: string) => {
			useDashboardStore.getState().setActiveHabitId(id);
			navigate({ to: "/dashboard" });
		},
		[navigate],
	);

	const handleCreateHabit = useCallback(() => {
		navigate({ to: "/create-habit" });
	}, [navigate]);

	const handleOpenSettings = useCallback(() => {
		navigate({ to: "/settings" });
	}, [navigate]);

	const handleOpenDebug = useCallback(() => {
		navigate({ to: "/debug" });
	}, [navigate]);

	return (
		<AppShell
			navbar={isOnboarding ? undefined : { width: 64, breakpoint: 0 }}
			padding={0}
			styles={{
				main: {
					backgroundColor: "#F7F5F0",
					height: "100vh",
					overflow: "auto",
				},
			}}
		>
			{!isOnboarding && (
				<AppShell.Navbar
					style={{
						backgroundColor: "white",
						borderRight: "1px solid var(--mantine-color-gray-2)",
					}}
				>
					<AppNavbar
						habits={habits}
						activeHabitId={visibleActiveId}
						onSelectHabit={handleSelectHabit}
						onCreateHabit={handleCreateHabit}
						onOpenSettings={handleOpenSettings}
						onOpenDebug={handleOpenDebug}
					/>
				</AppShell.Navbar>
			)}
			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}
