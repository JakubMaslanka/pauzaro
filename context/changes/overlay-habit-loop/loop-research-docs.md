# S-02 Latest Docs Fetch: Option E Dependencies

> Fetched: 2026-08-29
> Source: context7 (Tauri v2 docs, Tokio docs.rs)

---

## 1. Tauri 2 — Window Creation (WebviewWindowBuilder)

### Rust — overlay window

```rust
use tauri::{WebviewUrl, WebviewWindowBuilder};

WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
    .title("Overlay")
    .inner_size(400.0, 300.0)
    .decorations(false)        // borderless
    .always_on_top(true)       // stays above all windows
    .skip_taskbar(true)        // no taskbar entry
    .center()
    .build()?;
```

### JS — create from frontend (alternative)

```javascript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const webview = new WebviewWindow('overlay', { url: 'overlay.html' });
webview.once('tauri://created', () => { /* ready */ });
webview.once('tauri://error', (e) => console.error(e));
```

### macOS transparent titlebar

```rust
use tauri::{TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
    .title("Transparent Titlebar Window")
    .inner_size(800.0, 600.0);

#[cfg(target_os = "macos")]
let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);

let window = win_builder.build().unwrap();

#[cfg(target_os = "macos")]
{
    use objc2_app_kit::{NSColor, NSWindow};
    let ns_window_ptr = window.ns_window().unwrap() as *mut NSWindow;
    let ns_window = unsafe { &*ns_window_ptr };
    let bg_color = NSColor::colorWithRed_green_blue_alpha(
        50.0 / 255.0, 158.0 / 255.0, 163.5 / 255.0, 1.0,
    );
    ns_window.setBackgroundColor(Some(&bg_color));
}
```

### Config-level decorations

```json
{
  "tauri": {
    "windows": [
      { "decorations": false }
    ]
  }
}
```

---

## 2. Tauri 2 — Event System

Redesigned in v2: `emit()` broadcasts to all, `emitTo()` targets by label.

### Emit globally

```javascript
import { emit } from '@tauri-apps/api/event';
emit('file-selected', '/path/to/file');
```

### Emit to specific window

```javascript
import { emitTo } from '@tauri-apps/api/event';
emitTo('overlay', 'show-overlay', { habitId: '...' });
```

### Listen (webview-scoped)

```typescript
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const appWebview = getCurrentWebviewWindow();
appWebview.listen<string>('show-overlay', (event) => {
  // handle overlay trigger
});
```

### Catch-all listener (any webview)

```javascript
import { listen } from '@tauri-apps/api/event';
listen('state-changed', (event) => {
  console.log('got state changed event', event);
}, { target: { kind: 'Any' } });
```

### Rust-side emit

```rust
// From AppHandle (available in commands and setup)
app.emit("show-overlay", &trigger.habit_id).unwrap();

// Targeted to specific webview
app.emit_to("overlay", "show-overlay", &payload).unwrap();
```

---

## 3. Tokio — spawn / select! / sleep / Notify

### tokio::spawn

```rust
// Signature: pub fn spawn<F>(future: F) -> JoinHandle<F::Output>
// Requires: F: Future + Send + 'static, F::Output: Send + 'static

tokio::spawn(async move {
    // runs concurrently in background
});
```

### tokio::sync::Notify

Zero-data wake signal. Like semaphore starting at 0 permits.

```rust
use tokio::sync::Notify;
use std::collections::VecDeque;
use std::sync::Mutex;

struct Channel<T> {
    values: Mutex<VecDeque<T>>,
    notify: Notify,
}

impl<T> Channel<T> {
    pub fn send(&self, value: T) {
        self.values.lock().unwrap().push_back(value);
        self.notify.notify_one(); // stores one permit
    }

    pub async fn recv(&self) -> T {
        loop {
            if let Some(value) = self.values.lock().unwrap().pop_front() {
                return value;
            }
            self.notify.notified().await; // waits for permit
        }
    }
}
```

### select! with sleep (pin required in loop)

```rust
use tokio::time::{self, Duration, Instant};

let sleep = time::sleep(Duration::from_millis(10));
tokio::pin!(sleep);

loop {
    tokio::select! {
        () = &mut sleep => {
            println!("timer elapsed");
            sleep.as_mut().reset(Instant::now() + Duration::from_millis(50));
        },
    }
}
```

**Important**: `select!` runs branches on current thread, not parallel. If one branch blocks, all halt.

---

## 4. Tauri 2 — Commands & State

### Async command with managed state

```rust
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
async fn increase_counter(state: State<'_, Mutex<AppState>>) -> Result<u32, ()> {
    let mut state = state.lock().await;
    state.counter += 1;
    Ok(state.counter)
}
```

### AppHandle in command

```rust
#[tauri::command]
async fn my_command(app_handle: tauri::AppHandle) {
    // access app features, emit events, etc.
}
```

### Registration

```rust
tauri::Builder::default()
    .manage(MyState("value".into()))
    .invoke_handler(tauri::generate_handler![my_command])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

### Frontend invoke

```javascript
import { invoke } from '@tauri-apps/api/core';

invoke('my_command', { habitId: '...' })
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
```

---

## 5. Validation: Research Claims vs Docs

| Research claim | Confirmed |
|---|---|
| `always_on_top(true)` builder method | ✅ `alwaysOnTop` option exists |
| `decorations(false)` for borderless | ✅ config + builder both support |
| `skip_taskbar(true)` | ✅ builder API (docs.rs) |
| `emit` / `emitTo` cross-window events | ✅ v2 redesigned, `emitTo(label, event, payload)` |
| `tokio::select!` with sleep + Notify | ✅ pin required for loop reuse |
| `Notify::notify_one()` stores permit | ✅ single-consumer safe |
| Async commands required (Windows deadlock) | ✅ use `async` commands |
| `State<'_>` for managed Scheduler | ✅ standard pattern |

## 6. Correction to Research Skeleton Code

Research skeleton uses `tokio::time::sleep(delay)` inside `select!` loop without pinning. Per tokio docs, **must pin** when reusing sleep in loop:

```rust
// WRONG (from research skeleton):
tokio::select! {
    _ = tokio::time::sleep(delay.to_std().unwrap()) => { ... }
    _ = self.notify.notified() => { continue; }
}

// CORRECT — pin sleep for reuse in loop:
let sleep = tokio::time::sleep(delay.to_std().unwrap());
tokio::pin!(sleep);
tokio::select! {
    () = &mut sleep => { ... }
    _ = self.notify.notified() => { continue; }
}
```

Note: in practice, since research code creates a **new** `sleep` each loop iteration (not reusing), pinning is technically not required there. But pinning is best practice and required if sleep ever gets reused across iterations.
