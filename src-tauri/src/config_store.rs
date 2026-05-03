use anyhow::Result;
use std::path::PathBuf;

use crate::state::SpextConfig;

/// Get the config file path: ~/Library/Application Support/com.gulshanyadav.spext/config.json
fn config_path() -> Result<PathBuf> {
    let data_dir =
        dirs::data_dir().ok_or_else(|| anyhow::anyhow!("Cannot determine data directory"))?;
    let dir = data_dir.join("com.gulshanyadav.spext");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("config.json"))
}

/// Load config from disk. Returns default config if file doesn't exist or is invalid.
pub fn load_config() -> SpextConfig {
    match config_path() {
        Ok(path) => {
            if path.exists() {
                match std::fs::read_to_string(&path) {
                    Ok(json) => match serde_json::from_str::<SpextConfig>(&json) {
                        Ok(config) => {
                            log::info!("Loaded config from {:?}", path);
                            return config;
                        }
                        Err(e) => {
                            log::warn!("Failed to parse config, using defaults: {}", e);
                        }
                    },
                    Err(e) => {
                        log::warn!("Failed to read config file: {}", e);
                    }
                }
            } else {
                log::info!("No config file found, using defaults");
            }
        }
        Err(e) => {
            log::warn!("Failed to determine config path: {}", e);
        }
    }
    SpextConfig::default()
}

/// Save config to disk.
pub fn save_config(config: &SpextConfig) -> Result<()> {
    let path = config_path()?;
    let json = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, json)?;
    log::info!("Config saved to {:?}", path);
    Ok(())
}
