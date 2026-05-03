use anyhow::{anyhow, Result};
use std::process::Command;

/// Inject text into the frontmost application on Windows.
/// Uses clip.exe for clipboard and PowerShell for Ctrl+V paste.
/// Saves and restores the original clipboard.
pub async fn inject_text(text: &str) -> Result<()> {
    // Save current clipboard
    let original = get_clipboard();

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Set clipboard
    set_clipboard(text)?;

    // Simulate Ctrl+V
    send_paste()?;

    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

    // Restore original clipboard
    if let Some(orig) = original {
        let _ = set_clipboard(&orig);
    }

    log::info!("Text injected ({} chars), clipboard restored", text.len());
    Ok(())
}

fn get_clipboard() -> Option<String> {
    Command::new("powershell")
        .args(["-Command", "Get-Clipboard"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
            } else {
                None
            }
        })
}

fn set_clipboard(text: &str) -> Result<()> {
    let escaped = text.replace("'", "''");
    let status = Command::new("powershell")
        .args(["-Command", &format!("Set-Clipboard -Value '{}'", escaped)])
        .status()
        .map_err(|e| anyhow!("Failed to run powershell: {}", e))?;

    if !status.success() {
        return Err(anyhow!("Set-Clipboard failed"));
    }
    Ok(())
}

fn send_paste() -> Result<()> {
    let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait('^v')
    "#;
    let status = Command::new("powershell")
        .args(["-Command", script])
        .status()
        .map_err(|e| anyhow!("Failed to send paste: {}", e))?;

    if !status.success() {
        return Err(anyhow!("SendKeys paste failed"));
    }
    Ok(())
}
