use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreakFreeze {
    pub id: String,
    pub habit_id: String,
    pub frozen_date: String,
    pub created_at: String,
}
