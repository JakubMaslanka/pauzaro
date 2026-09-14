import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high"]);

export const ReviewFindingSchema = z.object({
	line: z.number().describe("Line number where the issue occurs"),
	severity: SeveritySchema.describe("Issue severity level"),
	category: z.string().describe("Category of the issue (e.g. bug, performance, style)"),
	message: z.string().describe("Description of the issue found"),
	suggestedFix: z.string().describe("Suggested code fix or improvement"),
});

export const ReviewResultSchema = z.object({
	findings: z.array(ReviewFindingSchema).describe("List of code review findings"),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
