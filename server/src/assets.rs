//! Bestandsopslag voor geüploade Word-bestanden en de artikelbibliotheek.

use std::path::{Path, PathBuf};

use axum::{
    body::Bytes,
    extract::{Path as AxPath, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::{
    error::{ApiError, ApiResult},
    store::valid_id,
    AppState,
};

pub fn assets_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("assets")
}

fn allowed_type(ct: &str) -> bool {
    let ct = ct
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    ct.starts_with("image/")
        || matches!(
            ct.as_str(),
            "application/json"
                | "application/octet-stream"
                | "application/pdf"
                | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                | "text/plain"
        )
}

pub async fn upload(
    State(st): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<impl IntoResponse> {
    if body.is_empty() {
        return Err(ApiError::BadRequest("leeg bestand".into()));
    }
    let ct = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    if !allowed_type(&ct) {
        return Err(ApiError::BadRequest(format!(
            "bestandstype '{ct}' niet toegestaan"
        )));
    }
    let id = uuid::Uuid::new_v4().simple().to_string();
    let dir = assets_dir(&st.cfg.data_dir);
    tokio::fs::create_dir_all(&dir).await?;
    tokio::fs::write(dir.join(&id), &body).await?;
    tokio::fs::write(dir.join(format!("{id}.type")), ct.as_bytes()).await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "id": id, "bytes": body.len() })),
    ))
}

pub async fn download(
    State(st): State<AppState>,
    AxPath(id): AxPath<String>,
) -> ApiResult<Response> {
    if !valid_id(&id) {
        return Err(ApiError::BadRequest("ongeldig id".into()));
    }
    let dir = assets_dir(&st.cfg.data_dir);
    let data = match tokio::fs::read(dir.join(&id)).await {
        Ok(d) => d,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Err(ApiError::NotFound),
        Err(e) => return Err(e.into()),
    };
    let ct = tokio::fs::read_to_string(dir.join(format!("{id}.type")))
        .await
        .unwrap_or_else(|_| "application/octet-stream".into());
    let mut res = data.into_response();
    res.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(ct.trim())
            .unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=31536000, immutable"),
    );
    Ok(res)
}
