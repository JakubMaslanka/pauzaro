import type { WeekStartDay } from "../types";

/**
 * Detect preferred week start from browser locale using Intl.Locale.weekInfo.
 * CLDR convention: firstDay 1=Mon, 7=Sun.
 * Falls back to "monday" if API unavailable or on error.
 */
export function detectWeekStart(): WeekStartDay {
	try {
		const locale = new Intl.Locale(navigator.language) as unknown as {
			weekInfo?: { firstDay?: number };
			getWeekInfo?: () => { firstDay?: number };
		};
		// Some browsers expose .weekInfo property, others .getWeekInfo() method
		const info = locale.weekInfo ?? locale.getWeekInfo?.();
		if (info?.firstDay === 7) return "sunday";
		return "monday";
	} catch {
		return "monday";
	}
}
