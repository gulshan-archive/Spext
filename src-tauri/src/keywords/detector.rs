use serde::{Deserialize, Serialize};

/// Trigger phrases that activate AI processing.
/// Matched greedily (longest first) and case-insensitive.
const TRIGGER_VERBS: &[(&str, &str)] = &[
    ("rephrase this as", "rephrase"),
    ("rewrite this as", "rephrase"),
    ("format this as", "rephrase"),
    ("rephrase as", "rephrase"),
    ("format as", "rephrase"),
    ("rewrite as", "rephrase"),
    ("rephrase", "rephrase"),
    ("summarize this", "summarize"),
    ("summarise this", "summarize"),
    ("summarize", "summarize"),
    ("summarise", "summarize"),
    ("fix grammar", "grammar"),
    ("fix the grammar", "grammar"),
    ("correct grammar", "grammar"),
];

/// Known format targets for rephrase triggers
const KNOWN_FORMATS: &[&str] = &[
    "professional email",
    "formal email",
    "casual email",
    "casual message",
    "slack message",
    "bullet points",
    "code comment",
    "formal",
    "casual",
    "email",
    "message",
    "summary",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeywordMatch {
    /// The type of action detected (e.g., "rephrase", "summarize", "grammar")
    pub action: String,
    /// The specific format requested (e.g., "professional email", "bullet points")
    pub format: Option<String>,
    /// The clean text with the trigger phrase removed
    pub clean_text: String,
}

/// Detect smart keywords in transcribed text.
/// Returns None if no trigger phrase is found.
pub fn detect(text: &str) -> Option<KeywordMatch> {
    let lower = text.to_lowercase();

    for &(trigger, action) in TRIGGER_VERBS {
        if let Some(pos) = lower.find(trigger) {
            let after_trigger = &text[pos + trigger.len()..].trim_start();

            // Try to match a known format after the trigger
            let format = KNOWN_FORMATS.iter().find_map(|&fmt| {
                let after_lower = after_trigger.to_lowercase();
                if after_lower.starts_with(fmt) {
                    Some(fmt.to_string())
                } else {
                    None
                }
            });

            // Build clean text by removing the trigger phrase and format
            let mut clean = String::new();
            clean.push_str(text[..pos].trim());

            let remaining = if let Some(ref fmt) = format {
                let fmt_end = lower[pos + trigger.len()..].find(&fmt.to_lowercase())
                    .map(|p| pos + trigger.len() + p + fmt.len())
                    .unwrap_or(pos + trigger.len());
                text[fmt_end..].trim()
            } else {
                after_trigger.as_ref()
            };

            if !clean.is_empty() && !remaining.is_empty() {
                clean.push(' ');
            }
            clean.push_str(remaining);

            let clean_text = clean.trim().to_string();
            if clean_text.is_empty() {
                continue;
            }

            return Some(KeywordMatch {
                action: action.to_string(),
                format,
                clean_text,
            });
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_rephrase_as_email() {
        let result = detect("Send a message to Ryan about the project timeline, rephrase as professional email");
        assert!(result.is_some());
        let m = result.unwrap();
        assert_eq!(m.action, "rephrase");
        assert_eq!(m.format, Some("professional email".to_string()));
    }

    #[test]
    fn test_detect_summarize() {
        let result = detect("summarize this The meeting covered three main topics");
        assert!(result.is_some());
        let m = result.unwrap();
        assert_eq!(m.action, "summarize");
    }

    #[test]
    fn test_no_keyword() {
        let result = detect("Just a normal sentence without any triggers");
        assert!(result.is_none());
    }
}
