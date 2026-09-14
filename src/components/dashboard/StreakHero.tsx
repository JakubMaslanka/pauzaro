import { Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { getMascotReaction } from "../../lib/mascot";
import { MascotImage } from "../shared/MascotImage";
import { SpeechBubble } from "../shared/SpeechBubble";

interface StreakHeroProps {
	streak: number;
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

export function StreakHero({ streak, isFrozen }: StreakHeroProps) {
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
			<Stack align="center" gap={4} py="xs">
				<div
					style={{
						position: "relative",
						display: "inline-block",
						marginBottom: -8,
					}}
				>
					<SpeechBubble
						message={getStreakMessage(streak, isFrozen)}
						visible={bubbleVisible}
						offsetY={-2}
						offsetX={-95}
						width={210}
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
							size={140}
						/>
					</motion.div>
				</div>
				<Title order={1} fz={56} lh={1} ta="center">
					{streak}
				</Title>
				<Text size="sm" fw={600} c="dimmed" ta="center">
					day streak
				</Text>
			</Stack>
		</motion.div>
	);
}
