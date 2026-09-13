import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import {
	getSettings,
	setAutostart as invokeSetAutostart,
	setWeekStart as invokeSetWeekStart,
} from "../lib/invoke";
import { detectWeekStart } from "../lib/locale";
import type { Settings, WeekStartDay } from "../types";

interface SettingsStore {
	weekStartDay: WeekStartDay;
	autostartEnabled: boolean;
	loaded: boolean;
	init: () => Promise<void>;
	setWeekStart: (day: WeekStartDay) => Promise<void>;
	setAutostart: (enabled: boolean) => Promise<void>;
}

/** Resolve the raw DB value into a concrete WeekStartDay. */
function resolveWeekStart(raw: Settings["week_start_day"]): WeekStartDay {
	if (raw === "sunday" || raw === "monday") return raw;
	return detectWeekStart();
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
	weekStartDay: "monday",
	autostartEnabled: false,
	loaded: false,

	async init() {
		if (get().loaded) return;

		try {
			const settings = await getSettings();
			const resolved = resolveWeekStart(settings.week_start_day);

			set({
				weekStartDay: resolved,
				autostartEnabled: settings.autostart_enabled,
				loaded: true,
			});

			// If sentinel 'auto' was present, persist the detected value
			if (settings.week_start_day === "auto") {
				console.info(
					`[settings] Auto-detected week start: ${resolved} (locale: ${navigator.language})`,
				);
				try {
					await invokeSetWeekStart(resolved);
				} catch (error) {
					console.error("Failed to persist detected week start:", error);
				}
			}
		} catch (error) {
			console.error("Failed to load settings:", error);
			set({ loaded: true });
		}

		// Sync from tray toggle or other sources
		listen<Settings>("settings-changed", (event) => {
			const s = event.payload;
			set({
				weekStartDay: resolveWeekStart(s.week_start_day),
				autostartEnabled: s.autostart_enabled,
			});
		});
	},

	async setWeekStart(day: WeekStartDay) {
		try {
			const updated = await invokeSetWeekStart(day);
			set({
				weekStartDay: resolveWeekStart(updated.week_start_day),
			});
		} catch (error) {
			console.error("Failed to set week start:", error);
			throw error;
		}
	},

	async setAutostart(enabled: boolean) {
		try {
			const updated = await invokeSetAutostart(enabled);
			set({
				autostartEnabled: updated.autostart_enabled,
			});
		} catch (error) {
			console.error("Failed to set autostart:", error);
			throw error;
		}
	},
}));
