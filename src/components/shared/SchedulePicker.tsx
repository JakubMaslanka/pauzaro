import {
	ActionIcon,
	Button,
	Group,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { X } from "lucide-react";
import { useCallback, useRef } from "react";
import type { TimeSlot } from "../../types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

interface SchedulePickerProps {
	days: number[];
	times: TimeSlot[];
	onDaysChange: (days: number[]) => void;
	onTimesChange: (times: TimeSlot[]) => void;
}

let nextSlotKey = 0;

export function SchedulePicker({
	days,
	times,
	onDaysChange,
	onTimesChange,
}: SchedulePickerProps) {
	const slotKeysRef = useRef<string[]>([]);

	while (slotKeysRef.current.length < times.length) {
		slotKeysRef.current.push(`slot-${++nextSlotKey}`);
	}
	if (slotKeysRef.current.length > times.length) {
		slotKeysRef.current = slotKeysRef.current.slice(0, times.length);
	}

	const slotKeys = slotKeysRef.current;

	const toggleDay = useCallback(
		(day: number) => {
			if (days.includes(day)) {
				onDaysChange(days.filter((d) => d !== day));
			} else {
				onDaysChange([...days, day].sort((a, b) => a - b));
			}
		},
		[days, onDaysChange],
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
				<Group gap={6}>
					{DAY_LABELS.map((label, i) => {
						const dayValue = DAY_VALUES[i];
						const selected = days.includes(dayValue);
						return (
							<UnstyledButton
								key={dayValue}
								onClick={() => toggleDay(dayValue)}
								style={{
									padding: "6px 12px",
									borderRadius: "var(--mantine-radius-xl)",
									border: selected
										? "2px solid var(--mantine-color-teal-6)"
										: "2px solid var(--mantine-color-gray-3)",
									background: selected
										? "var(--mantine-color-teal-1)"
										: "white",
									color: selected
										? "var(--mantine-color-teal-8)"
										: "var(--mantine-color-gray-6)",
									fontWeight: selected ? 700 : 500,
									fontSize: 13,
									transition: "all 0.15s",
								}}
							>
								{label}
							</UnstyledButton>
						);
					})}
				</Group>
			</div>

			<div>
				<Text size="sm" fw={700} mb={6}>
					⏰ What time?
				</Text>
				<Stack gap="xs">
					{times.map((slot, idx) => {
						const duplicate = isDuplicateSlot(slot.start_time, idx);
						return (
							<Group key={slotKeys[idx]} gap="xs" align="center">
								<input
									type="time"
									value={slot.start_time}
									onChange={(e) =>
										updateTimeSlot(idx, "start_time", e.target.value)
									}
									style={{
										padding: "6px 10px",
										border: duplicate
											? "2px solid var(--mantine-color-red-5)"
											: "2px solid var(--mantine-color-gray-3)",
										borderRadius: "var(--mantine-radius-md)",
										fontSize: 14,
										fontFamily: "inherit",
										background: "white",
									}}
								/>
								{times.length > 1 && (
									<ActionIcon
										variant="subtle"
										color="red"
										size="sm"
										radius="xl"
										onClick={() => removeTimeSlot(idx)}
									>
										<X size={14} />
									</ActionIcon>
								)}
								{duplicate && (
									<Text size="xs" c="red">
										Duplicate!
									</Text>
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
						style={{ alignSelf: "flex-start" }}
					>
						+ Add time slot
					</Button>
				</Stack>
			</div>
		</Stack>
	);
}
