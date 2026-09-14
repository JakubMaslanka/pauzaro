import { reviewCode } from "./index.js";

const brokenFibonacci = `
function fibonacci(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibonacci(n - 1) + fibonacci(n - 3);
}
`.trim();

async function main() {
	console.log("Reviewing code...\n");
	console.log("Input:\n", brokenFibonacci, "\n");

	const result = await reviewCode(brokenFibonacci);

	console.log("Review:\n", JSON.stringify(result, null, 2));
}

main().catch(console.error);
