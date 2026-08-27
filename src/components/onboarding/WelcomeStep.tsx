import { Button, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";

interface WelcomeStepProps {
	onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
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
					style={{ fontSize: 72 }}
				>
					🦕
				</motion.div>

				<Stack gap={4} align="center">
					<Title order={1} fw={800} size={34}>
						Hey there! 👋
					</Title>
					<Text size="lg" c="dimmed" maw={380}>
						Welcome to{" "}
						<Text span fw={800} c="teal">
							Pauzaro
						</Text>
						! Your friendly reminder to take breaks, stretch, and stay awesome
						while you code.
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
