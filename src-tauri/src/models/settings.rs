use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub autostart_enabled: bool,
    pub week_start_day: String,
}
