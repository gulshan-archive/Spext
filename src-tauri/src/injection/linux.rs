use anyhow::{anyhow, Result};
use std::process::{Command, Stdio};
use std::io::Write;

/// Inject text into the frontmost application on Linux.
/// Uses xclip for clipboard and xdotool for Ctrl+V paste.
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
    // Try xclip first, fall back to xsel
    Command::new("xclip")
        .args(["-selection", "clipboard", "-o"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok()
            } else {
                None
            }
        })
        .or_else(|| {
            Command::new("xsel")
                .args(["--clipboard", "--output"])
                .output()
                .ok()
                .and_then(|o| {
                    if o.status.success() {
                        String::from_utf8(o.stdout).ok()
                    } else {
                        None
                    }
                })
        })
}

fn set_clipboard(text: &str) -> Result<()> {
    // Try xclip first
    let mut child = Command::new("xclip")
        .args(["-selection", "clipboard"])
        .stdin(Stdio::piped())
        .spawn()
        .or_else(|_| {
            Command::new("xsel")
                .args(["--clipboard", "--input"])
                .stdin(Stdio::piped())
                .spawn()
        })
        .map_err(|e| anyhow!("No clipboard tool found (xclip or xsel): {}", e))?;

    child.stdin.as_mut()
        .ok_or_else(|| anyhow!("Failed to open stdin"))?
        .write_all(text.as_bytes())?;

    let status = child.wait()?;
    if !status.success() {
        return Err(anyhow!("Clipboard set failed"));
    }
    Ok(())
}

fn send_paste() -> Result<()> {
    let status = Command::new("xdotool")
        .args(["key", "ctrl+v"])
        .status()
        .map_err(|e| anyhow!("xdotool not found. Install with: sudo apt install xdotool. Error: {}", e))?;

    if !status.success() {
        return Err(anyhow!("xdotool paste failed"));
    }
    Ok(())
}
