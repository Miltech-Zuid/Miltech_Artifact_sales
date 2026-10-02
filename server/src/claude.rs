//! Proxy naar de Anthropic Messages API. De API-sleutel blijft op de server.
//!
//! - `POST /api/claude/stream`   streamt NDJSON-regels: `{"t":"…"}` per tekstdeel,
//!   afgesloten met `{"done":true,"text":"…"}` of `{"error":{"code","message"}}`.
//! - `POST /api/claude/complete` geeft in één keer `{"text":"…"}` terug.

use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderValue},
    response::{IntoResponse, Response},
    Json,
};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    error::{ApiError, ApiResult},
    AppState,
};

const JSON_SYSTEM: &str = "Antwoord uitsluitend met één geldig JSON-object. Geen uitleg, geen codeblok, geen tekst ervoor of erna.";
const MAX_PROMPT_CHARS: usize = 400_000;

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct Turn {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize, Debug)]
pub struct ClaudeRequest {
    pub messages: Vec<Turn>,
    #[serde(default)]
    pub json: bool,
    #[serde(default)]
    pub max_tokens: Option<u32>,
}

fn build_body(st: &AppState, req: &ClaudeRequest, stream: bool) -> ApiResult<Value> {
    if req.messages.is_empty() {
        return Err(ApiError::BadRequest("geen berichten".into()));
    }
    let total: usize = req.messages.iter().map(|m| m.content.len()).sum();
    if total > MAX_PROMPT_CHARS {
        return Err(ApiError::PromptTooLarge);
    }
    for m in &req.messages {
        if m.role != "user" && m.role != "assistant" {
            return Err(ApiError::BadRequest(
                "rol moet 'user' of 'assistant' zijn".into(),
            ));
        }
    }
    if req.messages[0].role != "user" {
        return Err(ApiError::BadRequest(
            "eerste bericht moet van 'user' zijn".into(),
        ));
    }
    let mut body = json!({
        "model": st.cfg.anthropic_model,
        "max_tokens": req.max_tokens.unwrap_or(st.cfg.anthropic_max_tokens).min(st.cfg.anthropic_max_tokens),
        "messages": req.messages,
        "stream": stream,
    });
    if req.json {
        body["system"] = Value::String(JSON_SYSTEM.into());
    }
    Ok(body)
}

async fn send(st: &AppState, body: &Value) -> ApiResult<reqwest::Response> {
    let key = st
        .cfg
        .anthropic_api_key
        .as_deref()
        .ok_or(ApiError::NotConfigured)?;
    let res = st
        .http
        .post(format!("{}/v1/messages", st.cfg.anthropic_base_url))
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(body)
        .send()
        .await
        .map_err(|e| ApiError::Upstream(format!("Claude niet bereikbaar: {e}")))?;
    let status = res.status();
    if status.is_success() {
        return Ok(res);
    }
    let text = res.text().await.unwrap_or_default();
    tracing::warn!("Anthropic API {status}: {text}");
    Err(match status.as_u16() {
        429 | 529 => ApiError::RateLimited,
        413 => ApiError::PromptTooLarge,
        400 if text.contains("too long") || text.contains("too many tokens") => {
            ApiError::PromptTooLarge
        }
        401 | 403 => ApiError::Upstream("API-sleutel geweigerd door Anthropic".into()),
        _ => ApiError::Upstream(format!("Claude gaf status {status}")),
    })
}

pub async fn complete(
    State(st): State<AppState>,
    Json(req): Json<ClaudeRequest>,
) -> ApiResult<impl IntoResponse> {
    let body = build_body(&st, &req, false)?;
    let res = send(&st, &body).await?;
    let v: Value = res
        .json()
        .await
        .map_err(|e| ApiError::Upstream(format!("onleesbaar antwoord: {e}")))?;
    let text = v["content"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|c| c["type"] == "text")
                .filter_map(|c| c["text"].as_str())
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();
    Ok(Json(json!({ "text": text })))
}

fn line(v: Value) -> bytes::Bytes {
    let mut s = v.to_string();
    s.push('\n');
    bytes::Bytes::from(s)
}

pub async fn stream(
    State(st): State<AppState>,
    Json(req): Json<ClaudeRequest>,
) -> ApiResult<Response> {
    let body = build_body(&st, &req, true)?;
    let res = send(&st, &body).await?;
    let mut upstream = res.bytes_stream();

    let out = async_stream::stream! {
        let mut buf = String::new();
        let mut full = String::new();
        let mut failed = false;
        while let Some(chunk) = upstream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    yield Ok::<_, std::io::Error>(line(json!({"error":{"code":"upstream_error","message":e.to_string()}})));
                    failed = true;
                    break;
                }
            };
            buf.push_str(&String::from_utf8_lossy(&chunk));
            while let Some(pos) = buf.find("\n\n") {
                let event: String = buf[..pos].to_string();
                buf.drain(..pos + 2);
                for l in event.lines() {
                    let Some(data) = l.strip_prefix("data:") else { continue };
                    let Ok(v) = serde_json::from_str::<Value>(data.trim()) else { continue };
                    match v["type"].as_str() {
                        Some("content_block_delta") if v["delta"]["type"] == "text_delta" => {
                            if let Some(t) = v["delta"]["text"].as_str() {
                                full.push_str(t);
                                yield Ok(line(json!({ "t": t })));
                            }
                        }
                        Some("error") => {
                            let code = if v["error"]["type"] == "overloaded_error" { "rate_limited" } else { "upstream_error" };
                            yield Ok(line(json!({"error":{"code":code,"message":v["error"]["message"]}})));
                            failed = true;
                        }
                        _ => {}
                    }
                }
            }
            if failed { break; }
        }
        if !failed {
            yield Ok(line(json!({ "done": true, "text": full })));
        }
    };

    let mut resp = Response::new(Body::from_stream(out));
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/x-ndjson; charset=utf-8"),
    );
    resp.headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    resp.headers_mut()
        .insert("x-accel-buffering", HeaderValue::from_static("no"));
    Ok(resp)
}
