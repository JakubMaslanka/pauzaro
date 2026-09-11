import { describe, expect, it } from "vitest";
import { getMascotReaction } from "./mascot";

describe("getMascotReaction", () => {
	describe("streak tiers (no freeze)", () => {
		it("returns 'sad' for streak 0", () => {
			expect(getMascotReaction({ streak: 0, isFrozen: false })).toBe("sad");
		});

		it("returns 'promising' for streak 1", () => {
			expect(getMascotReaction({ streak: 1, isFrozen: false })).toBe(
				"promising",
			);
		});

		it("returns 'promising' for streak 2", () => {
			expect(getMascotReaction({ streak: 2, isFrozen: false })).toBe(
				"promising",
			);
		});

		it("returns 'happy' for streak 3", () => {
			expect(getMascotReaction({ streak: 3, isFrozen: false })).toBe("happy");
		});

		it("returns 'happy' for streak 6", () => {
			expect(getMascotReaction({ streak: 6, isFrozen: false })).toBe("happy");
		});

		it("returns 'successful' for streak 7", () => {
			expect(getMascotReaction({ streak: 7, isFrozen: false })).toBe(
				"successful",
			);
		});

		it("returns 'successful' for streak 13", () => {
			expect(getMascotReaction({ streak: 13, isFrozen: false })).toBe(
				"successful",
			);
		});

		it("returns 'successful-glow' for streak 14", () => {
			expect(getMascotReaction({ streak: 14, isFrozen: false })).toBe(
				"successful-glow",
			);
		});

		it("returns 'successful-glow' for streak 100", () => {
			expect(getMascotReaction({ streak: 100, isFrozen: false })).toBe(
				"successful-glow",
			);
		});
	});

	describe("freeze override", () => {
		it("returns 'freeze' when frozen, regardless of streak 0", () => {
			expect(getMascotReaction({ streak: 0, isFrozen: true })).toBe("freeze");
		});

		it("returns 'freeze' when frozen at streak 5", () => {
			expect(getMascotReaction({ streak: 5, isFrozen: true })).toBe("freeze");
		});

		it("returns 'freeze' when frozen at streak 14", () => {
			expect(getMascotReaction({ streak: 14, isFrozen: true })).toBe("freeze");
		});

		it("returns 'freeze' when frozen at streak 100", () => {
			expect(getMascotReaction({ streak: 100, isFrozen: true })).toBe("freeze");
		});
	});

	describe("edge cases", () => {
		it("returns 'sad' for negative streak", () => {
			expect(getMascotReaction({ streak: -1, isFrozen: false })).toBe("sad");
		});
	});
});
