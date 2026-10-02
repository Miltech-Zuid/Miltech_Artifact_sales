//! Miltech Sales – server.
//!
//! Levert de gebouwde frontend (web/dist) en de API:
//!   GET    /api/health                  – gezondheidscheck (zonder wachtwoord)
//!   GET    /api/status                  – of Claude beschikbaar is
//!   GET    /api/events                  – live updates (Server-Sent Events)
//!   GET    /api/db/:col                 – alle documenten van een collectie
//!   PUT    /api/db/:col/:id             – document opslaan (vervangt het geheel)
//!   DELETE /api/db/:col/:id             – document verwijderen
//!   GET    /api/config/:key             – instelling lezen
//!   PUT    /api/config/:key             – instelling opslaan
//!   POST   /api/assets                  – bestand uploaden (body = bestand)
//!   GET    /api/assets/:id              – bestand ophalen
//!   POST   /api/claude/stream           – Claude, gestreamd (NDJSON)
//!   POST   /api/claude/complete         – Claude, in één antwoord

mod assets;
mod claude;
mod config;
mod error;
mod store;

use std::{convert::Infallible, sync::Arc, time::Duration};

use axum::{
    extract::{DefaultBodyLimit, Path, Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::{
        sse::{Event as SseEvent, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post, put},
    Json, Router,
};
use base64::Engine;
use futures::{stream, Stream, StreamExt};
use serde_json::{json, Value};
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};

use crate::{config::Config, error::ApiResult, store::Store};

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub store: Arc<Store>,
    pub http: reqwest::Client,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "miltech_sales=info,tower_http=info".into()),
        )
        .init();

    let cfg = Config::from_env()?;
    let store = Store::open(&cfg.data_dir).await?;
    let http = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(300))
        .build()?;

    if cfg.anthropic_api_key.is_none() {
        tracing::warn!("ANTHROPIC_API_KEY ontbreekt: Claude-functies staan uit");
    }
    if cfg.app_password.is_none() {
        tracing::warn!("APP_PASSWORD ontbreekt: de app is zonder wachtwoord bereikbaar");
    }

    let state = AppState {
        cfg: Arc::new(cfg.clone()),
        store: Arc::new(store),
        http,
    };
    let app = router(state);

    let listener = tokio::net::TcpListener::bind(cfg.addr).await?;
    tracing::info!("Miltech Sales draait op http://{}", cfg.addr);
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
}

async fn shutdown() {
    let _ = tokio::signal::ctrl_c().await;
    tracing::info!("afsluiten…");
}

pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/status", get(status))
        .route("/events", get(events))
        .route("/db/:col", get(list_docs))
        .route("/db/:col/:id", put(set_doc).delete(delete_doc))
        .route("/config/:key", get(get_config).put(set_config))
        .route("/assets", post(assets::upload))
        .route("/assets/:id", get(assets::download))
        .route("/claude/stream", post(claude::stream))
        .route("/claude/complete", post(claude::complete))
        .layer(DefaultBodyLimit::max(state.cfg.max_upload_bytes))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-store"),
        ));

    let dist = state.cfg.web_dist.clone();
    let spa = ServeDir::new(&dist).fallback(ServeFile::new(dist.join("index.html")));

    Router::new()
        .nest("/api", api)
        .fallback_service(spa)
        .layer(middleware::from_fn_with_state(state.clone(), auth))
        .route("/api/health", get(|| async { Json(json!({ "ok": true })) }))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Optionele Basic-authenticatie: actief zodra APP_PASSWORD is gezet.
/// De gebruikersnaam is vrij; alleen het wachtwoord telt.
async fn auth(State(st): State<AppState>, req: Request, next: Next) -> Response {
    let Some(pw) = st.cfg.app_password.as_deref() else {
        return next.run(req).await;
    };
    let ok = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Basic "))
        .and_then(|b| {
            base64::engine::general_purpose::STANDARD
                .decode(b.trim())
                .ok()
        })
        .and_then(|b| String::from_utf8(b).ok())
        .and_then(|s| s.split_once(':').map(|(_, p)| p.to_string()))
        .map(|p| constant_time_eq(p.as_bytes(), pw.as_bytes()))
        .unwrap_or(false);
    if ok {
        next.run(req).await
    } else {
        let mut r = (StatusCode::UNAUTHORIZED, "Inloggen vereist").into_response();
        r.headers_mut().insert(
            header::WWW_AUTHENTICATE,
            HeaderValue::from_static("Basic realm=\"Miltech Sales\", charset=\"UTF-8\""),
        );
        r
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

async fn status(State(st): State<AppState>) -> Json<Value> {
    Json(json!({
        "claude": st.cfg.anthropic_api_key.is_some(),
        "model": st.cfg.anthropic_model,
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

fn to_sse(ev: &store::Event) -> SseEvent {
    SseEvent::default().data(serde_json::to_string(ev).unwrap_or_else(|_| "{}".into()))
}

async fn events(
    State(st): State<AppState>,
) -> Sse<impl Stream<Item = Result<SseEvent, Infallible>>> {
    // Eerst abonneren, dan de momentopname: zo gaat er geen wijziging verloren.
    let rx = st.store.subscribe();
    let snap: Vec<SseEvent> = st.store.snapshot().await.iter().map(to_sse).collect();
    let store = st.store.clone();
    let live = BroadcastStream::new(rx).then(move |r| {
        let store = store.clone();
        async move {
            match r {
                Ok(ev) => vec![to_sse(&ev)],
                // Achterstand opgelopen: stuur alles opnieuw.
                Err(BroadcastStreamRecvError::Lagged(_)) => {
                    store.snapshot().await.iter().map(to_sse).collect()
                }
            }
        }
    });
    let s = stream::iter(snap)
        .chain(live.flat_map(stream::iter))
        .map(Ok::<_, Infallible>);
    Sse::new(s).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(20))
            .text("ping"),
    )
}

async fn list_docs(State(st): State<AppState>, Path(col): Path<String>) -> ApiResult<Json<Value>> {
    Ok(Json(Value::Array(st.store.list(&col).await?)))
}

async fn set_doc(
    State(st): State<AppState>,
    Path((col, id)): Path<(String, String)>,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    st.store.set(&col, &id, body).await?;
    Ok(Json(json!({ "ok": true, "id": id })))
}

async fn delete_doc(
    State(st): State<AppState>,
    Path((col, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    st.store.delete(&col, &id).await?;
    Ok(Json(json!({ "ok": true })))
}

async fn get_config(State(st): State<AppState>, Path(key): Path<String>) -> ApiResult<Json<Value>> {
    Ok(Json(st.store.get_config(&key).await?))
}

async fn set_config(
    State(st): State<AppState>,
    Path(key): Path<String>,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    st.store.set_config(&key, body).await?;
    Ok(Json(json!({ "ok": true })))
}
