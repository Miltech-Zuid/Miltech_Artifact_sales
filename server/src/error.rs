use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// Fout die als JSON `{ "error": { "code", "message" } }` naar de browser gaat.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("niet gevonden")]
    NotFound,
    #[error("Claude is niet geconfigureerd (ANTHROPIC_API_KEY ontbreekt)")]
    NotConfigured,
    #[error("te veel verzoeken")]
    RateLimited,
    #[error("prompt te groot")]
    PromptTooLarge,
    #[error("{0}")]
    Upstream(String),
    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

impl ApiError {
    pub fn code(&self) -> &'static str {
        match self {
            ApiError::BadRequest(_) => "invalid_argument",
            ApiError::NotFound => "not_found",
            ApiError::NotConfigured => "not_granted",
            ApiError::RateLimited => "rate_limited",
            ApiError::PromptTooLarge => "prompt_too_large",
            ApiError::Upstream(_) => "upstream_error",
            ApiError::Internal(_) => "internal",
        }
    }

    fn status(&self) -> StatusCode {
        match self {
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::NotFound => StatusCode::NOT_FOUND,
            ApiError::NotConfigured => StatusCode::SERVICE_UNAVAILABLE,
            ApiError::RateLimited => StatusCode::TOO_MANY_REQUESTS,
            ApiError::PromptTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            ApiError::Upstream(_) => StatusCode::BAD_GATEWAY,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl From<std::io::Error> for ApiError {
    fn from(e: std::io::Error) -> Self {
        ApiError::Internal(e.into())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        if let ApiError::Internal(e) = &self {
            tracing::error!("interne fout: {e:#}");
        }
        let body = Json(json!({ "error": { "code": self.code(), "message": self.to_string() } }));
        (self.status(), body).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
