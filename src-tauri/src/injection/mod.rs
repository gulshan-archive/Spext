#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

/// Cross-platform text injection
pub async fn inject_text(text: &str) -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    return macos::inject_text(text).await;

    #[cfg(target_os = "windows")]
    return windows::inject_text(text).await;

    #[cfg(target_os = "linux")]
    return linux::inject_text(text).await;
}

/// Cross-platform accessibility check
pub fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    return macos::check_accessibility_permission();

    #[cfg(target_os = "windows")]
    return true; // Windows doesn't need special permission

    #[cfg(target_os = "linux")]
    return true; // Linux doesn't need special permission
}

/// Cross-platform open accessibility settings
pub fn open_accessibility_settings() -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    return macos::open_accessibility_settings();

    #[cfg(target_os = "windows")]
    return Ok(()); // No-op on Windows

    #[cfg(target_os = "linux")]
    return Ok(()); // No-op on Linux
}
