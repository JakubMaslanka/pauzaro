# Autostart & Tray — Manual Verification

## Quick Smoke Test

1. `pnpm tauri dev` — app starts without errors
2. Tray menu shows: **Show Dashboard** / **Launch on startup** / ─── / **Quit Pauzaro**
3. "Launch on startup" starts **unchecked**

## Tray Toggle

4. Click "Launch on startup" — checkmark appears
5. Open **System Settings > General > Login Items** — Pauzaro listed
6. Quit app, relaunch — checkmark persists as checked
7. Click again to uncheck — Pauzaro removed from Login Items

## Settings Page

8. Navigate to Settings page — CheckboxCard shows "Launch on startup"
9. Checkbox state matches tray menu state
10. Toggle card — calls backend, checkbox updates

## Bidirectional Sync

11. Open Settings page, toggle via **tray menu** — settings page checkbox updates in real time
12. Toggle via **settings page** — tray menu checkmark updates

## Error Handling

13. (Optional) Revoke login items permission, try toggling — error message appears on settings page with guidance text

## DB Verification

14. Open SQLite DB (`~/Library/Application Support/com.pauzaro.dev/pauzaro.db`)
15. `SELECT * FROM settings;` — row exists with `autostart_enabled` matching toggle state

## Commits

| Phase | SHA | Description |
|-------|-----|-------------|
| 1 | `bd4e2d9` | Backend foundation — settings table, plugin, commands |
| 2 | `84d1708` | Refactor — extract tray.rs module |
| 3 | `f6477f6` | Tray menu CheckMenuItem toggle with sync |
| 4 | `94d610e` | Settings page CheckboxCard toggle |
