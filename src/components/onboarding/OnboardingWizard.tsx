import { Progress } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useOnboardingStore } from "../../stores/onboarding";
import { HabitDetailsStep } from "./HabitDetailsStep";
import { NameStep } from "./NameStep";
import { ScheduleStep } from "./ScheduleStep";
import { WelcomeStep } from "./WelcomeStep";

const TOTAL_STEPS = 4;

interface HabitDetails {
	name: string;
	description: string;
	icon: { name: string; color: string; strokeWidth: number };
}

export function OnboardingWizard() {
	const { step, nextStep, prevStep, visitedSteps, markVisited } =
		useOnboardingStore();
	const [habitDetails, setHabitDetails] = useState<HabitDetails>({
		name: "",
		description: "",
		icon: { name: "Coffee", color: "#12B886", strokeWidth: 2 },
	});

	const progress = ((step + 1) / TOTAL_STEPS) * 100;
	const shouldAnimate = !visitedSteps.has(step);

	const handleNext = () => {
		markVisited(step);
		nextStep();
	};

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			<div style={{ padding: "16px 24px 0" }}>
				<Progress
					value={progress}
					color="teal"
					size="sm"
					radius="xl"
					animated
				/>
			</div>

			<div style={{ flex: 1, overflow: "hidden" }}>
				<AnimatePresence mode="wait">
					{step === 0 && (
						<WelcomeStep
							key="welcome"
							onNext={handleNext}
							animate={shouldAnimate}
						/>
					)}
					{step === 1 && (
						<NameStep
							key="name"
							onNext={handleNext}
							onBack={prevStep}
							animate={shouldAnimate}
						/>
					)}
					{step === 2 && (
						<HabitDetailsStep
							key="habit-details"
							value={habitDetails}
							onChange={setHabitDetails}
							onNext={handleNext}
							onBack={prevStep}
							animate={shouldAnimate}
						/>
					)}
					{step === 3 && (
						<ScheduleStep
							key="schedule"
							habitDetails={habitDetails}
							onBack={prevStep}
							animate={shouldAnimate}
						/>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
