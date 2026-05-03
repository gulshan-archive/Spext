use anyhow::{anyhow, Result};
use std::process::{Command, Stdio};
use std::io::Write;

/// Inject text into the frontmost application via clipboard + Cmd+V.
/// Saves and restores the original clipboard content so the user's clipboard is preserved.
pub async fn inject_text(text: &str) -> Result<()> {
    // 1. Save current clipboard
    let original_clipboard = get_clipboard();

    // 2. Brief pause to let any pending key events settle
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // 3. Set clipboard to transcribed text
    set_clipboard(text)?;

    // 4. Simulate Cmd+V paste
    send_paste()?;

    // 5. Brief pause to let paste complete
    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

    // 6. Restore original clipboard
    if let Some(original) = original_clipboard {
        let _ = set_clipboard(&original);
    }

    log::info!("Text injected ({} chars), clipboard restored", text.len());
    Ok(())
}

/// Get current clipboard text content
fn get_clipboard() -> Option<String> {
    Command::new("pbpaste")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok()
            } else {
                None
            }
        })
}

/// Copy text to the system clipboard using pbcopy
fn set_clipboard(text: &str) -> Result<()> {
    let mut child = Command::new("pbcopy")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| anyhow!("Failed to spawn pbcopy: {}", e))?;

    child
        .stdin
        .as_mut()
        .ok_or_else(|| anyhow!("Failed to open pbcopy stdin"))?
        .write_all(text.as_bytes())?;

    let status = child.wait()?;
    if !status.success() {
        return Err(anyhow!("pbcopy exited with status: {}", status));
    }

    Ok(())
}

/// Simulate Cmd+V paste using osascript
fn send_paste() -> Result<()> {
    let script = r#"tell application "System Events" to keystroke "v" using command down"#;
    let status = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .status()
        .map_err(|e| anyhow!("Failed to run osascript: {}", e))?;

    if !status.success() {
        return Err(anyhow!(
            "Paste failed. Grant Accessibility permission: System Settings > Privacy & Security > Accessibility > Enable Spext"
        ));
    }

    Ok(())
}

/// Check if Accessibility permission is granted.
pub fn check_accessibility_permission() -> bool {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to get name of first process"#)
        .output();

    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

/// Open System Preferences to the Accessibility pane
pub fn open_accessibility_settings() -> Result<()> {
    Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .status()
        .map_err(|e| anyhow!("Failed to open System Preferences: {}", e))?;
    Ok(())
}
