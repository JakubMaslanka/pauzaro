import { Group, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

const FREEZE_SLOTS = [
	{ key: "freeze-a", index: 0 },
	{ key: "freeze-b", index: 1 },
] as const;

interface StreakHeroProps {
	streak: number;
	freezesRemaining: number;
}

function getStreakMessage(streak: number): string {
	if (streak >= 30) return "Legendary streak!";
	if (streak >= 14) return "Unstoppable!";
	if (streak >= 7) return "One week warrior!";
	if (streak >= 3) return "Building momentum!";
	if (streak >= 1) return "Nice start!";
	return "Time to start!";
}

export function StreakHero({ streak, freezesRemaining }: StreakHeroProps) {
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ type: "spring", stiffness: 260, damping: 20 }}
		>
			<Stack align="center" gap={4} py="md">
				<motion.div
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					transition={{
						type: "spring",
						stiffness: 300,
						damping: 15,
						delay: 0.15,
					}}
				>
					<Flame
						size={48}
						color={streak > 0 ? "#E28743" : "#c4b090"}
						fill={streak > 0 ? "#E28743" : "none"}
						strokeWidth={1.5}
					/>
				</motion.div>
				<Title order={1} fz={56} lh={1} ta="center">
					{streak}
				</Title>
				<Text size="lg" fw={600} c="dimmed" ta="center">
					{getStreakMessage(streak)}
				</Text>
				<Group gap={4} justify="center">
					{FREEZE_SLOTS.map((slot) => (
						<Text
							key={slot.key}
							size="lg"
							style={{
								opacity: slot.index < freezesRemaining ? 1 : 0.25,
							}}
						>
							❄️
						</Text>
					))}
				</Group>
			</Stack>
		</motion.div>
	);
}
