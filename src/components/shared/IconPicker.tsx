import {
	ActionIcon,
	ColorSwatch,
	Group,
	Popover,
	SimpleGrid,
	Slider,
	Stack,
	Text,
	TextInput,
	Tooltip,
	UnstyledButton,
} from "@mantine/core";
import { icons } from "lucide-react";
import { useMemo, useState } from "react";
import { DynamicIcon } from "./DynamicIcon";

const ICON_NAMES = Object.keys(icons);

const PRESET_COLORS = [
	"#12B886",
	"#339AF0",
	"#845EF7",
	"#E64980",
	"#FF6B6B",
	"#F59F00",
	"#20C997",
	"#E28743",
	"#495057",
	"#1C7ED6",
];

interface IconValue {
	name: string;
	color: string;
	strokeWidth: number;
}

interface IconPickerProps {
	value: IconValue;
	onChange: (icon: IconValue) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
	const [opened, setOpened] = useState(false);
	const [search, setSearch] = useState("");

	const filteredIcons = useMemo(() => {
		if (!search.trim()) return ICON_NAMES.slice(0, 60);
		const query = search.toLowerCase();
		return ICON_NAMES.filter((name) =>
			name.toLowerCase().includes(query),
		).slice(0, 60);
	}, [search]);

	return (
		<Popover
			opened={opened}
			onChange={setOpened}
			width={340}
			position="bottom-start"
			shadow="lg"
			radius="lg"
		>
			<Popover.Target>
				<Tooltip label="Pick an icon" withArrow>
					<ActionIcon
						variant="light"
						color="gray"
						size={42}
						radius="lg"
						onClick={() => setOpened((o) => !o)}
					>
						<DynamicIcon
							name={value.name}
							color={value.color}
							strokeWidth={value.strokeWidth}
							size={22}
						/>
					</ActionIcon>
				</Tooltip>
			</Popover.Target>

			<Popover.Dropdown p="sm">
				<Stack gap="sm">
					<TextInput
						placeholder="Search icons..."
						value={search}
						onChange={(e) => setSearch(e.currentTarget.value)}
						size="sm"
						radius="md"
						ref={(el) => el?.focus()}
					/>

					<div
						style={{
							maxHeight: 180,
							overflowY: "auto",
							overflowX: "hidden",
						}}
					>
						<SimpleGrid cols={6} spacing={4}>
							{filteredIcons.map((name) => (
								<Tooltip key={name} label={name} withArrow>
									<ActionIcon
										variant={value.name === name ? "light" : "subtle"}
										color={value.name === name ? "teal" : "gray"}
										size="lg"
										radius="md"
										onClick={() => {
											onChange({ ...value, name });
										}}
									>
										<DynamicIcon
											name={name}
											color={value.color}
											strokeWidth={value.strokeWidth}
											size={18}
										/>
									</ActionIcon>
								</Tooltip>
							))}
						</SimpleGrid>
					</div>

					<Stack gap={4}>
						<Text size="xs" c="dimmed" fw={600}>
							Color
						</Text>
						<Group gap={6}>
							{PRESET_COLORS.map((color) => (
								<UnstyledButton
									key={color}
									onClick={() => onChange({ ...value, color })}
								>
									<ColorSwatch
										color={color}
										size={26}
										style={{
											outline:
												value.color === color
													? "2px solid var(--mantine-color-teal-5)"
													: "2px solid transparent",
											outlineOffset: 2,
											cursor: "pointer",
										}}
									/>
								</UnstyledButton>
							))}
						</Group>
					</Stack>

					<Stack gap={4}>
						<Text size="xs" c="dimmed" fw={600}>
							Thickness: {value.strokeWidth.toFixed(1)}
						</Text>
						<Slider
							min={1}
							max={3}
							step={0.5}
							value={value.strokeWidth}
							onChange={(val) => onChange({ ...value, strokeWidth: val })}
							color="teal"
							size="sm"
						/>
					</Stack>
				</Stack>
			</Popover.Dropdown>
		</Popover>
	);
}
