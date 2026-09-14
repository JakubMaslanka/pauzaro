import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const ConfigSchema = z.object({
	openaiApiKey: z.string().min(1, "LLM_PROVIDER_API_KEY is required"),
	model: z.string().default("gpt-5.6-luna"),
});

const config = ConfigSchema.parse({
	openaiApiKey: process.env.LLM_PROVIDER_API_KEY,
	model: process.env.LLM_PROVIDER_MODEL,
});

const openai = createOpenAI({
	apiKey: config.openaiApiKey,
});

const model = openai(config.model);

const brokenFibonacci = `
function fibonacci(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibonacci(n - 1) + fibonacci(n - 3);
}
`.trim();

async function reviewCode(code: string): Promise<string> {
	const result = await generateText({
		model,
		instructions:
			"You are a senior code reviewer. " +
			"Find bugs, suggest fixes, and rate severity (low/medium/high). " +
			"Be concise.",
		prompt: `Review this function:\n\n\`\`\`js\n${code}\n\`\`\``,
	});

	return result.text;
}

async function main() {
	console.log("Reviewing code...\n");
	console.log("Input:\n", brokenFibonacci, "\n");

	const review = await reviewCode(brokenFibonacci);

	console.log("Review:\n", review);
}

main().catch(console.error);
