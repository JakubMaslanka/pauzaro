import { afterEach, describe, expect, it, vi } from "vitest";
import { detectWeekStart } from "./locale";

describe("detectWeekStart", () => {
	const originalIntl = globalThis.Intl;

	afterEach(() => {
		Object.defineProperty(globalThis, "Intl", {
			value: originalIntl,
			writable: true,
		});
		vi.restoreAllMocks();
	});

	function mockLocale(weekInfo: { firstDay?: number } | undefined) {
		function MockLocale() {
			return { weekInfo };
		}
		Object.defineProperty(globalThis, "Intl", {
			value: { ...originalIntl, Locale: MockLocale },
			writable: true,
		});
	}

	function mockLocaleWithGetWeekInfo(
		weekInfo: { firstDay?: number } | undefined,
	) {
		function MockLocale() {
			return { weekInfo: undefined, getWeekInfo: () => weekInfo };
		}
		Object.defineProperty(globalThis, "Intl", {
			value: { ...originalIntl, Locale: MockLocale },
			writable: true,
		});
	}

	it("returns 'sunday' when firstDay is 7", () => {
		mockLocale({ firstDay: 7 });
		expect(detectWeekStart()).toBe("sunday");
	});

	it("returns 'monday' when firstDay is 1", () => {
		mockLocale({ firstDay: 1 });
		expect(detectWeekStart()).toBe("monday");
	});

	it("returns 'monday' for Saturday-start locales (firstDay 6)", () => {
		mockLocale({ firstDay: 6 });
		expect(detectWeekStart()).toBe("monday");
	});

	it("returns 'sunday' via getWeekInfo() fallback when weekInfo property missing", () => {
		mockLocaleWithGetWeekInfo({ firstDay: 7 });
		expect(detectWeekStart()).toBe("sunday");
	});

	it("returns 'monday' when weekInfo unavailable", () => {
		mockLocale(undefined);
		expect(detectWeekStart()).toBe("monday");
	});

	it("returns 'monday' when Intl.Locale constructor throws", () => {
		function MockLocale() {
			throw new Error("Not supported");
		}
		Object.defineProperty(globalThis, "Intl", {
			value: { ...originalIntl, Locale: MockLocale },
			writable: true,
		});
		expect(detectWeekStart()).toBe("monday");
	});
});
