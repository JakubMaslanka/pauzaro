import { Button, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MascotImage } from "../shared/MascotImage";
import { SpeechBubble } from "../shared/SpeechBubble";

interface WelcomeStepProps {
	onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
	const [bubbleVisible, setBubbleVisible] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setBubbleVisible(true), 400);
		return () => clearTimeout(timer);
	}, []);

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -20 }}
			transition={{ duration: 0.4 }}
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
				<motion.div
					initial={{ scale: 0, rotate: -20 }}
					animate={{ scale: 1, rotate: 0 }}
					transition={{
						delay: 0.2,
						type: "spring",
						stiffness: 200,
					}}
				>
					<MascotImage reaction="happy" size={120} />
				</motion.div>

				<SpeechBubble
					message="Hi! I'm Pauzaro! 🦕"
					visible={bubbleVisible}
					direction="top"
				/>

				<Stack gap={4} align="center">
					<Title order={1} fw={800} size={34}>
						Your break-time buddy
					</Title>
					<Text size="lg" c="dimmed" maw={380}>
						I'll remind you to stretch, move, and rest while you code. Together
						we'll build healthy habits — and I'll cheer you on with every
						streak!
					</Text>
				</Stack>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.5 }}
				>
					<Button size="lg" radius="xl" color="teal" onClick={onNext} mt="md">
						Let's go! 🚀
					</Button>
				</motion.div>
			</Stack>
		</motion.div>
	);
}
