import { Button, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MascotImage } from "../shared/MascotImage";
import { SpeechBubble } from "../shared/SpeechBubble";

interface WelcomeStepProps {
	onNext: () => void;
	animate: boolean;
}

function stagger(index: number, animate: boolean) {
	if (!animate) return { initial: false, animate: { opacity: 1, y: 0 } };
	return {
		initial: { opacity: 0, y: 15 },
		animate: { opacity: 1, y: 0 },
		transition: { delay: index * 0.25, duration: 0.35 },
	};
}

export function WelcomeStep({ onNext, animate }: WelcomeStepProps) {
	const [bubbleVisible, setBubbleVisible] = useState(!animate);

	useEffect(() => {
		if (!animate) return;
		const timer = setTimeout(() => setBubbleVisible(true), 450);
		return () => clearTimeout(timer);
	}, [animate]);

	return (
		<motion.div
			initial={animate ? { opacity: 0 } : false}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0, y: -20 }}
			transition={{ duration: 0.2 }}
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				height: "100%",
				padding: 32,
			}}
		>
			<Stack align="center" gap="lg">
				{/* Mascot + bubble */}
				<motion.div {...stagger(0, animate)}>
					<div style={{ position: "relative", display: "inline-block" }}>
						<SpeechBubble
							message="Hi! I'm Pauzaro!"
							visible={bubbleVisible}
							offsetY={-10}
							offsetX={-40}
							width={140}
						/>
						<motion.div
							initial={animate ? { scale: 0, rotate: -20 } : false}
							animate={{ scale: 1, rotate: 0 }}
							transition={
								animate ? { type: "spring", stiffness: 200 } : undefined
							}
						>
							<MascotImage reaction="greeter" size={140} />
						</motion.div>
					</div>
				</motion.div>

				{/* Header + description */}
				<motion.div {...stagger(2, animate)}>
					<Stack gap={4} align="center">
						<Title order={1} fw={800} size={34}>
							Your break-time buddy
						</Title>
						<Text size="lg" c="dimmed" maw={380}>
							I'll remind you to stretch, move, and rest while you code.
							Together we'll build healthy habits and I'll cheer you on with
							every streak!
						</Text>
					</Stack>
				</motion.div>

				{/* Button */}
				<motion.div {...stagger(3, animate)}>
					<Button size="lg" radius="xl" color="teal" onClick={onNext} mt="md">
						Let's go! 🚀
					</Button>
				</motion.div>
			</Stack>
		</motion.div>
	);
}
