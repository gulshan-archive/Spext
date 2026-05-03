use anyhow::{anyhow, Result};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Windows flag to hide the console window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Inject text into the frontmost application on Windows.
/// Uses PowerShell for clipboard (hidden window) and SendKeys for Ctrl+V paste.
/// Saves and restores the original clipboard.
pub async fn inject_text(text: &str) -> Result<()> {
    // Save current clipboard
    let original = get_clipboard();

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Set clipboard and paste in one PowerShell call (faster, single hidden window)
    let escaped = text.replace("'", "''").replace("`", "``");
    let script = format!(
        "Set-Clipboard -Value '{}'; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
        escaped
    );

    run_powershell_hidden(&script)?;

    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // Restore original clipboard
    if let Some(orig) = original {
        let restore_escaped = orig.replace("'", "''").replace("`", "``");
        let _ = run_powershell_hidden(&format!("Set-Clipboard -Value '{}'", restore_escaped));
    }

    log::info!("Text injected ({} chars), clipboard restored", text.len());
    Ok(())
}

fn get_clipboard() -> Option<String> {
    let output = hidden_powershell_command()
        .args(["-Command", "Get-Clipboard"])
        .output()
        .ok()?;

    if output.status.success() {
        String::from_utf8(output.stdout).ok().map(|s| s.trim().to_string())
    } else {
        None
    }
}

fn run_powershell_hidden(script: &str) -> Result<()> {
    let status = hidden_powershell_command()
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .status()
        .map_err(|e| anyhow!("Failed to run PowerShell: {}", e))?;

    if !status.success() {
        return Err(anyhow!("PowerShell command failed"));
    }
    Ok(())
}

fn hidden_powershell_command() -> Command {
    let mut cmd = Command::new("powershell");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}
