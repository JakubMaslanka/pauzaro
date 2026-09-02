# Backend — Rust + Tauri 2

## Tauri Command Patterns

### Command Structure
Every command returns `Result<T, E>` — never panic in a command. Keep commands thin: validate input, call domain logic, return result.

```rust
#[tauri::command]
fn create_habit(state: State<'_, AppState>, input: NewHabitInput) -> Result<Habit, AppError> {
    input.validate()?;
    let habit = state.db.insert_habit(input)?;
    Ok(habit)
}
```

### Command Naming
Use snake_case matching frontend expectations. Group by domain: `create_habit`, `list_habits`, `delete_habit`, `complete_habit`.

### Async Commands
Use `async` for I/O-bound operations (database queries, file access). Tauri runs async commands off the main thread.

```rust
#[tauri::command]
async fn list_habits(state: State<'_, AppState>) -> Result<Vec<Habit>, AppError> {
    let habits = state.db.list_habits().await?;
    Ok(habits)
}
```

### State Management
Use `tauri::State<>` for shared app state. Initialize in `setup` hook. Wrap mutable state in `Mutex` or `RwLock`.

```rust
pub struct AppState {
    pub db: Mutex<Database>,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let db = Database::open(app.path().app_data_dir()?)?;
            app.manage(AppState { db: Mutex::new(db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_habit,
            list_habits,
            delete_habit,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
```

## Error Handling

### Custom Error Type
Single error type for all commands. Implement `serde::Serialize` so Tauri can send it to frontend.

```rust
use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum AppError {
    Database(String),
    Validation(String),
    NotFound(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Database(msg) => write!(f, "Database error: {msg}"),
            AppError::Validation(msg) => write!(f, "Validation error: {msg}"),
            AppError::NotFound(msg) => write!(f, "Not found: {msg}"),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}
```

### Use `?` Operator Everywhere
Convert errors at boundaries via `From` impls. Never `.unwrap()` in production code — `.unwrap()` only in tests.

## SQLite / Database Patterns

### Migration System
Keep migrations in ordered SQL files. Run on app startup. Always `IF NOT EXISTS`.

```rust
const MIGRATIONS: &[&str] = &[
    "CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        frequency TEXT NOT NULL,
        target INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )",
    "CREATE TABLE IF NOT EXISTS completions (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        completed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )",
];

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    for migration in MIGRATIONS {
        conn.execute_batch(migration)?;
    }
    Ok(())
}
```

### Repository Pattern
Separate database access from business logic. One struct, one responsibility.

```rust
pub struct HabitRepository<'a> {
    conn: &'a Connection,
}

impl<'a> HabitRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn insert(&self, input: &NewHabitInput) -> Result<Habit, rusqlite::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO habits (id, name, frequency, target) VALUES (?1, ?2, ?3, ?4)",
            params![id, input.name, input.frequency, input.target],
        )?;
        self.find_by_id(&id)
    }

    pub fn find_by_id(&self, id: &str) -> Result<Habit, rusqlite::Error> {
        self.conn.query_row(
            "SELECT id, name, frequency, target, created_at FROM habits WHERE id = ?1",
            params![id],
            |row| Ok(Habit {
                id: row.get(0)?,
                name: row.get(1)?,
                frequency: row.get(2)?,
                target: row.get(3)?,
                created_at: row.get(4)?,
            }),
        )
    }

    pub fn list(&self) -> Result<Vec<Habit>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, frequency, target, created_at FROM habits ORDER BY created_at DESC",
        )?;
        let habits = stmt.query_map([], |row| Ok(Habit {
            id: row.get(0)?,
            name: row.get(1)?,
            frequency: row.get(2)?,
            target: row.get(3)?,
            created_at: row.get(4)?,
        }))?
        .collect::<Result<Vec<_>, _>>()?;
        Ok(habits)
    }

    pub fn delete(&self, id: &str) -> Result<bool, rusqlite::Error> {
        let rows = self.conn.execute("DELETE FROM habits WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }
}
```

### Parameterized Queries Only
Never format SQL strings with user input. Always use `params![]`.

## Data Modeling

### Serde for Frontend Communication
All types sent to/from frontend derive `Serialize` + `Deserialize`. Keep field names consistent with TypeScript interfaces.

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub frequency: HabitFrequency,
    pub target: i32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HabitFrequency {
    Daily,
    Weekdays,
    Custom,
}

#[derive(Debug, Deserialize)]
pub struct NewHabitInput {
    pub name: String,
    pub frequency: HabitFrequency,
    pub target: i32,
}
```

### Validation
Validate inputs before they reach database. Implement on the input struct.

```rust
impl NewHabitInput {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.name.trim().is_empty() {
            return Err(AppError::Validation("Name cannot be empty".into()));
        }
        if self.target < 1 {
            return Err(AppError::Validation("Target must be at least 1".into()));
        }
        Ok(())
    }
}
```

## Module Organization

```
src/
  lib.rs          # Tauri setup, command registration
  main.rs         # Entry point (calls lib::run)
  error.rs        # AppError type + From impls
  db/
    mod.rs         # Database struct, connection, migrations
    habits.rs      # HabitRepository
    streaks.rs     # StreakRepository
    completions.rs # CompletionRepository
  models/
    mod.rs         # Re-exports
    habit.rs       # Habit, NewHabitInput, HabitFrequency
    streak.rs      # Streak, StreakStatus
  commands/
    mod.rs         # Re-exports all command functions
    habits.rs      # create_habit, list_habits, delete_habit
    streaks.rs     # get_streak, freeze_streak
```

## Testing

### Integration Tests
Use `/rust-integration-test` skill. Each test gets isolated temp SQLite DB — created before, deleted after.

### Unit Tests
In-module `#[cfg(test)]` for pure logic (streak calculation, validation, date math).

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_rejects_empty_name() {
        let input = NewHabitInput {
            name: "".into(),
            frequency: HabitFrequency::Daily,
            target: 5,
        };
        assert!(input.validate().is_err());
    }

    #[test]
    fn test_validate_rejects_zero_target() {
        let input = NewHabitInput {
            name: "Pull-ups".into(),
            frequency: HabitFrequency::Daily,
            target: 0,
        };
        assert!(input.validate().is_err());
    }
}
```

## Performance

- **Use `RwLock` over `Mutex`** when reads vastly outnumber writes (habit list vs habit create)
- **Batch writes in transactions** — multiple inserts in one `conn.execute_batch()` or explicit transaction
- **Index frequently queried columns** — `habit_id` + `completed_at` on completions table
- **Avoid cloning large structs** — pass references, clone only at serialization boundary

## Hard Rules

- Never `.unwrap()` or `.expect()` in command handlers — always propagate with `?`
- Never build SQL by string formatting — use parameterized queries
- All public types crossing IPC boundary derive `Serialize`
- All input types derive `Deserialize` and have `validate()` method
- Mutations (create/update/delete) return affected entity, not just status
- Database path from `app.path().app_data_dir()` — never hardcode paths
- Use local time (`chrono::Local::now()`) — never `chrono::Utc::now()`. App runs locally on one device; no server, no timezone sync. Date strings use `YYYY-MM-DD` format in local time
