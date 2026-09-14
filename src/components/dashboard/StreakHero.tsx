import { Group, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { getMascotReaction } from "../../lib/mascot";
import { MascotImage } from "../shared/MascotImage";
import { SpeechBubble } from "../shared/SpeechBubble";

const FREEZE_SLOTS = [
	{ key: "freeze-a", index: 0 },
	{ key: "freeze-b", index: 1 },
] as const;

interface StreakHeroProps {
	streak: number;
	freezesRemaining: number;
	isFrozen: boolean;
}

function getStreakMessage(streak: number, isFrozen: boolean): string {
	if (isFrozen) return "Brrr! Your streak is frozen!";
	if (streak >= 30) return "Legendary streak!";
	if (streak >= 14) return "Unstoppable!";
	if (streak >= 7) return "One week warrior!";
	if (streak >= 3) return "Building momentum!";
	if (streak >= 1) return "Nice start!";
	return "Time to start!";
}

export function StreakHero({
	streak,
	freezesRemaining,
	isFrozen,
}: StreakHeroProps) {
	const [bubbleVisible, setBubbleVisible] = useState(false);
	const prevStreakRef = useRef(streak);

	// Show bubble on mount with delay
	useEffect(() => {
		const timer = setTimeout(() => setBubbleVisible(true), 300);
		return () => clearTimeout(timer);
	}, []);

	// Re-trigger bubble when streak changes (habit switch)
	useEffect(() => {
		if (prevStreakRef.current !== streak) {
			prevStreakRef.current = streak;
			setBubbleVisible(false);
			const timer = setTimeout(() => setBubbleVisible(true), 150);
			return () => clearTimeout(timer);
		}
	}, [streak]);

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ type: "spring", stiffness: 260, damping: 20 }}
		>
			<Stack align="center" gap={4} py="md">
				<div style={{ position: "relative", display: "inline-block" }}>
					<SpeechBubble
						message={getStreakMessage(streak, isFrozen)}
						visible={bubbleVisible}
						offsetY={4}
					/>
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
						<MascotImage
							reaction={getMascotReaction({ streak, isFrozen })}
							size={72}
						/>
					</motion.div>
				</div>
				<Title order={1} fz={56} lh={1} ta="center">
					{streak}
				</Title>
				<Text size="sm" fw={600} c="dimmed" ta="center">
					day streak
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
