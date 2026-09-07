/**
 * Playwright fixture for Tauri 2 IPC mocking.
 *
 * Tauri commands (invoke) and events (listen/emit) only work inside
 * a Tauri webview. When Playwright drives the Vite dev server directly,
 * window.__TAURI_INTERNALS__ is missing and every invoke throws.
 *
 * This fixture injects a mock IPC bridge before any page script runs,
 * letting E2E tests control command responses and emit events as if
 * the Rust backend were present.
 *
 * Usage:
 *   import { test, expect } from "./fixtures/tauri";
 *
 *   test("example", async ({ page, tauriMock }) => {
 *     await tauriMock.setResponses({ list_habits: [] });
 *     await page.goto("/dashboard");
 *     // ...
 *     await tauriMock.updateResponses({ list_habits: [habit] });
 *     await tauriMock.emitEvent("habit-updated");
 *   });
 */
import { test as base, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Browser-side init script (pure JS — no TypeScript syntax inside)
// Injected via page.addInitScript before any app code runs.
// ---------------------------------------------------------------------------
const TAURI_MOCK_BRIDGE = /* js */ `
(function () {
  var responses = {};
  var callLog = [];
  var eventListeners = new Map();
  var callbacks = new Map();

  function registerCallback(callback) {
    var id = crypto.getRandomValues(new Uint32Array(1))[0];
    callbacks.set(id, function (data) {
      return callback && callback(data);
    });
    return id;
  }

  function runCallback(id, data) {
    var cb = callbacks.get(id);
    if (cb) cb(data);
  }

  function unregisterCallback(id) {
    callbacks.delete(id);
  }

  window.__TAURI_MOCK_RESPONSES__ = responses;
  window.__TAURI_MOCK_CALL_LOG__ = callLog;

  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    },

    invoke: function (cmd, args) {
      callLog.push({ cmd: cmd, args: args, ts: Date.now() });

      // --- Event plugin commands (listen / emit / unlisten) ---
      if (cmd === "plugin:event|listen") {
        if (!eventListeners.has(args.event)) eventListeners.set(args.event, []);
        eventListeners.get(args.event).push(args.handler);
        return Promise.resolve(args.handler);
      }
      if (cmd === "plugin:event|emit") {
        var listeners = eventListeners.get(args.event) || [];
        for (var i = 0; i < listeners.length; i++) {
          runCallback(listeners[i], { event: args.event, payload: args.payload });
        }
        return Promise.resolve(null);
      }
      if (cmd === "plugin:event|unlisten") {
        var list = eventListeners.get(args.event);
        if (list) {
          var idx = list.indexOf(args.id);
          if (idx !== -1) list.splice(idx, 1);
        }
        return Promise.resolve();
      }

      // --- Regular commands: look up mock response ---
      var response = window.__TAURI_MOCK_RESPONSES__[cmd];
      if (response !== undefined) {
        // Deep-clone to prevent test mutation leaking between calls
        return Promise.resolve(JSON.parse(JSON.stringify(response)));
      }

      console.warn("[TAURI_MOCK] No mock for command:", cmd, args);
      return Promise.resolve(null);
    },

    transformCallback: registerCallback,
    runCallback: runCallback,
    unregisterCallback: unregisterCallback,
    callbacks: callbacks,
    convertFileSrc: function (path) { return path; },
  };

  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: function (_event, id) { unregisterCallback(id); },
  };

  // Helper for tests to emit events from page.evaluate()
  window.__TAURI_MOCK_EMIT__ = function (event, payload) {
    var ls = eventListeners.get(event) || [];
    for (var i = 0; i < ls.length; i++) {
      runCallback(ls[i], { event: event, payload: payload });
    }
  };
})();
`;

// ---------------------------------------------------------------------------
// TauriMock — test-side helper wrapping page.evaluate calls
// ---------------------------------------------------------------------------
class TauriMock {
	constructor(private page: Page) {}

	/**
	 * Set initial mock responses for Tauri commands.
	 * Call BEFORE page.goto() — uses addInitScript so responses are
	 * available before app code runs.
	 */
	async setResponses(
		responses: Record<string, unknown>,
	): Promise<void> {
		await this.page.addInitScript(
			(r: Record<string, unknown>) => {
				Object.assign(
					(window as unknown as Record<string, unknown>).__TAURI_MOCK_RESPONSES__ as Record<string, unknown>,
					r,
				);
			},
			responses,
		);
	}

	/**
	 * Update mock responses on an already-loaded page.
	 * Next invoke() call from the app will use the new values.
	 */
	async updateResponses(
		responses: Record<string, unknown>,
	): Promise<void> {
		await this.page.evaluate(
			(r: Record<string, unknown>) => {
				Object.assign(
					(window as unknown as Record<string, unknown>).__TAURI_MOCK_RESPONSES__ as Record<string, unknown>,
					r,
				);
			},
			responses,
		);
	}

	/**
	 * Emit a Tauri event in the browser, simulating what the Rust
	 * backend does with app.emit(). Triggers all registered listeners.
	 */
	async emitEvent(
		event: string,
		payload?: unknown,
	): Promise<void> {
		await this.page.evaluate(
			([e, p]: [string, unknown]) => {
				const emit = (window as unknown as Record<string, unknown>).__TAURI_MOCK_EMIT__ as
					| ((event: string, payload?: unknown) => void)
					| undefined;
				emit?.(e, p);
			},
			[event, payload] as [string, unknown],
		);
	}

	/** Read the IPC call log for assertions on which commands were invoked. */
	async getCallLog(): Promise<
		Array<{ cmd: string; args: unknown; ts: number }>
	> {
		return this.page.evaluate(
			() =>
				(window as unknown as Record<string, unknown>).__TAURI_MOCK_CALL_LOG__ as Array<{
					cmd: string;
					args: unknown;
					ts: number;
				}>,
		);
	}
}

// ---------------------------------------------------------------------------
// Extended test fixture
// ---------------------------------------------------------------------------
interface TauriFixtures {
	tauriMock: TauriMock;
}

export const test = base.extend<TauriFixtures>({
	tauriMock: async ({ page }, use) => {
		await page.addInitScript({ content: TAURI_MOCK_BRIDGE });
		await use(new TauriMock(page));
	},
});

export { expect } from "@playwright/test";
