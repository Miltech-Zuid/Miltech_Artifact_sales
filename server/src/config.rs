use std::{env, net::SocketAddr, path::PathBuf};

/// Alle instellingen komen uit omgevingsvariabelen (of een .env-bestand).
#[derive(Clone, Debug)]
pub struct Config {
    pub addr: SocketAddr,
    pub data_dir: PathBuf,
    pub web_dist: PathBuf,
    pub anthropic_api_key: Option<String>,
    pub anthropic_model: String,
    pub anthropic_base_url: String,
    pub anthropic_max_tokens: u32,
    pub app_password: Option<String>,
    pub max_upload_bytes: usize,
}

fn var(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let host = var("HOST").unwrap_or_else(|| "0.0.0.0".into());
        let port: u16 = var("PORT").unwrap_or_else(|| "8787".into()).parse()?;
        let addr: SocketAddr = format!("{host}:{port}").parse()?;
        let max_mb: usize = var("MAX_UPLOAD_MB")
            .unwrap_or_else(|| "60".into())
            .parse()?;
        Ok(Self {
            addr,
            data_dir: PathBuf::from(var("DATA_DIR").unwrap_or_else(|| "./data".into())),
            web_dist: PathBuf::from(var("WEB_DIST").unwrap_or_else(|| "../web/dist".into())),
            anthropic_api_key: var("ANTHROPIC_API_KEY"),
            anthropic_model: var("ANTHROPIC_MODEL").unwrap_or_else(|| "claude-sonnet-4-5".into()),
            anthropic_base_url: var("ANTHROPIC_BASE_URL")
                .unwrap_or_else(|| "https://api.anthropic.com".into())
                .trim_end_matches('/')
                .to_string(),
            anthropic_max_tokens: var("ANTHROPIC_MAX_TOKENS")
                .unwrap_or_else(|| "4096".into())
                .parse()?,
            app_password: var("APP_PASSWORD"),
            max_upload_bytes: max_mb * 1024 * 1024,
        })
    }
}
