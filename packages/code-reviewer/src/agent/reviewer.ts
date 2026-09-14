import { ToolLoopAgent, Output } from "ai";
import { model } from "../provider/openai.js";
import { REVIEW_INSTRUCTIONS, buildReviewPrompt } from "../prompts/review.js";
import {
	ReviewResultSchema,
	type ReviewResult,
	type ReviewInput,
} from "../schemas/review.js";

export const codeReviewAgent = new ToolLoopAgent({
	model,
	instructions: REVIEW_INSTRUCTIONS,
	output: Output.object({ schema: ReviewResultSchema }),
});

export async function reviewCode(input: ReviewInput): Promise<ReviewResult> {
	const result = await codeReviewAgent.generate({
		prompt: buildReviewPrompt(input),
	});

	return result.output;
}
