import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
	options: {
		"result-file": { type: "string" },
		output: { type: "string" },
		truncated: { type: "boolean", default: false },
		"original-lines": { type: "string" },
	},
	strict: true,
});

if (!values["result-file"] || !values.output) {
	console.error(
		"Usage: render-comment.mjs --result-file <path> --output <path> [--truncated] [--original-lines <N>]",
	);
	process.exit(1);
}

const raw = readFileSync(values["result-file"], "utf-8");
const review = JSON.parse(raw);

if (review.error) {
	const body = [
		"<!-- ai-code-review -->",
		"## ⚠️ AI Code Review: Error",
		"",
		"The automated review could not be completed.",
		"",
		`**Error:** ${review.error}`,
		"",
		"_You can retry by adding the `ai-cr:review` label._",
	].join("\n");

	writeFileSync(values.output, body);
	process.exit(0);
}

const verdictEmoji = review.verdict === "passed" ? "✅" : "❌";
const verdictLabel = review.verdict === "passed" ? "PASSED" : "FAILED";

const criteriaRows = [
	["Implementation Correctness", review.criteria.implementationCorrectness],
	["Idiomaticity", review.criteria.idiomaticity],
	["Complexity", review.criteria.complexity],
	["Test / Risk Coverage", review.criteria.testRiskCoverage],
	["Documentation", review.criteria.documentation],
	["Security & Safety", review.criteria.securityAndSafety],
]
	.map(([name, c]) => `| ${name} | ${c.score}/10 | ${c.reasoning} |`)
	.join("\n");

const lines = [
	"<!-- ai-code-review -->",
	`## ${verdictEmoji} AI Code Review: ${verdictLabel}`,
	"",
	review.summary,
];

if (values.truncated) {
	const original = values["original-lines"] || "unknown";
	lines.push(
		"",
		`> ⚠️ Diff was truncated from ${original} to 3,000 lines for review.`,
	);
}

lines.push(
	"",
	"### Criteria Scores",
	"",
	"| Criterion | Score | Reasoning |",
	"|-----------|-------|-----------|",
	criteriaRows,
);

if (review.findings && review.findings.length > 0) {
	const top = review.findings.slice(0, 5);
	lines.push("", "### Top Findings", "");
	for (const f of top) {
		lines.push(
			`- **${f.severity.toUpperCase()}** \`${f.file}:${f.line}\` — ${f.message}`,
		);
		if (f.suggestedFix) {
			lines.push(`  > 💡 ${f.suggestedFix}`);
		}
	}
	if (review.findings.length > 5) {
		lines.push(
			"",
			`_...and ${review.findings.length - 5} more finding(s) in the full report._`,
		);
	}
}

lines.push(
	"",
	"---",
	"_Automated review powered by AI. Use the `ai-cr:review` label to re-run._",
);

writeFileSync(values.output, lines.join("\n"));
