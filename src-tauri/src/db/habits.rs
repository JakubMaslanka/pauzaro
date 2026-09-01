use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::{CreateHabitInput, Habit, TimeSlot};

pub struct HabitRepository<'a> {
    conn: &'a Connection,
}

impl<'a> HabitRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(&self, input: &CreateHabitInput) -> Result<Habit, AppError> {
        input.validate()?;

        let habit_id = uuid::Uuid::new_v4().to_string();
        let description = input.description.as_deref().unwrap_or("");
        let icon_color = input.icon_color.as_deref().unwrap_or("#000000");
        let icon_stroke_width = input.icon_stroke_width.unwrap_or(2.0);

        let tx = self.conn.unchecked_transaction()?;

        tx.execute(
            "INSERT INTO habits (id, name, description, icon, icon_color, icon_stroke_width, start_date, end_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                habit_id,
                input.name.trim(),
                description,
                input.icon,
                icon_color,
                icon_stroke_width,
                input.start_date,
                input.end_date,
            ],
        )?;

        for &day in &input.schedule_days {
            let day_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO habit_schedule_days (id, habit_id, day_of_week) VALUES (?1, ?2, ?3)",
                params![day_id, habit_id, day],
            )?;
        }

        for slot in &input.schedule_times {
            let time_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO habit_schedule_times (id, habit_id, start_time) VALUES (?1, ?2, ?3)",
                params![time_id, habit_id, slot.start_time],
            )?;
        }

        tx.commit()?;

        self.get(&habit_id)
    }

    pub fn get(&self, id: &str) -> Result<Habit, AppError> {
        let habit = self.conn.query_row(
            "SELECT id, name, description, icon, icon_color, icon_stroke_width, start_date, end_date, is_active, created_at
             FROM habits WHERE id = ?1",
            params![id],
            |row| {
                let is_active: i32 = row.get(8)?;
                Ok(HabitRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    icon: row.get(3)?,
                    icon_color: row.get(4)?,
                    icon_stroke_width: row.get(5)?,
                    start_date: row.get(6)?,
                    end_date: row.get(7)?,
                    is_active: is_active != 0,
                    created_at: row.get(9)?,
                })
            },
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Habit not found: {id}"))
            }
            other => AppError::from(other),
        })?;

        let schedule_days = self.get_schedule_days(&habit.id)?;
        let schedule_times = self.get_schedule_times(&habit.id)?;

        Ok(Habit {
            id: habit.id,
            name: habit.name,
            description: habit.description,
            icon: habit.icon,
            icon_color: habit.icon_color,
            icon_stroke_width: habit.icon_stroke_width,
            start_date: habit.start_date,
            end_date: habit.end_date,
            is_active: habit.is_active,
            created_at: habit.created_at,
            schedule_days,
            schedule_times,
        })
    }

    pub fn list_active_with_schedules(&self) -> Result<Vec<Habit>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, icon, icon_color, icon_stroke_width, start_date, end_date, is_active, created_at
             FROM habits WHERE is_active = 1 ORDER BY created_at DESC",
        )?;

        let rows: Vec<HabitRow> = stmt
            .query_map([], |row| {
                let is_active: i32 = row.get(8)?;
                Ok(HabitRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    icon: row.get(3)?,
                    icon_color: row.get(4)?,
                    icon_stroke_width: row.get(5)?,
                    start_date: row.get(6)?,
                    end_date: row.get(7)?,
                    is_active: is_active != 0,
                    created_at: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut habits = Vec::with_capacity(rows.len());
        for row in rows {
            let schedule_days = self.get_schedule_days(&row.id)?;
            let schedule_times = self.get_schedule_times(&row.id)?;
            habits.push(Habit {
                id: row.id,
                name: row.name,
                description: row.description,
                icon: row.icon,
                icon_color: row.icon_color,
                icon_stroke_width: row.icon_stroke_width,
                start_date: row.start_date,
                end_date: row.end_date,
                is_active: row.is_active,
                created_at: row.created_at,
                schedule_days,
                schedule_times,
            });
        }

        Ok(habits)
    }

    pub fn list(&self) -> Result<Vec<Habit>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, icon, icon_color, icon_stroke_width, start_date, end_date, is_active, created_at
             FROM habits ORDER BY created_at DESC",
        )?;

        let rows: Vec<HabitRow> = stmt
            .query_map([], |row| {
                let is_active: i32 = row.get(8)?;
                Ok(HabitRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    icon: row.get(3)?,
                    icon_color: row.get(4)?,
                    icon_stroke_width: row.get(5)?,
                    start_date: row.get(6)?,
                    end_date: row.get(7)?,
                    is_active: is_active != 0,
                    created_at: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut habits = Vec::with_capacity(rows.len());
        for row in rows {
            let schedule_days = self.get_schedule_days(&row.id)?;
            let schedule_times = self.get_schedule_times(&row.id)?;
            habits.push(Habit {
                id: row.id,
                name: row.name,
                description: row.description,
                icon: row.icon,
                icon_color: row.icon_color,
                icon_stroke_width: row.icon_stroke_width,
                start_date: row.start_date,
                end_date: row.end_date,
                is_active: row.is_active,
                created_at: row.created_at,
                schedule_days,
                schedule_times,
            });
        }

        Ok(habits)
    }

    pub fn update(
        &self,
        id: &str,
        name: &str,
        description: &str,
    ) -> Result<Habit, AppError> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(AppError::Validation("Habit name cannot be empty".into()));
        }

        let rows = self.conn.execute(
            "UPDATE habits SET name = ?1, description = ?2 WHERE id = ?3",
            params![trimmed, description, id],
        )?;

        if rows == 0 {
            return Err(AppError::NotFound(format!("Habit not found: {id}")));
        }

        self.get(id)
    }

    pub fn delete(&self, id: &str) -> Result<bool, AppError> {
        let rows = self.conn.execute(
            "DELETE FROM habits WHERE id = ?1",
            params![id],
        )?;
        Ok(rows > 0)
    }

    fn get_schedule_days(&self, habit_id: &str) -> Result<Vec<u8>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT day_of_week FROM habit_schedule_days WHERE habit_id = ?1 ORDER BY day_of_week",
        )?;

        let days = stmt
            .query_map(params![habit_id], |row| row.get(0))?
            .collect::<Result<Vec<u8>, _>>()?;

        Ok(days)
    }

    fn get_schedule_times(&self, habit_id: &str) -> Result<Vec<TimeSlot>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT start_time FROM habit_schedule_times WHERE habit_id = ?1",
        )?;

        let times = stmt
            .query_map(params![habit_id], |row| {
                Ok(TimeSlot {
                    start_time: row.get(0)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(times)
    }
}

/// Internal row type for habit table queries (without schedule data).
struct HabitRow {
    id: String,
    name: String,
    description: String,
    icon: String,
    icon_color: String,
    icon_stroke_width: f64,
    start_date: String,
    end_date: Option<String>,
    is_active: bool,
    created_at: String,
}
