import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const ConfigSchema = z.object({
	openaiApiKey: z.string().min(1, "LLM_PROVIDER_API_KEY is required"),
	model: z.string().default("gpt-5.6-luna"),
});

export const config = ConfigSchema.parse({
	openaiApiKey: process.env.LLM_PROVIDER_API_KEY,
	model: process.env.LLM_PROVIDER_MODEL,
});

export const openai = createOpenAI({
	apiKey: config.openaiApiKey,
});

export const model = openai(config.model);
