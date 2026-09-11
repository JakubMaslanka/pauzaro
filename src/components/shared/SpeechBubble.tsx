import { Text } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";

interface SpeechBubbleProps {
	message: string;
	visible: boolean;
	direction?: "left" | "right" | "top";
}

const TAIL_STYLES: Record<string, React.CSSProperties> = {
	top: {
		position: "absolute",
		bottom: -8,
		left: "50%",
		transform: "translateX(-50%)",
		width: 0,
		height: 0,
		borderLeft: "8px solid transparent",
		borderRight: "8px solid transparent",
		borderTop: "8px solid #F7F5F0",
	},
	left: {
		position: "absolute",
		top: "50%",
		right: -8,
		transform: "translateY(-50%)",
		width: 0,
		height: 0,
		borderTop: "8px solid transparent",
		borderBottom: "8px solid transparent",
		borderLeft: "8px solid #F7F5F0",
	},
	right: {
		position: "absolute",
		top: "50%",
		left: -8,
		transform: "translateY(-50%)",
		width: 0,
		height: 0,
		borderTop: "8px solid transparent",
		borderBottom: "8px solid transparent",
		borderRight: "8px solid #F7F5F0",
	},
};

export function SpeechBubble({
	message,
	visible,
	direction = "top",
}: SpeechBubbleProps) {
	return (
		<AnimatePresence>
			{visible && (
				<motion.div
					initial={{ opacity: 0, scale: 0, rotate: -5 }}
					animate={{ opacity: 1, scale: 1, rotate: 0 }}
					exit={{ opacity: 0, scale: 0, rotate: 5 }}
					transition={{
						type: "spring",
						stiffness: 400,
						damping: 12,
					}}
					style={{
						position: "relative",
						display: "inline-block",
					}}
				>
					<div
						style={{
							background: "#F7F5F0",
							borderRadius: 16,
							padding: "10px 16px",
							boxShadow:
								"0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
						}}
					>
						<Text size="sm" fw={600} ta="center" lh={1.4}>
							{message}
						</Text>
					</div>
					<div style={TAIL_STYLES[direction]} />
				</motion.div>
			)}
		</AnimatePresence>
	);
}
