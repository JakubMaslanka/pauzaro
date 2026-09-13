import {
	ActionIcon,
	Button,
	Chip,
	Group,
	Stack,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { CircleHelp, X } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import type { TimeSlot, WeekStartDay } from "../../types";

const DAY_LABELS_MONDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_VALUES_MONDAY = [1, 2, 3, 4, 5, 6, 0];

const DAY_LABELS_SUNDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_VALUES_SUNDAY = [0, 1, 2, 3, 4, 5, 6];

const MAX_TIME_SLOTS = 10;

interface SchedulePickerProps {
	days: number[];
	times: TimeSlot[];
	weekStartDay: WeekStartDay;
	onDaysChange: (days: number[]) => void;
	onTimesChange: (times: TimeSlot[]) => void;
}

let nextSlotKey = 0;

export function SchedulePicker({
	days,
	times,
	weekStartDay,
	onDaysChange,
	onTimesChange,
}: SchedulePickerProps) {
	const dayLabels = useMemo(
		() => (weekStartDay === "sunday" ? DAY_LABELS_SUNDAY : DAY_LABELS_MONDAY),
		[weekStartDay],
	);
	const dayValues = useMemo(
		() => (weekStartDay === "sunday" ? DAY_VALUES_SUNDAY : DAY_VALUES_MONDAY),
		[weekStartDay],
	);
	const slotKeysRef = useRef<string[]>([]);

	while (slotKeysRef.current.length < times.length) {
		slotKeysRef.current.push(`slot-${++nextSlotKey}`);
	}
	if (slotKeysRef.current.length > times.length) {
		slotKeysRef.current = slotKeysRef.current.slice(0, times.length);
	}

	const slotKeys = slotKeysRef.current;

	const handleDaysChange = useCallback(
		(values: string[]) => {
			onDaysChange(values.map(Number).sort((a, b) => a - b));
		},
		[onDaysChange],
	);

	const updateTimeSlot = useCallback(
		(slotIndex: number, field: keyof TimeSlot, value: string) => {
			const updated = times.map((slot, i) =>
				i === slotIndex ? { ...slot, [field]: value } : slot,
			);
			onTimesChange(updated);
		},
		[times, onTimesChange],
	);

	const isDuplicateSlot = useCallback(
		(startTime: string, excludeIndex: number) => {
			return times.some(
				(slot, i) => i !== excludeIndex && slot.start_time === startTime,
			);
		},
		[times],
	);

	const addTimeSlot = useCallback(() => {
		const newSlot = { start_time: "09:00" };
		if (isDuplicateSlot(newSlot.start_time, -1)) {
			const hours = [10, 11, 14, 15, 16, 12, 13, 17];
			for (const h of hours) {
				const start = `${String(h).padStart(2, "0")}:00`;
				if (!isDuplicateSlot(start, -1)) {
					onTimesChange([...times, { start_time: start }]);
					return;
				}
			}
		}
		onTimesChange([...times, newSlot]);
	}, [times, onTimesChange, isDuplicateSlot]);

	const removeTimeSlot = useCallback(
		(slotIndex: number) => {
			slotKeysRef.current = slotKeysRef.current.filter(
				(_, i) => i !== slotIndex,
			);
			onTimesChange(times.filter((_, i) => i !== slotIndex));
		},
		[times, onTimesChange],
	);

	return (
		<Stack gap="md">
			<div>
				<Text size="sm" fw={700} mb={6}>
					🗓️ Which days?
				</Text>
				<Chip.Group
					multiple
					value={days.map(String)}
					onChange={handleDaysChange}
				>
					<Group gap={6}>
						{dayLabels.map((label, i) => (
							<Chip
								key={dayValues[i]}
								value={String(dayValues[i])}
								color="teal"
								variant="outline"
								radius="xl"
								size="sm"
							>
								{label}
							</Chip>
						))}
					</Group>
				</Chip.Group>
			</div>

			<div>
				<Group gap={6} mb={6}>
					<Text size="sm" fw={700}>
						⏰ What time?
					</Text>
					<Tooltip
						label="You can schedule up to 10 reminders per day. Too many alerts reduce their effectiveness."
						multiline
						w={240}
						withArrow
					>
						<ActionIcon
							variant="subtle"
							color="gray"
							size="xs"
							radius="xl"
							aria-label="Schedule limit info"
						>
							<CircleHelp size={14} />
						</ActionIcon>
					</Tooltip>
				</Group>
				<Stack gap="xs">
					{times.map((slot, idx) => {
						const duplicate = isDuplicateSlot(slot.start_time, idx);
						return (
							<Group key={slotKeys[idx]} gap="xs" align="center">
								<TextInput
									type="time"
									value={slot.start_time}
									onChange={(e) =>
										updateTimeSlot(idx, "start_time", e.target.value)
									}
									size="sm"
									radius="md"
									error={duplicate ? "Duplicate!" : undefined}
									w={130}
								/>
								{times.length > 1 && (
									<ActionIcon
										variant="subtle"
										color="red"
										size="sm"
										radius="xl"
										aria-label="Remove time slot"
										onClick={() => removeTimeSlot(idx)}
									>
										<X size={14} />
									</ActionIcon>
								)}
							</Group>
						);
					})}
					<Button
						variant="subtle"
						color="teal"
						size="xs"
						radius="xl"
						onClick={addTimeSlot}
						disabled={times.length >= MAX_TIME_SLOTS}
						style={{ alignSelf: "flex-start" }}
					>
						+ Add time slot
					</Button>
				</Stack>
			</div>
		</Stack>
	);
}
