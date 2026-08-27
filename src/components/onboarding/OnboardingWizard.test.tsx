import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboardingStore } from "../../stores/onboarding";
import { theme } from "../../theme";
import { OnboardingWizard } from "./OnboardingWizard";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

describe("OnboardingWizard", () => {
	beforeEach(() => {
		useOnboardingStore.getState().reset();
	});

	it("renders welcome step initially", () => {
		render(<OnboardingWizard />, { wrapper: Wrapper });
		expect(screen.getByText("Hey there! 👋")).toBeInTheDocument();
	});

	it("advances to name step", async () => {
		render(<OnboardingWizard />, { wrapper: Wrapper });
		fireEvent.click(screen.getByText("Let's go! 🚀"));

		await waitFor(() => {
			expect(screen.getByText("What should we call you?")).toBeInTheDocument();
		});
	});

	it("shows validation error for empty name", async () => {
		render(<OnboardingWizard />, { wrapper: Wrapper });
		fireEvent.click(screen.getByText("Let's go! 🚀"));

		await waitFor(() => {
			expect(screen.getByText("What should we call you?")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("Continue ✨"));

		await waitFor(() => {
			expect(
				screen.getByText("Don't be shy, tell us your name! 😊"),
			).toBeInTheDocument();
		});
	});

	it("navigates back from name step to welcome", async () => {
		render(<OnboardingWizard />, { wrapper: Wrapper });
		fireEvent.click(screen.getByText("Let's go! 🚀"));

		await waitFor(() => {
			expect(screen.getByText("What should we call you?")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("← Back"));

		await waitFor(() => {
			expect(screen.getByText("Hey there! 👋")).toBeInTheDocument();
		});
	});
});
