import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import type { ReviewInput } from "./schemas/review.js";

const USAGE = `Usage: code-reviewer --diff-file <path> --pr-title <string> --pr-body <string> --output <path>

Options:
  --diff-file   Path to the diff file (required)
  --pr-title    Pull request title (required)
  --pr-body     Pull request body (required)
  --output      Output JSON file path (required)
  --help        Show this help message`;

interface CliArgs {
	diffFile: string;
	prTitle: string;
	prBody: string;
	output: string;
}

function parseCliArgs(): CliArgs {
	const { values } = parseArgs({
		options: {
			"diff-file": { type: "string" },
			"pr-title": { type: "string" },
			"pr-body": { type: "string" },
			output: { type: "string" },
			help: { type: "boolean" },
		},
		strict: true,
	});

	if (values.help) {
		console.log(USAGE);
		process.exit(0);
	}

	if (
		!values["diff-file"] ||
		!values["pr-title"] ||
		values["pr-body"] === undefined ||
		!values.output
	) {
		console.error(USAGE);
		process.exit(1);
	}

	return {
		diffFile: values["diff-file"],
		prTitle: values["pr-title"],
		prBody: values["pr-body"],
		output: values.output,
	};
}

async function writeError(outputPath: string, message: string): Promise<void> {
	await writeFile(outputPath, JSON.stringify({ error: message }, null, 2));
}

async function main(): Promise<void> {
	const args = parseCliArgs();

	let diff: string;
	try {
		diff = await readFile(args.diffFile, "utf-8");
	} catch {
		const message = `Failed to read diff file: ${args.diffFile}`;
		console.error(message);
		await writeError(args.output, message);
		process.exit(1);
	}

	try {
		// Lazy import — provider validates env vars on load, so defer until args are valid
		const { reviewCode } = await import("./agent/reviewer.js");

		const input: ReviewInput = {
			diff,
			prTitle: args.prTitle,
			prBody: args.prBody,
		};

		const result = await reviewCode(input);
		await writeFile(args.output, JSON.stringify(result, null, 2));
		console.log(`Review complete: ${result.verdict}`);
		console.log(`Output written to: ${args.output}`);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error during review";
		console.error(`Review failed: ${message}`);
		await writeError(args.output, message);
		process.exit(1);
	}
}

main();
