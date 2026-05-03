use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub text: String,
    pub original_text: String,
    pub language: String,
    pub timestamp: String,
    pub duration_secs: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HistoryData {
    pub entries: Vec<HistoryEntry>,
}

fn history_path() -> Result<PathBuf> {
    let data_dir =
        dirs::data_dir().ok_or_else(|| anyhow::anyhow!("Cannot determine data directory"))?;
    let dir = data_dir.join("com.gulshanyadav.spext");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("history.json"))
}

pub fn load_history() -> HistoryData {
    let mut data = match history_path() {
        Ok(path) => {
            if path.exists() {
                match std::fs::read_to_string(&path) {
                    Ok(json) => match serde_json::from_str::<HistoryData>(&json) {
                        Ok(d) => d,
                        Err(e) => { log::warn!("Failed to parse history: {}", e); HistoryData::default() }
                    },
                    Err(e) => { log::warn!("Failed to read history: {}", e); HistoryData::default() }
                }
            } else {
                HistoryData::default()
            }
        }
        Err(e) => { log::warn!("Failed to get history path: {}", e); HistoryData::default() }
    };
    // Prune entries older than 7 days
    let cutoff = chrono::Utc::now() - chrono::Duration::days(7);
    data.entries.retain(|e| {
        chrono::DateTime::parse_from_rfc3339(&e.timestamp)
            .map(|t| t > cutoff)
            .unwrap_or(true)
    });
    data
}

pub fn save_history(data: &HistoryData) -> Result<()> {
    let path = history_path()?;
    let json = serde_json::to_string_pretty(data)?;
    std::fs::write(&path, json)?;
    Ok(())
}

pub fn add_entry(entry: HistoryEntry) -> Result<()> {
    let mut data = load_history();
    data.entries.insert(0, entry); // newest first
    // Remove entries older than 7 days
    let cutoff = chrono::Utc::now() - chrono::Duration::days(7);
    data.entries.retain(|e| {
        chrono::DateTime::parse_from_rfc3339(&e.timestamp)
            .map(|t| t > cutoff)
            .unwrap_or(true) // keep entries with unparseable timestamps
    });
    save_history(&data)
}

pub fn delete_entry(id: &str) -> Result<()> {
    let mut data = load_history();
    data.entries.retain(|e| e.id != id);
    save_history(&data)
}

pub fn clear_all() -> Result<()> {
    save_history(&HistoryData::default())
}
