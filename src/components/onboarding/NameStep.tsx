import { Button, Group, Stack, TextInput, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createUserProfile, getUserProfile } from "../../lib/invoke";
import { useOnboardingStore } from "../../stores/onboarding";
import { MascotImage } from "../shared/MascotImage";
import { SpeechBubble } from "../shared/SpeechBubble";

interface NameStepProps {
	onNext: () => void;
	onBack: () => void;
	animate: boolean;
}

export function NameStep({ onNext, onBack, animate }: NameStepProps) {
	const { name, setName } = useOnboardingStore();
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [bubbleVisible, setBubbleVisible] = useState(!animate);

	useEffect(() => {
		if (!animate) return;
		const timer = setTimeout(() => setBubbleVisible(true), 300);
		return () => clearTimeout(timer);
	}, [animate]);

	const handleSubmit = async () => {
		if (!name.trim()) {
			setError("Don't be shy, tell us your name!");
			return;
		}

		setError("");
		setSubmitting(true);

		try {
			const existing = await getUserProfile();
			if (existing) {
				onNext();
				return;
			}

			await createUserProfile({ name: name.trim() });
			onNext();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("Failed to create profile:", message);
			setError("Something went wrong. Try again?");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<motion.div
			initial={animate ? { opacity: 0, x: 50 } : false}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -50 }}
			transition={{ duration: 0.3 }}
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100%",
				padding: 32,
			}}
		>
			<Stack align="center" gap="lg" maw={360} w="100%">
				<div style={{ position: "relative", display: "inline-block" }}>
					<SpeechBubble
						message={`What's your name?\nI want to know who I'm cheering for!`}
						visible={bubbleVisible}
						offsetY={-5}
						offsetX={-100}
						width={270}
					/>
					<MascotImage reaction="noteing" size={140} />
				</div>

				<Title order={2} fw={800} ta="center">
					What should I call you?
				</Title>

				<TextInput
					placeholder="Your awesome name"
					value={name}
					onChange={(e) => setName(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSubmit();
					}}
					error={error}
					size="md"
					radius="lg"
					w="100%"
					ref={(el) => el?.focus()}
					styles={{
						input: {
							textAlign: "center",
							fontWeight: 600,
							fontSize: 16,
						},
					}}
				/>

				<Group mt="sm">
					<Button variant="subtle" color="gray" radius="xl" onClick={onBack}>
						← Back
					</Button>
					<Button
						color="teal"
						radius="xl"
						onClick={handleSubmit}
						loading={submitting}
					>
						Continue ✨
					</Button>
				</Group>
			</Stack>
		</motion.div>
	);
}
