import { ActionIcon, Menu } from "@mantine/core";
import { CircleCheck, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { Completion, Habit } from "../../types";

interface HabitMenuProps {
	habit: Habit;
	latestCompletion: Completion | null;
	onRename: () => void;
	onDelete: () => void;
	onMarkDone: () => void;
}

export function HabitMenu({
	latestCompletion,
	onRename,
	onDelete,
	onMarkDone,
}: HabitMenuProps) {
	const canMarkDone =
		latestCompletion !== null && latestCompletion.status !== "done";

	return (
		<Menu shadow="md" width={200} position="bottom-start" withArrow>
			<Menu.Target>
				<ActionIcon
					variant="subtle"
					color="gray"
					size="sm"
					radius="xl"
					className="habit-menu-trigger"
					style={{ opacity: 0.12, transition: "opacity 150ms ease" }}
				>
					<MoreVertical size={16} />
				</ActionIcon>
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Item leftSection={<Pencil size={14} />} onClick={onRename}>
					Rename
				</Menu.Item>
				<Menu.Item
					leftSection={<CircleCheck size={14} />}
					onClick={onMarkDone}
					disabled={!canMarkDone}
				>
					Mark latest as done
				</Menu.Item>
				<Menu.Divider />
				<Menu.Item
					color="red"
					leftSection={<Trash2 size={14} />}
					onClick={onDelete}
				>
					Delete habit
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}
