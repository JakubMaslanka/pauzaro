import { icons } from "lucide-react";

interface DynamicIconProps {
	name: string;
	color?: string;
	strokeWidth?: number;
	size?: number;
	className?: string;
}

export function DynamicIcon({
	name,
	color = "#000000",
	strokeWidth = 2,
	size = 24,
	className,
}: DynamicIconProps) {
	const IconComponent = icons[name as keyof typeof icons];

	if (!IconComponent) {
		const Fallback = icons.CircleAlert;
		return (
			<Fallback
				color={color}
				strokeWidth={strokeWidth}
				size={size}
				className={className}
			/>
		);
	}

	return (
		<IconComponent
			color={color}
			strokeWidth={strokeWidth}
			size={size}
			className={className}
		/>
	);
}
