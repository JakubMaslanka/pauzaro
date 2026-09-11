import { Text } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";

interface SpeechBubbleProps {
	message: string;
	visible: boolean;
	/** Horizontal offset from center (px). Positive = right. */
	offsetX?: number;
	/** Vertical offset from anchor (px). Negative = higher above. */
	offsetY?: number;
	/** Width of the bubble (px). Default is auto. */
	width?: number | string;
}

export function SpeechBubble({
	message,
	visible,
	offsetX = 0,
	offsetY = 0,
	width = "auto",
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
						position: "absolute",
						bottom: `calc(100% + ${offsetY}px)`,
						left: `calc(50% + ${offsetX}px)`,
						transform: "translateX(-50%)",
						zIndex: 10,
						whiteSpace: "nowrap",
						width: width ? `${width}px` : "auto",
					}}
				>
					<div
						style={{
							background: "#FFFFFF",
							borderRadius: 16,
							padding: "10px 16px",
							boxShadow:
								"0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
							whiteSpace: "pre-line",
							maxWidth: 280,
						}}
					>
						<Text size="sm" fw={600} ta="center" lh={1.4}>
							{message}
						</Text>
					</div>
					{/* Tail pointing down toward mascot */}
					<div
						style={{
							position: "absolute",
							bottom: -8,
							left: "50%",
							transform: "translateX(-50%)",
							width: 0,
							height: 0,
							borderLeft: "8px solid transparent",
							borderRight: "8px solid transparent",
							borderTop: "8px solid #FFFFFF",
						}}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
