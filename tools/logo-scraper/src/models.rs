use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogoResult {
    pub id: String,
    pub source: String,
    pub source_type: String,
    pub format: String,
    pub url: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeRequest {
    pub query: String,
    pub formats: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeResponse {
    pub success: bool,
    pub query: String,
    pub results: Vec<LogoResult>,
    pub meta: MetaInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaInfo {
    pub sources_checked: usize,
    pub results_found: usize,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone)]
pub struct KnownInfo {
    pub domains: Vec<String>,
    pub github: Option<String>,
    pub wikipedia: Option<String>,
}

impl KnownInfo {
    pub fn from_name(name: &str) -> Option<Self> {
        let key = name.to_lowercase();
        match key.as_str() {
            "vscode" | "visual studio code" => Some(KnownInfo {
                domains: vec!["code.visualstudio.com".into(), "visualstudio.com".into()],
                github: Some("microsoft/vscode".into()),
                wikipedia: Some("Visual_Studio_Code".into()),
            }),
            "github" => Some(KnownInfo {
                domains: vec!["github.com".into()],
                github: Some("github".into()),
                wikipedia: Some("GitHub".into()),
            }),
            "docker" => Some(KnownInfo {
                domains: vec!["docker.com".into()],
                github: Some("moby/moby".into()),
                wikipedia: Some("Docker_(software)".into()),
            }),
            "react" => Some(KnownInfo {
                domains: vec!["react.dev".into()],
                github: Some("facebook/react".into()),
                wikipedia: Some("React_(software)".into()),
            }),
            "tailwind" => Some(KnownInfo {
                domains: vec!["tailwindcss.com".into()],
                github: Some("tailwindlabs/tailwindcss".into()),
                wikipedia: Some("Tailwind_CSS".into()),
            }),
            "rust" => Some(KnownInfo {
                domains: vec!["rust-lang.org".into()],
                github: Some("rust-lang/rust".into()),
                wikipedia: Some("Rust_(programming_language)".into()),
            }),
            _ => None,
        }
    }
}

pub fn guess_domains(name: &str) -> Vec<String> {
    if let Some(known) = KnownInfo::from_name(name) {
        return known.domains;
    }
    let clean: String = name
        .to_lowercase()
        .replace(|c: char| c.is_whitespace(), "")
        .replace(|c: char| !c.is_alphanumeric(), "");
    vec![
        format!("{}.com", clean),
        format!("www.{}.com", clean),
        format!("{}.io", clean),
        format!("www.{}.io", clean),
        format!("{}.dev", clean),
        format!("{}.org", clean),
        format!("app.{}.com", clean),
    ]
}
