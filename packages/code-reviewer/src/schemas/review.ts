import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high"]);

export const ReviewFindingSchema = z.object({
	file: z.string().describe("File path from the diff where the issue occurs"),
	line: z.number().describe("Line number where the issue occurs"),
	severity: SeveritySchema.describe("Issue severity level"),
	category: z
		.string()
		.describe("Category of the issue (e.g. bug, performance, style)"),
	message: z.string().describe("Description of the issue found"),
	suggestedFix: z.string().describe("Suggested code fix or improvement"),
});

const CriterionSchema = z.object({
	score: z
		.number()
		.int()
		.min(1)
		.max(10)
		.describe("Score from 1 (worst) to 10 (best)"),
	reasoning: z.string().describe("Brief justification for the score"),
});

export const ReviewResultSchema = z.object({
	criteria: z.object({
		implementationCorrectness: CriterionSchema.describe(
			"Does the code do what the PR claims without introducing bugs or regressions?",
		),
		idiomaticity: CriterionSchema.describe(
			"Does the code follow language, framework, and project conventions?",
		),
		complexity: CriterionSchema.describe(
			"Is the solution as simple as it can be while meeting requirements?",
		),
		testRiskCoverage: CriterionSchema.describe(
			"Are the riskiest paths exercised by tests that catch breakage?",
		),
		documentation: CriterionSchema.describe(
			"Are non-obvious decisions, public interfaces, and setup steps explained?",
		),
		securityAndSafety: CriterionSchema.describe(
			"Does the code avoid introducing vulnerabilities or unsafe data handling?",
		),
	}),
	verdict: z
		.enum(["passed", "failed"])
		.describe("Overall pass/fail verdict decided by the reviewer"),
	summary: z.string().describe("High-level summary of the review"),
	findings: z
		.array(ReviewFindingSchema)
		.describe("List of concrete code review findings"),
});

export const ReviewInputSchema = z.object({
	diff: z.string(),
	prTitle: z.string(),
	prBody: z.string(),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
export type ReviewInput = z.infer<typeof ReviewInputSchema>;
