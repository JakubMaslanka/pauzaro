import {
	ActionIcon,
	AppShell,
	ScrollArea,
	Stack,
	Tooltip,
} from "@mantine/core";
import { Bug, Plus, Settings } from "lucide-react";
import type { Habit } from "../../types";
import { DynamicIcon } from "../shared/DynamicIcon";

interface AppNavbarProps {
	habits: Habit[];
	activeHabitId: string | null;
	onSelectHabit: (id: string) => void;
	onCreateHabit: () => void;
	onOpenSettings: () => void;
	onOpenDebug: () => void;
}

export function AppNavbar({
	habits,
	activeHabitId,
	onSelectHabit,
	onCreateHabit,
	onOpenSettings,
	onOpenDebug,
}: AppNavbarProps) {
	const isDev = import.meta.env.DEV;

	return (
		<>
			<AppShell.Section
				style={{
					display: "flex",
					justifyContent: "center",
					paddingTop: 16,
					paddingBottom: 16,
				}}
			>
				<Tooltip label="Pauzaro" position="right" withArrow>
					<ActionIcon
						variant="transparent"
						size={40}
						radius="md"
						style={{ cursor: "default" }}
					>
						<span style={{ fontSize: 24 }}>🦕</span>
					</ActionIcon>
				</Tooltip>
			</AppShell.Section>

			<AppShell.Section grow component={ScrollArea} scrollbarSize={4}>
				<Stack align="center" gap={4} py={4}>
					{habits.map((habit) => {
						const isActive = habit.id === activeHabitId;
						return (
							<Tooltip
								key={habit.id}
								label={habit.name}
								position="right"
								withArrow
								transitionProps={{ duration: 150 }}
							>
								<ActionIcon
									variant={isActive ? "light" : "subtle"}
									color="teal"
									size={40}
									radius="md"
									onClick={() => onSelectHabit(habit.id)}
									style={{
										border: isActive
											? "2px solid var(--mantine-color-teal-4)"
											: "2px solid transparent",
									}}
								>
									<DynamicIcon
										name={habit.icon}
										color="var(--mantine-color-teal-6)"
										strokeWidth={1.8}
										size={20}
									/>
								</ActionIcon>
							</Tooltip>
						);
					})}
					<Tooltip
						label="Create habit"
						position="right"
						withArrow
						transitionProps={{ duration: 150 }}
					>
						<ActionIcon
							variant="subtle"
							color="teal"
							size={40}
							radius="md"
							onClick={onCreateHabit}
						>
							<Plus size={20} />
						</ActionIcon>
					</Tooltip>
				</Stack>
			</AppShell.Section>

			<AppShell.Section
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 4,
					paddingBottom: 16,
					paddingTop: 8,
				}}
			>
				{isDev ? (
					<Tooltip
						label="Debug"
						position="right"
						withArrow
						transitionProps={{ duration: 150 }}
					>
						<ActionIcon
							variant="subtle"
							color="gray"
							size={40}
							radius="md"
							onClick={onOpenDebug}
						>
							<Bug size={20} />
						</ActionIcon>
					</Tooltip>
				) : null}
				<Tooltip
					label="Settings"
					position="right"
					withArrow
					transitionProps={{ duration: 150 }}
				>
					<ActionIcon
						variant="subtle"
						color="gray"
						size={40}
						radius="md"
						onClick={onOpenSettings}
					>
						<Settings size={20} />
					</ActionIcon>
				</Tooltip>
			</AppShell.Section>
		</>
	);
}
