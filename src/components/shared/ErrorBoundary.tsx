import { Button, Stack, Text, Title } from "@mantine/core";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { MascotImage } from "./MascotImage";

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): ErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error("[ErrorBoundary] Render crash caught:", {
			error: error.message,
			stack: error.stack,
			componentStack: info.componentStack,
		});
	}

	render() {
		if (this.state.hasError) {
			return (
				<Stack
					align="center"
					justify="center"
					gap="md"
					style={{ height: "100vh", padding: 32, textAlign: "center" }}
				>
					<MascotImage reaction="sad" size={96} />
					<Title order={2} fw={800}>
						Oops! Something went wrong 😵
					</Title>
					<Text size="md" c="dimmed" maw={360}>
						Don't worry — try restarting the app and everything should be back
						to normal.
					</Text>
					<Button
						color="teal"
						radius="xl"
						size="md"
						onClick={() => window.location.reload()}
					>
						Reload 🔄
					</Button>
				</Stack>
			);
		}

		return this.props.children;
	}
}
