import exercisingImg from "../../assets/pauzaro-reactions/exercising.png";
import freezeImg from "../../assets/pauzaro-reactions/freeze.png";
import greeterImg from "../../assets/pauzaro-reactions/greeter.png";
import happyImg from "../../assets/pauzaro-reactions/happy.png";
import noteingImg from "../../assets/pauzaro-reactions/noteing.png";
import promisingImg from "../../assets/pauzaro-reactions/promising.png";
import sadImg from "../../assets/pauzaro-reactions/sad.png";
import successfulImg from "../../assets/pauzaro-reactions/successful.png";
import type { MascotReaction } from "../../lib/mascot";

const REACTION_IMAGES: Record<MascotReaction, string> = {
	sad: sadImg,
	promising: promisingImg,
	happy: happyImg,
	successful: successfulImg,
	"successful-glow": successfulImg,
	freeze: freezeImg,
	greeter: greeterImg,
	noteing: noteingImg,
	exercising: exercisingImg,
};

interface MascotImageProps {
	reaction: MascotReaction;
	size?: number;
	className?: string;
}

export function MascotImage({
	reaction,
	size = 64,
	className,
}: MascotImageProps) {
	const src = REACTION_IMAGES[reaction];
	const isGlow = reaction === "successful-glow";

	return (
		<img
			src={src}
			alt={`Pauzaro mascot — ${reaction}`}
			width={size}
			height={size}
			className={className}
			style={{
				objectFit: "contain",
				filter: isGlow
					? "drop-shadow(0 0 8px #E28743) drop-shadow(0 0 16px rgba(226, 135, 67, 0.4))"
					: undefined,
			}}
		/>
	);
}
