# Miltech Sales – volledige broncode
Alle bestanden van het project, in volgorde: configuratie en setup, server (Rust), frontend-setup, gedeelde logica, componenten, weergaven en de Syntess-module. `server/Cargo.lock` en `web/package-lock.json` worden door `cargo` en `npm` gegenereerd en zitten in de zip.

## `README.md`

````markdown
# Miltech Sales – Artifact Dashboard

Sales-dashboard van **Miltech Zuid Nederland B.V.**: pipeline, opvolging, prospects per sector, klantbestand en het afmaken van Syntess-offertes in Miltech-huisstijl, met Claude als assistent.

Dit is de losstaande versie van het claude.ai-artifact “Miltech Sales”. De runtime van claude.ai (gedeelde database, Claude, uploads, downloads) is vervangen door een eigen server.

| Onderdeel | Techniek |
| --- | --- |
| Frontend | React 18 + TypeScript, Vite 5, JSZip |
| Backend | Rust (Axum 0.7, Tokio), één binary |
| Database | JSON-bestand (`data/db.json`), atomair weggeschreven, live updates via Server-Sent Events |
| Bestanden | `data/assets/` (Word-exports, bibliotheek) |
| Claude | Anthropic Messages API via de server (sleutel blijft op de server) |

## Functies

- **Overzicht** – kerncijfers, opvolglijst (te laat, vandaag, stille offertes, deze week, zonder vervolgstap), pipeline per fase en een dagstart door Claude (gedeeld met het team).
- **Pipeline** – kanbanbord per fase, zoeken en filteren, dossierlade met logboek, opvolgmail en voorgestelde volgende stap door Claude, “Plak mail of notitie” om een dossier automatisch te laten invullen.
- **Nieuwe klanten** – prospects per sector, zoeklinks per regio, onderzoeksopdrachten, controle of een bedrijf al klant is, omzetten naar lead.
- **Offerte uit Syntess** – Word-export uploaden; per artikelregel standaardtekst en afbeelding uit de bibliotheek invoegen, systeemomschrijving met Claude, controles (klant, aanhef, datum, Ref. Nr., projectleider, huisstijl, tekstpunten), voorbeeldweergave per pagina en export naar Word waarbij gecontroleerd wordt dat alle originele onderdelen ongewijzigd blijven. Elke offerte loopt automatisch mee in de pipeline.
- **Klantbestand** – klanten importeren (`naam; plaats`), sector per klant, teamleden beheren.

## Snel starten (lokaal)

Benodigd: **Node.js 20+** en **Rust 1.80+** (`rustup`).

```bash
# 1. Frontend bouwen
cd web
cp .env.example .env          # optioneel: link naar Miltech Control
npm install
npm run build

# 2. Server starten (levert ook de frontend)
cd ../server
cp .env.example .env          # vul ANTHROPIC_API_KEY en APP_PASSWORD in
cargo run --release
```

Open daarna <http://localhost:8787>.

### Ontwikkelen met hot reload

```bash
# terminal 1
cd server && cargo run

# terminal 2
cd web && npm run dev         # http://localhost:5173, /api gaat naar :8787
```

## Productie met Docker

```bash
cat > .env <<'EOF'
APP_PASSWORD=een-sterk-wachtwoord
ANTHROPIC_API_KEY=sk-ant-...
VITE_CONTROL_URL=https://claude.ai/artifact/MstK1MowqyH58vcbZ2rknM
EOF

docker compose up -d --build
```

De gegevens staan in het volume `miltech-data` (`/data` in de container). Zet er voor gebruik via internet een reverse proxy met HTTPS voor (bijv. Caddy of nginx); zorg dat die Server-Sent Events niet buffert (`/api/events`).

**Back-up:** kopieer `data/db.json` en de map `data/assets/`.

## Instellingen (server)

| Variabele | Standaard | Uitleg |
| --- | --- | --- |
| `HOST` / `PORT` | `0.0.0.0` / `8787` | Luisteradres |
| `DATA_DIR` | `./data` | Database en bestanden |
| `WEB_DIST` | `../web/dist` | Gebouwde frontend |
| `APP_PASSWORD` | – | Zet Basic-authenticatie aan voor de hele app (gebruikersnaam vrij) |
| `ANTHROPIC_API_KEY` | – | Zonder sleutel staan de Claude-functies uit |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | Modelnaam; controleer de actuele namen op docs.claude.com |
| `ANTHROPIC_MAX_TOKENS` | `4096` | Maximum per antwoord |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Alleen wijzigen bij een proxy |
| `MAX_UPLOAD_MB` | `60` | Maximale uploadgrootte |

Frontend (bij het bouwen): `VITE_CONTROL_URL` – link “Miltech Control ↗” in de bovenbalk (leeg = verborgen).

## API

Alle routes staan onder `/api` en vallen onder `APP_PASSWORD` (behalve `/api/health`).

| Methode | Pad | Doel |
| --- | --- | --- |
| GET | `/api/health` | Gezondheidscheck |
| GET | `/api/status` | `{ claude, model, version }` |
| GET | `/api/events` | Live updates (SSE): eerst een momentopname, daarna elke wijziging |
| GET | `/api/db/:col` | Alle documenten van `leads`, `prospects`, `klanten`, `opdrachten` of `syntess` |
| PUT | `/api/db/:col/:id` | Document opslaan (vervangt het geheel) |
| DELETE | `/api/db/:col/:id` | Document verwijderen |
| GET/PUT | `/api/config/:key` | `team`, `dagstart`, `kennis`, `bibliotheek` |
| POST | `/api/assets` | Bestand uploaden (body = bestand, `Content-Type` verplicht) |
| GET | `/api/assets/:id` | Bestand ophalen |
| POST | `/api/claude/stream` | `{ messages, json?, max_tokens? }` → NDJSON-stream |
| POST | `/api/claude/complete` | Zelfde invoer → `{ text }` |

Voorbeeld: een geverifieerde prospect terugzetten na een onderzoeksopdracht.

```bash
curl -u :$APP_PASSWORD -X PUT http://localhost:8787/api/db/prospects/p-voorbeeld-1 \
  -H 'content-type: application/json' \
  -d '{"bedrijf":"Voorbeeld Staal B.V.","plaats":"Helmond","sector":"metaal","signaal":"Nieuwe productiehal","bron":"https://...","signaalDatum":"2026-10-01","status":"nieuw","geverifieerd":true}'
```

## Kennis en bibliotheek (project “Offerte Tool”)

Importeer beide via **Offerte uit Syntess → Kennis en bibliotheek**.

**Kennis** – JSON met (alle velden optioneel, tekst):

```json
{
  "beschrijving": "…",
  "instructies": "…",
  "huisstijl": "…",
  "werkwijze": "…",
  "extra": "…",
  "standaardteksten": "## Artikelnaam\nZoekwoorden: alias1, alias2\nTekst met **vet**\n- opsomming"
}
```

Een los `Standaardteksten.md`-bestand kan ook; dat vervangt alleen de standaardteksten.

**Bibliotheek** – JSON met `entries`:

```json
{
  "entries": [
    {
      "name": "Afzuigarm AR-4000",
      "aliases": ["AR-4000"],
      "kind": "artikel",
      "exact": false,
      "blocks": [
        { "type": "p", "runs": [["Flexibele afzuigarm, lengte 4 m.", false, false]] },
        { "type": "img", "ext": "png", "b64": "<base64>", "cx": 3600000, "cy": 2400000 }
      ]
    },
    {
      "name": "Systeemomschrijving 1",
      "aliases": [],
      "kind": "media",
      "omschrijving": "overzichtstekening",
      "blocks": [{ "type": "img", "ext": "png", "b64": "<base64>" }]
    }
  ],
  "tabel_sjabloon": { "tblPr": "<w:tblPr …/>", "tblGrid": "<w:tblGrid …/>", "hdr_shd": "<w:shd …/>", "hdr_color": "FFFFFF" }
}
```

Bloktypes: `p` (tekst-runs `[tekst, vet, cursief]`, optioneel `list`, `tabs`, `ind`), `img` (base64-afbeelding, maten in EMU), `media` (`runs_xml` + `parts`, bijv. Visio-objecten) en `element` (los XML-element met `parts`). Dezelfde structuur als `offerte_tool.py` v2.1.

## Projectstructuur

```
.
├── Dockerfile
├── docker-compose.yml
├── .github/workflows/ci.yml
├── server/                 Rust-backend
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs         routes, SSE, authenticatie, statische bestanden
│       ├── config.rs       omgevingsvariabelen
│       ├── store.rs        JSON-database + broadcast
│       ├── assets.rs       bestandsopslag
│       ├── claude.rs       Anthropic-proxy (stream en compleet)
│       └── error.rs        foutafhandeling
└── web/                    React-frontend
    └── src/
        ├── App.tsx, main.tsx, styles.css
        ├── lib/            gegevens, API, Claude, kpi's, hulpfuncties
        ├── components/     bovenbalk, ticker, lades, meldingen
        ├── views/          Overzicht, Pipeline, Prospects, Klanten
        └── syntess/        Word-analyse, opbouw, voorbeeld, export, Claude-assistent
```

## Verschillen met het claude.ai-artifact

- Je kiest je naam in de bovenbalk (per browser bewaard); herkenning via het claude.ai-account bestaat hier niet.
- Kennis en bibliotheek worden geïmporteerd in plaats van gesynchroniseerd vanuit een Claude-project.
- Onderzoeksopdrachten worden klaargezet in de database; resultaten voeg je toe in de app of via de API.
- Word-downloads gaan direct via de browser.
````

## `.gitignore`

```gitignore
# Rust
/server/target/

# Node / Vite
/web/node_modules/
/web/dist/
*.tsbuildinfo

# Omgeving en gegevens (nooit committen)
.env
*.env.local
/server/data/
/data/

# Editors en systeem
.DS_Store
Thumbs.db
.idea/
.vscode/
*.log
```

## `.dockerignore`

```gitignore
.git
server/target
server/data
server/.env
web/node_modules
web/dist
web/.env
data
*.log
```

## `Dockerfile`

```dockerfile
# --- 1. Frontend bouwen ---
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
ARG VITE_CONTROL_URL=""
ENV VITE_CONTROL_URL=${VITE_CONTROL_URL}
RUN npm run build

# --- 2. Server bouwen ---
FROM rust:1-bookworm AS server
WORKDIR /server
COPY server/Cargo.toml server/Cargo.lock ./
COPY server/src ./src
RUN cargo build --release --locked

# --- 3. Runtime ---
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 app \
 && mkdir /data && chown app /data
WORKDIR /app
COPY --from=server /server/target/release/miltech-sales /app/miltech-sales
COPY --from=web /web/dist /app/web
ENV HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data \
    WEB_DIST=/app/web
USER app
VOLUME ["/data"]
EXPOSE 8787
CMD ["/app/miltech-sales"]
```

## `docker-compose.yml`

```yaml
services:
  miltech-sales:
    build:
      context: .
      args:
        VITE_CONTROL_URL: ${VITE_CONTROL_URL:-}
    image: miltech-sales:latest
    restart: unless-stopped
    ports:
      - "8787:8787"
    environment:
      APP_PASSWORD: ${APP_PASSWORD:?Zet APP_PASSWORD in .env}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-sonnet-4-5}
      RUST_LOG: ${RUST_LOG:-miltech_sales=info,tower_http=info}
    volumes:
      - miltech-data:/data

volumes:
  miltech-data:
```

## `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci --no-audit --no-fund
      - run: npm run build

  server:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: server
      - run: cargo fmt --check
      - run: cargo clippy --locked -- -D warnings
      - run: cargo build --release --locked
```

## `server/Cargo.toml`

```toml
[package]
name = "miltech-sales-server"
version = "1.0.0"
edition = "2021"
description = "Backend voor het Miltech Sales dashboard: gedeelde database met live updates, bestandsopslag en Claude-proxy"
license = "UNLICENSED"
publish = false

[[bin]]
name = "miltech-sales"
path = "src/main.rs"

[dependencies]
anyhow = "1"
async-stream = "0.3"
axum = { version = "0.7", features = ["macros"] }
base64 = "0.22"
bytes = "1"
dotenvy = "0.15"
futures = "0.3"
reqwest = { version = "0.12", default-features = false, features = ["json", "stream", "rustls-tls-native-roots"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread", "fs", "sync", "signal", "net"] }
tokio-stream = { version = "0.1", features = ["sync"] }
tower = "0.5"
tower-http = { version = "0.6", features = ["fs", "trace", "compression-gzip", "set-header"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1", features = ["v4"] }

[profile.release]
lto = "thin"
codegen-units = 1
strip = true
```

## `server/.env.example`

```bash
# Kopieer naar server/.env en vul in. Alle waarden zijn optioneel behalve waar vermeld.

# Netwerk
HOST=0.0.0.0
PORT=8787

# Waar db.json en geüploade bestanden komen te staan
DATA_DIR=./data

# Map met de gebouwde frontend (npm run build in web/)
WEB_DIST=../web/dist

# Wachtwoord voor de hele app (Basic-authenticatie, gebruikersnaam vrij).
# Sterk aanbevolen zodra de server buiten je eigen computer bereikbaar is.
APP_PASSWORD=

# Claude (Anthropic API). Zonder sleutel werkt alles behalve de Claude-functies.
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_MAX_TOKENS=4096
# ANTHROPIC_BASE_URL=https://api.anthropic.com

# Maximale uploadgrootte in MB (Word-bestanden en bibliotheek)
MAX_UPLOAD_MB=60

# Logniveau
RUST_LOG=miltech_sales=info,tower_http=info
```

## `server/src/main.rs`

```rust
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
```

## `server/src/config.rs`

```rust
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
```

## `server/src/error.rs`

```rust
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
```

## `server/src/store.rs`

```rust
//! Eenvoudige documentdatabase in één JSON-bestand.
//!
//! Collecties (leads, prospects, …) bevatten documenten met een id; daarnaast
//! zijn er vaste configuratiedocumenten (team, dagstart, kennis, bibliotheek).
//! Elke wijziging wordt atomair naar schijf geschreven en via een broadcast-kanaal
//! naar alle open browsers gestuurd (Server-Sent Events).

use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tokio::sync::{broadcast, Mutex, RwLock};

use crate::error::{ApiError, ApiResult};

pub const COLLECTIONS: &[&str] = &["leads", "prospects", "klanten", "opdrachten", "syntess"];
pub const CONFIG_KEYS: &[&str] = &["team", "dagstart", "kennis", "bibliotheek"];

#[derive(Default, Serialize, Deserialize, Clone)]
struct Db {
    #[serde(default)]
    collections: BTreeMap<String, BTreeMap<String, Value>>,
    #[serde(default)]
    config: BTreeMap<String, Value>,
}

#[derive(Clone, Serialize, Debug)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Event {
    Collection { name: String, docs: Vec<Value> },
    Config { key: String, value: Value },
}

pub struct Store {
    path: PathBuf,
    db: RwLock<Db>,
    write_lock: Mutex<()>,
    tx: broadcast::Sender<Event>,
}

pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn check_collection(name: &str) -> ApiResult<()> {
    if COLLECTIONS.contains(&name) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(format!(
            "onbekende collectie '{name}'"
        )))
    }
}

fn check_config(key: &str) -> ApiResult<()> {
    if CONFIG_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(format!(
            "onbekende instelling '{key}'"
        )))
    }
}

fn docs_of(db: &Db, name: &str) -> Vec<Value> {
    db.collections
        .get(name)
        .map(|m| {
            m.iter()
                .map(|(id, v)| {
                    let mut o = v.as_object().cloned().unwrap_or_default();
                    o.insert("id".into(), Value::String(id.clone()));
                    Value::Object(o)
                })
                .collect()
        })
        .unwrap_or_default()
}

impl Store {
    pub async fn open(data_dir: &Path) -> anyhow::Result<Self> {
        tokio::fs::create_dir_all(data_dir).await?;
        let path = data_dir.join("db.json");
        let db = match tokio::fs::read(&path).await {
            Ok(bytes) => serde_json::from_slice::<Db>(&bytes)
                .map_err(|e| anyhow::anyhow!("{} is geen geldige database: {e}", path.display()))?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Db::default(),
            Err(e) => return Err(e.into()),
        };
        let (tx, _) = broadcast::channel(256);
        Ok(Self {
            path,
            db: RwLock::new(db),
            write_lock: Mutex::new(()),
            tx,
        })
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.tx.subscribe()
    }

    /// Alle collecties en instellingen als losse events (voor nieuwe verbindingen).
    pub async fn snapshot(&self) -> Vec<Event> {
        let db = self.db.read().await;
        let mut out: Vec<Event> = COLLECTIONS
            .iter()
            .map(|c| Event::Collection {
                name: (*c).to_string(),
                docs: docs_of(&db, c),
            })
            .collect();
        for k in CONFIG_KEYS {
            if let Some(v) = db.config.get(*k) {
                out.push(Event::Config {
                    key: (*k).to_string(),
                    value: v.clone(),
                });
            }
        }
        out
    }

    pub async fn list(&self, col: &str) -> ApiResult<Vec<Value>> {
        check_collection(col)?;
        Ok(docs_of(&*self.db.read().await, col))
    }

    pub async fn set(&self, col: &str, id: &str, data: Value) -> ApiResult<()> {
        check_collection(col)?;
        if !valid_id(id) {
            return Err(ApiError::BadRequest("ongeldig id".into()));
        }
        let mut obj: Map<String, Value> = match data {
            Value::Object(o) => o,
            _ => {
                return Err(ApiError::BadRequest(
                    "document moet een JSON-object zijn".into(),
                ))
            }
        };
        obj.remove("id");
        let docs = {
            let mut db = self.db.write().await;
            db.collections
                .entry(col.to_string())
                .or_default()
                .insert(id.to_string(), Value::Object(obj));
            docs_of(&db, col)
        };
        self.persist().await?;
        let _ = self.tx.send(Event::Collection {
            name: col.to_string(),
            docs,
        });
        Ok(())
    }

    pub async fn delete(&self, col: &str, id: &str) -> ApiResult<()> {
        check_collection(col)?;
        let docs = {
            let mut db = self.db.write().await;
            let removed = db.collections.get_mut(col).and_then(|m| m.remove(id));
            if removed.is_none() {
                return Err(ApiError::NotFound);
            }
            docs_of(&db, col)
        };
        self.persist().await?;
        let _ = self.tx.send(Event::Collection {
            name: col.to_string(),
            docs,
        });
        Ok(())
    }

    pub async fn get_config(&self, key: &str) -> ApiResult<Value> {
        check_config(key)?;
        Ok(self
            .db
            .read()
            .await
            .config
            .get(key)
            .cloned()
            .unwrap_or(Value::Null))
    }

    pub async fn set_config(&self, key: &str, value: Value) -> ApiResult<()> {
        check_config(key)?;
        if !value.is_object() {
            return Err(ApiError::BadRequest(
                "instelling moet een JSON-object zijn".into(),
            ));
        }
        self.db
            .write()
            .await
            .config
            .insert(key.to_string(), value.clone());
        self.persist().await?;
        let _ = self.tx.send(Event::Config {
            key: key.to_string(),
            value,
        });
        Ok(())
    }

    /// Schrijft de database atomair: eerst naar een tijdelijk bestand, dan hernoemen.
    async fn persist(&self) -> ApiResult<()> {
        let _guard = self.write_lock.lock().await;
        let bytes = {
            let db = self.db.read().await;
            serde_json::to_vec_pretty(&*db).map_err(|e| ApiError::Internal(e.into()))?
        };
        let tmp = self.path.with_extension("json.tmp");
        tokio::fs::write(&tmp, &bytes).await?;
        tokio::fs::rename(&tmp, &self.path).await?;
        Ok(())
    }
}
```

## `server/src/assets.rs`

```rust
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
```

## `server/src/claude.rs`

```rust
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
```

## `web/package.json`

```json
{
  "name": "miltech-sales-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Frontend van het Miltech Sales dashboard (React + TypeScript)",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --noEmit",
    "preview": "vite preview"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.6.3",
    "vite": "^5.4.11"
  }
}
```

## `web/tsconfig.json`

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

## `web/tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

## `web/tsconfig.node.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": [
      "ES2023"
    ],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": [
      "node"
    ]
  },
  "include": [
    "vite.config.ts"
  ]
}
```

## `web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In ontwikkeling stuurt Vite alle /api-verzoeken door naar de Rust-server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
```

## `web/.env.example`

```bash
# Kopieer naar web/.env (wordt bij het bouwen in de frontend gezet)

# Link naar het Miltech Control-dashboard in de bovenbalk (leeg = verbergen)
VITE_CONTROL_URL=https://claude.ai/artifact/MstK1MowqyH58vcbZ2rknM
```

## `web/index.html`

```html
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <meta name="theme-color" content="#0c0c0b" />
    <title>Miltech Sales</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Manrope:wght@400;500;600;700;800&display=swap"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## `web/public/favicon.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3987e5"/><stop offset="1" stop-color="#2bb6a3"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><text x="16" y="21.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="15" fill="#fff">M</text></svg>
```

## `web/src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTROL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## `web/src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { verbind } from './lib/dataStore';
import { startSyntessKoppeling } from './syntess/syStore';
import './styles.css';

verbind();
startSyntessKoppeling();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

## `web/src/App.tsx`

```tsx
import { useEffect, useMemo } from 'react';
import { LeadDrawer } from './components/LeadDrawer';
import { PlakDrawer } from './components/PlakDrawer';
import { Ticker } from './components/Ticker';
import { ToastHost } from './components/ToastHost';
import { TopBar } from './components/TopBar';
import { VIEWS } from './lib/constants';
import { useData } from './lib/dataStore';
import { kpi } from './lib/kpi';
import { useMe } from './lib/session';
import { sluitLade, useUi } from './lib/ui';
import { begroeting } from './lib/utils';
import { SyntessView } from './syntess/SyntessView';
import { Klanten } from './views/Klanten';
import { Overzicht } from './views/Overzicht';
import { Pipeline } from './views/Pipeline';
import { Prospects } from './views/Prospects';

export function App() {
  const d = useData();
  const me = useMe();
  const { view, lade } = useUi();
  const K = useMemo(() => kpi(d.leads), [d.leads]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') sluitLade();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const live = d.conn === 'live';

  return (
    <>
      <div className="app">
        <div className="glow1" />
        <div className="glow2" />
        <TopBar K={K} />
        <main>
          <div className="wrap">
            <header className="top">
              <div>
                <div className="kicker">{VIEWS[view].k}</div>
                <h1>{view === 'overzicht' ? begroeting(me) : VIEWS[view].n}</h1>
              </div>
              <div className="pill">
                <span className={'live' + (live ? '' : ' off')} />
                <span>{live ? 'Gedeelde database · live' : d.conn === 'offline' ? 'Geen verbinding met de server' : 'Verbinden…'}</span>
              </div>
            </header>
            <Ticker K={K} />
            <div>
              {view === 'overzicht' && <Overzicht K={K} />}
              {view === 'pipeline' && <Pipeline />}
              {view === 'prospects' && <Prospects />}
              {view === 'syntess' && <SyntessView />}
              {view === 'klanten' && <Klanten />}
            </div>
            <div className="foot">
              Hoe Claude helpt: dagstart, opvolgmails en het afmaken van Syntess-offertes op de pagina. Elke offerte in de offerte-tool loopt
              automatisch mee in de pipeline; kennis en bibliotheek komen uit het project Offerte Tool (importeren via “Offerte uit
              Syntess”). Alle gegevens staan in de gedeelde database op de server.
            </div>
          </div>
        </main>
      </div>
      {lade?.soort === 'lead' && <LeadDrawer key={lade.key} start={lade.lead} />}
      {lade?.soort === 'plak' && <PlakDrawer key={lade.key} />}
      <ToastHost />
    </>
  );
}
```

## `web/src/styles.css`

```css
/* Miltech Sales – stijlen (donker thema, Manrope + Cormorant Garamond) */
:root{
  color-scheme:dark;
  --bg:#0c0c0b; --panel:#1a1a19; --panel2:#141413; --raise:rgba(255,255,255,.04);
  --line:rgba(255,255,255,.09); --line2:rgba(255,255,255,.18);
  --ink:#ffffff; --soft:#c3c2b7; --mute:#898781;
  --blue:#3987e5; --blue2:#5aa0f0; --violet:#9085e9; --teal:#2bb6a3;
  --amber:#fab219; --orange:#e0773a; --green:#5fd35f; --green2:#0ca30c; --red:#e05252;
  --r-lg:22px; --r-md:14px; --r-sm:10px;
  --sans:'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif;
  --serif:'Cormorant Garamond','Iowan Old Style',Georgia,serif;
}
*{box-sizing:border-box}
html,body{background:var(--bg);color:var(--ink)}
body{font-family:var(--sans);font-size:14px;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;margin:0}
a{color:var(--soft);text-decoration:none} a:hover{color:var(--ink)}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--blue2);outline-offset:2px;border-radius:6px}
@keyframes mc-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes mc-drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(120px,60px)}}
@keyframes mc-drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-90px,-70px)}}
@keyframes mc-blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes mc-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

.app{position:relative;min-height:100vh;overflow:clip;display:flex;flex-direction:column}
.glow1,.glow2{position:absolute;border-radius:50%;pointer-events:none}
.glow1{top:-180px;left:-120px;width:620px;height:620px;background:radial-gradient(circle,rgba(57,135,229,.20),transparent 65%);filter:blur(40px);animation:mc-drift1 18s ease-in-out infinite}
.glow2{top:30%;right:-200px;width:700px;height:700px;background:radial-gradient(circle,rgba(95,211,95,.10),transparent 65%);filter:blur(50px);animation:mc-drift2 22s ease-in-out infinite}

/* tabbalk bovenaan */
.topbar{position:sticky;top:0;z-index:40;background:rgba(20,20,19,.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding-top:env(safe-area-inset-top,0px)}
.topbar-in{max-width:1432px;margin:0 auto;padding:10px clamp(16px,4vw,36px) 0;display:flex;align-items:flex-end;gap:6px 22px;flex-wrap:wrap;background:linear-gradient(var(--line2),var(--line2)) left bottom/100% 1px no-repeat}
.brand{display:flex;align-items:center;gap:10px;padding-bottom:10px;flex-shrink:0}
.logo{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#3987e5,#2bb6a3);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:0 0 26px rgba(57,135,229,.4);flex-shrink:0}
.brand b{display:block;font-size:14px;line-height:1.2}
.brand small{font-size:11px;color:var(--mute)}
.nav{display:flex;gap:4px;overflow-x:auto;flex:1 1 320px;min-width:0;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.nav::-webkit-scrollbar{display:none}
.nav button{display:flex;align-items:center;gap:9px;padding:10px 16px;border-radius:12px 12px 0 0;border:1px solid transparent;border-bottom:none;font-size:13.5px;font-weight:600;color:#a5a49b;background:transparent;transition:background .15s,color .15s;white-space:nowrap;flex-shrink:0}
.nav button:hover{color:#fff;background:rgba(255,255,255,.04)}
.nav button[aria-current="page"]{background:var(--bg);border-color:var(--line2);color:#fff}
.nav button:focus-visible{outline-offset:-2px}
.nav .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.nav .cnt{font-size:11px;color:var(--mute);font-weight:700}
.nav .cnt:empty{display:none}
.tools{display:flex;align-items:center;gap:12px;padding-bottom:9px;flex-shrink:0;font-size:12px;color:var(--mute)}
.tools select.input{width:auto;padding:6px 9px;font-size:12.5px}
.tools a{font-weight:700;font-size:12.5px;white-space:nowrap}
.side-foot{display:flex;align-items:center;gap:7px;white-space:nowrap}
.side-foot #live-txt{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.live{width:7px;height:7px;border-radius:50%;background:var(--green2);box-shadow:0 0 10px var(--green2);animation:mc-blink 2.2s ease-in-out infinite;flex-shrink:0}
.live.off{background:var(--amber);box-shadow:0 0 10px var(--amber)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.me-naam{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#fff;white-space:nowrap}
.foot{margin-top:14px;padding-top:14px;border-top:1px solid var(--line);font-size:11.5px;color:var(--mute);line-height:1.7}

main{position:relative;flex:1;width:100%;padding:24px clamp(16px,4vw,36px) calc(48px + env(safe-area-inset-bottom,0px));min-width:0}
.wrap{max-width:1360px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
header.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px 24px;flex-wrap:wrap}
.kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);font-weight:600}
h1{font-family:var(--serif);font-style:italic;font-weight:500;font-size:36px;line-height:1.05;margin:2px 0 0;text-wrap:balance}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--raise);font-size:12.5px;color:var(--soft)}
.ticker{overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:9px 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.ticker-in{display:flex;width:max-content;animation:mc-marquee 44s linear infinite}
.tk{display:flex;align-items:center;gap:10px;padding:0 28px;font-size:12.5px;color:var(--soft);white-space:nowrap}
.tk i{width:6px;height:6px;border-radius:50%}
.tk span{color:var(--mute)} .tk b{color:#fff}

/* generic */
.card{border-radius:var(--r-lg);border:1px solid var(--line);background:var(--panel);padding:22px 24px;min-width:0}
.card h2{font-size:16px;font-weight:700;margin:0}
.sub{font-size:12.5px;color:var(--mute);margin-top:3px;line-height:1.5}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:18px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.tile{position:relative;text-align:left;color:#fff;border-radius:18px;border:1px solid var(--line);background:var(--panel);padding:18px 20px;overflow:hidden}
.tile:hover{border-color:rgba(255,255,255,.25)}
.tile .l{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:600}
.tile .v{font-size:28px;font-weight:800;letter-spacing:-.02em;margin-top:8px;line-height:1;white-space:nowrap}
.tile .s{font-size:12.5px;margin-top:8px;font-weight:600;color:var(--soft)}
.tile .orb{position:absolute;right:-20px;bottom:-30px;width:110px;height:110px;border-radius:50%}
.btn{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:10px;border:1px solid var(--line2);background:rgba(255,255,255,.05);font-size:13px;font-weight:700;color:#fff;white-space:nowrap}
.btn:hover{background:rgba(255,255,255,.1)}
.btn.pri{background:linear-gradient(135deg,#3987e5,#2f74c9);border-color:transparent;box-shadow:0 0 22px rgba(57,135,229,.3)}
.btn.pri:hover{filter:brightness(1.1)}
.btn.ai{background:linear-gradient(135deg,rgba(144,133,233,.25),rgba(57,135,229,.2));border-color:rgba(144,133,233,.45)}
.btn.sm{padding:6px 10px;font-size:12px;border-radius:8px}
.btn.ghost{border-color:transparent;background:transparent;color:var(--soft)}
.btn.danger{border-color:rgba(224,82,82,.5);color:#ffb3b3}
.btn:disabled{opacity:.45;cursor:not-allowed}
.spark{width:14px;height:14px;display:inline-block;flex-shrink:0}
.input,select.input,textarea.input{width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line2);background:#111110;color:#fff;font-size:13.5px}
textarea.input{resize:vertical;min-height:84px;line-height:1.5}
select.input{appearance:auto}
.lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:700;margin-bottom:5px;display:block}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:700;background:rgba(255,255,255,.06);color:var(--soft);white-space:nowrap}
.chip i{width:7px;height:7px;border-radius:50%}
.chip.late{background:rgba(224,82,82,.16);color:#ff9c9c}
.chip.today{background:rgba(250,178,25,.16);color:#ffd27a}
.chip.ok{background:rgba(95,211,95,.12);color:#9be59b}
.chip.ai{background:rgba(144,133,233,.18);color:#c9c2ff}
.chip.ex{background:rgba(250,178,25,.14);color:#ffd27a}
.muted{color:var(--mute)} .soft{color:var(--soft)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.between{justify-content:space-between}
.stack{display:flex;flex-direction:column;gap:12px}
.banner{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:var(--r-md);border:1px solid rgba(250,178,25,.35);background:rgba(250,178,25,.07);font-size:13px;color:var(--soft);line-height:1.5}
.banner b{color:#fff}
.empty{padding:18px;border:1px dashed var(--line2);border-radius:var(--r-md);color:var(--mute);font-size:13px;text-align:center}

/* overzicht */
.funnel{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.fn{display:grid;grid-template-columns:120px minmax(0,1fr) 90px;gap:12px;align-items:center;font-size:12.5px}
.fn .n{color:var(--soft);font-weight:600}
.fn .bar{height:22px;border-radius:6px;background:rgba(255,255,255,.04);position:relative;overflow:hidden}
.fn .bar div{position:absolute;inset:0 auto 0 0;border-radius:6px}
.fn .bar span{position:absolute;left:8px;top:50%;transform:translateY(-50%);font-weight:800;font-size:11.5px}
.fn .e{text-align:right;font-weight:700}
.todo{display:flex;gap:12px;padding:12px 14px;border-radius:var(--r-md);background:var(--raise);border:1px solid rgba(255,255,255,.06);text-align:left;width:100%;color:#fff;align-items:flex-start}
.todo:hover{border-color:var(--line2)}
.todo .d{width:10px;height:10px;border-radius:50%;margin-top:5px;flex-shrink:0}
.todo .t{font-size:13.5px;font-weight:700}
.todo .x{font-size:12px;color:var(--soft);margin-top:3px;line-height:1.5}
.ai-out{font-size:13px;line-height:1.65;color:var(--soft);white-space:normal}
.ai-out ul{margin:6px 0;padding-left:18px} .ai-out li{margin:3px 0}
.ai-out b,.ai-out strong{color:#fff}
.ai-out p{margin:6px 0}
.spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:mc-spin .8s linear infinite;display:inline-block}

/* pipeline */
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.toolbar .input{width:auto;min-width:0}
.toolbar .grow{flex:1 1 200px}
.board-wrap{overflow-x:auto;padding-bottom:8px;margin:0 -4px}
.board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(250px,1fr);gap:12px;padding:0 4px;min-width:min-content}
.col{border-radius:18px;background:rgba(255,255,255,.025);border:1px solid var(--line);padding:12px;display:flex;flex-direction:column;gap:10px;min-height:180px}
.col-h{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;padding:2px 4px}
.col-h i{width:9px;height:9px;border-radius:50%}
.col-h small{margin-left:auto;color:var(--mute);font-weight:700}
.lc{text-align:left;width:100%;border-radius:14px;border:1px solid var(--line);background:var(--panel);padding:12px 13px;color:#fff;display:flex;flex-direction:column;gap:7px}
.lc:hover{border-color:var(--line2);transform:translateY(-1px)}
.lc .b{font-weight:700;font-size:13.5px}
.lc .o{font-size:12px;color:var(--soft);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lc .f{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.lc .w{margin-left:auto;font-weight:800;font-size:13px}
.av{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;background:rgba(57,135,229,.25);color:#cfe2ff;flex-shrink:0}

/* prospects */
.sectors{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.sec{text-align:left;border-radius:16px;border:1px solid var(--line);background:var(--panel);padding:14px 15px;color:#fff;display:flex;flex-direction:column;gap:6px;position:relative;overflow:hidden}
.sec:hover{border-color:var(--line2)}
.sec[aria-pressed="true"]{border-color:var(--blue2);box-shadow:0 0 0 1px var(--blue2) inset}
.sec .h{font-weight:700;font-size:13.5px;display:flex;gap:8px;align-items:center}
.sec .h i{width:9px;height:9px;border-radius:3px;flex-shrink:0}
.sec .e{font-size:12px;color:var(--mute);line-height:1.45}
.sec .n{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:10px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
td .b{font-weight:700}
td .x{font-size:12px;color:var(--soft);line-height:1.5;margin-top:2px}
.why{display:grid;gap:8px}
.why div{display:flex;gap:10px;font-size:12.5px;color:var(--soft);line-height:1.55}
.why div::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--blue2);margin-top:7px;flex-shrink:0}
.links{display:flex;gap:8px;flex-wrap:wrap}
.links a{font-size:12px;font-weight:700;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--raise);color:var(--soft)}
.links a:hover{color:#fff;border-color:var(--line2)}
.sugg{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:var(--raise);border:1px solid rgba(144,133,233,.25)}

/* drawer */
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);z-index:50}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100%);background:#131312;border-left:1px solid var(--line2);z-index:51;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
.dr-h{display:flex;align-items:center;gap:10px;padding:18px 20px;border-bottom:1px solid var(--line)}
.dr-h h3{font-family:var(--serif);font-style:italic;font-weight:600;font-size:26px;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dr-b{flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:16px}
.dr-f{padding:14px 20px;border-top:1px solid var(--line);display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fields .full{grid-column:1/-1}
.stages{display:flex;gap:6px;flex-wrap:wrap}
.stages button{padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;font-size:12px;font-weight:700;color:var(--soft)}
.stages button[aria-pressed="true"]{color:#0c0c0b}
.log{display:flex;flex-direction:column;gap:8px}
.log div{font-size:12.5px;line-height:1.5;color:var(--soft);padding:8px 10px;border-radius:10px;background:var(--raise)}
.log small{color:var(--mute);display:block;font-size:11px;margin-bottom:2px}
.toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:#fff;color:#0c0c0b;font-weight:700;font-size:13px;padding:10px 16px;border-radius:999px;z-index:60;box-shadow:0 8px 30px rgba(0,0,0,.4)}

/* calculatie */
.seg{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);flex-wrap:wrap}
.seg button{border:none;background:transparent;color:var(--soft);font-weight:700;font-size:13px;padding:8px 14px;border-radius:9px}
.seg button[aria-pressed="true"]{background:rgba(255,255,255,.12);color:#fff}
.calc-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:18px;align-items:start}
@media (max-width:1180px){.calc-grid{grid-template-columns:minmax(0,1fr)}}
.chat{display:flex;flex-direction:column;gap:10px;max-height:62vh;overflow-y:auto;padding-right:4px}
.msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.55;white-space:pre-wrap}
.msg.c{background:rgba(144,133,233,.12);border:1px solid rgba(144,133,233,.28);color:#e9e7ff;align-self:flex-start;border-bottom-left-radius:4px}
.msg.u{background:rgba(57,135,229,.2);border:1px solid rgba(57,135,229,.35);align-self:flex-end;border-bottom-right-radius:4px}
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opts button{padding:6px 11px;border-radius:999px;border:1px solid rgba(144,133,233,.45);background:transparent;color:#d8d3ff;font-size:12.5px;font-weight:700}
.opts button:hover{background:rgba(144,133,233,.15)}
.composer{display:flex;gap:8px;align-items:flex-end}
.composer textarea{min-height:46px;flex:1}
.ctbl{width:100%;border-collapse:collapse;font-size:12.5px;min-width:620px}
.ctbl th{padding:6px 6px;font-size:10.5px}
.ctbl td{padding:4px 4px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
.ctbl .grp td{padding:12px 6px 6px;font-weight:800;font-size:12px;color:var(--soft);border-bottom:1px solid var(--line)}
.ctbl .num{text-align:right}
.cell{width:100%;padding:6px 7px;border-radius:7px;border:1px solid transparent;background:rgba(255,255,255,.03);color:#fff;font-size:12.5px}
.cell:hover{border-color:var(--line)} .cell:focus{border-color:var(--blue2);background:#111110;outline:none}
.cell.n{text-align:right}
.cell.miss{border-color:rgba(250,178,25,.55);background:rgba(250,178,25,.08)}
.totals{display:grid;grid-template-columns:1fr auto;gap:6px 18px;font-size:13px;margin-left:auto;min-width:min(100%,320px)}
.totals .t{color:var(--soft)} .totals .v{text-align:right;font-weight:700}
.totals .big{font-size:18px;font-weight:800;color:#fff}
.sheet-wrap{background:#e9e8e3;border-radius:var(--r-lg);padding:24px;overflow:hidden}
.sheet{background:#fff;color:#222;max-width:794px;margin:0 auto;box-shadow:0 10px 40px rgba(0,0,0,.35);border-radius:4px}
.sheet [contenteditable]{outline:none;border-radius:3px}
.sheet [contenteditable]:hover{background:rgba(11,94,168,.06)}
.sheet [contenteditable]:focus{background:rgba(11,94,168,.1);box-shadow:0 0 0 2px rgba(11,94,168,.35)}
.calc-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.of-doc table{font-size:inherit;width:auto}
.of-doc td,.of-doc th{padding:0;border:none;vertical-align:top}
.logo-prev{height:56px;max-width:220px;object-fit:contain;background:#fff;border-radius:8px;padding:6px 10px}

/* offerte uit syntess */
.sy-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:18px;align-items:start}
@media (max-width:1180px){.sy-grid{grid-template-columns:minmax(0,1fr)}}
.sy-grid>div:last-child{position:sticky;top:70px}
@media (max-width:1180px){.sy-grid>div:last-child{position:static}}
.sy-art{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--raise);cursor:pointer}
.sy-art:hover{border-color:var(--line2)} .sy-art.sel{border-color:var(--blue2);box-shadow:0 0 0 1px var(--blue2) inset}
.sy-ctl{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;line-height:1.5;padding:8px 10px;border-radius:10px;background:var(--raise);color:var(--soft)}
.sy-ctl.warn{border:1px solid rgba(250,178,25,.35)} .sy-ctl b{color:#fff}
.leg{display:inline-flex;align-items:center;gap:6px;color:var(--soft)} .leg i{width:10px;height:10px;border-radius:3px}
.sy-view{background:#e9e8e3;border-radius:14px;padding:16px;max-height:80vh;overflow:auto}
#sy-pages{width:max-content;margin:0 auto}
.sy-page{position:relative;background:#fff;margin:0 auto 22px;box-shadow:0 8px 30px rgba(0,0,0,.3);overflow:hidden;color:#000}
.sy-hdr,.sy-ftr,.sy-body{position:absolute}
.sy-body{overflow:visible}
.sy-pnr{position:absolute;right:8px;top:6px;font:600 11px Arial;color:#aaa}
.sy-doc{font-family:var(--syf,'Times New Roman'),serif;font-size:var(--sys,12pt);line-height:1.15;color:#000;text-align:left}
.sy-doc .wp{position:relative;margin:0;min-height:1.15em;white-space:pre-wrap;word-wrap:break-word}
.sy-doc .tb{display:inline-block;width:47px}
.sy-doc .anc{position:absolute;display:block;overflow:visible}
.sy-doc .inl{display:inline-block;vertical-align:bottom;position:relative}
.sy-doc .ph{background:#eef1f5;border:1px dashed #9aa8b8;color:#567;font:11px Arial;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px}
.sy-doc table{width:auto;font-size:inherit;border-collapse:collapse}
.sy-doc td{padding:0 5px;border:none;vertical-align:top}
.sy-doc table.bd td{border:1px solid #000}
.sy-doc .syi-bib{box-shadow:-7px 0 0 #2bb6a3;background:rgba(43,182,163,.07)}
.sy-doc .syi-claude{box-shadow:-7px 0 0 #9085e9;background:rgba(144,133,233,.09)}
.sy-doc .syi-eigen{box-shadow:-7px 0 0 #fab219;background:rgba(250,178,25,.09)}
.sy-doc [data-syk]{cursor:pointer}
.sy-doc [contenteditable]{cursor:text;outline:none}
.sy-doc [contenteditable]:focus{box-shadow:-7px 0 0 #9085e9,0 0 0 2px rgba(144,133,233,.6)}
.sy-doc .sel{outline:2px solid #3987e5;outline-offset:1px}
#sy-pages.nomark .syi{box-shadow:none;background:none}
#sy-pages.nomark .sel{outline:none}
.seg .cnt{font-size:11px;color:var(--amber);font-weight:800}

@media (max-width:860px){
  .sheet-wrap{padding:10px}
  .brand{order:1}
  .tools{order:2;margin-left:auto;align-self:center;padding-bottom:10px;gap:10px}
  .nav{order:3;flex-basis:100%;gap:2px}
  .nav button{padding:9px 12px;font-size:13px;gap:7px}
  .brand small,.tools a{display:none}
  main{padding-top:18px}
  h1{font-size:30px}
  .fields{grid-template-columns:1fr}
  .fn{grid-template-columns:92px minmax(0,1fr) 72px}
  .card{padding:18px 16px}
}

/* aanvullingen voor de losstaande versie */
html{padding-top:env(safe-area-inset-top,0px)}
body{margin:0;padding:0}
img{max-width:100%}
[hidden]:not([hidden=until-found i]){display:none!important}
.sy-ctl.ok{border:1px solid rgba(95,211,95,.2)}
.file-btn{position:relative;overflow:hidden}
.file-btn input{position:absolute;inset:0;opacity:0;cursor:pointer}
```

## `web/src/lib/api.ts`

```typescript
import type { CollectionName, ConfigKey } from './types';

export class ApiFout extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  let code = 'http_' + res.status;
  let message = res.statusText || 'Verzoek mislukt';
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } };
    if (j.error?.code) code = j.error.code;
    if (j.error?.message) message = j.error.message;
  } catch {
    /* geen JSON-foutbericht */
  }
  throw new ApiFout(code, message);
}

const jsonHeaders = { 'content-type': 'application/json' };

export const api = {
  async status(): Promise<{ claude: boolean; model: string; version: string }> {
    return (await check(await fetch('/api/status'))).json();
  },
  async set(col: CollectionName, id: string, data: unknown): Promise<void> {
    await check(
      await fetch(`/api/db/${col}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(data),
      }),
    );
  },
  async del(col: CollectionName, id: string): Promise<void> {
    await check(await fetch(`/api/db/${col}/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  },
  async setConfig(key: ConfigKey, value: unknown): Promise<void> {
    await check(
      await fetch(`/api/config/${key}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(value) }),
    );
  },
  async upload(blob: Blob): Promise<{ id: string }> {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob,
    });
    return (await check(res)).json();
  },
  async asset(id: string): Promise<Response> {
    return check(await fetch(`/api/assets/${encodeURIComponent(id)}`));
  },
  async assetJson<T>(id: string): Promise<T> {
    return (await api.asset(id)).json() as Promise<T>;
  },
};
```

## `web/src/lib/claude.ts`

````typescript
import { ApiFout } from './api';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export type ClaudeInput = string | Turn[];

function berichten(input: ClaudeInput): Turn[] {
  return typeof input === 'string' ? [{ role: 'user', content: input }] : input;
}

async function fout(res: Response): Promise<never> {
  let code = 'upstream_error';
  let msg = 'Claude gaf geen antwoord';
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } };
    code = j.error?.code || code;
    msg = j.error?.message || msg;
  } catch {
    /* geen JSON */
  }
  if (res.status === 503) code = 'not_configured';
  throw new ApiFout(code, msg);
}

/** Gestreamd antwoord; onText krijgt telkens de tekst tot nu toe. */
export async function sample(
  input: ClaudeInput,
  opts: { onText?: (t: { text: string }) => void; maxTokens?: number } = {},
): Promise<{ text: string }> {
  const res = await fetch('/api/claude/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: berichten(input), max_tokens: opts.maxTokens }),
  });
  if (!res.ok || !res.body) return fout(res);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const regel = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!regel) continue;
      const j = JSON.parse(regel) as { t?: string; done?: boolean; text?: string; error?: { code: string; message: string } };
      if (j.error) throw new ApiFout(j.error.code, j.error.message);
      if (typeof j.t === 'string') {
        text += j.t;
        opts.onText?.({ text });
      }
      if (j.done && typeof j.text === 'string') text = j.text;
    }
  }
  return { text };
}

/** Haalt het eerste JSON-object uit een antwoord (ook als er toch tekst omheen staat). */
export function parseJson<T>(text: string): T {
  const t = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new ApiFout('bad_json', 'Geen JSON in het antwoord');
  return JSON.parse(t.slice(a, b + 1)) as T;
}

/** Antwoord als JSON-object. */
export async function sampleJson<T = Record<string, unknown>>(input: ClaudeInput, maxTokens?: number): Promise<T> {
  const res = await fetch('/api/claude/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: berichten(input), json: true, max_tokens: maxTokens }),
  });
  if (!res.ok) return fout(res);
  const j = (await res.json()) as { text: string };
  return parseJson<T>(j.text);
}

export function aiFout(e: unknown): string {
  const c = e instanceof ApiFout ? e.code : '';
  if (c === 'not_configured' || c === 'not_granted') return 'Claude is niet ingesteld op de server (ANTHROPIC_API_KEY).';
  if (c === 'rate_limited') return 'Even te veel vragen achter elkaar. Probeer het over een minuut opnieuw.';
  if (c === 'prompt_too_large') return 'Te veel gegevens voor één vraag.';
  return 'Claude gaf geen antwoord. Probeer het opnieuw.';
}
````

## `web/src/lib/constants.ts`

```typescript
import type { FaseId, ViewId } from './types';

export interface Fase {
  id: FaseId;
  n: string;
  k: string;
  p: number;
}

export const FASEN: Fase[] = [
  { id: 'lead', n: 'Lead', k: '#9085e9', p: 10 },
  { id: 'aanvraag', n: 'Aanvraag', k: '#5aa0f0', p: 25 },
  { id: 'bezoek', n: 'Bezoek / inmeten', k: '#2bb6a3', p: 40 },
  { id: 'offerte', n: 'Offerte uit', k: '#fab219', p: 50 },
  { id: 'onderhandeling', n: 'Onderhandeling', k: '#e0773a', p: 70 },
  { id: 'gewonnen', n: 'Gewonnen', k: '#5fd35f', p: 100 },
  { id: 'verloren', n: 'Verloren', k: '#e05252', p: 0 },
];

export const OPEN: FaseId[] = ['lead', 'aanvraag', 'bezoek', 'offerte', 'onderhandeling'];

export const FASE = Object.fromEntries(FASEN.map((f) => [f.id, f])) as Record<FaseId, Fase>;

export function faseVan(id: string | undefined): Fase {
  return (id && FASE[id as FaseId]) || FASE.lead;
}

export interface Sector {
  id: string;
  n: string;
  k: string;
}

export const SECTOREN: Sector[] = [
  { id: 'metaal', n: 'Metaal & lastechniek', k: '#5aa0f0' },
  { id: 'hout', n: 'Hout & meubel', k: '#c9a26b' },
  { id: 'voeding', n: 'Voeding & zuivel', k: '#f0c05a' },
  { id: 'chemie', n: 'Chemie, verf & coatings', k: '#9085e9' },
  { id: 'kunststof', n: 'Kunststof & rubber', k: '#2bb6a3' },
  { id: 'recycling', n: 'Recycling & afval', k: '#7ab35a' },
  { id: 'verpakking', n: 'Verpakking & drukwerk', k: '#d98b5f' },
  { id: 'bouwmat', n: 'Bouwmaterialen & steen', k: '#b5a48a' },
  { id: 'machinebouw', n: 'Machinebouw & OEM', k: '#6fa8dc' },
  { id: 'voertuigen', n: 'Voertuigen & testruimtes', k: '#e0773a' },
  { id: 'farma', n: 'Farma & laboratoria', k: '#c983d9' },
  { id: 'onderwijs', n: 'Onderwijs & praktijklokalen', k: '#8fc3a9' },
];

export const SEC: Record<string, Sector> = Object.fromEntries(SECTOREN.map((s) => [s.id, s]));

export const BRONNEN = ['', 'Telefoon', 'E-mail', 'Website', 'Bestaande klant', 'Beurs', 'Netwerk', 'Prospectie', 'Onderhoud', 'Syntess'];

export const PROSPECT_STATUS = ['nieuw', 'te verifiëren', 'benaderd', 'lead', 'afgevallen'] as const;

export const STANDAARD_TEAM = ['Tycho', 'Tim'];

export const CONTEXT =
  'Je bent de sales-assistent van Miltech Zuid Nederland B.V. Schrijf in het Nederlands, zakelijk en direct. Gebruik alleen de gegevens die je hieronder krijgt. Verzin geen feiten, namen, producten, referenties, prijzen of afspraken.';

export const VIEWS: Record<ViewId, { n: string; k: string; dot: string }> = {
  overzicht: { n: 'Overzicht', k: 'Sales · vandaag', dot: '#3987e5' },
  pipeline: { n: 'Pipeline', k: 'Leads, aanvragen en offertes', dot: '#fab219' },
  prospects: { n: 'Nieuwe klanten', k: 'Prospects per sector', dot: '#2bb6a3' },
  syntess: { n: 'Offerte uit Syntess', k: 'Syntess-export aanvullen in Miltech-huisstijl', dot: '#5fd35f' },
  klanten: { n: 'Klantbestand', k: 'Wie al klant is', dot: '#9085e9' },
};

export const VIEW_IDS = Object.keys(VIEWS) as ViewId[];

export const CONTROL_URL: string = import.meta.env.VITE_CONTROL_URL ?? '';
```

## `web/src/lib/dataStore.ts`

```typescript
import { useSyncExternalStore } from 'react';
import { api, ApiFout } from './api';
import { STANDAARD_TEAM } from './constants';
import { toast } from './toast';
import type { CollectionName, ConfigKey, DataState } from './types';

/**
 * Gedeelde gegevens. De server stuurt via Server-Sent Events bij elke wijziging
 * de volledige collectie; lokale wijzigingen worden direct (optimistisch) getoond.
 */
let state: DataState = {
  leads: [],
  prospects: [],
  klanten: [],
  opdrachten: [],
  syntess: [],
  team: STANDAARD_TEAM,
  dagstart: null,
  kennis: null,
  bibliotheek: null,
  conn: 'wacht',
  claude: false,
};

const luisteraars = new Set<() => void>();
const naCollectie = new Map<string, Set<() => void>>();

function zet(patch: Partial<DataState>) {
  state = { ...state, ...patch };
  luisteraars.forEach((l) => l());
}

export function getData(): DataState {
  return state;
}

export function useData(): DataState {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => state,
  );
}

/** Luistert naar elke wijziging in de gegevens (buiten React). */
export function abonneer(cb: () => void): () => void {
  luisteraars.add(cb);
  return () => luisteraars.delete(cb);
}

/** Callback na elke update van een collectie vanaf de server. */
export function bijUpdate(col: CollectionName, cb: () => void): () => void {
  if (!naCollectie.has(col)) naCollectie.set(col, new Set());
  naCollectie.get(col)!.add(cb);
  return () => naCollectie.get(col)!.delete(cb);
}

type ServerEvent =
  | { type: 'collection'; name: CollectionName; docs: unknown[] }
  | { type: 'config'; key: ConfigKey; value: Record<string, unknown> };

function verwerk(ev: ServerEvent) {
  if (ev.type === 'collection') {
    zet({ [ev.name]: ev.docs } as Partial<DataState>);
    naCollectie.get(ev.name)?.forEach((cb) => cb());
    return;
  }
  const v = ev.value;
  if (!v) return;
  if (ev.key === 'team') {
    const namen = (v as { namen?: unknown }).namen;
    if (Array.isArray(namen) && namen.length) zet({ team: namen.map(String) });
  } else if (ev.key === 'dagstart') {
    if ((v as { text?: string }).text) zet({ dagstart: v as unknown as DataState['dagstart'] });
  } else if (ev.key === 'kennis') {
    zet({ kennis: v as DataState['kennis'] });
  } else if (ev.key === 'bibliotheek') {
    zet({ bibliotheek: v as unknown as DataState['bibliotheek'] });
  }
}

let bron: EventSource | null = null;

export function verbind(): void {
  if (bron) return;
  api
    .status()
    .then((s) => zet({ claude: !!s.claude }))
    .catch(() => zet({ claude: false }));
  bron = new EventSource('/api/events');
  bron.onopen = () => zet({ conn: 'live' });
  bron.onerror = () => zet({ conn: 'offline' });
  bron.onmessage = (m) => {
    try {
      verwerk(JSON.parse(m.data) as ServerEvent);
      if (state.conn !== 'live') zet({ conn: 'live' });
    } catch {
      /* onbekend bericht negeren */
    }
  };
}

function foutTekst(e: unknown): string {
  if (e instanceof ApiFout && e.code === 'invalid_argument') return 'Opslaan geweigerd: ' + e.message;
  return 'Opslaan mislukt, probeer het opnieuw';
}

/** Document opslaan (vervangt het geheel). Geeft true bij succes. */
export async function bewaar(col: CollectionName, id: string, data: object): Promise<boolean> {
  const vorige = state[col] as unknown as Array<{ id: string }>;
  const obj = { ...(data as Record<string, unknown>), id };
  const i = vorige.findIndex((x) => x.id === id);
  const nieuw = i >= 0 ? vorige.map((x, j) => (j === i ? obj : x)) : [...vorige, obj];
  zet({ [col]: nieuw } as Partial<DataState>);
  try {
    await api.set(col, id, data);
    return true;
  } catch (e) {
    zet({ [col]: vorige } as Partial<DataState>);
    toast(foutTekst(e));
    return false;
  }
}

export async function verwijder(col: CollectionName, id: string): Promise<boolean> {
  const vorige = state[col] as unknown as Array<{ id: string }>;
  zet({ [col]: vorige.filter((x) => x.id !== id) } as Partial<DataState>);
  try {
    await api.del(col, id);
    return true;
  } catch {
    zet({ [col]: vorige } as Partial<DataState>);
    toast('Verwijderen mislukt');
    return false;
  }
}

export async function bewaarConfig(key: ConfigKey, value: object): Promise<boolean> {
  try {
    await api.setConfig(key, value);
    verwerk({ type: 'config', key, value: value as Record<string, unknown> });
    return true;
  } catch (e) {
    toast(foutTekst(e));
    return false;
  }
}
```

## `web/src/lib/kpi.ts`

```typescript
import { FASE, OPEN } from './constants';
import type { Klant, Lead } from './types';
import { dagenSinds, dagenTot, laatsteContact, norm } from './utils';

export interface Kpi {
  L: Lead[];
  open: Lead[];
  waarde: number;
  gewogen: number;
  off: Lead[];
  laat: Lead[];
  nu: Lead[];
  zonder: Lead[];
  stil: Lead[];
  won: Lead[];
  lost: Lead[];
  wonW: number;
  hit: number | null;
}

export function kpi(L: Lead[]): Kpi {
  const open = L.filter((l) => OPEN.includes(l.fase));
  const waarde = open.reduce((a, l) => a + (+(l.waarde ?? 0) || 0), 0);
  const gewogen = open.reduce(
    (a, l) => a + (+(l.waarde ?? 0) || 0) * ((l.kans != null ? +l.kans : FASE[l.fase].p) / 100),
    0,
  );
  const off = open.filter((l) => l.fase === 'offerte' || l.fase === 'onderhandeling');
  const laat = open.filter((l) => l.volgendeDatum && (dagenTot(l.volgendeDatum) ?? 0) < 0);
  const nu = open.filter((l) => l.volgendeDatum && dagenTot(l.volgendeDatum) === 0);
  const zonder = open.filter((l) => !l.volgendeDatum);
  const stil = off.filter((l) => {
    const s = dagenSinds(laatsteContact(l));
    return s != null && s >= 10;
  });
  const jaar = String(new Date().getFullYear());
  const won = L.filter((l) => l.fase === 'gewonnen' && String(l.gesloten || '').startsWith(jaar));
  const lost = L.filter((l) => l.fase === 'verloren' && String(l.gesloten || '').startsWith(jaar));
  return {
    L,
    open,
    waarde,
    gewogen,
    off,
    laat,
    nu,
    zonder,
    stil,
    won,
    lost,
    wonW: won.reduce((a, l) => a + (+(l.waarde ?? 0) || 0), 0),
    hit: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
  };
}

export function isKlant(naam: string, klanten: Klant[]): Klant | null {
  const n = norm(naam);
  if (!n) return null;
  return (
    klanten.find((k) => {
      const m = norm(k.naam);
      return m && (m === n || (m.length > 4 && n.includes(m)) || (n.length > 4 && m.includes(n)));
    }) || null
  );
}

export function somWaarde(L: Lead[]): number {
  return L.reduce((a, l) => a + (+(l.waarde ?? 0) || 0), 0);
}
```

## `web/src/lib/session.ts`

```typescript
import { useSyncExternalStore } from 'react';
import { lsGet, lsSet } from './utils';

/** Wie achter deze browser zit (gekozen uit het team, bewaard per browser). */
let me = lsGet('ms-me') || '';
const luisteraars = new Set<() => void>();

export function getMe(): string {
  return me;
}

export function setMe(naam: string): void {
  me = naam;
  lsSet('ms-me', naam);
  luisteraars.forEach((l) => l());
}

export function useMe(): string {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => me,
  );
}
```

## `web/src/lib/toast.ts`

```typescript
import { useSyncExternalStore } from 'react';

let bericht: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const luisteraars = new Set<() => void>();

function meld() {
  luisteraars.forEach((l) => l());
}

/** Toont kort een melding onderin het scherm. */
export function toast(msg: string): void {
  bericht = msg;
  clearTimeout(timer);
  timer = setTimeout(() => {
    bericht = null;
    meld();
  }, 2600);
  meld();
}

export function useToast(): string | null {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => bericht,
  );
}
```

## `web/src/lib/types.ts`

```typescript
export type FaseId = 'lead' | 'aanvraag' | 'bezoek' | 'offerte' | 'onderhandeling' | 'gewonnen' | 'verloren';

export type ViewId = 'overzicht' | 'pipeline' | 'prospects' | 'syntess' | 'klanten';

export type CollectionName = 'leads' | 'prospects' | 'klanten' | 'opdrachten' | 'syntess';

export type ConfigKey = 'team' | 'dagstart' | 'kennis' | 'bibliotheek';

export interface LogItem {
  d: string;
  t: string;
  w?: string;
}

export interface Lead {
  id: string;
  fase: FaseId;
  bedrijf: string;
  contact?: string;
  plaats?: string;
  email?: string;
  tel?: string;
  omschrijving?: string;
  sector?: string;
  eigenaar?: string;
  waarde?: number;
  kans?: number;
  offertenr?: string;
  bron?: string;
  volgendeActie?: string;
  volgendeDatum?: string;
  aangemaakt?: string;
  gewijzigd?: string;
  gesloten?: string;
  offerteDatum?: string;
  syntessId?: string;
  log: LogItem[];
}

export type ProspectStatus = 'nieuw' | 'te verifiëren' | 'benaderd' | 'lead' | 'afgevallen';

export interface Prospect {
  id: string;
  bedrijf: string;
  plaats?: string;
  sector?: string;
  bron?: string;
  signaal?: string;
  signaalDatum?: string;
  notitie?: string;
  status: ProspectStatus;
  geverifieerd?: boolean;
  toegevoegd?: string;
  door?: string;
}

export interface Klant {
  id: string;
  naam: string;
  plaats?: string;
  sector?: string;
}

export interface Opdracht {
  id: string;
  sector: string | null;
  regio: string;
  vraag: string;
  status: 'open' | 'klaar';
  resultaat?: string;
  aangemaakt: string;
  door?: string;
}

export interface ChatMsg {
  r: 'u' | 'c';
  t: string;
  wijz?: string;
}

export interface SyntessSamenvatting {
  artikelen: number;
  aangevuld: number;
  ref: string;
  klant: string;
}

export interface SyntessOfferte {
  id: string;
  naam: string;
  bestand: string;
  assetId: string;
  keuzes: Record<string, string>;
  eigen: Record<string, string>;
  inleiding: string;
  chat: ChatMsg[];
  opties: string[];
  gezien: Record<string, boolean>;
  status: 'concept' | 'klaar' | 'verstuurd';
  door: string;
  aangemaakt: string;
  gewijzigd: string;
  leadId?: string;
  samenvatting?: SyntessSamenvatting;
}

export interface Dagstart {
  text: string;
  at: string;
  door: string;
}

export interface Kennis {
  beschrijving?: string;
  instructies?: string;
  huisstijl?: string;
  werkwijze?: string;
  extra?: string;
  standaardteksten?: string;
  gesynchroniseerd?: string;
}

export interface BibliotheekMeta {
  assetId: string;
  kernId?: string;
  mediaIds?: string[];
  naam?: string;
  geimporteerd?: string;
}

export interface TeamConfig {
  namen: string[];
}

export interface DataState {
  leads: Lead[];
  prospects: Prospect[];
  klanten: Klant[];
  opdrachten: Opdracht[];
  syntess: SyntessOfferte[];
  team: string[];
  dagstart: Dagstart | null;
  kennis: Kennis | null;
  bibliotheek: BibliotheekMeta | null;
  conn: 'wacht' | 'live' | 'offline';
  claude: boolean;
}
```

## `web/src/lib/ui.ts`

```typescript
import { useSyncExternalStore } from 'react';
import { VIEW_IDS } from './constants';
import type { Lead, ViewId } from './types';
import { lsGet, lsSet } from './utils';

/** Concept-dossier in de lade: nog zonder id als het een nieuwe lead is. */
export type LeadConcept = Partial<Lead> & Pick<Lead, 'fase' | 'log'> & { _pid?: string };

export type Lade = { soort: 'lead'; lead: LeadConcept; key: number } | { soort: 'plak'; key: number } | null;

interface UiState {
  view: ViewId;
  lade: Lade;
  sector: string | null;
}

function startView(): ViewId {
  let v = (location.hash || '').replace('#', '') || lsGet('ms-view') || 'overzicht';
  if (v === 'calculatie') v = 'syntess';
  return (VIEW_IDS as string[]).includes(v) ? (v as ViewId) : 'overzicht';
}

let ui: UiState = { view: startView(), lade: null, sector: null };
const luisteraars = new Set<() => void>();
let teller = 0;

function zet(p: Partial<UiState>) {
  ui = { ...ui, ...p };
  luisteraars.forEach((l) => l());
}

export function useUi(): UiState {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => ui,
  );
}

export function gaNaar(view: ViewId, sector?: string): void {
  lsSet('ms-view', view);
  try {
    history.replaceState(null, '', '#' + view);
  } catch {
    /* geen history */
  }
  zet({ view, ...(sector ? { sector } : {}) });
  window.scrollTo({ top: 0 });
}

export function kiesSector(sector: string | null): void {
  zet({ sector });
}

export function openLade(lead: LeadConcept): void {
  zet({ lade: { soort: 'lead', lead: JSON.parse(JSON.stringify(lead)), key: ++teller } });
}

export function openPlak(): void {
  zet({ lade: { soort: 'plak', key: ++teller } });
}

export function sluitLade(): void {
  zet({ lade: null });
}

window.addEventListener('hashchange', () => {
  const v = startView();
  if (v !== ui.view) zet({ view: v });
});
```

## `web/src/lib/utils.ts`

```typescript
import type { Lead } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const isoVan = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function vandaag(): string {
  return isoVan(new Date());
}

export function plusDagen(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoVan(d);
}

export function dagenTot(iso?: string | null): number | null {
  if (!iso) return null;
  const a = new Date(vandaag() + 'T00:00:00');
  const b = new Date(iso + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

export function dagenSinds(iso?: string | null): number | null {
  const n = dagenTot(iso);
  return n == null ? null : -n;
}

export const eur = (n?: number | null) => '€ ' + Math.round(n || 0).toLocaleString('nl-NL');

export const eurK = (n?: number | null) => {
  const v = n || 0;
  if (v >= 1e6) return '€ ' + (v / 1e6).toLocaleString('nl-NL', { maximumFractionDigits: 2 }) + ' mln';
  if (v >= 1e4) return '€ ' + Math.round(v / 1e3).toLocaleString('nl-NL') + 'k';
  return eur(v);
};

export const esc = (s: unknown) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

export const datumNL = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
};

export const nid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const norm = (s: unknown) =>
  String(s || '')
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|bv|nv|holding|nederland|netherlands|europe|international)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

export function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function lsSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* opslag niet beschikbaar: negeren */
  }
}

export function laatsteContact(l: Lead): string | null {
  const ds = (l.log || []).map((x) => x.d).filter(Boolean).sort();
  return ds.length ? ds[ds.length - 1] : l.aangemaakt || null;
}

export function initialen(n?: string): string {
  return (
    String(n || '?')
      .trim()
      .split(/\s+/)
      .map((x) => x[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

/** Zeer beperkte markdown (vet + opsommingen) naar veilige HTML. */
export function mdLite(t: string): string {
  const lines = esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .split(/\n/);
  let out = '';
  let inList = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (/^([-•*]|\d+[.)])\s+/.test(l)) {
      if (!inList) {
        out += '<ul>';
        inList = true;
      }
      out += '<li>' + l.replace(/^([-•*]|\d+[.)])\s+/, '') + '</li>';
    } else {
      if (inList) {
        out += '</ul>';
        inList = false;
      }
      if (l) out += '<p>' + l.replace(/^#+\s*/, '') + '</p>';
    }
  }
  if (inList) out += '</ul>';
  return out;
}

export function zonderId<T extends { id: string }>(o: T): Omit<T, 'id'> {
  const c: Partial<T> = { ...o };
  delete c.id;
  return c as Omit<T, 'id'>;
}

export function kloon<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

export function begroeting(me: string): string {
  const h = new Date().getHours();
  const g = h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
  return g + (me ? ', ' + me : '');
}

export function downloadBlob(naam: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
```

## `web/src/components/LeadDrawer.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { BRONNEN, CONTEXT, FASE, FASEN, OPEN, SECTOREN, faseVan } from '../lib/constants';
import { aiFout, sample, sampleJson } from '../lib/claude';
import { bewaar, useData, verwijder } from '../lib/dataStore';
import { isKlant } from '../lib/kpi';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { FaseId, Lead } from '../lib/types';
import { gaNaar, sluitLade, type LeadConcept } from '../lib/ui';
import { datumNL, nid, plusDagen, vandaag } from '../lib/utils';
import { Spark, Spin } from './Spark';
import { openSyntessOfferte } from '../syntess/syStore';

type Stap = { busy: boolean; data?: { actie: string; datum: string; waarom: string }; err?: string };

export function LeadDrawer({ start }: { start: LeadConcept }) {
  const d = useData();
  const [D, setD] = useState<LeadConcept>(() => ({ ...start, log: start.log || [] }));
  const [note, setNote] = useState('');
  const [mail, setMail] = useState<{ busy: boolean; text: string } | null>(null);
  const [stap, setStap] = useState<Stap | null>(null);
  const [zeker, setZeker] = useState(false);
  const [bezig, setBezig] = useState(false);
  const bedrijfRef = useRef<HTMLInputElement>(null);
  const isNew = !D.id;
  const f = faseVan(D.fase);
  const kl = isKlant(D.bedrijf || '', d.klanten);

  useEffect(() => {
    if (!start.id) bedrijfRef.current?.focus();
  }, [start.id]);

  const upd = <K extends keyof LeadConcept>(k: K, v: LeadConcept[K]) => setD((x) => ({ ...x, [k]: v }));

  function opslaanVorm(x: LeadConcept): Omit<Lead, 'id'> {
    const c: Record<string, unknown> = { ...x };
    delete c.id;
    delete c._pid;
    return c as unknown as Omit<Lead, 'id'>;
  }

  async function opslaan() {
    if (!D.bedrijf?.trim()) {
      toast('Vul een bedrijfsnaam in');
      bedrijfRef.current?.focus();
      return;
    }
    setBezig(true);
    const nu = vandaag();
    const x: LeadConcept = {
      ...D,
      bedrijf: D.bedrijf.trim(),
      waarde: +(D.waarde ?? 0) || 0,
      kans: D.kans == null || (D.kans as unknown) === '' ? FASE[D.fase].p : Math.max(0, Math.min(100, +D.kans)),
      log: [...(D.log || [])],
    };
    const id = x.id || nid('l');
    if (!x.id) {
      x.aangemaakt = nu;
      x.log.push({ d: nu, t: 'Dossier aangemaakt' + (x.bron ? ' (bron: ' + x.bron + ')' : ''), w: getMe() });
    }
    x.gewijzigd = new Date().toISOString();
    if ((x.fase === 'gewonnen' || x.fase === 'verloren') && !x.gesloten) x.gesloten = nu;
    if (OPEN.includes(x.fase)) delete x.gesloten;
    const pid = x._pid;
    const ok = await bewaar('leads', id, opslaanVorm(x));
    setBezig(false);
    if (!ok) return;
    toast('Opgeslagen');
    if (pid) {
      const p = d.prospects.find((y) => y.id === pid);
      if (p) {
        const { id: pId, ...rest } = p;
        await bewaar('prospects', pId, { ...rest, status: 'lead' });
      }
    }
    sluitLade();
  }

  async function voegNotitieToe() {
    const t = note.trim();
    if (!t) return;
    const nieuw: LeadConcept = { ...D, log: [...(D.log || []), { d: vandaag(), t, w: getMe() }] };
    setD(nieuw);
    setNote('');
    if (nieuw.id) {
      nieuw.gewijzigd = new Date().toISOString();
      if (await bewaar('leads', nieuw.id, opslaanVorm(nieuw))) toast('Notitie bewaard');
    }
  }

  async function aiMail() {
    setMail({ busy: true, text: '' });
    const input = `${CONTEXT}\n\nDossier (JSON):\n${JSON.stringify({ bedrijf: D.bedrijf, contact: D.contact, fase: f.n, wat: D.omschrijving, waarde: D.waarde, offertenummer: D.offertenr, volgendeActie: D.volgendeActie, logboek: (D.log || []).slice(-8) })}\n\nSchrijf een korte, persoonlijke opvolgmail aan ${D.contact || 'de contactpersoon'} namens ${D.eigenaar || getMe() || 'Miltech'} van Miltech Zuid Nederland. Begin met een regel "Onderwerp: ...", dan een lege regel en de mail. Verwijs concreet naar wat in het logboek staat en stel één duidelijke vervolgstap voor (bijv. een belmoment). Maximaal 120 woorden. Geen verzonnen feiten.`;
    try {
      const r = await sample(input, { onText: (u) => setMail({ busy: true, text: u.text }) });
      setMail({ busy: false, text: r.text });
    } catch (e) {
      setMail({ busy: false, text: aiFout(e) });
    }
  }

  async function aiStap() {
    setStap({ busy: true });
    const input = `${CONTEXT}\n\nVandaag: ${vandaag()}.\nDossier (JSON):\n${JSON.stringify({ bedrijf: D.bedrijf, fase: f.n, wat: D.omschrijving, waarde: D.waarde, volgendeActie: D.volgendeActie, volgendeDatum: D.volgendeDatum, logboek: (D.log || []).slice(-8) })}\n\nWat is de beste volgende stap om dit dossier dichter bij een opdracht te brengen? Antwoord als JSON: {"actie": korte actie (max 8 woorden), "datum": "YYYY-MM-DD" (realistische datum vanaf vandaag, werkdag), "waarom": één zin}.`;
    try {
      const j = await sampleJson<{ actie?: string; datum?: string; waarom?: string }>(input);
      if (!j || !j.actie) throw new Error('leeg');
      setStap({
        busy: false,
        data: { actie: String(j.actie), datum: String(j.datum || plusDagen(2)).slice(0, 10), waarom: String(j.waarom || '') },
      });
    } catch (e) {
      setStap({ busy: false, err: aiFout(e) });
    }
  }

  async function kopieerMail() {
    try {
      await navigator.clipboard.writeText(mail?.text || '');
      toast('Mail gekopieerd');
    } catch {
      toast('Kopiëren lukte niet; selecteer de tekst handmatig');
    }
  }

  async function verwijderDossier() {
    if (!D.id) return;
    if (await verwijder('leads', D.id)) {
      toast('Dossier verwijderd');
      sluitLade();
    }
  }

  const syntessBestaat = !!(D.syntessId && d.syntess.some((x) => x.id === D.syntessId));

  return (
    <>
      <div className="scrim" onClick={sluitLade} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Dossier">
        <div className="dr-h">
          <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: f.k, boxShadow: `0 0 12px ${f.k}` }} />
          <h3>{D.bedrijf || 'Nieuwe lead'}</h3>
          <button className="btn ghost sm" onClick={sluitLade} aria-label="Sluiten">
            ✕
          </button>
        </div>
        <div className="dr-b">
          <div>
            <span className="lbl">Fase</span>
            <div className="stages">
              {FASEN.map((x) => (
                <button
                  key={x.id}
                  aria-pressed={D.fase === x.id}
                  style={D.fase === x.id ? { background: x.k, borderColor: x.k } : undefined}
                  onClick={() => setD((y) => ({ ...y, fase: x.id as FaseId, kans: FASE[x.id].p }))}
                >
                  {x.n}
                </button>
              ))}
            </div>
          </div>
          <div className="fields">
            <div className="full">
              <label className="lbl" htmlFor="d-bedrijf">Bedrijf</label>
              <input ref={bedrijfRef} className="input" id="d-bedrijf" value={D.bedrijf || ''} onChange={(e) => upd('bedrijf', e.target.value)} />
            </div>
            {kl && (
              <div className="full" style={{ marginTop: -6 }}>
                <span className="chip ok">Bestaande klant: {kl.naam}</span>
              </div>
            )}
            <div>
              <label className="lbl" htmlFor="d-contact">Contactpersoon</label>
              <input className="input" id="d-contact" value={D.contact || ''} onChange={(e) => upd('contact', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-plaats">Plaats</label>
              <input className="input" id="d-plaats" value={D.plaats || ''} onChange={(e) => upd('plaats', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-email">E-mail</label>
              <input className="input" id="d-email" type="email" value={D.email || ''} onChange={(e) => upd('email', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-tel">Telefoon</label>
              <input className="input" id="d-tel" type="tel" value={D.tel || ''} onChange={(e) => upd('tel', e.target.value)} />
            </div>
            <div className="full">
              <label className="lbl" htmlFor="d-oms">Wat willen ze</label>
              <textarea className="input" id="d-oms" rows={2} value={D.omschrijving || ''} onChange={(e) => upd('omschrijving', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-sector">Sector</label>
              <select className="input" id="d-sector" value={D.sector || ''} onChange={(e) => upd('sector', e.target.value)}>
                <option value="">Onbekend</option>
                {SECTOREN.map((s) => (
                  <option key={s.id} value={s.id}>{s.n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="d-eig">Eigenaar</label>
              <select className="input" id="d-eig" value={D.eigenaar || ''} onChange={(e) => upd('eigenaar', e.target.value)}>
                <option value="">—</option>
                {d.team.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="d-waarde">Waarde (€ excl. btw)</label>
              <input
                className="input"
                id="d-waarde"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={D.waarde || ''}
                onChange={(e) => upd('waarde', e.target.value === '' ? 0 : +e.target.value)}
              />
            </div>
            <div>
              <label className="lbl" htmlFor="d-kans">Kans (%)</label>
              <input
                className="input"
                id="d-kans"
                type="number"
                min={0}
                max={100}
                step={5}
                value={D.kans != null ? D.kans : f.p}
                onChange={(e) => upd('kans', e.target.value === '' ? undefined : +e.target.value)}
              />
            </div>
            <div>
              <label className="lbl" htmlFor="d-offnr">Offertenummer</label>
              <input className="input" id="d-offnr" value={D.offertenr || ''} onChange={(e) => upd('offertenr', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-bron">Bron</label>
              <select className="input" id="d-bron" value={D.bron || ''} onChange={(e) => upd('bron', e.target.value)}>
                {BRONNEN.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="full" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span className="lbl">Volgende stap</span>
            </div>
            <div>
              <label className="lbl" htmlFor="d-actie">Actie</label>
              <input
                className="input"
                id="d-actie"
                value={D.volgendeActie || ''}
                placeholder="Bijv. offerte nabellen"
                onChange={(e) => upd('volgendeActie', e.target.value)}
              />
            </div>
            <div>
              <label className="lbl" htmlFor="d-datum">Datum</label>
              <input className="input" id="d-datum" type="date" value={D.volgendeDatum || ''} onChange={(e) => upd('volgendeDatum', e.target.value)} />
            </div>
          </div>

          {d.claude && !isNew && (
            <div
              className="stack"
              style={{ gap: 10, padding: 14, borderRadius: 14, border: '1px solid rgba(144,133,233,.3)', background: 'rgba(144,133,233,.06)' }}
            >
              <div className="row">
                <Spark />
                <b>Claude</b>
              </div>
              <div className="row">
                <button className="btn ai sm" onClick={aiMail} disabled={!!mail?.busy}>Schrijf opvolgmail</button>
                <button className="btn ai sm" onClick={aiStap} disabled={!!stap?.busy}>Stel volgende stap voor</button>
              </div>
              {stap && (
                <>
                  <div className="ai-out">
                    {stap.busy && !stap.data ? (
                      <>
                        <Spin /> Denkt na…
                      </>
                    ) : stap.err ? (
                      stap.err
                    ) : stap.data ? (
                      <>
                        <b>{stap.data.actie}</b> · {datumNL(stap.data.datum)}
                        <br />
                        {stap.data.waarom}
                      </>
                    ) : null}
                  </div>
                  {stap.data && (
                    <div>
                      <button
                        className="btn sm"
                        onClick={() => {
                          setD((x) => ({ ...x, volgendeActie: stap.data!.actie, volgendeDatum: stap.data!.datum }));
                          toast('Overgenomen, vergeet niet op te slaan');
                        }}
                      >
                        Neem over als volgende stap
                      </button>
                    </div>
                  )}
                </>
              )}
              {mail && (
                <>
                  <div
                    className="ai-out"
                    style={{ whiteSpace: 'pre-wrap', background: '#0f0f0e', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--line)' }}
                  >
                    {mail.text || (
                      <>
                        <Spin /> Schrijft…
                      </>
                    )}
                  </div>
                  {mail.text && !mail.busy && (
                    <div className="row">
                      <button className="btn sm" onClick={kopieerMail}>Kopieer</button>
                      {D.email && <span className="sub" style={{ margin: 0 }}>Aan: {D.email}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            <label className="lbl" htmlFor="d-note" style={{ margin: 0 }}>Notitie of contactmoment toevoegen</label>
            <textarea
              className="input"
              id="d-note"
              rows={2}
              placeholder="Bijv. gebeld met inkoper, beslissing volgende week"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div>
              <button className="btn sm" onClick={voegNotitieToe}>+ Voeg toe aan logboek</button>
            </div>
            <div className="log">
              {(D.log || []).length ? (
                (D.log || [])
                  .slice()
                  .reverse()
                  .map((x, i) => (
                    <div key={i}>
                      <small>
                        {datumNL(x.d)}
                        {x.w ? ' · ' + x.w : ''}
                      </small>
                      {x.t}
                    </div>
                  ))
              ) : (
                <span className="muted" style={{ fontSize: 12.5 }}>Nog geen contactmomenten.</span>
              )}
            </div>
          </div>
        </div>
        <div className="dr-f">
          <button className="btn pri" onClick={opslaan} disabled={bezig}>
            {isNew ? 'Lead aanmaken' : 'Opslaan'}
          </button>
          {!isNew && syntessBestaat && (
            <button
              className="btn"
              onClick={() => {
                sluitLade();
                gaNaar('syntess');
                void openSyntessOfferte(D.syntessId!);
              }}
            >
              Offerte (Syntess)
            </button>
          )}
          <button className="btn ghost" onClick={sluitLade}>Annuleer</button>
          {!isNew && (
            <>
              <span style={{ marginLeft: 'auto' }} />
              {zeker ? (
                <>
                  <span className="sub" style={{ margin: 0 }}>Zeker weten?</span>
                  <button className="btn danger sm" onClick={verwijderDossier}>Ja, verwijder</button>
                  <button className="btn ghost sm" onClick={() => setZeker(false)}>Nee</button>
                </>
              ) : (
                <button className="btn ghost sm" onClick={() => setZeker(true)}>Verwijder</button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

## `web/src/components/PlakDrawer.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { CONTEXT, FASE, SEC, SECTOREN } from '../lib/constants';
import { aiFout, sampleJson } from '../lib/claude';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { FaseId } from '../lib/types';
import { openLade, sluitLade } from '../lib/ui';
import { vandaag } from '../lib/utils';
import { Spark, Spin } from './Spark';

interface Parsed {
  bedrijf?: string;
  contact?: string;
  email?: string;
  tel?: string;
  plaats?: string;
  sector?: string;
  fase?: string;
  omschrijving?: string;
  waarde?: number | null;
  volgendeActie?: string;
  volgendeDatum?: string;
  notitie?: string;
}

function prompt(txt: string): string {
  return `${CONTEXT}\n\nHaal uit onderstaande tekst (een e-mail, belnotitie of aanvraag) de gegevens voor een nieuw sales-dossier. Vandaag is ${vandaag()}.\nSector kies uit: ${SECTOREN.map((s) => s.id + ' (' + s.n + ')').join(', ')}, of "".\nFase kies uit: lead, aanvraag, bezoek, offerte, onderhandeling.\nAntwoord als JSON met: bedrijf, contact, email, tel, plaats, sector, fase, omschrijving (max 15 woorden, wat de klant wil), waarde (getal in euro of null), volgendeActie (max 8 woorden), volgendeDatum ("YYYY-MM-DD" of ""), notitie (samenvatting in 1-2 zinnen). Laat onbekende velden leeg. Verzin niets.\n\nTekst:\n"""${txt.slice(0, 12000)}"""`;
}

export function PlakDrawer() {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  async function go() {
    const t = txt.trim();
    if (!t) {
      toast('Plak eerst een tekst');
      return;
    }
    setBusy(true);
    setFout('');
    try {
      const j = (await sampleJson<Parsed>(prompt(t))) || {};
      const fase: FaseId = j.fase && j.fase in FASE ? (j.fase as FaseId) : 'aanvraag';
      const me = getMe();
      openLade({
        fase,
        kans: FASE[fase].p,
        bedrijf: j.bedrijf || '',
        contact: j.contact || '',
        email: j.email || '',
        tel: j.tel || '',
        plaats: j.plaats || '',
        sector: j.sector && SEC[j.sector] ? j.sector : '',
        omschrijving: j.omschrijving || '',
        waarde: +(j.waarde ?? 0) || 0,
        volgendeActie: j.volgendeActie || '',
        volgendeDatum: /^\d{4}-\d{2}-\d{2}$/.test(j.volgendeDatum || '') ? j.volgendeDatum : '',
        eigenaar: me,
        bron: /@/.test(t) ? 'E-mail' : '',
        log: j.notitie ? [{ d: vandaag(), t: j.notitie, w: me }] : [],
      });
      toast('Controleer de gegevens en sla op');
    } catch (e) {
      setBusy(false);
      setFout(aiFout(e));
    }
  }

  return (
    <>
      <div className="scrim" onClick={sluitLade} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Plak mail">
        <div className="dr-h">
          <h3>Plak mail of notitie</h3>
          <button className="btn ghost sm" onClick={sluitLade} aria-label="Sluiten">
            ✕
          </button>
        </div>
        <div className="dr-b">
          <div className="sub">
            Plak een aanvraag, een doorgestuurde mail of je aantekeningen na een klantbezoek. Claude vult het dossier in; jij
            controleert en slaat op.
          </div>
          <textarea
            ref={ref}
            className="input"
            rows={12}
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            placeholder={'Van: ...\nOnderwerp: aanvraag afzuiging lasafdeling...'}
          />
        </div>
        <div className="dr-f">
          <button className="btn ai" onClick={go} disabled={busy}>
            <Spark />
            Vul dossier in
          </button>
          <button className="btn ghost" onClick={sluitLade}>
            Annuleer
          </button>
          <span className="sub" style={{ margin: 0 }}>
            {busy ? (
              <>
                <Spin /> Claude leest mee…
              </>
            ) : (
              fout
            )}
          </span>
        </div>
      </div>
    </>
  );
}
```

## `web/src/components/Spark.tsx`

```tsx
export function Spark() {
  return (
    <svg className="spark" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3L8 1.5z" fill="#c9c2ff" />
      <circle cx="13" cy="13" r="1.5" fill="#9dc4f5" />
    </svg>
  );
}

export function Spin() {
  return <span className="spin" />;
}
```

## `web/src/components/Ticker.tsx`

```tsx
import { useData } from '../lib/dataStore';
import { somWaarde, type Kpi } from '../lib/kpi';
import { eurK } from '../lib/utils';

export function Ticker({ K }: { K: Kpi }) {
  const d = useData();
  const tk = [
    { k: '#3987e5', l: 'Open pipeline', v: eurK(K.waarde), d: K.open.length + ' dossiers' },
    { k: '#9085e9', l: 'Gewogen', v: eurK(K.gewogen), d: '' },
    { k: '#fab219', l: 'Offertes uit', v: String(K.off.length), d: eurK(somWaarde(K.off)) },
    {
      k: K.laat.length ? '#e05252' : '#5fd35f',
      l: 'Te laat opgevolgd',
      v: String(K.laat.length),
      d: K.laat.length ? 'actie nodig' : 'alles bij',
    },
    { k: '#5fd35f', l: 'Gewonnen ' + new Date().getFullYear(), v: eurK(K.wonW), d: K.hit != null ? K.hit + '% hitrate' : '' },
    {
      k: '#2bb6a3',
      l: 'Prospects',
      v: String(d.prospects.length),
      d: d.opdrachten.filter((o) => o.status !== 'klaar').length + ' zoekopdrachten open',
    },
  ];
  const items = [...tk, ...tk];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-in">
        {items.map((t, i) => (
          <div className="tk" key={i}>
            <i style={{ background: t.k }} />
            <span>{t.l}</span>
            <b>{t.v}</b>
            <em style={{ color: t.k, fontStyle: 'normal', fontWeight: 600 }}>{t.d}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## `web/src/components/ToastHost.tsx`

```tsx
import { useToast } from '../lib/toast';

export function ToastHost() {
  const msg = useToast();
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  );
}
```

## `web/src/components/TopBar.tsx`

```tsx
import { CONTROL_URL, VIEWS, VIEW_IDS } from '../lib/constants';
import { useData } from '../lib/dataStore';
import type { Kpi } from '../lib/kpi';
import { setMe, useMe } from '../lib/session';
import { gaNaar, useUi } from '../lib/ui';

export function TopBar({ K }: { K: Kpi }) {
  const d = useData();
  const me = useMe();
  const { view } = useUi();
  const counts: Record<string, number | ''> = {
    overzicht: K.laat.length + K.nu.length || '',
    pipeline: K.open.length || '',
    prospects: d.prospects.filter((p) => !['lead', 'afgevallen'].includes(p.status)).length || '',
    syntess: d.syntess.filter((c) => c.status === 'concept').length || '',
    klanten: d.klanten.length || '',
  };
  const live = d.conn === 'live';
  return (
    <header className="topbar">
      <div className="topbar-in">
        <div className="brand">
          <div className="logo">M</div>
          <div>
            <b>Miltech Sales</b>
            <small>Zuid Nederland B.V.</small>
          </div>
        </div>
        <nav className="nav" aria-label="Onderdelen">
          {VIEW_IDS.map((id) => {
            const v = VIEWS[id];
            return (
              <button key={id} onClick={() => gaNaar(id)} aria-current={view === id ? 'page' : undefined}>
                <span className="dot" style={{ background: v.dot, boxShadow: `0 0 10px ${v.dot}` }} />
                {v.n}
                <span className="cnt">{counts[id]}</span>
              </button>
            );
          })}
        </nav>
        <div className="tools">
          <label className="sr" htmlFor="me-sel">
            Ik ben
          </label>
          <select className="input" id="me-sel" aria-label="Ik ben" value={me} onChange={(e) => setMe(e.target.value)}>
            <option value="">Kies je naam</option>
            {d.team.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {CONTROL_URL && (
            <a href={CONTROL_URL} target="_blank" rel="noopener">
              Miltech Control ↗
            </a>
          )}
          <span className="side-foot" title="Verbindingsstatus">
            <span className={'live' + (live ? '' : ' off')} />
            <span id="live-txt">{live ? 'Live · gedeeld' : d.conn === 'offline' ? 'Geen verbinding' : 'Verbinden…'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
```

## `web/src/components/ZekerKnop.tsx`

```tsx
import { useEffect, useState } from 'react';

/** Knop die eerst om bevestiging vraagt (3 seconden geldig). */
export function ZekerKnop({ onBevestig, label }: { onBevestig: () => void; label: string }) {
  const [zeker, setZeker] = useState(false);
  useEffect(() => {
    if (!zeker) return;
    const t = setTimeout(() => setZeker(false), 3000);
    return () => clearTimeout(t);
  }, [zeker]);
  return (
    <button
      className={'btn sm ' + (zeker ? 'danger' : 'ghost')}
      aria-label={label}
      onClick={() => (zeker ? onBevestig() : setZeker(true))}
    >
      {zeker ? 'Zeker?' : '✕'}
    </button>
  );
}
```

## `web/src/views/Klanten.tsx`

```tsx
import { useEffect, useState } from 'react';
import { OPEN, SECTOREN } from '../lib/constants';
import { bewaar, bewaarConfig, useData, verwijder } from '../lib/dataStore';
import { toast } from '../lib/toast';
import { nid, norm, zonderId } from '../lib/utils';
import { ZekerKnop } from '../components/ZekerKnop';

export function Klanten() {
  const d = useData();
  const [imp, setImp] = useState('');
  const [kq, setKq] = useState('');
  const [team, setTeam] = useState(d.team.join(', '));

  useEffect(() => setTeam(d.team.join(', ')), [d.team]);

  const q = kq.toLowerCase();
  const K = d.klanten
    .filter((k) => !q || String(k.naam).toLowerCase().includes(q))
    .sort((a, b) => String(a.naam).localeCompare(String(b.naam)));

  async function importeer() {
    const lines = imp
      .split(/\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    const seen = new Set(d.klanten.map((k) => norm(k.naam)));
    const nieuw: { naam: string; plaats: string; sector: string }[] = [];
    for (const ln of lines) {
      const [naam, plaats] = ln.split(/[;\t]/).map((x) => (x || '').trim());
      if (!naam || seen.has(norm(naam))) continue;
      seen.add(norm(naam));
      nieuw.push({ naam, plaats: plaats || '', sector: '' });
    }
    let n = 0;
    for (const k of nieuw) if (await bewaar('klanten', nid('k'), k)) n++;
    setImp('');
    toast(n + ' klant' + (n === 1 ? '' : 'en') + ' toegevoegd');
  }

  async function bewaarTeam() {
    const t = team
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!t.length) return;
    if (await bewaarConfig('team', { namen: t })) toast('Team bewaard');
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid2">
        <section className="card stack">
          <div>
            <h2>Klanten importeren</h2>
            <div className="sub">
              Plak één klant per regel, <b className="soft">naam; plaats</b>. Het klantbestand wordt gebruikt om te zien of een prospect al
              klant is.
            </div>
          </div>
          <textarea
            className="input"
            rows={5}
            value={imp}
            onChange={(e) => setImp(e.target.value)}
            placeholder={'Bedrijfsnaam; Plaats\nBedrijfsnaam; Plaats'}
          />
          <div className="row">
            <button className="btn pri" onClick={importeer}>Voeg toe</button>
            <span className="sub" style={{ margin: 0 }}>Dubbele namen worden overgeslagen.</span>
          </div>
        </section>
        <section className="card stack">
          <div>
            <h2>Team</h2>
            <div className="sub">Namen die je kunt kiezen als eigenaar van een dossier. Gescheiden door komma's.</div>
          </div>
          <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team" />
          <div>
            <button className="btn" onClick={bewaarTeam}>Bewaar team</button>
          </div>
        </section>
      </div>
      <section className="card stack">
        <div className="row between">
          <div>
            <h2>{d.klanten.length} klanten</h2>
            <div className="sub">Geef ontbrekende sectoren op, dan telt de prospect-zoeker ze mee.</div>
          </div>
          <input
            className="input"
            type="search"
            style={{ width: 220 }}
            placeholder="Zoek klant"
            value={kq}
            onChange={(e) => setKq(e.target.value)}
            aria-label="Zoek klant"
          />
        </div>
        {K.length ? (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Klant</th>
                  <th>Sector</th>
                  <th>Pipeline</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {K.map((k) => {
                  const n = d.leads.filter((l) => norm(l.bedrijf) === norm(k.naam) && OPEN.includes(l.fase)).length;
                  return (
                    <tr key={k.id}>
                      <td>
                        <div className="b">{k.naam}</div>
                        <div className="x">{k.plaats || ''}</div>
                      </td>
                      <td>
                        <select
                          className="input"
                          aria-label="Sector"
                          style={{ minWidth: 160 }}
                          value={k.sector || ''}
                          onChange={(e) => bewaar('klanten', k.id, { ...zonderId(k), sector: e.target.value })}
                        >
                          <option value="">Onbekend</option>
                          {SECTOREN.map((s) => (
                            <option key={s.id} value={s.id}>{s.n}</option>
                          ))}
                        </select>
                      </td>
                      <td>{n ? <span className="chip ok">{n} open</span> : <span className="muted">—</span>}</td>
                      <td>
                        <ZekerKnop label="Verwijder" onBevestig={() => void verwijder('klanten', k.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Nog geen klanten. Plak hierboven je klantenlijst.</div>
        )}
      </section>
    </div>
  );
}
```

## `web/src/views/Overzicht.tsx`

```tsx
import { useState } from 'react';
import { Spark, Spin } from '../components/Spark';
import { CONTEXT, FASE, OPEN, SEC } from '../lib/constants';
import { aiFout, sample } from '../lib/claude';
import { bewaarConfig, useData } from '../lib/dataStore';
import { somWaarde, type Kpi } from '../lib/kpi';
import { getMe, useMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { Lead, Prospect } from '../lib/types';
import { gaNaar, openLade } from '../lib/ui';
import { dagenSinds, dagenTot, datumNL, eurK, laatsteContact, mdLite } from '../lib/utils';

export function pipelineVoorClaude(leads: Lead[]) {
  return leads
    .filter((l) => OPEN.includes(l.fase))
    .map((l) => ({
      bedrijf: l.bedrijf,
      fase: FASE[l.fase].n,
      waarde: l.waarde || 0,
      kans: l.kans,
      eigenaar: l.eigenaar || '',
      wat: l.omschrijving || '',
      volgendeActie: l.volgendeActie || '',
      volgendeDatum: l.volgendeDatum || '',
      dagenSindsContact: dagenSinds(laatsteContact(l)),
      laatsteNotitie: (l.log || []).slice(-1)[0]?.t || '',
    }));
}

function dagstartPrompt(leads: Lead[], prospects: Prospect[]): string {
  const me = getMe();
  const pl = pipelineVoorClaude(leads);
  const n = (s: string) => prospects.filter((p) => p.status === s).length;
  return `${CONTEXT}\n\nVandaag is het ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. ${me ? 'Je praat met ' + me + '.' : ''}\n\nOpen dossiers (JSON):\n${JSON.stringify(pl)}\n\nProspects: ${n('nieuw')} nieuw, ${n('te verifiëren')} te verifiëren, ${n('benaderd')} benaderd.${pl.length ? '' : '\nEr zijn nog geen open dossiers; zeg dat eerlijk en verzin er geen.'}\n\nMaak een dagstart:\n1. De 3 tot 5 belangrijkste acties voor vandaag, elk met bedrijfsnaam en waarom (te laat, veel waarde, lang stil).\n2. Welke offertes stil liggen en wat de beste opvolging is.\n3. Eén concrete tip om de pipeline te vullen.\nMaximaal 170 woorden. Gebruik korte bullets die beginnen met "- " en zet bedrijfsnamen in **vet**. Geen inleiding.`;
}

interface TodoItem {
  l: Lead;
  k: string;
  t: string;
  x: string;
}

export function Overzicht({ K }: { K: Kpi }) {
  const d = useData();
  useMe();
  const [ai, setAi] = useState<{ busy: boolean; text: string } | null>(null);

  async function maakDagstart() {
    if (!d.claude) return;
    setAi({ busy: true, text: '' });
    try {
      const r = await sample(dagstartPrompt(d.leads, d.prospects), {
        onText: (u) => setAi({ busy: true, text: u.text }),
      });
      const me = getMe();
      await bewaarConfig('dagstart', { text: r.text, at: new Date().toISOString(), door: me ? 'voor ' + me : '' });
    } catch (e) {
      toast(aiFout(e));
    }
    setAi(null);
  }

  const tiles = [
    { l: 'Open pipeline', v: eurK(K.waarde), s: K.open.length + ' lopende dossiers', k: '#3987e5', sk: '' },
    { l: 'Gewogen verwachting', v: eurK(K.gewogen), s: 'waarde × kans per dossier', k: '#9085e9', sk: '' },
    {
      l: 'Offertes uit',
      v: String(K.off.length),
      s: K.stil.length ? K.stil.length + ' al 10+ dagen stil' : 'geen stille offertes',
      k: '#fab219',
      sk: K.stil.length ? '#ffd27a' : '',
    },
    {
      l: 'Opvolgen',
      v: String(K.laat.length + K.nu.length),
      s: K.laat.length + ' te laat · ' + K.nu.length + ' vandaag',
      k: K.laat.length ? '#e05252' : '#5fd35f',
      sk: K.laat.length ? '#ff9c9c' : '#9be59b',
    },
  ];

  const perFase = OPEN.map((f) => {
    const ls = K.open.filter((l) => l.fase === f);
    return { f, n: ls.length, w: somWaarde(ls) };
  });
  const maxW = Math.max(1, ...perFase.map((x) => x.w));

  const items: TodoItem[] = [];
  K.laat.forEach((l) =>
    items.push({
      l,
      k: '#e05252',
      t: `${l.volgendeActie || 'Opvolgen'} · ${l.bedrijf}`,
      x: `${-(dagenTot(l.volgendeDatum) ?? 0)} dag(en) te laat · ${FASE[l.fase].n} · ${eurK(l.waarde)}`,
    }),
  );
  K.nu.forEach((l) =>
    items.push({ l, k: '#fab219', t: `${l.volgendeActie || 'Opvolgen'} · ${l.bedrijf}`, x: `Vandaag · ${FASE[l.fase].n} · ${eurK(l.waarde)}` }),
  );
  K.stil
    .filter((l) => !K.laat.includes(l) && !K.nu.includes(l))
    .forEach((l) =>
      items.push({
        l,
        k: '#e0773a',
        t: `Offerte ligt stil · ${l.bedrijf}`,
        x: `${dagenSinds(laatsteContact(l))} dagen geen contact · ${eurK(l.waarde)}`,
      }),
    );
  K.open
    .filter((l) => {
      const n = dagenTot(l.volgendeDatum);
      return n != null && n > 0 && n <= 7;
    })
    .sort((a, b) => String(a.volgendeDatum).localeCompare(String(b.volgendeDatum)))
    .forEach((l) =>
      items.push({ l, k: '#5aa0f0', t: `${l.volgendeActie || 'Opvolgen'} · ${l.bedrijf}`, x: `${datumNL(l.volgendeDatum)} · ${FASE[l.fase].n}` }),
    );
  K.zonder.forEach((l) =>
    items.push({ l, k: '#898781', t: `Geen volgende stap · ${l.bedrijf}`, x: `${FASE[l.fase].n} · plan een actie zodat dit dossier niet wegzakt` }),
  );

  const ds = d.dagstart;
  const nieuwePros = d.prospects.filter((p) => p.status === 'nieuw' || p.status === 'te verifiëren').slice(0, 4);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.l} className="tile" onClick={() => gaNaar('pipeline')}>
            <div className="l">{t.l}</div>
            <div className="v">{t.v}</div>
            <div className="s" style={t.sk ? { color: t.sk } : undefined}>
              {t.s}
            </div>
            <div className="orb" style={{ background: `radial-gradient(circle,${t.k}55,transparent 70%)` }} />
          </button>
        ))}
      </div>

      <div className="grid2">
        <section className="card">
          <div className="row between">
            <div>
              <h2>Dagstart met Claude</h2>
              <div className="sub">Wat moet er vandaag gebeuren</div>
            </div>
            {d.claude && (
              <button className="btn ai" onClick={maakDagstart} disabled={!!ai?.busy}>
                <Spark />
                {ds?.text ? 'Vernieuw' : 'Maak dagstart'}
              </button>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            {ai?.busy ? (
              ai.text ? (
                <div className="ai-out" dangerouslySetInnerHTML={{ __html: mdLite(ai.text) }} />
              ) : (
                <div className="ai-out">
                  <Spin /> Claude leest je pipeline…
                </div>
              )
            ) : ds?.text ? (
              <>
                <div className="ai-out" dangerouslySetInnerHTML={{ __html: mdLite(ds.text) }} />
                <div className="sub">
                  Gemaakt {ds.door || ''}{' '}
                  {ds.at
                    ? 'op ' +
                      new Date(ds.at).toLocaleString('nl-NL', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </div>
              </>
            ) : (
              <div className="sub">
                Claude leest alle open dossiers en zet de belangrijkste acties voor vandaag op een rij, inclusief offertes die stil liggen.
              </div>
            )}
          </div>
          {!d.claude && (
            <div className="sub" style={{ marginTop: 8 }}>
              Claude is niet ingesteld op de server. Zet ANTHROPIC_API_KEY in de .env om de dagstart te gebruiken.
            </div>
          )}
        </section>

        <section className="card stack">
          <div>
            <h2>Opvolgen</h2>
            <div className="sub">Te laat, vandaag, stille offertes en deze week</div>
          </div>
          {items.length ? (
            items.slice(0, 9).map((i, n) => (
              <button key={i.l.id + '-' + n} className="todo" onClick={() => openLade(i.l)}>
                <span className="d" style={{ background: i.k, boxShadow: `0 0 12px ${i.k}` }} />
                <span>
                  <span className="t">{i.t}</span>
                  <span className="x" style={{ display: 'block' }}>
                    {i.x}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">Niets op te volgen. Tijd om prospects te benaderen.</div>
          )}
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Pipeline per fase</h2>
          <div className="sub">Aantal dossiers en totale waarde van wat open staat</div>
          <div className="funnel">
            {perFase.map(({ f, n, w }) => (
              <div className="fn" key={f}>
                <div className="n">{FASE[f].n}</div>
                <div className="bar">
                  <div
                    style={{
                      width: `${Math.max(w ? 4 : 0, (w / maxW) * 100)}%`,
                      background: `linear-gradient(90deg,${FASE[f].k}cc,${FASE[f].k}55)`,
                    }}
                  />
                  <span>{n}</span>
                </div>
                <div className="e">{eurK(w)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <div className="row between">
            <div>
              <h2>Nieuwe klanten zoeken</h2>
              <div className="sub">Prospects die nog niet in het klantbestand zitten</div>
            </div>
            <button className="btn sm" onClick={() => gaNaar('prospects')}>
              Open →
            </button>
          </div>
          {nieuwePros.length ? (
            nieuwePros.map((p) => (
              <button key={p.id} className="todo" onClick={() => gaNaar('prospects', p.sector || undefined)}>
                <span className="d" style={{ background: SEC[p.sector || '']?.k || '#898781' }} />
                <span>
                  <span className="t">{p.bedrijf}</span>
                  <span className="x" style={{ display: 'block' }}>
                    {p.signaal || ''}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">Nog geen prospects. Voeg ze toe of zet een onderzoeksopdracht klaar.</div>
          )}
        </section>
      </div>
    </div>
  );
}
```

## `web/src/views/Pipeline.tsx`

```tsx
import { useState } from 'react';
import { Spark } from '../components/Spark';
import { FASE, FASEN, OPEN, SEC, SECTOREN } from '../lib/constants';
import { useData } from '../lib/dataStore';
import { somWaarde } from '../lib/kpi';
import { getMe } from '../lib/session';
import type { Lead } from '../lib/types';
import { openLade, openPlak } from '../lib/ui';
import { dagenTot, datumNL, eurK, initialen } from '../lib/utils';

function LeadKaart({ l }: { l: Lead }) {
  const d = l.volgendeDatum ? dagenTot(l.volgendeDatum) : null;
  const cls = d == null ? '' : d < 0 ? 'late' : d === 0 ? 'today' : 'ok';
  const dl = d == null ? 'geen actie' : d < 0 ? `${-d}d te laat` : d === 0 ? 'vandaag' : datumNL(l.volgendeDatum);
  const sec = SEC[l.sector || ''];
  return (
    <button className="lc" onClick={() => openLade(l)}>
      <div className="row" style={{ gap: 8 }}>
        <span className="b">{l.bedrijf}</span>
      </div>
      {l.omschrijving && <div className="o">{l.omschrijving}</div>}
      <div className="f">
        <span className={'chip ' + cls}>{dl}</span>
        {sec && (
          <span className="chip">
            <i style={{ background: sec.k }} />
            {sec.n.split(' ')[0]}
          </span>
        )}
        {l.syntessId && (
          <span className="chip" title="Offerte in de offerte-tool">
            Offerte
          </span>
        )}
        <span className="w">{l.waarde ? eurK(l.waarde) : ''}</span>
        {l.eigenaar && (
          <span className="av" title={l.eigenaar}>
            {initialen(l.eigenaar)}
          </span>
        )}
      </div>
    </button>
  );
}

export function Pipeline() {
  const d = useData();
  const [q, setQ] = useState('');
  const [eig, setEig] = useState('');
  const [sec, setSec] = useState('');
  const [closed, setClosed] = useState(false);

  const qq = q.trim().toLowerCase();
  const L = d.leads.filter(
    (l) =>
      (!qq || [l.bedrijf, l.contact, l.omschrijving, l.plaats].join(' ').toLowerCase().includes(qq)) &&
      (!eig || l.eigenaar === eig) &&
      (!sec || l.sector === sec),
  );
  const cols = closed ? FASEN : FASEN.filter((f) => OPEN.includes(f.id));
  const nClosed = d.leads.filter((l) => !OPEN.includes(l.fase)).length;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="toolbar">
        <button className="btn pri" onClick={() => openLade({ fase: 'lead', eigenaar: getMe(), kans: FASE.lead.p, log: [] })}>
          + Nieuwe lead
        </button>
        {d.claude && (
          <button className="btn ai" onClick={openPlak}>
            <Spark />
            Plak mail of notitie
          </button>
        )}
        <input
          className="input grow"
          type="search"
          placeholder="Zoek bedrijf, contact, plaats…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Zoeken"
        />
        <select className="input" value={eig} onChange={(e) => setEig(e.target.value)} aria-label="Eigenaar">
          <option value="">Iedereen</option>
          {d.team.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="input" value={sec} onChange={(e) => setSec(e.target.value)} aria-label="Sector">
          <option value="">Alle sectoren</option>
          {SECTOREN.map((s) => (
            <option key={s.id} value={s.id}>
              {s.n}
            </option>
          ))}
        </select>
        <button className="btn ghost sm" onClick={() => setClosed(!closed)}>
          {closed ? 'Verberg afgesloten' : `Toon afgesloten (${nClosed})`}
        </button>
      </div>
      <div className="board-wrap">
        <div className="board">
          {cols.map((f) => {
            const ls = L.filter((l) => l.fase === f.id).sort((a, b) =>
              (a.volgendeDatum || '9').localeCompare(b.volgendeDatum || '9'),
            );
            return (
              <div className="col" key={f.id}>
                <div className="col-h">
                  <i style={{ background: f.k, boxShadow: `0 0 10px ${f.k}` }} />
                  {f.n}
                  <small>
                    {ls.length} · {eurK(somWaarde(ls))}
                  </small>
                </div>
                {ls.length ? (
                  ls.map((l) => <LeadKaart key={l.id} l={l} />)
                ) : (
                  <div className="muted" style={{ fontSize: 12, padding: '6px 4px' }}>
                    Leeg
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

## `web/src/views/Prospects.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { PROSPECT_STATUS, SEC, SECTOREN } from '../lib/constants';
import { bewaar, useData, verwijder } from '../lib/dataStore';
import { isKlant } from '../lib/kpi';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { Prospect, ProspectStatus } from '../lib/types';
import { kiesSector, openLade, useUi } from '../lib/ui';
import { nid, vandaag, zonderId } from '../lib/utils';
import { ZekerKnop } from '../components/ZekerKnop';


function NieuweProspect({ sector, klaar }: { sector: string | null; klaar: () => void }) {
  const d = useData();
  const [v, setV] = useState({ b: '', p: '', s: sector || '', u: '', g: '' });
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  async function opslaan() {
    const n = v.b.trim();
    if (!n) {
      toast('Vul een bedrijfsnaam in');
      return;
    }
    const kl = isKlant(n, d.klanten);
    const ok = await bewaar('prospects', nid('p'), {
      bedrijf: n,
      plaats: v.p.trim(),
      sector: v.s,
      bron: v.u.trim(),
      signaal: v.g.trim(),
      status: 'nieuw',
      geverifieerd: !!v.u.trim(),
      toegevoegd: vandaag(),
      signaalDatum: vandaag(),
      door: getMe(),
    });
    if (ok) {
      toast(kl ? 'Bewaard. Let op: ' + kl.naam + ' is al klant' : 'Prospect bewaard');
      klaar();
    }
  }
  return (
    <div className="fields" style={{ padding: 12, borderRadius: 12, background: 'var(--raise)' }}>
      <div>
        <label className="lbl" htmlFor="pa-b">Bedrijf</label>
        <input ref={ref} className="input" id="pa-b" value={v.b} onChange={(e) => setV({ ...v, b: e.target.value })} />
      </div>
      <div>
        <label className="lbl" htmlFor="pa-p">Plaats</label>
        <input className="input" id="pa-p" value={v.p} onChange={(e) => setV({ ...v, p: e.target.value })} />
      </div>
      <div>
        <label className="lbl" htmlFor="pa-s">Sector</label>
        <select className="input" id="pa-s" value={v.s} onChange={(e) => setV({ ...v, s: e.target.value })}>
          <option value="">Nog onbekend</option>
          {SECTOREN.map((s) => (
            <option key={s.id} value={s.id}>{s.n}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl" htmlFor="pa-u">Bron (link)</label>
        <input className="input" id="pa-u" type="url" placeholder="https://" value={v.u} onChange={(e) => setV({ ...v, u: e.target.value })} />
      </div>
      <div className="full">
        <label className="lbl" htmlFor="pa-g">Signaal</label>
        <input
          className="input"
          id="pa-g"
          placeholder="Bijv. nieuwe hal in aanbouw, vacature KAM-coördinator"
          value={v.g}
          onChange={(e) => setV({ ...v, g: e.target.value })}
        />
      </div>
      <div className="full">
        <button className="btn pri" onClick={opslaan}>Bewaar prospect</button>
      </div>
    </div>
  );
}

export function Prospects() {
  const d = useData();
  const { sector } = useUi();
  const [regio, setRegio] = useState('Noord-Brabant');
  const [opdTxt, setOpdTxt] = useState('');
  const [toonForm, setToonForm] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const s = sector ? SEC[sector] : null;

  useEffect(() => {
    if (sector) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sector]);

  const onbekend = d.prospects.filter((p) => !p.sector || !SEC[p.sector]);
  const lijst = d.prospects
    .filter((p) => (s ? p.sector === s.id : true))
    .sort((a, b) => String(b.signaalDatum || '').localeCompare(String(a.signaalDatum || '')));
  const opd = d.opdrachten
    .filter((o) => !s || o.sector === s.id)
    .sort((a, b) => String(b.aangemaakt).localeCompare(String(a.aangemaakt)));

  async function zetOpdracht() {
    const ok = await bewaar('opdrachten', nid('o'), {
      sector: sector,
      regio,
      vraag: opdTxt.trim(),
      status: 'open',
      aangemaakt: new Date().toISOString(),
      door: getMe(),
    });
    if (ok) {
      setOpdTxt('');
      toast('Opdracht klaargezet');
    }
  }

  async function zetStatus(p: Prospect, status: ProspectStatus) {
    await bewaar('prospects', p.id, { ...zonderId(p), status });
  }

  function naarLead(p: Prospect) {
    const me = getMe();
    openLade({
      fase: 'lead',
      bedrijf: p.bedrijf,
      plaats: p.plaats || '',
      sector: p.sector || '',
      bron: 'Prospectie',
      eigenaar: me,
      kans: 10,
      omschrijving: '',
      log: [{ d: vandaag(), t: 'Uit prospectlijst: ' + (p.signaal || ''), w: me }],
      _pid: p.id,
    });
  }

  const q = encodeURIComponent;
  const t0 = s ? s.n.split(' ')[0].toLowerCase() : '';

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="sectors">
        {SECTOREN.map((x) => {
          const np = d.prospects.filter((p) => p.sector === x.id && p.status !== 'afgevallen').length;
          const nk = d.klanten.filter((k) => k.sector === x.id).length;
          return (
            <button key={x.id} className="sec" aria-pressed={sector === x.id} onClick={() => kiesSector(sector === x.id ? null : x.id)}>
              <div className="h">
                <i style={{ background: x.k }} />
                {x.n}
              </div>
              <div className="n">
                <span className="chip">{np} prospect{np === 1 ? '' : 's'}</span>
                <span className="chip">{nk} klant{nk === 1 ? '' : 'en'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {onbekend.length > 0 && !s && (
        <div className="banner" style={{ borderColor: 'rgba(90,160,240,.35)', background: 'rgba(90,160,240,.07)' }}>
          <div>
            <b>
              {onbekend.length} prospect{onbekend.length === 1 ? '' : 's'} zonder sector.
            </b>{' '}
            Ze staan hieronder in de lijst.
          </div>
        </div>
      )}

      {s && (
        <section ref={detailRef} className="card stack" style={{ gap: 16 }}>
          <div className="row between">
            <div>
              <div className="kicker" style={{ color: s.k }}>Sector</div>
              <h2 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 600, fontSize: 28 }}>{s.n}</h2>
            </div>
            <div className="row">
              <label className="lbl" htmlFor="regio" style={{ margin: 0 }}>Regio</label>
              <input
                className="input"
                id="regio"
                style={{ width: 170 }}
                value={regio}
                onChange={(e) => setRegio(e.target.value)}
                onBlur={() => setRegio((r) => r.trim() || 'Noord-Brabant')}
              />
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="lbl">Zelf zoeken</div>
            <div className="links">
              <a target="_blank" rel="noopener" href={`https://www.google.com/search?q=${q(t0 + ' ' + regio + ' (uitbreiding OR nieuwbouw OR investeert)')}`}>
                {s.n} + investering ↗
              </a>
              <a target="_blank" rel="noopener" href={`https://www.google.com/search?q=${q('vergunning bedrijfshal ' + t0 + ' ' + regio)}`}>
                Vergunningen bedrijfshallen ↗
              </a>
              <a target="_blank" rel="noopener" href={`https://www.google.com/search?q=${q('vacature KAM ' + t0 + ' ' + regio)}`}>
                Vacatures KAM/HSE ↗
              </a>
              <a target="_blank" rel="noopener" href={`https://www.linkedin.com/search/results/people/?keywords=${q(t0 + ' ' + regio)}`}>
                LinkedIn ↗
              </a>
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="lbl" style={{ margin: 0 }}>Onderzoeksopdracht</div>
            <div className="sub">
              Voor echte, gecontroleerde namen. Zet een opdracht klaar: zoek bedrijven in deze sector en regio met een koopsignaal
              (nieuwbouw, uitbreiding, vergunning, vacature). Resultaten worden als prospect met bron toegevoegd, handmatig of via de API
              (<code>PUT /api/db/prospects/&lt;id&gt;</code>).
            </div>
            <textarea
              className="input"
              rows={2}
              value={opdTxt}
              onChange={(e) => setOpdTxt(e.target.value)}
              placeholder="Bijv. alleen bedrijven met eigen productie, 20+ medewerkers"
            />
            <div>
              <button className="btn" onClick={zetOpdracht}>Zet opdracht klaar</button>
            </div>
            {opd.map((o) => (
              <div key={o.id} className="row" style={{ gap: 8, fontSize: 12.5 }}>
                <span className={'chip ' + (o.status === 'klaar' ? 'ok' : 'today')}>{o.status === 'klaar' ? 'klaar' : 'open'}</span>
                <span className="soft">
                  {o.regio}
                  {o.vraag ? ' · ' + o.vraag : ''}
                </span>
                {o.resultaat && <span className="muted">· {o.resultaat}</span>}
                {o.status !== 'klaar' && (
                  <button className="btn ghost sm" onClick={() => bewaar('opdrachten', o.id, { ...zonderId(o), status: 'klaar' })}>
                    Markeer klaar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card stack">
        <div className="row between">
          <div>
            <h2>{s ? 'Prospects in ' + s.n : 'Alle prospects en signalen'}</h2>
            <div className="sub">
              {s ? (
                <button className="btn ghost sm" style={{ padding: 0 }} onClick={() => kiesSector(null)}>
                  Toon alle sectoren
                </button>
              ) : (
                'Nieuwste signalen eerst'
              )}
            </div>
          </div>
          <button className="btn" onClick={() => setToonForm(!toonForm)}>+ Prospect</button>
        </div>
        {toonForm && <NieuweProspect sector={sector} klaar={() => setToonForm(false)} />}
        {lijst.length ? (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bedrijf</th>
                  <th>Signaal</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lijst.map((p) => {
                  const kl = isKlant(p.bedrijf, d.klanten);
                  const sec = SEC[p.sector || ''];
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="b">{p.bedrijf}</div>
                        <div className="x">
                          {p.plaats || ''}
                          {sec && !s ? ' · ' + sec.n : ''}
                        </div>
                        <div className="row" style={{ gap: 6, marginTop: 6 }}>
                          {p.geverifieerd ? <span className="chip ok">bron gecontroleerd</span> : <span className="chip ai">te verifiëren</span>}
                          {kl && <span className="chip late">al klant</span>}
                        </div>
                      </td>
                      <td>
                        <div className="x" style={{ margin: 0 }}>{p.signaal || ''}</div>
                        {p.bron && (
                          <a className="x" style={{ display: 'inline-block', marginTop: 4, color: '#9dc4f5' }} href={p.bron} target="_blank" rel="noopener">
                            Bron{p.signaalDatum ? ' · ' + p.signaalDatum : ''} ↗
                          </a>
                        )}
                        {p.notitie && <div className="x muted">{p.notitie}</div>}
                      </td>
                      <td>
                        <select
                          className="input"
                          aria-label="Status"
                          style={{ minWidth: 130 }}
                          value={p.status}
                          onChange={(e) => zetStatus(p, e.target.value as ProspectStatus)}
                        >
                          {PROSPECT_STATUS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <button className="btn sm" onClick={() => naarLead(p)}>→ Lead</button>
                          <ZekerKnop
                            label="Verwijder"
                            onBevestig={async () => {
                              if (await verwijder('prospects', p.id)) toast('Prospect verwijderd');
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Nog geen prospects in deze sector.</div>
        )}
      </section>
    </div>
  );
}
```

## `web/src/syntess/types.ts`

```typescript
import type { Artikel } from './analyse';
import type { RelPart } from './library';
import type { Stijlen } from './ooxml';

export interface Rel {
  target: string;
  type: string;
  ext: boolean;
}

export type Rels = Record<string, Rel>;

export interface Deel {
  xml: string;
  rels: Rels;
}

/** Ingelezen Syntess-export. */
export interface Basis {
  naam: string;
  xml: string;
  st: Stijlen;
  rels: Rels;
  media: Record<string, string>;
  hdr: Record<string, Deel>;
  ftr: Record<string, Deel>;
}

export interface NieuweRel extends RelPart {
  pad: string;
}

export interface Rapport {
  ingevoegd: string[];
  overgeslagen: string[];
  inleiding: string;
}

/** Resultaat van de opbouw: nieuw document + rapport + nieuwe relaties (afbeeldingen). */
export interface Opbouw {
  doc: Document;
  arts: Artikel[];
  rap: Rapport;
  nieuweRels: Record<string, NieuweRel>;
}
```

## `web/src/syntess/ooxml.ts`

```typescript
/* Hulpfuncties voor WordprocessingML (document.xml uit een .docx). */

export const NW = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const NR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const NWP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
export const NA = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const NPR = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const NV = 'urn:schemas-microsoft-com:vml';
export const NO = 'urn:schemas-microsoft-com:office:office';
export const NMC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
export const NSY = 'urn:miltech:offertetool';
export const NCT = 'http://schemas.openxmlformats.org/package/2006/content-types';

/** "2 x Afzuigarm XYZ" / "1 st. Ventilator" */
export const ART_RE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:x|×|st\.?|stk\.?|stuks?)\s+(.+?)\s*$/i;
export const SECTIE_RE =
  /^(totaalprijs|niet tot onze levering|onze installatiekosten|condities|leveringsomvang|systeemomschrijving|optie|opties|meerprijs)/;

export const ORDER_PPR = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
export const ORDER_RPR = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];

/** Huisstijl-instellingen, gelijk aan offerte_tool.py v2.1. */
export const SYH = {
  LEGE_VOOR_TEKST: true,
  LEGE_VOOR_AFB: true,
  LEGE_NA_BLOK: true,
  BIJ_ELKAAR: true,
  LIJST: '- ',
};

export const nrm = (s: unknown) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const codeTok = (s: unknown) =>
  new Set(
    nrm(s)
      .split(' ')
      .filter((t) => t.length >= 4 && /\d/.test(t) && /[a-z]/.test(t)),
  );

export function kids(e: Node | null | undefined, ns: string, l?: string | null): Element[] {
  if (!e) return [];
  return [...e.childNodes].filter(
    (n): n is Element => n.nodeType === 1 && (n as Element).namespaceURI === ns && (l == null || (n as Element).localName === l),
  );
}

export function kid(e: Node | null | undefined, ns: string, l: string): Element | null {
  return kids(e, ns, l)[0] || null;
}

export function alle(e: Document | Element | null | undefined, ns: string, l: string): Element[] {
  return e ? [...e.getElementsByTagNameNS(ns, l)] : [];
}

/** Waarde van een w:-attribuut. */
export function wv(e: Element | null | undefined, a: string): string | null {
  return e ? e.getAttributeNS(NW, a) || e.getAttribute('w:' + a) : null;
}

export const wn = (e: Element | null | undefined, a: string): number => +(wv(e, a) || 0);

export function ptekst(e: Element | Document): string {
  return alle(e, NW, 't')
    .map((t) => t.textContent)
    .join('');
}

export function hasMedia(e: Element): boolean {
  return alle(e, NA, 'blip').length > 0 || alle(e, NW, 'object').length > 0 || alle(e, NV, 'imagedata').length > 0;
}

export function bms(e: Element): string[] {
  return alle(e, NW, 'bookmarkStart').map((b) => wv(b, 'name') || '');
}

export function b64ToBytes(b: string): Uint8Array {
  const s = atob(b);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export function bytesToB64(u: Uint8Array): string {
  let s = '';
  const c = 0x8000;
  for (let i = 0; i < u.length; i += c) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + c)));
  return btoa(s);
}

export function hashStr(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < s.length; i += Math.max(1, (s.length / 4096) | 0)) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 = (h2 + s.charCodeAt(i) * (i + 1)) | 0;
  }
  return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + s.length.toString(16)).slice(0, 14);
}

/** Voegt een kind in op de plek die het OOXML-schema voorschrijft. */
export function insOrder(parent: Element, node: Element, order: string[]): Element {
  const idx = order.indexOf(node.localName);
  for (const c of [...parent.childNodes]) {
    if (c.nodeType !== 1) continue;
    const j = order.indexOf((c as Element).localName);
    if (j > idx) {
      parent.insertBefore(node, c);
      return node;
    }
  }
  parent.appendChild(node);
  return node;
}

export function wEl(doc: Document, tag: string, attrs?: Record<string, string | number>): Element {
  const e = doc.createElementNS(NW, 'w:' + tag);
  for (const k in attrs || {}) e.setAttributeNS(NW, 'w:' + k, String(attrs![k]));
  return e;
}

export function bodyVan(doc: Document): Element {
  return alle(doc, NW, 'body')[0];
}

export function parseXml(s: string): Document {
  return new DOMParser().parseFromString(s, 'application/xml');
}

export const isAan = (e: Element | null) => !!e && !['0', 'false'].includes(wv(e, 'val') || '');

/* ---------- stijlen (vet via stijl) ---------- */

export interface Stijl {
  bold: boolean | null;
  basedOn: string | null;
  name: string;
  sz: number | null;
  font: string | null;
  isDefault: boolean;
  type: string | null;
}

export interface Stijlen {
  s: Record<string, Stijl>;
  def: { font: string | null; sz: number | null };
}

export function leesStijlen(xml: string): Stijlen {
  const out: Stijlen = { s: {}, def: { font: null, sz: null } };
  if (!xml) return out;
  const d = parseXml(xml);
  for (const s of alle(d, NW, 'style')) {
    const id = wv(s, 'styleId') || '';
    const rp = kid(s, NW, 'rPr');
    const b = rp && kid(rp, NW, 'b');
    const bo = kid(s, NW, 'basedOn');
    const nm = kid(s, NW, 'name');
    const sz = rp && kid(rp, NW, 'sz');
    const rf = rp && kid(rp, NW, 'rFonts');
    out.s[id] = {
      bold: b ? isAan(b) : null,
      basedOn: bo ? wv(bo, 'val') : null,
      name: nm ? wv(nm, 'val') || id : id,
      sz: sz ? wn(sz, 'val') : null,
      font: rf ? wv(rf, 'ascii') : null,
      isDefault: s.getAttributeNS(NW, 'default') === '1' || s.getAttribute('w:default') === '1',
      type: wv(s, 'type'),
    };
  }
  const dd = alle(d, NW, 'rPrDefault')[0];
  if (dd) {
    const f = alle(dd, NW, 'rFonts')[0];
    const z = alle(dd, NW, 'sz')[0];
    out.def = { font: f ? wv(f, 'ascii') : null, sz: z ? wn(z, 'val') : null };
  }
  return out;
}

export function standaardStijl(st: Stijlen): string | undefined {
  return Object.keys(st.s).find((k) => st.s[k].isDefault && st.s[k].type === 'paragraph');
}

function stijlBold(st: Stijlen, id: string | null | undefined): boolean {
  let n = 0;
  while (id && st.s[id] && n++ < 10) {
    if (st.s[id].bold != null) return !!st.s[id].bold;
    id = st.s[id].basedOn;
  }
  return false;
}

function runBold(r: Element, p: Element, st: Stijlen): boolean {
  const rp = kid(r, NW, 'rPr');
  const b = rp && kid(rp, NW, 'b');
  if (b) return isAan(b);
  const rs = rp && kid(rp, NW, 'rStyle');
  if (rs && stijlBold(st, wv(rs, 'val'))) return true;
  const pp = kid(p, NW, 'pPr');
  const ps = pp && kid(pp, NW, 'pStyle');
  return stijlBold(st, ps ? wv(ps, 'val') : standaardStijl(st));
}

/** Runs van een alinea, zonder tekstvakken en fallback-inhoud. */
export function runsVan(p: Element): Element[] {
  return alle(p, NW, 'r').filter((r) => {
    let x = r.parentNode as Element | null;
    while (x && x !== p) {
      if (x.localName === 'txbxContent' || x.localName === 'Fallback') return false;
      x = x.parentNode as Element | null;
    }
    return true;
  });
}

export function vetteRegel(p: Element, st: Stijlen): boolean {
  const rs = runsVan(p).filter((r) => ptekst(r).trim());
  return rs.length > 0 && rs.every((r) => runBold(r, p, st));
}

export function isKop(p: Element, st: Stijlen): boolean {
  const pp = kid(p, NW, 'pPr');
  const ps = pp && kid(pp, NW, 'pStyle');
  if (!ps) return false;
  const id = wv(ps, 'val') || '';
  const nm = st.s[id]?.name || id;
  return /^(heading|kop)\s*\d/i.test(nm) || /^(kop|heading)\d/i.test(id);
}

export function isArtikel(p: Element, st: Stijlen): boolean {
  return p.localName === 'p' && ART_RE.test(ptekst(p).trim()) && vetteRegel(p, st);
}

/** Alinea's/tabellen die bij een artikelregel horen (tot de volgende artikelregel of sectiekop). */
export function blokNa(p: Element, st: Stijlen): Element[] {
  const out: Element[] = [];
  let n = p.nextSibling;
  while (n) {
    if (n.nodeType !== 1) {
      n = n.nextSibling;
      continue;
    }
    const e = n as Element;
    if (e.localName !== 'p' && e.localName !== 'tbl') break;
    if (e.localName === 'p') {
      const t = ptekst(e).trim();
      if (isArtikel(e, st) || isKop(e, st) || (vetteRegel(e, st) && SECTIE_RE.test(nrm(t)))) break;
    }
    out.push(e);
    n = e.nextSibling;
  }
  return out;
}
```

## `web/src/syntess/library.ts`

```typescript
/* Artikelbibliotheek: standaardteksten en afbeeldingen uit het project "Offerte Tool". */
import type { Kennis } from '../lib/types';
import { codeTok, nrm } from './ooxml';

/** [tekst, vet, cursief] */
export type Run = [string, boolean, boolean];

export interface RelPart {
  reltype: string;
  ctype: string;
  ext: string;
  b64: string;
}

export interface BlockP {
  type: 'p';
  runs: Run[];
  list?: boolean;
  tabs?: [string, string][];
  ind?: number;
}
export interface BlockImg {
  type: 'img';
  ext: string;
  b64: string;
  cx?: number;
  cy?: number;
}
export interface BlockMedia {
  type: 'media';
  runs_xml: string[];
  parts: Record<string, RelPart>;
}
export interface BlockElement {
  type: 'element';
  xml: string;
  parts: Record<string, RelPart>;
  tekst?: string;
}
export type Block = BlockP | BlockImg | BlockMedia | BlockElement;

export interface LibEntry {
  name: string;
  aliases: string[];
  kind: string;
  exact?: boolean;
  bron?: string;
  omschrijving?: string;
  blocks: Block[];
}

export interface TabelSjabloon {
  tblPr: string;
  tblGrid: string;
  hdr_shd?: string;
  hdr_color?: string;
}

export interface Bibliotheek {
  entries: LibEntry[];
  tabel_sjabloon?: TabelSjabloon;
  __id?: string;
}

/** Standaardteksten.md: "## Artikelnaam", "Zoekwoorden: a, b", daarna de tekst. */
export function mdEntries(md: string | undefined): LibEntry[] {
  const out: LibEntry[] = [];
  let cur: LibEntry | null = null;
  for (const raw of String(md || '').split(/\r?\n/)) {
    const l = raw.replace(/\s+$/, '');
    const h = l.match(/^##\s+(.+)/);
    if (h) {
      cur = { name: h[1].trim(), aliases: [], kind: 'artikel', exact: false, bron: 'Standaardteksten (project)', blocks: [] };
      out.push(cur);
      continue;
    }
    if (!cur || /^#\s/.test(l)) continue;
    const z = l.match(/^\s*zoekwoorden\s*:\s*(.*)$/i);
    if (z) {
      cur.aliases.push(
        ...z[1]
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      );
      continue;
    }
    const lst = /^\s*[-*]\s+/.test(l);
    const t = l.replace(/^\s*[-*]\s+/, '');
    const runs: Run[] = t
      ? t
          .split(/(\*\*.+?\*\*)/)
          .filter(Boolean)
          .map((x): Run => (/^\*\*.+\*\*$/.test(x) ? [x.slice(2, -2), true, false] : [x, false, false]))
      : [];
    cur.blocks.push({ type: 'p', runs, list: lst });
  }
  const leeg = (b: Block | undefined) => !!b && b.type === 'p' && !b.runs.length;
  for (const e of out) {
    while (e.blocks.length && leeg(e.blocks[0])) e.blocks.shift();
    while (e.blocks.length && leeg(e.blocks[e.blocks.length - 1])) e.blocks.pop();
  }
  return out.filter((e) => e.blocks.length);
}

/** Bibliotheek (met afbeeldingen) samengevoegd met de standaardteksten uit het project. */
export function bibliotheek(bib: Bibliotheek | null, kennis: Kennis | null): LibEntry[] {
  const res: LibEntry[] = (bib?.entries || []).map((e) => e);
  for (const m of mdEntries(kennis?.standaardteksten)) {
    const i = res.findIndex((e) => nrm(e.name) === nrm(m.name));
    if (i >= 0) {
      const med = res[i].blocks.filter((b) => b.type !== 'p');
      res[i] = {
        ...res[i],
        aliases: [...(res[i].aliases || []), ...m.aliases],
        blocks: [...m.blocks, { type: 'p', runs: [] }, ...med],
        bron: m.bron,
      };
    } else res.push(m);
  }
  return res;
}

export type ZoekStatus = 'ok' | 'onbekend' | 'twijfel';

export function zoek(product: string, lib: LibEntry[]): { e: LibEntry | null; st: ZoekStatus; info: string } {
  const np = ' ' + nrm(product) + ' ';
  const toks = codeTok(product);
  const sc: [number, LibEntry][] = [];
  for (const e of lib) {
    if (e.kind === 'media') continue;
    if (e.exact) {
      if ([e.name, ...(e.aliases || [])].some((k) => nrm(k) === nrm(product))) sc.push([1000, e]);
      continue;
    }
    let best = 0;
    for (const k of [e.name, ...(e.aliases || [])]) {
      const n = nrm(k);
      if (n && np.includes(' ' + n + ' ')) best = Math.max(best, 100 + n.length);
    }
    for (const t of [...codeTok(e.name), ...(e.aliases || []).filter((a) => codeTok(a).size).map(nrm)])
      if (toks.has(t)) best = Math.max(best, 50 + t.length);
    if (best) sc.push([best, e]);
  }
  if (!sc.length) return { e: null, st: 'onbekend', info: '' };
  sc.sort((a, b) => b[0] - a[0]);
  if (sc.length > 1 && sc[0][0] === sc[1][0])
    return {
      e: null,
      st: 'twijfel',
      info: sc
        .slice(0, 3)
        .map((x) => x[1].name)
        .join(' / '),
    };
  return { e: sc[0][1], st: 'ok', info: '' };
}

export const heeftMedia = (e: LibEntry) => e.blocks.some((b) => b.type === 'media' || b.type === 'img');
```

## `web/src/syntess/analyse.ts`

```typescript
/* Analyse en controles van een aangeleverde Syntess-offerte. */
import { vandaag } from '../lib/utils';
import type { SyntessOfferte } from '../lib/types';
import { heeftMedia, zoek, type LibEntry } from './library';
import { ART_RE, NW, alle, blokNa, bms, bodyVan, hasMedia, kids, nrm, ptekst, vetteRegel, type Stijlen } from './ooxml';

export type StatusCode =
  | 'ok'
  | 'alleen_afbeelding'
  | 'eigen'
  | 'heeft_al_tekst'
  | 'heeft_al_inhoud'
  | 'leeg'
  | 'al_ingevoegd'
  | 'onbekend'
  | 'twijfel';

export interface ArtStatus {
  st: StatusCode;
  e: LibEntry | null;
  info: string;
}

export interface Artikel {
  p: Element;
  regel: string;
  aantal: string;
  product: string;
  blok: Element[];
  txt: boolean;
  med: boolean;
  klaar: boolean;
  s: ArtStatus;
}

export const ST_INFO: Record<StatusCode, [string, string]> = {
  ok: ['Tekst + afbeelding', 'ok'],
  alleen_afbeelding: ['Alleen afbeelding', 'ok'],
  eigen: ['Eigen tekst', 'ai'],
  heeft_al_tekst: ['Eigen tekst blijft', ''],
  heeft_al_inhoud: ['Compleet', ''],
  leeg: ['Niets toevoegen', ''],
  al_ingevoegd: ['Al aangevuld', ''],
  onbekend: ['Niet in bibliotheek', 'today'],
  twijfel: ['Twijfel', 'late'],
};

/** Alle dikgedrukte artikelregels ("2 x …") met het blok dat erbij hoort. */
export function analyse(doc: Document, st: Stijlen): Artikel[] {
  const body = bodyVan(doc);
  const arts: Artikel[] = [];
  for (const p of kids(body, NW, 'p')) {
    const t = ptekst(p).trim();
    const m = t.match(ART_RE);
    if (!m || !vetteRegel(p, st)) continue;
    const blk = blokNa(p, st);
    arts.push({
      p,
      regel: t,
      aantal: m[1],
      product: m[2],
      blok: blk,
      txt: blk.some((x) => !!ptekst(x).trim()),
      med: blk.some(hasMedia),
      klaar: blk.some((x) => bms(x).some((b) => b.startsWith('OT_'))),
      s: { st: 'onbekend', e: null, info: '' },
    });
  }
  return arts;
}

export function statusVan(a: Artikel, i: number, lib: LibEntry[], cur: SyntessOfferte): ArtStatus {
  const k = (cur.keuzes || {})[i] || 'auto';
  if (a.klaar) return { st: 'al_ingevoegd', e: null, info: 'al eerder door de tool ingevoegd' };
  if (k === 'leeg') return { st: 'leeg', e: null, info: 'bewust niets toevoegen' };
  if (k === 'eigen') {
    const t = ((cur.eigen || {})[i] || '').trim();
    return t
      ? {
          st: a.txt ? 'heeft_al_tekst' : 'eigen',
          e: null,
          info: a.txt ? 'er staat al tekst; eigen tekst niet nodig' : 'jouw eigen tekst',
        }
      : { st: 'onbekend', e: null, info: 'eigen tekst nog leeg' };
  }
  let r: { e: LibEntry | null; st: string; info: string } = k.startsWith('lib:')
    ? { e: lib.find((e) => e.name === k.slice(4)) || null, st: 'ok', info: 'handmatig gekozen' }
    : zoek(a.product, lib);
  if (k.startsWith('lib:') && !r.e) r = { e: null, st: 'onbekend', info: 'gekozen artikel bestaat niet meer' };
  if (!r.e) return { st: r.st as StatusCode, e: null, info: r.info };
  if (a.med) return { st: 'heeft_al_inhoud', e: r.e, info: 'tekst en afbeelding staan er al' };
  if (a.txt)
    return heeftMedia(r.e)
      ? { st: 'alleen_afbeelding', e: r.e, info: r.info || 'eigen tekst blijft, afbeelding erbij' }
      : { st: 'heeft_al_tekst', e: r.e, info: 'eigen tekst, bibliotheek heeft geen afbeelding' };
  return { st: 'ok', e: r.e, info: r.info };
}

/* ---------- controles (alleen melden) ---------- */

const ABBR = new Set(['excl', 'incl', 'fabr', 'ca', 'nr', 'bijv', 'min', 'max', 'tel', 'mob', 'art', 'st', 'stk', 'evt', 'o', 'a']);
const TYPO: Record<string, string> = { verhoofd: 'verhoogd', verlichtte: 'verlichte', úit: 'uit' };

export function lint(t: string): string[] {
  const h: string[] = [];
  if (/\S {2,}\S/.test(t)) h.push('dubbele spatie');
  const m = t.match(/\b([A-Za-zÀ-ÿ]{2,}) \1\b/i);
  if (m) h.push(`woord dubbel: '${m[0]}'`);
  if (/\w [,.;!?](\s|$)/.test(t)) h.push('spatie vóór leesteken');
  for (const x of t.matchAll(/(?:^|[^.\w])([A-Za-zÀ-ÿ]{2,})\. ([a-zà-ÿ])/g))
    if (!ABBR.has(x[1].toLowerCase())) h.push(`kleine letter na punt: '${x[1]}. ${x[2]}'`);
  if (/\d+(?:,\d+)?\s?W\b/.test(t) && !/\d\s?kW/.test(t)) h.push('vermogen in W – bedoeld kW?');
  for (const k in TYPO) if (t.includes(k)) h.push(`'${k}' → '${TYPO[k]}'`);
  return h;
}

export function alleTeksten(doc: Document): string[] {
  const body = bodyVan(doc);
  const out = kids(body, NW, 'p').map((p) => ptekst(p).trim());
  for (const t of alle(body, NW, 'tbl')) for (const p of alle(t, NW, 'p')) out.push(ptekst(p).trim());
  for (const x of alle(doc, NW, 'txbxContent')) for (const p of alle(x, NW, 'p')) out.push(ptekst(p).trim());
  return out.filter(Boolean);
}

export type Controle = [string, string, string];

/** Klant, aanhef, datum, referentie, projectleider, adres en huisstijl-onderdelen. */
export function gegevens(doc: Document, naam: string | undefined): Controle[] {
  const T = alleTeksten(doc);
  const out: Controle[] = [];
  const j = T.join(' ');
  const ti = T.findIndex((t) => /^t\.?a\.?v\.?\s/i.test(t));
  const tav = ti >= 0 ? T[ti] : null;
  const klant = ti > 0 ? T[ti - 1] : null;
  const aan = T.find((t) => /^geachte\s/i.test(t));
  out.push(['INFO', 'Klant', `${klant || '?'} · ${tav || 'T.a.v. niet gevonden'}`]);
  if (tav && aan) {
    const m1 = tav.match(/(heer|mevrouw|mevr\.?|dhr\.?)\s+(?:[A-Z]\.\s*)*([\w'\- ]+?)\s*$/i);
    const m2 = aan.match(/geachte\s+(heer|mevrouw)\s+([\w'\- ]+?)\s*,?\s*$/i);
    if (m1 && m2) {
      const g1 = /^(heer|dhr)/i.test(m1[1]) ? 'heer' : 'mevrouw';
      const ok = nrm(m1[2]) === nrm(m2[2]) && g1 === m2[1].toLowerCase();
      out.push([ok ? 'OK' : 'LET OP', 'Aanhef', `'${aan}' ${ok ? 'past bij' : 'past NIET bij'} '${tav}'`]);
    } else out.push(['INFO', 'Aanhef', aan]);
  } else if (!aan) out.push(['LET OP', 'Aanhef', 'geen “Geachte …” gevonden']);

  const d = j.match(/[A-Z][a-zë-]+,\s*(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (d) {
    const dt = new Date(+d[3], +d[2] - 1, +d[1]);
    const diff = Math.round((new Date(vandaag() + 'T00:00:00').getTime() - dt.getTime()) / 864e5);
    out.push([
      diff >= -14 && diff <= 30 ? 'OK' : 'LET OP',
      'Datum',
      `${d[0]} (${diff >= 0 ? diff + ' dagen geleden' : 'over ' + -diff + ' dagen'})`,
    ]);
  } else out.push(['LET OP', 'Datum', '“Plaats, dd-mm-jjjj” niet gevonden']);

  const r = j.match(/TD(\d{6}-\d+[A-Z]?)/);
  if (r) {
    const fn = String(naam || '').match(/(\d{6}-\d+[A-Z]?)/);
    const af = !!fn && fn[1] !== r[1];
    out.push([af ? 'LET OP' : 'OK', 'Ref. Nr.', `TD${r[1]}${af ? ' – bestandsnaam heeft ' + fn![1] : ''}`]);
  }

  const g = T.findIndex((t) => /^met vriendelijke groet/i.test(t));
  if (g >= 0) {
    const sig = T.slice(g + 1, g + 7);
    const mail = (sig.find((t) => t.includes('@')) || '').match(/[\w.-]+@[\w.-]+/);
    const mob = sig.find((t) => /^(mob|tel)/i.test(t));
    const nm = sig.find((t) => !t.includes('@') && !/^(mob|tel|miltech)/i.test(t));
    let ok = !!(nm && mail && mob);
    let x = '';
    if (nm && mail) {
      const last = nrm(nm).split(' ').pop();
      if (last && !nrm(mail[0].split('@')[0]).replace(/ /g, '').includes(last)) {
        ok = false;
        x = ' (e-mail past niet bij naam)';
      }
      if (!/@miltech\.nl$/i.test(mail[0])) ok = false;
    }
    out.push([ok ? 'OK' : 'LET OP', 'Projectleider', `${nm || '?'}${x} · ${mail ? mail[0] : 'geen e-mail'} · ${mob || 'geen mobiel'}`]);
  } else out.push(['LET OP', 'Projectleider', 'ondertekening niet gevonden']);

  const adr = ti >= 0 ? T[ti + 1] : null;
  const lev = T.find((t) => nrm(t).startsWith('afleveradres'));
  if (adr && lev) {
    const w = nrm(adr).split(' ').slice(0, 2);
    const ok = w.every((x) => nrm(lev).includes(x));
    out.push([ok ? 'OK' : 'LET OP', 'Afleveradres', `${ok ? 'gelijk aan' : 'wijkt af van'} klantadres (${adr})`]);
  }

  const lm = T.findIndex((t) => /levering en montage van;\s*$/.test(t));
  if (lm >= 0 && T[lm + 1]) {
    const n = T.filter((t) => nrm(t) === nrm(T[lm + 1])).length;
    out.push([n >= 2 ? 'OK' : 'LET OP', 'Projecttitel', `'${T[lm + 1]}' ${n >= 2 ? 'staat ook op voorblad' : 'niet gelijk aan voorblad'}`]);
  }

  const HS: [string, boolean][] = [
    ['Kop OFFERTE', T.some((t) => t === 'OFFERTE')],
    ['Kop Systeemomschrijving', T.some((t) => nrm(t).startsWith('systeemomschrijving'))],
    ['Leveringsomvang-kop', T.some((t) => nrm(t).includes('leveringsomvang omschrijvingen prijzen en condities'))],
    ['Totaalprijs', T.some((t) => nrm(t).includes('totaalprijs voor het leveren'))],
    ['Bedrag € … excl. BTW', /€\s?\d{1,3}(\.\d{3})*,\d{2}\s+excl\.\s?BTW/.test(j.replace(/ /g, ' '))],
    ['Niet tot onze levering behoren', T.some((t) => nrm(t).includes('niet tot onze levering behoren'))],
    ['Condities', T.some((t) => nrm(t) === 'condities')],
    ['ALIB 2024', T.some((t) => nrm(t).includes('alib 2024'))],
  ];
  for (const [n, ok] of HS) if (!ok) out.push(['LET OP', 'Huisstijl', `ontbreekt: ${n}`]);
  return out;
}

export function controlePunten(doc: Document | null | undefined, bestand: string | undefined): Controle[] {
  if (!doc) return [];
  const g = gegevens(doc, bestand);
  const L: Controle[] = [];
  for (const n of kids(bodyVan(doc), NW, 'p')) {
    const t = ptekst(n);
    for (const h of lint(t)) L.push(['TEKST', h, t.trim().slice(0, 80)]);
  }
  return [...g, ...L.slice(0, 40)];
}
```

## `web/src/syntess/build.ts`

```typescript
/* Opbouw: aangeleverde offerte + keuzes -> nieuw document (zelfde regels als offerte_tool.py). */
import type { SyntessOfferte } from '../lib/types';
import { ST_INFO, analyse, statusVan } from './analyse';
import type { Bibliotheek, Block, BlockElement, BlockImg, BlockMedia, LibEntry, RelPart, Run } from './library';
import {
  NA,
  NO,
  NR,
  NV,
  NW,
  NWP,
  NSY,
  ORDER_PPR,
  ORDER_RPR,
  SYH,
  alle,
  bodyVan,
  hasMedia,
  hashStr,
  insOrder,
  kid,
  kids,
  nrm,
  parseXml,
  ptekst,
  runsVan,
  wEl,
  wv,
} from './ooxml';
import type { Basis, NieuweRel, Opbouw } from './types';

interface Fmt {
  doc: Document;
  pPr: Element;
  rPr: Element | null;
  left: number;
}

interface Ctx {
  doc: Document;
  mark: boolean;
  lib: Bibliotheek | null;
  nid: () => number;
  rel: (info: RelPart) => string;
}

/** Opmaak van een referentie-alinea overnemen (zonder nummering, vet, enz.). */
function fmtVan(doc: Document, ref: Element): Fmt {
  const p0 = kid(ref, NW, 'pPr');
  const pPr = p0 ? (p0.cloneNode(true) as Element) : wEl(doc, 'pPr');
  for (const t of ['numPr', 'keepNext', 'pageBreakBefore', 'outlineLvl', 'rPr', 'jc', 'sectPr', 'pPrChange'])
    kids(pPr, NW, t).forEach((x) => pPr.removeChild(x));
  const ind = kid(pPr, NW, 'ind');
  let left = 0;
  if (ind) {
    left = +(wv(ind, 'left') || wv(ind, 'start') || 0);
    for (const a of ['firstLine', 'hanging', 'start', 'end']) {
      ind.removeAttributeNS(NW, a);
      ind.removeAttribute('w:' + a);
    }
  }
  const r0 = runsVan(ref).find((r) => ptekst(r).trim());
  const rp0 = r0 && kid(r0, NW, 'rPr');
  const rPr = rp0 ? (rp0.cloneNode(true) as Element) : null;
  if (rPr) for (const t of ['b', 'bCs', 'i', 'iCs', 'u', 'highlight', 'caps']) kids(rPr, NW, t).forEach((x) => rPr.removeChild(x));
  return { doc, pPr, rPr, left };
}

function nieuwePPr(f: Fmt, extra: number, keep: boolean, tabs?: [string, string][] | null): Element {
  const p = f.pPr.cloneNode(true) as Element;
  if (tabs && tabs.length) {
    kids(p, NW, 'tabs').forEach((x) => p.removeChild(x));
    const tt = wEl(f.doc, 'tabs');
    for (const [v, pos] of tabs) tt.appendChild(wEl(f.doc, 'tab', { val: v, pos }));
    insOrder(p, tt, ORDER_PPR);
  }
  if (keep) insOrder(p, wEl(f.doc, 'keepNext'), ORDER_PPR);
  let ind = kid(p, NW, 'ind');
  if (!ind) ind = insOrder(p, wEl(f.doc, 'ind'), ORDER_PPR);
  ind.setAttributeNS(NW, 'w:left', String(f.left + (extra || 0)));
  if (f.rPr) insOrder(p, f.rPr.cloneNode(true) as Element, ORDER_PPR);
  return p;
}

function maakRun(f: Fmt, tekst: string, b: boolean, i: boolean, kleur?: string | null): Element {
  const d = f.doc;
  const r = wEl(d, 'r');
  const rp = f.rPr ? (f.rPr.cloneNode(true) as Element) : wEl(d, 'rPr');
  if (b) {
    insOrder(rp, wEl(d, 'b'), ORDER_RPR);
    insOrder(rp, wEl(d, 'bCs'), ORDER_RPR);
  }
  if (i) insOrder(rp, wEl(d, 'i'), ORDER_RPR);
  if (kleur) {
    kids(rp, NW, 'color').forEach((x) => rp.removeChild(x));
    insOrder(rp, wEl(d, 'color', { val: kleur }), ORDER_RPR);
  }
  if (rp.childNodes.length) r.appendChild(rp);
  String(tekst)
    .replace(/\n/g, '')
    .split('\t')
    .forEach((s, k) => {
      if (k) r.appendChild(wEl(d, 'tab'));
      if (s) {
        const t = wEl(d, 't');
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        t.textContent = s;
        r.appendChild(t);
      }
    });
  return r;
}

/** **vet** en *cursief* naar runs. */
export function markup(l: string): Run[] {
  return String(l)
    .split(/(\*\*.+?\*\*|(?<!\*)\*[^*]+?\*(?!\*))/)
    .filter(Boolean)
    .map((x): Run =>
      /^\*\*.+\*\*$/.test(x) ? [x.slice(2, -2), true, false] : /^\*[^*].*\*$/.test(x) ? [x.slice(1, -1), false, true] : [x, false, false],
    );
}

function zetKeep(p: Element | null) {
  if (!p || p.localName !== 'p') return;
  let pp = kid(p, NW, 'pPr');
  if (!pp) {
    pp = wEl(p.ownerDocument, 'pPr');
    p.insertBefore(pp, p.firstChild);
  }
  if (!kid(pp, NW, 'keepNext')) insOrder(pp, wEl(p.ownerDocument, 'keepNext'), ORDER_PPR);
}

function isLegeP(n: Element | null): boolean {
  return !!n && n.nodeType === 1 && n.localName === 'p' && !ptekst(n).trim() && !hasMedia(n);
}

function volgend(n: Node): Element | null {
  let x = n.nextSibling;
  while (x && x.nodeType !== 1) x = x.nextSibling;
  return x as Element | null;
}

function vorig(n: Node): Element | null {
  let x = n.previousSibling;
  while (x && x.nodeType !== 1) x = x.previousSibling;
  return x as Element | null;
}

function zetRelaties(n: Element, parts: Record<string, RelPart>, ctx: Ctx) {
  const map: Record<string, string> = {};
  for (const e of [n, ...n.getElementsByTagName('*')])
    for (const at of [...e.attributes])
      if (at.namespaceURI === NR && parts[at.value]) {
        if (!map[at.value]) map[at.value] = ctx.rel(parts[at.value]);
        e.setAttributeNS(NR, at.name, map[at.value]);
      }
}

class Invoeger {
  ctx: Ctx;
  d: Document;
  last: Element;
  f: Fmt;
  first: Element | null = null;
  keep = false;
  soort: string;
  sleutel: string;

  constructor(ctx: Ctx, anker: Element, f: Fmt, soort: string, sleutel: string) {
    this.ctx = ctx;
    this.d = ctx.doc;
    this.last = anker;
    this.f = f;
    this.soort = soort;
    this.sleutel = sleutel;
  }

  private _p(extra?: number, tabs?: [string, string][] | null): Element {
    const p = wEl(this.d, 'p');
    p.appendChild(nieuwePPr(this.f, extra || 0, this.keep, tabs));
    this.zet(p);
    return p;
  }

  zet(n: Element) {
    if (this.ctx.mark) {
      n.setAttributeNS(NSY, 'sy:k', this.sleutel);
      n.setAttributeNS(NSY, 'sy:s', this.soort);
    }
    this.last.parentNode!.insertBefore(n, this.last.nextSibling);
    this.last = n;
    if (!this.first) this.first = n;
  }

  leeg() {
    return this._p();
  }

  tekst(runs: Run[], lijst?: boolean, tabs?: [string, string][] | null, ind?: number, lineKey?: number | null) {
    const p = this._p((lijst ? 709 : 0) + (ind || 0), tabs);
    if (lineKey != null && this.ctx.mark) p.setAttributeNS(NSY, 'sy:l', String(lineKey));
    const rr: Run[] = lijst ? [[SYH.LIJST, false, false], ...runs] : runs;
    for (const [t, b, i] of rr.length ? rr : [['', false, false] as Run]) p.appendChild(maakRun(this.f, t, b, i));
    return p;
  }

  pagina() {
    const p = this._p();
    const r = wEl(this.d, 'r');
    r.appendChild(wEl(this.d, 'br', { type: 'page' }));
    p.appendChild(r);
    return p;
  }

  media(blk: BlockImg | BlockMedia) {
    const p = this._p();
    if (blk.type === 'img') {
      const rid = this.ctx.rel({
        reltype: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        ctype: 'image/' + (blk.ext === 'jpg' ? 'jpeg' : blk.ext),
        ext: blk.ext,
        b64: blk.b64,
      });
      const id = this.ctx.nid();
      const cx = blk.cx || 3600000;
      const cy = blk.cy || 2400000;
      const x = `<w:r xmlns:w="${NW}"><w:drawing><wp:inline xmlns:wp="${NWP}" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Afbeelding ${id}"/><a:graphic xmlns:a="${NA}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Afbeelding ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="${NR}" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      p.appendChild(this.d.importNode(parseXml(x).documentElement, true));
      return p;
    }
    for (const xml of blk.runs_xml) {
      const n = this.d.importNode(parseXml(xml).documentElement, true) as Element;
      zetRelaties(n, blk.parts, this.ctx);
      for (const dp of alle(n, NWP, 'docPr')) dp.setAttribute('id', String(this.ctx.nid()));
      for (const sh of alle(n, NV, 'shape')) {
        const old = sh.getAttribute('id');
        const nw = '_x0000_i' + this.ctx.nid();
        sh.setAttribute('id', nw);
        for (const o of alle(n, NO, 'OLEObject'))
          if (o.getAttribute('ShapeID') === old) {
            o.setAttribute('ShapeID', nw);
            o.setAttribute('ObjectID', '_' + (1700000000 + this.ctx.nid()));
          }
      }
      p.appendChild(n);
    }
    return p;
  }

  element(blk: BlockElement) {
    const n = this.d.importNode(parseXml(blk.xml).documentElement, true) as Element;
    zetRelaties(n, blk.parts, this.ctx);
    for (const dp of alle(n, NWP, 'docPr')) dp.setAttribute('id', String(this.ctx.nid()));
    this.zet(n);
    return n;
  }

  tabel(rows: string[][]) {
    const d = this.d;
    const tpl = this.ctx.lib?.tabel_sjabloon;
    const bestaand = kids(bodyVan(d), NW, 'tbl')[0];
    const nc = Math.max(...rows.map((r) => r.length));
    let tblPr: Element;
    let grid: Element | null;
    let shd: Element | null = null;
    let kleur: string | null = null;
    const P = (s: string) => d.importNode(parseXml(s).documentElement, true) as Element;
    if (bestaand) {
      tblPr = kid(bestaand, NW, 'tblPr')!.cloneNode(true) as Element;
      const g0 = kid(bestaand, NW, 'tblGrid');
      grid = g0 ? (g0.cloneNode(true) as Element) : null;
      const tc0 = alle(bestaand, NW, 'tc')[0];
      const s0 = tc0 && alle(tc0, NW, 'shd')[0];
      shd = s0 ? (s0.cloneNode(true) as Element) : null;
      const c = tc0 && alle(tc0, NW, 'color')[0];
      kleur = c ? wv(c, 'val') : null;
    } else if (tpl) {
      tblPr = P(tpl.tblPr);
      grid = P(tpl.tblGrid);
      shd = tpl.hdr_shd ? P(tpl.hdr_shd) : null;
      kleur = tpl.hdr_color || null;
    } else {
      tblPr = wEl(d, 'tblPr');
      tblPr.appendChild(wEl(d, 'tblW', { w: 0, type: 'auto' }));
      const bd = wEl(d, 'tblBorders');
      for (const s of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'])
        bd.appendChild(wEl(d, s, { val: 'single', sz: 4, space: 0, color: '000000' }));
      tblPr.appendChild(bd);
      grid = null;
    }
    const cols = grid ? kids(grid, NW, 'gridCol') : [];
    const ws = cols.length === nc ? cols.map((g) => wv(g, 'w') || '0') : Array<string>(nc).fill(String(Math.round(9600 / nc)));
    if (!grid || cols.length !== nc) {
      grid = wEl(d, 'tblGrid');
      ws.forEach((w) => grid!.appendChild(wEl(d, 'gridCol', { w })));
    }
    const tbl = wEl(d, 'tbl');
    tbl.appendChild(tblPr);
    tbl.appendChild(grid);
    rows.forEach((row, i) => {
      const tr = wEl(d, 'tr');
      for (let j = 0; j < nc; j++) {
        const tc = wEl(d, 'tc');
        const tp = wEl(d, 'tcPr');
        tp.appendChild(wEl(d, 'tcW', { w: ws[j], type: 'dxa' }));
        if (i === 0 && shd) tp.appendChild(shd.cloneNode(true));
        tc.appendChild(tp);
        const p = wEl(d, 'p');
        for (const [t, b, it] of markup(row[j] || '')) p.appendChild(maakRun(this.f, t, b || i === 0, it, i === 0 ? kleur : null));
        tc.appendChild(p);
        tr.appendChild(tc);
      }
      tbl.appendChild(tr);
    });
    this.zet(tbl);
    return tbl;
  }

  bladwijzer(naam: string) {
    if (!this.first || this.first.localName !== 'p') return;
    const id = this.ctx.nid();
    const s = wEl(this.d, 'bookmarkStart', { id, name: naam.slice(0, 40) });
    const e = wEl(this.d, 'bookmarkEnd', { id });
    const pp = kid(this.first, NW, 'pPr');
    this.first.insertBefore(s, pp ? pp.nextSibling : this.first.firstChild);
    this.first.appendChild(e);
  }
}

const tekstVan = (b: Block) => (b.type === 'p' ? b.runs.map((r) => r[0]).join('').trim() : '');

function voegArtikelIn(ins: Invoeger, e: LibEntry): number {
  let n = 0;
  let prev: 'p' | 'blank' | 'img' | null = null;
  ins.keep = SYH.BIJ_ELKAAR;
  if (SYH.LEGE_VOOR_TEKST) ins.leeg();
  ins.keep = false;
  for (const b of e.blocks) {
    if (b.type === 'p') {
      ins.tekst(b.runs, b.list, b.tabs, b.ind);
      prev = tekstVan(b) ? 'p' : 'blank';
    } else if (b.type === 'element') {
      ins.element(b);
      prev = 'p';
    } else {
      if (prev === 'p' && SYH.LEGE_VOOR_AFB && !e.exact) {
        if (SYH.BIJ_ELKAAR) zetKeep(ins.last);
        ins.leeg();
      }
      if (SYH.BIJ_ELKAAR && ins.first && (prev === 'p' || prev === 'blank')) {
        zetKeep(ins.last);
        const pv = vorig(ins.last);
        if (prev === 'blank' && pv && pv !== vorig(ins.first)) zetKeep(pv);
      }
      ins.media(b);
      n++;
      prev = 'img';
    }
  }
  if (SYH.LEGE_NA_BLOK && !isLegeP(volgend(ins.last))) ins.leeg();
  return n;
}

function voegAfbeeldingIn(ins: Invoeger, e: LibEntry): number {
  const bl = e.blocks;
  const k = bl.findIndex((b) => b.type !== 'p');
  const voor = k > 0 ? bl[k - 1] : null;
  const lb = !!voor && voor.type === 'p' && !tekstVan(voor);
  if (e.exact ? lb : SYH.LEGE_VOOR_AFB) {
    ins.leeg();
    if (SYH.BIJ_ELKAAR) zetKeep(ins.last);
  }
  let n = 0;
  for (const b of bl)
    if (b.type === 'img' || b.type === 'media') {
      ins.media(b);
      n++;
    }
  if (SYH.LEGE_NA_BLOK && !isLegeP(volgend(ins.last))) ins.leeg();
  return n;
}

/** Bouwt het aangevulde document. `mark` voegt markeringen toe voor de voorbeeldweergave. */
export function bouw(B: Basis, cur: SyntessOfferte, lib: LibEntry[], bib: Bibliotheek | null, mark: boolean): Opbouw {
  const doc = parseXml(B.xml);
  let teller = 90000;
  let relN = 0;
  const nieuweRels: Record<string, NieuweRel> = {};
  const perHash: Record<string, string> = {};
  const ctx: Ctx = {
    doc,
    mark,
    lib: bib,
    nid: () => ++teller,
    rel: (info) => {
      const h = hashStr(info.b64);
      if (perHash[h]) return perHash[h];
      const id = 'rIdOT' + ++relN;
      nieuweRels[id] = {
        ...info,
        pad: (/package|oleObject/.test(info.ctype) ? 'embeddings/' : 'media/') + 'ot_' + h + '.' + info.ext,
      };
      perHash[h] = id;
      return id;
    },
  };
  const arts = analyse(doc, B.st);
  const rap = { ingevoegd: [] as string[], overgeslagen: [] as string[], inleiding: '' };

  arts.forEach((a, i) => {
    const s = statusVan(a, i, lib, cur);
    a.s = s;
    const key = 'a' + i;
    if (s.st === 'alleen_afbeelding' && s.e) {
      const inh = a.blok.filter((x) => ptekst(x).trim());
      const ins = new Invoeger(ctx, inh[inh.length - 1], fmtVan(doc, a.p), 'bib', key);
      const n = voegAfbeeldingIn(ins, s.e);
      ins.bladwijzer('OT_img_' + i);
      rap.ingevoegd.push(`${a.regel} → alleen afbeelding (${n}), eigen tekst ongewijzigd`);
    } else if (s.st === 'ok' && s.e) {
      const ins = new Invoeger(ctx, a.p, fmtVan(doc, a.p), 'bib', key);
      const n = voegArtikelIn(ins, s.e);
      ins.bladwijzer('OT_art_' + i);
      rap.ingevoegd.push(`${a.regel} → ${s.e.name} (${n} afb.)`);
    } else if (s.st === 'eigen') {
      const ins = new Invoeger(ctx, a.p, fmtVan(doc, a.p), 'eigen', key);
      if (SYH.LEGE_VOOR_TEKST) ins.leeg();
      for (const l of (cur.eigen[i] || '').split('\n')) ins.tekst(markup(l.replace(/^- /, '')), /^- /.test(l));
      if (!isLegeP(volgend(ins.last))) ins.leeg();
      ins.bladwijzer('OT_art_' + i);
      rap.ingevoegd.push(`${a.regel} → eigen tekst`);
    } else rap.overgeslagen.push(`${a.regel} → ${ST_INFO[s.st] ? ST_INFO[s.st][0] : s.st}${s.info ? ' (' + s.info + ')' : ''}`);
  });

  // inleiding onder Systeemomschrijving
  const inl = String(cur.inleiding || '');
  if (inl.trim()) {
    const so = kids(bodyVan(doc), NW, 'p').find((p) => nrm(ptekst(p)).startsWith('systeemomschrijving') && ptekst(p).trim().length < 120);
    if (!so) rap.inleiding = 'NIET geplaatst: kop Systeemomschrijving niet gevonden';
    else if (alle(doc, NW, 'bookmarkStart').some((b) => wv(b, 'name') === 'OT_inleiding')) rap.inleiding = 'staat er al';
    else {
      const ins = new Invoeger(ctx, so, fmtVan(doc, so), 'claude', 'inl');
      ins.leeg();
      ins.bladwijzer('OT_inleiding');
      const L = inl.replace(/\s+$/, '').split('\n');
      let k = 0;
      const mis: string[] = [];
      while (k < L.length) {
        const l = L[k].trim();
        if (l.startsWith('|')) {
          const tl: string[] = [];
          while (k < L.length && L[k].trim().startsWith('|')) tl.push(L[k++].trim());
          ins.tabel(
            tl
              .filter((x) => !/^\|?\s*:?-{2,}/.test(x))
              .map((x) =>
                x
                  .replace(/^\||\|$/g, '')
                  .split('|')
                  .map((c) => c.trim()),
              ),
          );
          continue;
        }
        if (!l) ins.leeg();
        else if (/^-{3}\s*pagina\s*-{3}$/i.test(l)) ins.pagina();
        else if (/^\[\[(.+)\]\]$/.test(l)) {
          const e = lib.find((x) => nrm(x.name) === nrm(l.slice(2, -2)));
          if (!e) mis.push(l);
          else
            for (const b of e.blocks) {
              if (b.type === 'p') ins.tekst(b.runs, false, b.tabs, 0, k);
              else if (b.type === 'img' || b.type === 'media') ins.media(b);
              else ins.element(b);
            }
        } else if (l.startsWith('- ')) ins.tekst(markup(l.slice(2)), true, null, 0, k);
        else ins.tekst(markup(l), false, null, 0, k);
        k++;
      }
      rap.inleiding = 'geplaatst onder Systeemomschrijving' + (mis.length ? ' – niet gevonden: ' + mis.join(', ') : '');
    }
  }
  return { doc, arts, rap, nieuweRels };
}
```

## `web/src/syntess/preview.ts`

```typescript
/* Voorbeeldweergave: benadering van de Word-pagina's in HTML. */
import { esc } from '../lib/utils';
import { NA, NMC, NSY, NV, NW, NWP, alle, b64ToBytes, bodyVan, hasMedia, hashStr, kid, kids, parseXml, ptekst, standaardStijl, wn, wv } from './ooxml';
import type { Basis, NieuweRel, Opbouw, Rels } from './types';

const TW = 15; // twips per px (96 dpi)
const pxEmu = (n: string | null | undefined) => Math.round((+(n || 0) || 0) / 9525);

interface PaginaMaten {
  w: number;
  h: number;
  mt: number;
  mb: number;
  ml: number;
  mr: number;
  hd: number;
  fd: number;
  cw: number;
  titel: boolean;
}

interface Veld {
  instr?: string;
  mode?: string;
  open?: string;
}

/** Tekencontext voor één voorbeeldweergave. */
interface Teken {
  base: Basis;
  pg: PaginaMaten;
}

const extraUrls: Record<string, string> = {};

/** Blob-URL's van nieuw ingevoegde afbeeldingen opruimen (bij een ander document). */
export function ruimVoorbeeldOp(): void {
  for (const k of Object.keys(extraUrls)) {
    URL.revokeObjectURL(extraUrls[k]);
    delete extraUrls[k];
  }
}

function mediaUrl(T: Teken, rid: string | null, rels: Rels | null, extra: Record<string, NieuweRel> | null): string | null {
  if (!rid) return null;
  if (extra && extra[rid]) {
    const r = extra[rid];
    if (!/^(png|jpe?g|gif)$/i.test(r.ext)) return null;
    const k = 'nr:' + rid + ':' + hashStr(r.b64);
    if (!extraUrls[k]) extraUrls[k] = URL.createObjectURL(new Blob([b64ToBytes(r.b64)], { type: r.ctype }));
    return extraUrls[k];
  }
  const r = rels && rels[rid];
  if (!r) return null;
  const m = T.base.media;
  return m['word/' + r.target.replace(/^\.\.\//, '').replace(/^\//, '')] || m['word/' + r.target] || null;
}

function runCss(rp: Element | null): string {
  let s = '';
  if (!rp) return s;
  const b = kid(rp, NW, 'b');
  const i = kid(rp, NW, 'i');
  const u = kid(rp, NW, 'u');
  const sz = kid(rp, NW, 'sz');
  const c = kid(rp, NW, 'color');
  const f = kid(rp, NW, 'rFonts');
  if (b && !['0', 'false'].includes(wv(b, 'val') || '')) s += 'font-weight:700;';
  if (i && !['0', 'false'].includes(wv(i, 'val') || '')) s += 'font-style:italic;';
  if (u && wv(u, 'val') !== 'none') s += 'text-decoration:underline;';
  if (sz) s += `font-size:${wn(sz, 'val') / 2}pt;`;
  if (c && /^[0-9A-Fa-f]{6}$/.test(wv(c, 'val') || '')) s += `color:#${wv(c, 'val')};`;
  if (f && wv(f, 'ascii')) s += `font-family:'${esc(wv(f, 'ascii'))}',Arial,sans-serif;`;
  return s;
}

function tekenRunInhoud(T: Teken, r: Element, rels: Rels, extra: Record<string, NieuweRel> | null, veld: Veld): string {
  let h = '';
  const css = runCss(kid(r, NW, 'rPr'));
  for (const c of r.childNodes) {
    if (c.nodeType !== 1) continue;
    const e = c as Element;
    const ln = e.localName;
    if (e.namespaceURI === NW && ln === 'fldChar') {
      const t = wv(e, 'fldCharType');
      if (t === 'begin') veld.instr = '';
      if (t === 'separate') veld.mode = /NUMPAGES/.test(veld.instr || '') ? 'pgs' : /\bPAGE\b/.test(veld.instr || '') ? 'pg' : '';
      if (t === 'end') {
        veld.mode = '';
        if (veld.open) {
          h += veld.open;
          veld.open = '';
        }
      }
      continue;
    }
    if (e.namespaceURI === NW && ln === 'instrText') {
      veld.instr = (veld.instr || '') + e.textContent;
      continue;
    }
    if (e.namespaceURI === NW && ln === 't') {
      if (veld.mode) {
        if (!veld.open) veld.open = `<span class="${veld.mode}" style="${css}"></span>`;
        continue;
      }
      h += `<span style="${css}">${esc(e.textContent)}</span>`;
    } else if (e.namespaceURI === NW && ln === 'tab') h += '<span class="tb"></span>';
    else if (e.namespaceURI === NW && ln === 'br') h += wv(e, 'type') === 'page' ? '<span class="pbrk"></span>' : '<br>';
    else if (e.namespaceURI === NW && (ln === 'drawing' || ln === 'pict' || ln === 'object')) h += tekenObject(T, e, rels, extra);
    else if (e.namespaceURI === NMC && ln === 'AlternateContent') {
      const ch = kid(e, NMC, 'Choice');
      if (ch)
        for (const x of ch.childNodes)
          if (x.nodeType === 1 && (x as Element).localName === 'drawing') h += tekenObject(T, x as Element, rels, extra);
    }
  }
  return h;
}

function binnenTekst(T: Teken, box: Element, rels: Rels, extra: Record<string, NieuweRel> | null): string {
  const tx = alle(box, NW, 'txbxContent')[0];
  if (!tx) return '';
  return kids(tx, NW, 'p')
    .map((p) => tekenP(T, p, rels, extra, {}))
    .join('');
}

function tekenObject(T: Teken, o: Element, rels: Rels, extra: Record<string, NieuweRel> | null): string {
  const pg = T.pg;
  if (o.localName === 'drawing') {
    const a = kid(o, NWP, 'anchor') || kid(o, NWP, 'inline');
    if (!a) return '';
    const ex = kid(a, NWP, 'extent');
    const w = pxEmu(ex && ex.getAttribute('cx'));
    const h = pxEmu(ex && ex.getAttribute('cy'));
    const blip = alle(a, NA, 'blip')[0];
    let fill = '';
    const sf = alle(a, NA, 'srgbClr')[0];
    if (!blip && sf) fill = `background:#${sf.getAttribute('val')};`;
    let inner = '';
    if (blip) {
      const u = mediaUrl(T, blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'), rels, extra);
      inner = u
        ? `<img src="${u}" alt="" style="width:${w}px;height:${h}px;display:block">`
        : `<div class="ph" style="width:${w}px;height:${h}px">afbeelding (in Word zichtbaar)</div>`;
    }
    inner += binnenTekst(T, a, rels, extra);
    if (a.localName === 'anchor') {
      const ph = kid(a, NWP, 'positionH');
      const pv = kid(a, NWP, 'positionV');
      const off = (x: Element | null) => {
        const po = x && kid(x, NWP, 'posOffset');
        return po ? pxEmu(po.textContent) : 0;
      };
      const rf = ph && ph.getAttribute('relativeFrom');
      let L = off(ph);
      if (rf === 'page') L -= pg.ml;
      const al = ph && kid(ph, NWP, 'align');
      if (al && al.textContent === 'right') L = pg.cw - w;
      if (al && al.textContent === 'center') L = (pg.cw - w) / 2;
      let Tp: number | null = off(pv);
      const rv = pv && pv.getAttribute('relativeFrom');
      if (rv === 'page' || rv === 'margin') Tp = null;
      const beh = a.getAttribute('behindDoc') === '1';
      return `<span class="anc" style="left:${L}px;${Tp == null ? 'top:0' : 'top:' + Tp + 'px'};width:${w}px;height:${h}px;${fill}${beh ? 'z-index:0' : 'z-index:2'}" ${Tp == null ? `data-pt="${off(pv) - (rv === 'page' ? pg.mt : 0)}"` : ''}>${inner}</span>`;
    }
    return `<span class="inl" style="width:${w}px;min-height:${h}px;${fill}">${inner}</span>`;
  }
  // VML (pict / object)
  const sh = alle(o, NV, 'shape')[0] || alle(o, NV, 'rect')[0] || alle(o, NV, 'roundrect')[0];
  if (!sh) return '';
  const stl: Record<string, string> = {};
  String(sh.getAttribute('style') || '')
    .split(';')
    .forEach((kv) => {
      const [k, v] = kv.split(':');
      if (k && v) stl[k.trim()] = v.trim();
    });
  const pt = (v?: string) =>
    v
      ? /pt$/.test(v)
        ? (parseFloat(v) * 96) / 72
        : /in$/.test(v)
          ? parseFloat(v) * 96
          : /cm$/.test(v)
            ? (parseFloat(v) * 96) / 2.54
            : /mm$/.test(v)
              ? (parseFloat(v) * 96) / 25.4
              : parseFloat(v)
      : 0;
  const w = pt(stl.width);
  const h = pt(stl.height);
  const im = alle(sh, NV, 'imagedata')[0];
  let inner = '';
  if (im) {
    const u = mediaUrl(T, im.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), rels, extra);
    inner = u
      ? `<img src="${u}" alt="" style="width:${w}px;height:${h}px;display:block">`
      : `<div class="ph" style="width:${w}px;height:${h}px">${o.localName === 'object' ? 'Visio-tekening / object – wordt in Word getoond' : 'afbeelding (in Word zichtbaar)'}</div>`;
  }
  inner += binnenTekst(T, sh, rels, extra);
  const fc = sh.getAttribute('fillcolor');
  const fill = fc && sh.getAttribute('filled') !== 'f' && !im ? `background:${esc(fc.split(' ')[0])};` : '';
  if (stl.position === 'absolute') {
    let L = pt(stl['margin-left']);
    if (stl['mso-position-horizontal-relative'] === 'page') L -= pg.ml;
    return `<span class="anc" style="left:${L}px;top:${pt(stl['margin-top'])}px;width:${w}px;height:${h}px;${fill}">${inner}</span>`;
  }
  return `<span class="inl" style="width:${w}px;min-height:${h}px;${fill}">${inner}</span>`;
}

function tekenP(T: Teken, p: Element, rels: Rels, extra: Record<string, NieuweRel> | null, veld: Veld): string {
  const pp = kid(p, NW, 'pPr');
  let css = '';
  let fs = '';
  const jc = pp && kid(pp, NW, 'jc');
  const sp = pp && kid(pp, NW, 'spacing');
  const ind = pp && kid(pp, NW, 'ind');
  const bd = pp && kid(pp, NW, 'pBdr');
  if (jc) {
    const v = wv(jc, 'val');
    css += `text-align:${v === 'both' ? 'justify' : v === 'center' ? 'center' : v === 'right' || v === 'end' ? 'right' : 'left'};`;
  }
  if (sp) {
    if (wv(sp, 'before')) css += `margin-top:${wn(sp, 'before') / TW}px;`;
    if (wv(sp, 'after')) css += `margin-bottom:${wn(sp, 'after') / TW}px;`;
    if (wv(sp, 'line') && (wv(sp, 'lineRule') || 'auto') === 'auto') css += `line-height:${((wn(sp, 'line') / 240) * 1.15).toFixed(3)};`;
  }
  if (ind) {
    const l = +(wv(ind, 'left') || wv(ind, 'start') || 0);
    const fl = wn(ind, 'firstLine') - wn(ind, 'hanging');
    if (l) css += `padding-left:${l / TW}px;`;
    if (fl) css += `text-indent:${fl / TW}px;`;
  }
  if (bd) css += 'border:1px solid #000;padding:4px 6px;';
  const mr = pp && kid(pp, NW, 'rPr');
  const msz = mr && kid(mr, NW, 'sz');
  if (msz) fs = `font-size:${wn(msz, 'val') / 2}pt;`;
  let h = '';
  const walk = (n: Element) => {
    for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue;
      const e = c as Element;
      if (e.namespaceURI === NW && e.localName === 'r') h += tekenRunInhoud(T, e, rels, extra, veld);
      else if (e.namespaceURI === NW && ['hyperlink', 'ins', 'smartTag', 'sdt', 'sdtContent', 'customXml', 'fldSimple'].includes(e.localName))
        walk(e);
    }
  };
  walk(p);
  const sk = p.getAttributeNS(NSY, 'k');
  const ss = p.getAttributeNS(NSY, 's');
  const sl = p.getAttributeNS(NSY, 'l');
  const leeg = !ptekst(p).trim() && !hasMedia(p);
  const ed = ss === 'claude' && sl !== '' && sl != null && !hasMedia(p);
  return `<div class="wp${sk ? ' syi syi-' + ss : ''}" style="${css}${fs}"${sk ? ` data-syk="${esc(sk)}"` : ''}${ed ? ` contenteditable="true" data-syl="${esc(sl)}" spellcheck="true"` : ''}>${h || (leeg ? '&#8203;' : '')}</div>`;
}

function tekenTbl(T: Teken, t: Element, rels: Rels, extra: Record<string, NieuweRel> | null): string {
  const grid = kids(kid(t, NW, 'tblGrid'), NW, 'gridCol').map((g) => wn(g, 'w') / TW);
  const sk = t.getAttributeNS(NSY, 'k');
  const ss = t.getAttributeNS(NSY, 's');
  const rows = kids(t, NW, 'tr')
    .map(
      (tr) =>
        '<tr>' +
        kids(tr, NW, 'tc')
          .map((tc, j) => {
            const tp = kid(tc, NW, 'tcPr');
            const sh = tp && kid(tp, NW, 'shd');
            const f = sh && wv(sh, 'fill');
            const gs = tp && kid(tp, NW, 'gridSpan');
            return `<td ${gs ? `colspan="${esc(wv(gs, 'val'))}"` : ''} style="${f && f !== 'auto' ? 'background:#' + esc(f) + ';' : ''}${grid[j] ? 'width:' + grid[j] + 'px;' : ''}">${kids(tc, NW, 'p')
              .map((p) => tekenP(T, p, rels, extra, {}))
              .join('')}</td>`;
          })
          .join('') +
        '</tr>',
    )
    .join('');
  const bd =
    alle(t, NW, 'tblBorders').some((b) => alle(b, NW, 'top').some((x) => wv(x, 'val') && wv(x, 'val') !== 'none')) ||
    alle(t, NW, 'tcBorders').length > 0;
  return `<table class="wt${bd ? ' bd' : ''}${sk ? ' syi syi-' + ss : ''}"${sk ? ` data-syk="${esc(sk)}"` : ''}>${rows}</table>`;
}

function tekenDeel(T: Teken, part: { xml: string; rels: Rels } | undefined | null): string {
  if (!part) return '';
  const root = parseXml(part.xml).documentElement;
  const veld: Veld = {};
  return [...root.childNodes]
    .filter((n): n is Element => n.nodeType === 1)
    .map((n) => (n.localName === 'p' ? tekenP(T, n, part.rels, null, veld) : n.localName === 'tbl' ? tekenTbl(T, n, part.rels, null) : ''))
    .join('');
}

function paginaMaten(doc: Document): PaginaMaten {
  const sp = alle(doc, NW, 'sectPr').pop();
  const sz = sp && kid(sp, NW, 'pgSz');
  const mg = sp && kid(sp, NW, 'pgMar');
  const W_ = sz ? wn(sz, 'w') / TW : 794;
  const H_ = sz ? wn(sz, 'h') / TW : 1123;
  const g = (k: string) => (mg ? wn(mg, k) / TW : 72);
  return {
    w: W_,
    h: H_,
    mt: g('top'),
    mb: g('bottom'),
    ml: g('left'),
    mr: g('right'),
    hd: g('header'),
    fd: g('footer'),
    cw: W_ - g('left') - g('right'),
    titel: !!(sp && kid(sp, NW, 'titlePg')),
  };
}

/** Tekent alle pagina's in `host`. */
export function tekenVoorbeeld(host: HTMLElement, res: Opbouw, base: Basis, opts: { marks: boolean; sel: string | null }): void {
  const doc = res.doc;
  const pg = paginaMaten(doc);
  const T: Teken = { base, pg };
  const blokken: string[] = [];
  const body = bodyVan(doc);
  for (const n of body.childNodes) {
    if (n.nodeType !== 1) continue;
    const e = n as Element;
    if (e.localName === 'p') blokken.push(tekenP(T, e, base.rels, res.nieuweRels, {}));
    else if (e.localName === 'tbl') blokken.push(tekenTbl(T, e, base.rels, res.nieuweRels));
    else if (e.localName === 'sdt') {
      const c = kid(e, NW, 'sdtContent');
      if (c)
        for (const x of c.childNodes)
          if (x.nodeType === 1 && (x as Element).localName === 'p') blokken.push(tekenP(T, x as Element, base.rels, res.nieuweRels, {}));
    }
  }
  const st = base.st;
  const nid0 = standaardStijl(st);
  const bf = (nid0 && st.s[nid0].font) || st.def.font || 'Calibri';
  const bs = ((nid0 && st.s[nid0].sz) || st.def.sz || 22) / 2;
  host.style.setProperty('--syf', `'${bf}'`);
  host.style.setProperty('--sys', bs + 'pt');

  // meten
  const meet = document.createElement('div');
  meet.className = 'sy-doc';
  meet.style.cssText = `position:absolute;visibility:hidden;left:-99999px;top:0;width:${pg.cw}px;--syf:'${bf}';--sys:${bs}pt`;
  meet.innerHTML = blokken.join('');
  document.body.appendChild(meet);
  const els = [...meet.children] as HTMLElement[];
  const pagina: string[][] = [[]];
  let y = 0;
  const H = pg.h - pg.mt - pg.mb - 6;
  for (const e of els) {
    const eerste = e.firstElementChild;
    const breekVoor = !!eerste && eerste.classList.contains('pbrk') && !(e.textContent || '').replace(/​/g, '').trim();
    const cs = getComputedStyle(e);
    const hgt = e.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    if (breekVoor && pagina[pagina.length - 1].length) {
      pagina.push([]);
      y = 0;
    }
    if (y + hgt > H && pagina[pagina.length - 1].length) {
      pagina.push([]);
      y = 0;
    }
    pagina[pagina.length - 1].push(e.outerHTML);
    y += hgt;
    if (!breekVoor && e.querySelector('.pbrk')) {
      pagina.push([]);
      y = 0;
    }
  }
  meet.remove();
  const kop = (k: string) => tekenDeel(T, (k === 'first' && pg.titel ? base.hdr.first : null) || base.hdr.default);
  const voet = (k: string) => tekenDeel(T, (k === 'first' && pg.titel ? base.ftr.first : null) || base.ftr.default);
  const N = pagina.length;
  host.innerHTML = pagina
    .map(
      (inh, i) =>
        `<div class="sy-page" style="width:${pg.w}px;height:${pg.h}px"><div class="sy-hdr" style="top:${pg.hd}px;left:${pg.ml}px;width:${pg.cw}px">${kop(i ? 'default' : 'first')}</div><div class="sy-doc sy-body" style="top:${pg.mt}px;left:${pg.ml}px;width:${pg.cw}px;height:${H}px">${inh.join('')}</div><div class="sy-ftr" style="bottom:${pg.fd}px;left:${pg.ml}px;width:${pg.cw}px">${voet(i ? 'default' : 'first')}</div><div class="sy-pnr">${i + 1} / ${N}</div></div>`,
    )
    .join('');
  host.querySelectorAll('.sy-page').forEach((p, i) => {
    p.querySelectorAll('.pg').forEach((x) => (x.textContent = String(i + 1)));
    p.querySelectorAll('.pgs').forEach((x) => (x.textContent = String(N)));
  });
  host.querySelectorAll<HTMLElement>('.anc[data-pt]').forEach((a) => {
    const pr = a.closest<HTMLElement>('.wp');
    a.style.top = +(a.dataset.pt || 0) - (pr ? pr.offsetTop : 0) + 'px';
  });
  host.classList.toggle('nomark', !opts.marks);
  if (opts.sel) host.querySelector(`[data-syk="${CSS.escape(opts.sel)}"]`)?.classList.add('sel');
}
```

## `web/src/syntess/docx.ts`

```typescript
/* Inlezen en wegschrijven van .docx-bestanden (JSZip). */
import JSZip from 'jszip';
import { NCT, NPR, NR, NW, alle, b64ToBytes, bodyVan, kids, parseXml, leesStijlen, wv } from './ooxml';
import type { Basis, Deel, Opbouw, Rels } from './types';

let baseUrls: string[] = [];

async function relsVan(zip: JSZip, p: string): Promise<Rels> {
  const f = zip.file(p);
  const m: Rels = {};
  if (!f) return m;
  const d = parseXml(await f.async('string'));
  for (const r of alle(d, NPR, 'Relationship'))
    m[r.getAttribute('Id') || ''] = {
      target: r.getAttribute('Target') || '',
      type: r.getAttribute('Type') || '',
      ext: r.getAttribute('TargetMode') === 'External',
    };
  return m;
}

/** Leest een Syntess-export in: document, stijlen, relaties, media, kop- en voetteksten. */
export async function leesBasis(buf: ArrayBuffer, naam: string): Promise<Basis> {
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Geen word/document.xml in dit bestand');
  const xml = await docFile.async('string');
  const stFile = zip.file('word/styles.xml');
  const st = leesStijlen(stFile ? await stFile.async('string') : '');
  const rels = await relsVan(zip, 'word/_rels/document.xml.rels');

  // media als blob-URL's voor de voorbeeldweergave
  for (const u of baseUrls) URL.revokeObjectURL(u);
  baseUrls = [];
  const media: Record<string, string> = {};
  for (const f of Object.keys(zip.files).filter((p) => /^word\/media\//.test(p))) {
    const ext = (f.split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'].includes(ext)) continue;
    const b = await zip.file(f)!.async('blob');
    const u = URL.createObjectURL(ext === 'svg' ? new Blob([b], { type: 'image/svg+xml' }) : b);
    baseUrls.push(u);
    media[f] = u;
  }

  const d = parseXml(xml);
  const sp = alle(d, NW, 'sectPr').pop();
  const kv = async (type: 'header' | 'footer'): Promise<Record<string, Deel>> => {
    const out: Record<string, Deel> = {};
    if (!sp) return out;
    for (const r of kids(sp, NW, type + 'Reference')) {
      const t = rels[r.getAttributeNS(NR, 'id') || ''];
      if (!t) continue;
      const p = 'word/' + t.target;
      const f = zip.file(p);
      if (!f) continue;
      out[wv(r, 'type') || 'default'] = {
        xml: await f.async('string'),
        rels: await relsVan(zip, 'word/_rels/' + t.target.split('/').pop() + '.rels'),
      };
    }
    return out;
  };
  return { naam, xml, st, rels, media, hdr: await kv('header'), ftr: await kv('footer') };
}

export class ExportFout extends Error {}

/**
 * Schrijft het aangevulde document weg. Controleert eerst dat alle originele
 * onderdelen ongewijzigd en in dezelfde volgorde in het resultaat staan.
 */
export async function maakDocx(buf: ArrayBuffer, origXml: string, res: Opbouw): Promise<{ blob: Blob; onderdelen: number }> {
  const zip = await JSZip.loadAsync(buf);
  const ser = new XMLSerializer();
  const org = parseXml(origXml);
  const A = kids(bodyVan(org), NW, null).map((n) => ser.serializeToString(n));
  const Bn = kids(bodyVan(res.doc), NW, null).map((n) => ser.serializeToString(n));
  let k = 0;
  let mis = 0;
  for (const x of A) {
    const j = Bn.indexOf(x, k);
    if (j < 0) mis++;
    else k = j + 1;
  }
  if (mis) throw new ExportFout(`Gestopt: ${mis} originele onderdelen zouden wijzigen`);

  zip.file('word/document.xml', ser.serializeToString(res.doc));
  const relP = 'word/_rels/document.xml.rels';
  const rd = parseXml(await zip.file(relP)!.async('string'));
  const ctP = '[Content_Types].xml';
  const cd = parseXml(await zip.file(ctP)!.async('string'));
  const defs = new Set(alle(cd, NCT, 'Default').map((d) => (d.getAttribute('Extension') || '').toLowerCase()));
  for (const [id, r] of Object.entries(res.nieuweRels)) {
    zip.file('word/' + r.pad, b64ToBytes(r.b64));
    const e = rd.createElementNS(NPR, 'Relationship');
    e.setAttribute('Id', id);
    e.setAttribute('Type', r.reltype);
    e.setAttribute('Target', r.pad);
    rd.documentElement.appendChild(e);
    const ext = r.ext.toLowerCase();
    if (/^image\//.test(r.ctype) && !defs.has(ext)) {
      const d = cd.createElementNS(NCT, 'Default');
      d.setAttribute('Extension', ext);
      d.setAttribute('ContentType', r.ctype);
      cd.documentElement.insertBefore(d, cd.documentElement.firstChild);
      defs.add(ext);
    } else if (!/^image\//.test(r.ctype)) {
      const o = cd.createElementNS(NCT, 'Override');
      o.setAttribute('PartName', '/word/' + r.pad);
      o.setAttribute('ContentType', r.ctype);
      cd.documentElement.appendChild(o);
    }
  }
  zip.file(relP, ser.serializeToString(rd));
  zip.file(ctP, ser.serializeToString(cd));
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
  return { blob, onderdelen: A.length };
}
```

## `web/src/syntess/pipelineLink.ts`

```typescript
/* Koppeling offerte-tool -> pipeline: elke offerte loopt mee als dossier. */
import { FASE, OPEN } from '../lib/constants';
import { bewaar, getData } from '../lib/dataStore';
import { getMe } from '../lib/session';
import type { FaseId, Lead, SyntessOfferte } from '../lib/types';
import { eur, kloon, nid, norm, plusDagen, vandaag } from '../lib/utils';
import { alleTeksten } from './analyse';
import { nrm } from './ooxml';

export interface OfferteGegevens {
  klant: string;
  contact: string;
  plaats: string;
  ref: string;
  datum: string;
  betreft: string;
  waarde: number;
  eigenaar: string;
}

export function offerteGegevens(doc: Document): OfferteGegevens {
  const T = alleTeksten(doc);
  const j = T.join(' ');
  const ti = T.findIndex((t) => /^t\.?a\.?v\.?\s/i.test(t));
  const klant = ti > 0 ? T[ti - 1] : '';
  const contact =
    ti >= 0
      ? T[ti]
          .replace(/^t\.?a\.?v\.?\s*/i, '')
          .replace(/^(de heer|mevrouw|dhr\.?|mevr\.?)\s+/i, '')
          .trim()
      : '';
  const pc = ti >= 0 ? T.slice(ti + 1, ti + 4).find((t) => /^\d{4}\s?[A-Z]{2}\b/.test(t)) : '';
  const plaats = pc ? pc.replace(/^\d{4}\s?[A-Z]{2}\s*/, '').trim() : '';
  const ref = (j.match(/TD\d{6}[.-]\d+[A-Z]?/) || [''])[0];
  const dm = j.match(/[A-Z][a-zë-]+,\s*(\d{1,2})-(\d{1,2})-(\d{4})/);
  const datum = dm ? `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` : '';
  const lm = T.findIndex((t) => /levering en montage van;\s*$/.test(t));
  const betreft = lm >= 0 ? T[lm + 1] || '' : '';
  const bedragNa = (re: RegExp): number | null => {
    const i = T.findIndex((t) => re.test(nrm(t)));
    if (i < 0) return null;
    for (const t of T.slice(i, i + 3)) {
      const m = t.replace(/\s+/g, ' ').match(/€\s*([\d.]+),(\d{2}|-)/);
      if (m) return +(m[1].replace(/\./g, '') + (m[2] === '-' ? '' : '.' + m[2]));
    }
    return null;
  };
  const waarde = bedragNa(/^speciale projectprijs/) ?? bedragNa(/^totaalprijs voor het leveren/) ?? bedragNa(/^totale investering/) ?? 0;
  const g = T.findIndex((t) => /^met vriendelijke groet/i.test(t));
  const sig = g >= 0 ? T.slice(g + 1, g + 7) : [];
  const pl = sig.find((t) => !t.includes('@') && !/^(mob|tel|miltech)/i.test(t)) || '';
  const voor = pl.split(/\s+/)[0] || '';
  const eigenaar = getData().team.find((x) => nrm(x) === nrm(voor)) || getMe() || '';
  return { klant, contact, plaats, ref, datum, betreft, waarde, eigenaar };
}

function zoekLeadVoor(g: OfferteGegevens): Lead | null {
  const leads = getData().leads;
  const r = (x?: string) => String(x || '').replace(/^TD/i, '');
  return (
    (g.ref && leads.find((x) => r(x.offertenr) === r(g.ref))) ||
    (g.klant && leads.find((x) => OPEN.includes(x.fase) && norm(x.bedrijf) === norm(g.klant))) ||
    null
  );
}

export type PipelineActie = 'upload' | 'export' | 'verstuurd';

/** Maakt of werkt het dossier bij. Geeft het lead-id terug (of null). */
export async function syPipeline(c: SyntessOfferte, doc: Document, actie: PipelineActie): Promise<string | null> {
  const g = offerteGegevens(doc);
  const leads = getData().leads;
  let l = c.leadId ? leads.find((x) => x.id === c.leadId) || null : null;
  if (!l) l = zoekLeadVoor(g);
  const nu = vandaag();
  const w = getMe();
  const vroeg: FaseId[] = ['lead', 'aanvraag', 'bezoek'];
  let n: Omit<Lead, 'id'>;
  if (l) {
    const k = kloon(l) as Partial<Lead>;
    delete k.id;
    n = k as Omit<Lead, 'id'>;
  } else {
    n = {
      fase: 'aanvraag',
      bedrijf: g.klant || c.naam,
      contact: g.contact,
      plaats: g.plaats,
      email: '',
      tel: '',
      omschrijving: g.betreft,
      sector: '',
      eigenaar: g.eigenaar,
      waarde: 0,
      kans: FASE.aanvraag.p,
      offertenr: '',
      bron: 'Syntess',
      volgendeActie: '',
      volgendeDatum: '',
      aangemaakt: nu,
      log: [{ d: nu, t: `Dossier aangemaakt vanuit offerte ${g.ref || c.bestand} (offerte-tool)`, w }],
    };
  }
  n.log = n.log || [];
  n.syntessId = c.id;
  if (g.ref) n.offertenr = g.ref;
  if (g.waarde) n.waarde = Math.round(g.waarde);
  if (!n.contact && g.contact) n.contact = g.contact;
  if (!n.plaats && g.plaats) n.plaats = g.plaats;
  if (!n.eigenaar && g.eigenaar) n.eigenaar = g.eigenaar;
  if (!n.omschrijving) n.omschrijving = g.betreft;
  if (actie === 'upload') {
    if (vroeg.includes(n.fase)) {
      if (n.fase === 'lead') {
        n.fase = 'aanvraag';
        n.kans = Math.max(+(n.kans ?? 0) || 0, FASE.aanvraag.p);
      }
      n.volgendeActie = 'Offerte afmaken in de offerte-tool';
      n.volgendeDatum = plusDagen(2);
    }
    if (l) n.log.push({ d: nu, t: `Offerte ${g.ref || ''} uit Syntess geüpload in de offerte-tool`, w });
  }
  if (actie === 'export') n.log.push({ d: nu, t: `Offerte ${g.ref || ''} aangevuld in huisstijl, Word gedownload`, w });
  if (actie === 'verstuurd') {
    if (vroeg.includes(n.fase)) n.fase = 'offerte';
    n.kans = Math.max(+(n.kans ?? 0) || 0, FASE.offerte.p);
    n.offerteDatum = g.datum || nu;
    n.log.push({ d: nu, t: `Offerte ${g.ref || ''} verstuurd: ${eur(n.waarde)} excl. btw`, w });
    n.volgendeActie = 'Offerte nabellen';
    n.volgendeDatum = plusDagen(7);
  }
  if (OPEN.includes(n.fase)) delete n.gesloten;
  n.gewijzigd = new Date().toISOString();
  const id = l ? l.id : nid('l');
  return (await bewaar('leads', id, n)) ? id : null;
}
```

## `web/src/syntess/syStore.ts`

```typescript
/* Toestand en acties van "Offerte uit Syntess". */
import { useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import { aiFout, sampleJson, type Turn } from '../lib/claude';
import { CONTEXT } from '../lib/constants';
import { abonneer, bewaar, bewaarConfig, bijUpdate, getData } from '../lib/dataStore';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { BibliotheekMeta, Kennis, SyntessOfferte } from '../lib/types';
import { downloadBlob, kloon, nid } from '../lib/utils';
import { alleTeksten, controlePunten, gegevens } from './analyse';
import { bouw } from './build';
import { ExportFout, leesBasis, maakDocx } from './docx';
import { bibliotheek, type Bibliotheek, type LibEntry } from './library';
import { NW, bodyVan, kids, nrm, ptekst } from './ooxml';
import { syPipeline, type PipelineActie } from './pipelineLink';
import { ruimVoorbeeldOp } from './preview';
import type { Basis, Opbouw } from './types';

export type SyMenu = 'vragen' | 'artikelen' | 'inleiding' | 'controle';

export interface SyState {
  bib: Bibliotheek | null;
  bibBusy: boolean;
  bibErr: string;
  cur: SyntessOfferte | null;
  buf: ArrayBuffer | null;
  base: Basis | null;
  res: Opbouw | null;
  busy: boolean;
  chatBusy: boolean;
  marks: boolean;
  zoom: number;
  fout: string;
  expBusy: boolean;
  sel: string | null;
  menu: SyMenu;
  versie: number;
}

let SY: SyState = {
  bib: null,
  bibBusy: false,
  bibErr: '',
  cur: null,
  buf: null,
  base: null,
  res: null,
  busy: false,
  chatBusy: false,
  marks: true,
  zoom: 0.72,
  fout: '',
  expBusy: false,
  sel: null,
  menu: 'vragen',
  versie: 0,
};

const luisteraars = new Set<() => void>();

/** Past de toestand aan en tekent opnieuw. */
export function zetSy(p: Partial<SyState>): void {
  SY = { ...SY, ...p, versie: SY.versie + 1 };
  luisteraars.forEach((l) => l());
}

export function getSy(): SyState {
  return SY;
}

export function useSy(): SyState {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => SY,
  );
}

export function lib(): LibEntry[] {
  return bibliotheek(SY.bib, getData().kennis);
}

/** Bouwt het voorbeelddocument opnieuw op (met markeringen). */
export function herbouw(): void {
  const res = SY.cur && SY.base ? bouw(SY.base, SY.cur, lib(), SY.bib, true) : null;
  zetSy({ res });
}

function nieuweSy(naam: string, assetId: string): SyntessOfferte {
  const nu = new Date().toISOString();
  return {
    id: nid('sy'),
    naam,
    bestand: naam,
    assetId: assetId || '',
    keuzes: {},
    eigen: {},
    inleiding: '',
    chat: [],
    opties: [],
    gezien: {},
    status: 'concept',
    door: getMe(),
    aangemaakt: nu,
    gewijzigd: nu,
  };
}

let syTimer: ReturnType<typeof setTimeout> | undefined;

/** Markeert de huidige offerte als gewijzigd en bewaart na 0,8 s. */
export function syGewijzigd(): void {
  const c = SY.cur;
  if (!c) return;
  c.gewijzigd = new Date().toISOString();
  clearTimeout(syTimer);
  syTimer = setTimeout(() => void syBewaar(), 800);
  zetSy({});
}

export async function syBewaar(): Promise<void> {
  const c = SY.cur;
  clearTimeout(syTimer);
  if (!c) return;
  const d = kloon(c) as Partial<SyntessOfferte>;
  d.chat = (d.chat || []).slice(-50);
  if (SY.res) {
    const g = gegevens(SY.res.doc, c.bestand);
    d.samenvatting = {
      artikelen: SY.res.arts.length,
      aangevuld: SY.res.rap.ingevoegd.length,
      ref: (g.find((x) => x[1] === 'Ref. Nr.') || [])[2] || '',
      klant: ((g.find((x) => x[1] === 'Klant') || [])[2] || '').split(' · ')[0],
    };
    c.samenvatting = d.samenvatting;
  }
  delete d.id;
  await bewaar('syntess', c.id, d);
}

async function koppel(c: SyntessOfferte, actie: PipelineActie): Promise<string | null> {
  if (!SY.res) return null;
  const id = await syPipeline(c, SY.res.doc, actie);
  if (id) {
    c.leadId = id;
    syGewijzigd();
  }
  return id;
}

export async function syUpload(file: File | undefined, bestaand: boolean): Promise<void> {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) {
    toast('Kies een .docx-bestand');
    return;
  }
  zetSy({ busy: true, fout: '' });
  try {
    const buf = await file.arrayBuffer();
    ruimVoorbeeldOp();
    const base = await leesBasis(buf, file.name);
    let assetId = '';
    try {
      const r = await api.upload(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      );
      assetId = r.id;
    } catch {
      toast('Word-bestand alleen in deze weergave (opslaan op de server lukte niet)');
    }
    let cur: SyntessOfferte;
    if (bestaand && SY.cur) {
      cur = SY.cur;
      cur.assetId = assetId || cur.assetId;
      cur.bestand = file.name;
    } else {
      cur = nieuweSy(file.name.replace(/\.docx$/i, ''), assetId);
      cur.bestand = file.name;
    }
    zetSy({ buf, base, cur, menu: bestaand ? SY.menu : 'vragen', sel: null });
    herbouw();
    await syBewaar();
    if (!bestaand) {
      const id = await koppel(cur, 'upload');
      if (id) toast('Offerte staat in de pipeline');
    }
  } catch {
    zetSy({ fout: 'Dit Word-bestand kon niet worden gelezen', cur: bestaand ? SY.cur : null });
  }
  zetSy({ busy: false });
  window.scrollTo({ top: 0 });
}

export async function syOpen(x: SyntessOfferte): Promise<void> {
  const cur = kloon(x);
  cur.keuzes = cur.keuzes || {};
  cur.eigen = cur.eigen || {};
  cur.chat = cur.chat || [];
  cur.opties = cur.opties || [];
  cur.gezien = cur.gezien || {};
  zetSy({ cur, base: null, res: null, buf: null, menu: 'vragen', sel: null, fout: '' });
  if (!x.assetId) return;
  zetSy({ busy: true });
  try {
    const buf = await (await api.asset(x.assetId)).arrayBuffer();
    ruimVoorbeeldOp();
    const base = await leesBasis(buf, x.bestand);
    zetSy({ buf, base });
    herbouw();
  } catch {
    toast('Word-bestand kon niet worden opgehaald');
  }
  zetSy({ busy: false });
}

export async function openSyntessOfferte(id: string): Promise<void> {
  const x = getData().syntess.find((y) => y.id === id);
  if (x) await syOpen(x);
}

export async function sySluit(): Promise<void> {
  await syBewaar();
  ruimVoorbeeldOp();
  zetSy({ cur: null, base: null, res: null, buf: null, sel: null });
}

export async function syKoppel(): Promise<void> {
  if (SY.cur && (await koppel(SY.cur, 'upload'))) toast('Offerte staat in de pipeline');
}

export async function syZetStatus(status: SyntessOfferte['status']): Promise<void> {
  const c = SY.cur;
  if (!c) return;
  c.status = status;
  syGewijzigd();
  if (status === 'verstuurd' && (await koppel(c, 'verstuurd'))) toast('Pipeline bijgewerkt: offerte uit');
}

/* ---------- export naar Word ---------- */

export async function syExport(): Promise<void> {
  const c = SY.cur;
  if (!c || !SY.buf || !SY.base) return;
  zetSy({ expBusy: true });
  try {
    const res = bouw(SY.base, c, lib(), SY.bib, false);
    const { blob, onderdelen } = await maakDocx(SY.buf, SY.base.xml, res);
    const naam =
      String(c.bestand || 'offerte.docx')
        .replace(/\.docx$/i, '')
        .replace(/\s*input document uit calculatie/i, '') + ' (aangevuld).docx';
    downloadBlob(naam, blob);
    toast(`Word bewaard · ${onderdelen}/${onderdelen} originele onderdelen ongewijzigd`);
    if (c.status === 'concept') {
      c.status = 'klaar';
      syGewijzigd();
    }
    await koppel(c, 'export');
  } catch (e) {
    toast(e instanceof ExportFout ? e.message : 'Word maken lukte niet: ' + (e instanceof Error ? e.message : String(e)));
  }
  zetSy({ expBusy: false });
}

/* ---------- Claude-assistent ---------- */

function kennisTekst(): string {
  const K: Kennis = getData().kennis || {};
  const cut = (s: string | undefined, n: number) => String(s || '').slice(0, n);
  return `KENNIS UIT PROJECT "OFFERTE TOOL" (leidend):\nProject: ${cut(K.beschrijving, 600)}\n${K.instructies ? 'Instructies: ' + cut(K.instructies, 2000) + '\n' : ''}\n--- HUISSTIJL ---\n${cut(K.huisstijl, 9000)}\n\n--- WERKWIJZE ---\n${cut(K.werkwijze, 5000)}\n${K.extra ? '\n--- OVERIGE PROJECTDOCUMENTEN ---\n' + cut(K.extra, 6000) : ''}`;
}

function staatVoorClaude() {
  const c = SY.cur!;
  const res = SY.res;
  const L = lib();
  const so = res ? kids(bodyVan(res.doc), NW, 'p').findIndex((p) => nrm(ptekst(p)).startsWith('systeemomschrijving')) : -1;
  const T = res ? alleTeksten(res.doc) : [];
  return {
    bestand: c.bestand,
    begin_offerte: T.slice(0, 40).join(' | ').slice(0, 2500),
    artikelen: res
      ? res.arts.map((a, i) => ({
          nr: i,
          regel: a.regel,
          status: a.s.st,
          bibliotheek: a.s.e ? a.s.e.name : null,
          info: a.s.info,
          eigenTekstInSyntess: a.txt
            ? a.blok
                .map((x) => ptekst(x).trim())
                .filter(Boolean)
                .join(' / ')
                .slice(0, 300)
            : '',
        }))
      : [],
    bibliotheek_artikelen: L.filter((e) => e.kind !== 'media').map((e) => e.name),
    bibliotheek_afbeeldingen: L.filter((e) => e.kind === 'media').map((e) => e.name + ': ' + (e.omschrijving || '')),
    systeemomschrijving_gevonden: so >= 0,
    inleiding_nu: c.inleiding || '',
    controle: controlePunten(res?.doc, c.bestand)
      .map((x) => x.join(' · '))
      .slice(0, 40),
  };
}

const SY_INSTR = `Je helpt een verkoper van Miltech een offerte af te maken die als Word-export uit het calculatieprogramma Syntess komt. Je werkt in een interactief menu naast een voorbeeldweergave.
Harde regels:
- Wat Syntess aanlevert (klant, adres, datum, Ref. Nr., projectleider, prijzen, condities, artikelregels en bestaande teksten) wordt NIET gewijzigd. Fouten daarin meld je alleen.
- Productteksten verzin je nooit. Artikelen vul je alleen aan door een bibliotheekartikel te kiezen (exacte naam uit bibliotheek_artikelen) of "leeg". Past niets, zeg dat dan en vraag of de verkoper zelf tekst wil typen.
- Alleen de inleiding onder Systeemomschrijving schrijf jij, in de opbouw van de huisstijl (intro-zin "In deze offerte treft u een ... aan t.b.v. onderstaande posities:", positietabel, capaciteit, opstelling, besturing, eventueel [[Systeemomschrijving N]] voor een afbeelding). Gebruik alleen gegevens uit de offerte en uit wat de verkoper zegt. Onbekend = **[gegeven]**; keuzes = **optie A / optie B**.
- Inleiding-syntax: elke regel een alinea, lege regel = witregel, tabel als | a | b | regels met kopregel en |---| scheidingsregel, **vet**, *cursief*, [[naam]] afbeelding, ---pagina--- nieuwe pagina.
- Stel per bericht één of twee korte concrete vragen en geef 2 tot 5 antwoordopties. Controleer jezelf op onjuistheden (eenheden, kW/W, tegenstrijdige typenummers, aantallen die niet kloppen met de positietabel).
Antwoord uitsluitend als JSON: {"bericht":"tekst aan de verkoper","opties":["..."],"inleiding":"VOLLEDIGE nieuwe inleiding of null als die niet verandert","keuzes":{"<artikelnr>":"leeg" | "auto" | "lib:<exacte bibliotheeknaam>"} of null,"menu":"vragen"|"artikelen"|"inleiding"|"controle"|null}`;

interface ChatAntwoord {
  bericht?: string;
  opties?: unknown[];
  inleiding?: string | null;
  keuzes?: Record<string, string> | null;
  menu?: string | null;
}

export async function syChat(tekst: string): Promise<void> {
  const c = SY.cur;
  if (!c || !getData().claude || SY.chatBusy) return;
  if (tekst) c.chat.push({ r: 'u', t: tekst });
  c.opties = [];
  zetSy({ chatBusy: true, menu: 'vragen' });
  const turns: Turn[] = [{ role: 'user', content: `${CONTEXT}\n\n${SY_INSTR}\n\n${kennisTekst()}\n\nBegin of ga verder met het gesprek.` }];
  for (const m of c.chat) {
    if (m.r === 'c') turns.push({ role: 'assistant', content: m.t });
    else if (turns[turns.length - 1].role === 'user') turns[turns.length - 1].content += '\n\nVerkoper: ' + m.t;
    else turns.push({ role: 'user', content: 'Verkoper: ' + m.t });
  }
  if (turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', content: 'Ga verder.' });
  turns[turns.length - 1].content += `\n\n[Huidige stand van de offerte: ${JSON.stringify(staatVoorClaude())}]\nAntwoord als JSON volgens het schema.`;
  try {
    const j = await sampleJson<ChatAntwoord>(turns);
    if (SY.cur && SY.cur.id === c.id) {
      const w: string[] = [];
      if (j && typeof j.inleiding === 'string' && j.inleiding.trim() && j.inleiding !== c.inleiding) {
        c.inleiding = j.inleiding.replace(/\r/g, '');
        w.push('Systeemomschrijving bijgewerkt');
      }
      if (j && j.keuzes && typeof j.keuzes === 'object') {
        const L = lib();
        let n = 0;
        for (const [k, v] of Object.entries(j.keuzes)) {
          const i = +k;
          if (!SY.res || !SY.res.arts[i]) continue;
          const val = String(v);
          if (val === 'leeg' || val === 'auto' || (val.startsWith('lib:') && L.some((e) => e.name === val.slice(4)))) {
            c.keuzes[i] = val;
            n++;
          }
        }
        if (n) w.push(n + ' artikelkeuze' + (n === 1 ? '' : 's') + ' aangepast');
      }
      c.chat.push({ r: 'c', t: String(j?.bericht || 'Wat wil je nog aanvullen?'), wijz: w.join(' · ') });
      c.opties = Array.isArray(j?.opties) ? j.opties.map(String).slice(0, 5) : [];
    }
  } catch (e) {
    c.chat.push({ r: 'c', t: aiFout(e) });
  }
  zetSy({ chatBusy: false });
  herbouw();
  syGewijzigd();
}

/* ---------- kennis en bibliotheek ---------- */

let geladenBib = '';

export async function laadBibliotheek(m: BibliotheekMeta | null): Promise<void> {
  if (!m || !m.assetId || SY.bibBusy || geladenBib === m.assetId) return;
  zetSy({ bibBusy: true, bibErr: '' });
  try {
    let kern: Bibliotheek;
    if (m.kernId) {
      const [k, ...shards] = await Promise.all([
        api.assetJson<Bibliotheek>(m.kernId),
        ...(m.mediaIds || []).map((id) => api.assetJson<Record<string, string>>(id)),
      ]);
      const media: Record<string, string> = Object.assign({}, ...shards);
      const fix = (o: Record<string, unknown>, key: string) => {
        const v = o[key];
        if (typeof v === 'string' && v.startsWith('@m:')) o[key] = media[v.slice(3)] || '';
      };
      for (const e of k.entries)
        for (const b of e.blocks) {
          if (b.type === 'img') fix(b as unknown as Record<string, unknown>, 'b64');
          if (b.type === 'media' || b.type === 'element')
            for (const p of Object.values(b.parts || {})) fix(p as unknown as Record<string, unknown>, 'b64');
        }
      kern = k;
    } else kern = await api.assetJson<Bibliotheek>(m.assetId);
    if (!Array.isArray(kern.entries)) throw new Error('geen entries');
    kern.__id = m.assetId;
    geladenBib = m.assetId;
    zetSy({ bib: kern });
  } catch {
    zetSy({ bibErr: 'Bibliotheek niet geladen' });
  }
  zetSy({ bibBusy: false });
  if (SY.cur) herbouw();
}

/** Importeert kennis (JSON) of standaardteksten (Markdown) uit het project Offerte Tool. */
export async function importeerKennis(file: File | undefined): Promise<void> {
  if (!file) return;
  try {
    const tekst = await file.text();
    const nu = new Date().toISOString();
    let k: Kennis;
    if (/\.md$/i.test(file.name)) {
      k = { ...(getData().kennis || {}), standaardteksten: tekst, gesynchroniseerd: nu };
    } else {
      const j = JSON.parse(tekst) as Kennis;
      if (!j || typeof j !== 'object') throw new Error('ongeldig');
      const toegestaan: (keyof Kennis)[] = ['beschrijving', 'instructies', 'huisstijl', 'werkwijze', 'extra', 'standaardteksten'];
      k = { gesynchroniseerd: nu };
      for (const key of toegestaan) if (typeof j[key] === 'string') k[key] = j[key];
    }
    if (await bewaarConfig('kennis', k)) {
      toast('Kennis geïmporteerd');
      if (SY.cur) herbouw();
    }
  } catch {
    toast('Dit kennisbestand kon niet worden gelezen');
  }
}

/** Importeert de artikelbibliotheek (JSON met entries) en zet hem in de gedeelde opslag. */
export async function importeerBibliotheek(file: File | undefined): Promise<void> {
  if (!file) return;
  try {
    const tekst = await file.text();
    const j = JSON.parse(tekst) as Bibliotheek;
    if (!j || !Array.isArray(j.entries)) throw new Error('geen entries');
    const r = await api.upload(new Blob([tekst], { type: 'application/json' }));
    if (await bewaarConfig('bibliotheek', { assetId: r.id, naam: file.name, geimporteerd: new Date().toISOString() })) {
      toast(`Bibliotheek geïmporteerd · ${j.entries.length} items`);
    }
  } catch {
    toast('Dit bibliotheekbestand kon niet worden gelezen (verwacht JSON met "entries")');
  }
}

/* ---------- koppeling met de gedeelde gegevens ---------- */

function sySnapshot() {
  if (!SY.cur) return;
  const r = getData().syntess.find((x) => x.id === SY.cur!.id);
  const ae = document.activeElement;
  const bezigMetTypen = !!ae && !!ae.closest('#sy-pages,#sy-inl,textarea');
  if (r && String(r.gewijzigd) > String(SY.cur.gewijzigd) && !SY.chatBusy && !bezigMetTypen) {
    const cur = kloon(r);
    cur.keuzes = cur.keuzes || {};
    cur.eigen = cur.eigen || {};
    cur.chat = cur.chat || [];
    cur.opties = cur.opties || [];
    cur.gezien = cur.gezien || {};
    zetSy({ cur });
    herbouw();
  }
}

let gestart = false;

export function startSyntessKoppeling(): void {
  if (gestart) return;
  gestart = true;
  let bibMeta = getData().bibliotheek;
  let kennis = getData().kennis;
  abonneer(() => {
    const d = getData();
    if (d.bibliotheek !== bibMeta) {
      bibMeta = d.bibliotheek;
      void laadBibliotheek(bibMeta);
    }
    if (d.kennis !== kennis) {
      kennis = d.kennis;
      if (SY.cur) herbouw();
    }
  });
  bijUpdate('syntess', sySnapshot);
}
```

## `web/src/syntess/SyntessView.tsx`

```tsx
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Spark, Spin } from '../components/Spark';
import { faseVan } from '../lib/constants';
import { useData } from '../lib/dataStore';
import { toast } from '../lib/toast';
import type { SyntessOfferte } from '../lib/types';
import { openLade } from '../lib/ui';
import { eurK } from '../lib/utils';
import { ST_INFO, controlePunten } from './analyse';
import { tekenVoorbeeld } from './preview';
import {
  herbouw,
  importeerBibliotheek,
  importeerKennis,
  lib,
  syChat,
  syExport,
  syGewijzigd,
  syKoppel,
  syOpen,
  sySluit,
  syUpload,
  syZetStatus,
  useSy,
  zetSy,
  getSy,
  type SyMenu,
} from './syStore';

const START = [
  'Loop de offerte met me door',
  'Stel de systeemomschrijving voor',
  'Welke artikelen missen nog iets?',
  'Controleer de offerte op onjuistheden',
];
const START_VOLLEDIG = [
  'Loop de offerte met me door: wat ontbreekt er nog en wat moet ik nakijken?',
  'Stel de systeemomschrijving voor op basis van de artikelen en vraag wat je mist.',
  'Welke artikelen missen nog tekst of een afbeelding, en wat stel je voor?',
  'Controleer de hele offerte inhoudelijk op onjuistheden en tegenstrijdigheden. Meld alleen, wijzig niets aan wat Syntess aanlevert.',
];

function Kennisregel() {
  const d = useData();
  const sy = useSy();
  const L = lib();
  const nArt = L.filter((e) => e.kind !== 'media').length;
  const nMed = L.filter((e) => e.kind === 'media').length;
  const K = d.kennis;
  return (
    <div className="row" style={{ gap: 8 }}>
      {K ? (
        <span className="chip ok">
          Project “Offerte Tool” · gesynchroniseerd{' '}
          {K.gesynchroniseerd
            ? new Date(K.gesynchroniseerd).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : ''}
        </span>
      ) : (
        <span className="chip today">Nog geen kennis uit het project</span>
      )}
      <span className="chip">{nArt} artikelen in bibliotheek</span>
      <span className="chip">{nMed} afbeeldingen/tekeningen</span>
      {sy.bibBusy && (
        <span className="chip">
          <Spin /> bibliotheek laden…
        </span>
      )}
      {sy.bibErr && <span className="chip late">{sy.bibErr}</span>}
    </div>
  );
}

function LeadChip({ leadId }: { leadId?: string }) {
  const d = useData();
  const l = leadId ? d.leads.find((y) => y.id === leadId) : null;
  if (!l) return null;
  const f = faseVan(l.fase);
  return (
    <span className="chip">
      <i style={{ background: f.k }} />
      {f.n}
    </span>
  );
}

function Startpagina() {
  const d = useData();
  const sy = useSy();
  const lijst = d.syntess.slice().sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="card stack" style={{ gap: 14 }}>
        <div>
          <h2>Offerte maken uit een Syntess-calculatie</h2>
          <div className="sub">
            Upload de Word-export uit Syntess. Per artikelregel worden de standaardtekst en afbeelding aangevuld, Claude stelt de
            systeemomschrijving voor en de tool controleert klant, datum en projectleider. Wat Syntess aanlevert blijft ongewijzigd.
          </div>
        </div>
        <Kennisregel />
        <div className="row">
          <label className="btn pri file-btn">
            Upload Syntess-export (.docx)
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                void syUpload(e.target.files?.[0], false);
                e.target.value = '';
              }}
            />
          </label>
          {sy.busy && (
            <span className="sub" style={{ margin: 0 }}>
              <Spin /> Inlezen…
            </span>
          )}
          {sy.fout && <span className="chip late">{sy.fout}</span>}
        </div>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <div>
          <h2>Kennis en bibliotheek</h2>
          <div className="sub">
            De kennis komt uit het project <b className="soft">Offerte Tool</b>: huisstijl, werkwijze, standaardteksten en de bibliotheek
            met afbeeldingen. Importeer de export hier; het hele team gebruikt daarna dezelfde versie.
          </div>
        </div>
        <div className="row">
          <label className="btn file-btn">
            Importeer kennis (.json of Standaardteksten.md)
            <input
              type="file"
              accept=".json,.md,application/json,text/markdown"
              onChange={(e) => {
                void importeerKennis(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <label className="btn file-btn">
            Importeer bibliotheek (.json)
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void importeerBibliotheek(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>Eerdere offertes</h2>
        {lijst.length ? (
          <div className="calc-list">
            {lijst.map((x) => (
              <button key={x.id} className="sec" onClick={() => void syOpen(x)}>
                <div className="h">{x.samenvatting?.klant || x.naam}</div>
                <div className="e">
                  {x.samenvatting?.ref || ''} · {x.bestand || ''}
                </div>
                <div className="n">
                  <span className={'chip ' + (x.status === 'klaar' ? 'ok' : '')}>{x.status || 'concept'}</span>
                  {x.samenvatting && (
                    <span className="chip">
                      {x.samenvatting.aangevuld}/{x.samenvatting.artikelen} aangevuld
                    </span>
                  )}
                  <LeadChip leadId={x.leadId} />
                  {x.door && <span className="chip">{x.door}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">Nog geen offertes uit Syntess.</div>
        )}
      </section>
    </div>
  );
}

function Kop({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const res = sy.res;
  const l = c.leadId ? d.leads.find((x) => x.id === c.leadId) : null;
  const f = l ? faseVan(l.fase) : null;
  return (
    <div className="row between">
      <div className="row" style={{ gap: 12 }}>
        <button className="btn ghost sm" onClick={() => void sySluit()}>
          ← Alle offertes
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{c.naam}</div>
          <div className="sub" style={{ margin: 0 }}>
            {res ? `${res.rap.ingevoegd.length} van ${res.arts.length} artikelen aangevuld` : ''}
            {sy.base ? '' : ' · Word-bestand nog niet geladen'}
          </div>
        </div>
      </div>
      <div className="row">
        {l && f ? (
          <button
            className="chip"
            title="Open dossier in de pipeline"
            style={{ border: 'none', cursor: 'pointer', padding: '6px 11px' }}
            onClick={() => openLade(l)}
          >
            <i style={{ background: f.k }} />
            Pipeline · {l.bedrijf} · {f.n}
            {l.waarde ? ' · ' + eurK(l.waarde) : ''}
          </button>
        ) : res ? (
          <button className="btn sm" onClick={() => void syKoppel()}>
            + Zet in pipeline
          </button>
        ) : null}
        {c.status !== 'verstuurd' && res && (
          <button className="btn sm" onClick={() => void syZetStatus('verstuurd')}>
            Markeer als verstuurd
          </button>
        )}
        <select
          className="input"
          style={{ width: 'auto' }}
          aria-label="Status"
          value={c.status}
          onChange={(e) => void syZetStatus(e.target.value as SyntessOfferte['status'])}
        >
          {['concept', 'klaar', 'verstuurd'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn pri" disabled={!res || sy.expBusy} onClick={() => void syExport()}>
          {sy.expBusy && <Spin />}Download Word
        </button>
      </div>
    </div>
  );
}

function Chat({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const res = sy.res;
  const [tekst, setTekst] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLTextAreaElement>(null);
  const open = res ? res.arts.filter((a) => ['onbekend', 'twijfel'].includes(a.s.st)).length : 0;
  const lo = controlePunten(res?.doc, c.bestand).filter((x) => x[0] === 'LET OP').length;

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [c.chat.length, sy.chatBusy]);

  useEffect(() => {
    if (!sy.chatBusy) inRef.current?.focus();
  }, [sy.chatBusy]);

  function stuur() {
    const t = tekst.trim();
    if (!t || sy.chatBusy) return;
    setTekst('');
    void syChat(t);
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <Spark />
        <b>Claude-assistent</b>
        <span className="sub" style={{ margin: 0 }}>
          vraagt door, vult aan en controleert · {open} open artikel{open === 1 ? '' : 'en'} · {lo} aandachtspunt{lo === 1 ? '' : 'en'}
        </span>
      </div>
      {d.claude ? (
        <>
          <div className="chat" ref={chatRef}>
            {c.chat.length ? (
              c.chat.map((m, i) => (
                <div key={i} className={'msg ' + (m.r === 'u' ? 'u' : 'c')}>
                  {m.t}
                  {m.wijz && (
                    <div className="sub" style={{ marginTop: 6, color: '#c9c2ff' }}>
                      {m.wijz}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="sub">
                Kies hieronder waar je wilt beginnen, of typ je vraag of aanvulling. Claude gebruikt de huisstijl en werkwijze uit het
                project Offerte Tool en verzint geen productteksten.
              </div>
            )}
            {sy.chatBusy && (
              <div className="msg c">
                <Spin /> Claude denkt na…
              </div>
            )}
          </div>
          {!sy.chatBusy && c.opties && c.opties.length > 0 ? (
            <div className="opts">
              {c.opties.map((o, i) => (
                <button key={i} onClick={() => void syChat(o)}>
                  {o}
                </button>
              ))}
            </div>
          ) : !c.chat.length ? (
            <div className="opts">
              {START.map((o, i) => (
                <button key={i} onClick={() => void syChat(START_VOLLEDIG[i])}>
                  {o}
                </button>
              ))}
            </div>
          ) : null}
          <div className="composer">
            <textarea
              ref={inRef}
              className="input"
              rows={2}
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  stuur();
                }
              }}
              placeholder="Bijv. de installatie staat binnen, capaciteit 4.000 m3/h… (Enter = versturen)"
            />
            <button className="btn pri" onClick={stuur} disabled={sy.chatBusy}>
              Stuur
            </button>
          </div>
        </>
      ) : (
        <div className="empty">
          Claude is niet ingesteld op de server (ANTHROPIC_API_KEY). De artikelen, systeemomschrijving en controle werken wel.
        </div>
      )}
    </div>
  );
}

let tEigen: ReturnType<typeof setTimeout> | undefined;
let tInl: ReturnType<typeof setTimeout> | undefined;

function Artikelen({ c }: { c: SyntessOfferte }) {
  const sy = useSy();
  const res = sy.res;
  if (!res) return null;
  const opties = lib()
    .filter((e) => e.kind !== 'media')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  function kies(ev: MouseEvent<HTMLDivElement>, k: string) {
    if ((ev.target as HTMLElement).closest('select,textarea,option')) return;
    zetSy({ sel: k });
    requestAnimationFrame(() => {
      const el = document.querySelector(`#sy-pages [data-syk="${k}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      else toast('Voor dit artikel wordt niets ingevoegd');
    });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="sub">
        Per dikgedrukte artikelregel uit Syntess. Automatisch = exacte match uit de bibliotheek. Productteksten komen alleen uit de
        bibliotheek of van jou, nooit van Claude.
      </div>
      {res.arts.map((a, i) => {
        const s = a.s;
        const k = c.keuzes[i] || 'auto';
        const [lab, cls] = ST_INFO[s.st] || [s.st, ''];
        return (
          <div key={i} className={'sy-art' + (sy.sel === 'a' + i ? ' sel' : '')} onClick={(ev) => kies(ev, 'a' + i)}>
            <div className="row between" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <div style={{ minWidth: 0 }}>
                <div className="b" style={{ fontWeight: 700, fontSize: 13 }}>
                  {a.regel}
                </div>
                <div className="sub" style={{ margin: '2px 0 0' }}>
                  {s.e ? 'Bibliotheek: ' + s.e.name : ''}
                  {s.info ? (s.e ? ' · ' : '') + s.info : ''}
                </div>
              </div>
              <span className={'chip ' + cls}>{lab}</span>
            </div>
            {!(a.klaar || s.st === 'heeft_al_inhoud') && (
              <>
                <div className="row" style={{ marginTop: 8, gap: 8 }}>
                  <select
                    className="input"
                    style={{ flex: '1 1 220px', width: 'auto' }}
                    aria-label={'Keuze voor ' + a.regel}
                    value={k}
                    onChange={(e) => {
                      c.keuzes[i] = e.target.value;
                      herbouw();
                      syGewijzigd();
                    }}
                  >
                    <option value="auto">Automatisch</option>
                    <option value="leeg">Niets toevoegen</option>
                    {!a.txt && <option value="eigen">Eigen tekst typen</option>}
                    <optgroup label="Bibliotheek">
                      {opties.map((n) => (
                        <option key={n} value={'lib:' + n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {k === 'eigen' && (
                  <textarea
                    className="input"
                    rows={3}
                    style={{ marginTop: 8 }}
                    placeholder="Jouw tekst (regels met - worden een opsomming)"
                    value={c.eigen[i] || ''}
                    onChange={(e) => {
                      c.eigen[i] = e.target.value;
                      zetSy({});
                      clearTimeout(tEigen);
                      tEigen = setTimeout(() => {
                        herbouw();
                        syGewijzigd();
                      }, 600);
                    }}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Inleiding({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const med = lib().filter((e) => e.kind === 'media');

  function voegToe(stuk: string) {
    c.inleiding = (c.inleiding || '').replace(/\s*$/, '') + stuk;
    herbouw();
    syGewijzigd();
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="sub">
        Komt onder de kop <b className="soft">Systeemomschrijving</b>, opbouw volgens de huisstijl: intro-zin, positietabel, capaciteit,
        opstelling, besturing, foto met onderschrift. Je kunt ook direct in de voorbeeldweergave typen.
      </div>
      <div className="row" style={{ gap: 8 }}>
        {d.claude && (
          <button
            className="btn ai sm"
            disabled={sy.chatBusy}
            onClick={() => void syChat('Stel de systeemomschrijving voor op basis van de artikelen en vraag wat je mist.')}
          >
            <Spark />
            Laat Claude voorstellen
          </button>
        )}
        <button
          className="btn sm"
          onClick={() =>
            voegToe(
              '\n\n| Positie: | Aantal | Aansluitmaat | Totaal cap. [ m3/h ] |\n|---|---|---|---|\n| **[positie]** | **[aantal]** st. | Ø**[maat]**mm | **[capaciteit]** m3/h |\n',
            )
          }
        >
          + Positietabel
        </button>
        <button className="btn sm" onClick={() => voegToe('\n---pagina---\n')}>
          + Nieuwe pagina
        </button>
        {med.length > 0 && (
          <select
            className="input"
            style={{ width: 'auto', flex: '1 1 200px', maxWidth: '100%', minWidth: 0 }}
            aria-label="Afbeelding"
            value=""
            onChange={(e) => {
              if (e.target.value) voegToe('\n\n[[' + e.target.value + ']]\n');
            }}
          >
            <option value="">+ Afbeelding/tekening…</option>
            {med.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} – {m.omschrijving || ''}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        id="sy-inl"
        className="input"
        rows={14}
        style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5 }}
        placeholder="In deze offerte treft u een … aan t.b.v. onderstaande posities:"
        value={c.inleiding || ''}
        onChange={(e) => {
          c.inleiding = e.target.value;
          zetSy({});
          clearTimeout(tInl);
          tInl = setTimeout(() => {
            herbouw();
            syGewijzigd();
          }, 500);
        }}
      />
      <div className="sub">
        Syntax: elke regel = alinea · lege regel = witregel · <code>| a | b |</code> = tabel · <code>**vet**</code> = keuze ·{' '}
        <code>*cursief*</code> · <code>[[Systeemomschrijving 1]]</code> = afbeelding · <code>---pagina---</code>
      </div>
    </div>
  );
}

function Controle({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const P = controlePunten(sy.res?.doc, c.bestand);
  const g = P.filter((x) => x[0] !== 'TEKST');
  const t = P.filter((x) => x[0] === 'TEKST');
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="sub">
        Alleen controle: klantgegevens, datum, projectleider en huisstijl komen uit Syntess en worden <b className="soft">niet</b>{' '}
        aangepast. Pas fouten aan in Syntess of in Word.
      </div>
      {g.map((x, i) => {
        const key = x[1] + x[2];
        const let_op = x[0] === 'LET OP';
        return (
          <label key={i} className={'sy-ctl ' + (let_op ? 'warn' : x[0] === 'OK' ? 'ok' : '')}>
            {let_op && (
              <input
                type="checkbox"
                checked={!!c.gezien[key]}
                onChange={(e) => {
                  c.gezien[key] = e.target.checked;
                  syGewijzigd();
                }}
              />
            )}
            <span className={'chip ' + (let_op ? 'today' : x[0] === 'OK' ? 'ok' : '')}>{x[0]}</span>
            <span>
              <b>{x[1]}</b> · {x[2]}
            </span>
          </label>
        );
      })}
      <div className="lbl" style={{ marginTop: 6 }}>
        Tekstpunten ({t.length})
      </div>
      {t.length ? (
        t.map((x, i) => (
          <div key={i} className="sy-ctl">
            <span className="chip">{x[1]}</span>
            <span className="soft">{x[2]}</span>
          </div>
        ))
      ) : (
        <div className="sub">Geen tekstpunten gevonden.</div>
      )}
      {d.claude && (
        <div>
          <button className="btn ai sm" onClick={() => void syChat(START_VOLLEDIG[3])}>
            <Spark />
            Laat Claude ook inhoudelijk controleren
          </button>
        </div>
      )}
    </div>
  );
}

function Menu({ c }: { c: SyntessOfferte }) {
  const sy = useSy();
  const res = sy.res;
  const nLetOp = controlePunten(res?.doc, c.bestand).filter((x) => x[0] === 'LET OP').length;
  const nOpen = res ? res.arts.filter((a) => ['onbekend', 'twijfel'].includes(a.s.st)).length : 0;
  const tabs: [SyMenu, string][] = [
    ['vragen', 'Claude'],
    ['artikelen', 'Artikelen'],
    ['inleiding', 'Systeemomschrijving'],
    ['controle', 'Controle'],
  ];
  return (
    <section className="card stack" style={{ gap: 14 }}>
      <div className="seg" role="group" aria-label="Menu">
        {tabs.map(([k, n]) => (
          <button key={k} aria-pressed={sy.menu === k} onClick={() => zetSy({ menu: k })}>
            {n}
            {k === 'controle' && <span className="cnt"> {nLetOp || ''}</span>}
            {k === 'artikelen' && <span className="cnt"> {nOpen || ''}</span>}
          </button>
        ))}
      </div>
      {sy.menu === 'artikelen' ? (
        <Artikelen c={c} />
      ) : sy.menu === 'inleiding' ? (
        <Inleiding c={c} />
      ) : sy.menu === 'controle' ? (
        <Controle c={c} />
      ) : (
        <Chat c={c} />
      )}
    </section>
  );
}

function Voorbeeld() {
  const sy = useSy();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !sy.res || !sy.base) return;
    try {
      tekenVoorbeeld(host, sy.res, sy.base, { marks: sy.marks, sel: sy.sel });
    } catch (e) {
      host.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'empty';
      div.style.cssText = 'background:#fff;color:#333';
      div.textContent = 'Voorbeeld kon niet worden getekend: ' + (e instanceof Error ? e.message : String(e));
      host.appendChild(div);
    }
  }, [sy.res, sy.base, sy.marks, sy.sel]);

  function klik(ev: MouseEvent<HTMLDivElement>) {
    const blk = (ev.target as HTMLElement).closest<HTMLElement>('#sy-pages [data-syk]');
    if (!blk || blk.isContentEditable) return;
    const k = blk.dataset.syk || '';
    zetSy({ sel: k, menu: k === 'inl' ? 'inleiding' : 'artikelen' });
    requestAnimationFrame(() => document.querySelector(`.sy-art.sel`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function blur(ev: FocusEvent<HTMLDivElement>) {
    const t = ev.target as HTMLElement;
    const c = getSy().cur;
    if (!c || t.dataset.syl == null) return;
    const k = +t.dataset.syl;
    const L = String(c.inleiding || '').split('\n');
    if (k >= L.length) return;
    const oud = L[k];
    const nieuw = t.innerText.replace(/​/g, '').replace(/\n+/g, ' ').trim();
    const pref = oud.trim().startsWith('- ') ? '- ' : '';
    if (nieuw === oud.replace(/\*\*?/g, '').replace(/^- /, '').trim()) return;
    L[k] = pref + nieuw;
    c.inleiding = L.join('\n');
    herbouw();
    syGewijzigd();
  }

  function toets(ev: KeyboardEvent<HTMLDivElement>) {
    const t = ev.target as HTMLElement;
    if (t.dataset.syl != null && ev.key === 'Enter') {
      ev.preventDefault();
      t.blur();
    }
  }

  return (
    <section className="card stack" style={{ gap: 12, padding: 16 }}>
      <div className="row between">
        <div>
          <h2>Voorbeeld</h2>
          <div className="sub" style={{ margin: 0 }}>
            Klik een gemarkeerd blok om het te kiezen · typ in de paarse alinea’s · benadering van Word
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className={'btn sm ' + (sy.marks ? '' : 'ghost')} aria-pressed={sy.marks} onClick={() => zetSy({ marks: !sy.marks })}>
            Markeringen
          </button>
          <button
            className="btn sm ghost"
            aria-label="Uitzoomen"
            onClick={() => zetSy({ zoom: Math.max(0.4, Math.round((sy.zoom - 0.08) * 100) / 100) })}
          >
            −
          </button>
          <span className="sub" style={{ margin: 0 }}>
            {Math.round(sy.zoom * 100)}%
          </span>
          <button
            className="btn sm ghost"
            aria-label="Inzoomen"
            onClick={() => zetSy({ zoom: Math.min(1.2, Math.round((sy.zoom + 0.08) * 100) / 100) })}
          >
            +
          </button>
        </div>
      </div>
      <div className="row" style={{ gap: 10, fontSize: 11.5 }}>
        <span className="leg">
          <i style={{ background: '#2bb6a3' }} />
          Uit bibliotheek
        </span>
        <span className="leg">
          <i style={{ background: '#9085e9' }} />
          Claude (systeemomschrijving)
        </span>
        <span className="leg">
          <i style={{ background: '#fab219' }} />
          Eigen tekst
        </span>
        <span className="leg">
          <i style={{ background: '#c3c2b7' }} />
          Aangeleverd door Syntess (ongewijzigd)
        </span>
      </div>
      <div className="sy-view" onClick={klik} onBlur={blur} onKeyDown={toets}>
        <div id="sy-pages" ref={ref} style={{ zoom: sy.zoom }} />
      </div>
    </section>
  );
}

function Editor({ c }: { c: SyntessOfferte }) {
  const sy = useSy();
  if (!sy.base) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <Kop c={c} />
        <section className="card stack">
          {sy.busy ? (
            <div className="sub">
              <Spin /> Word-bestand ophalen…
            </div>
          ) : (
            <>
              <div className="banner">
                <div>Het Word-bestand van deze offerte is niet beschikbaar. Upload de Syntess-export opnieuw om verder te gaan.</div>
              </div>
              <div>
                <label className="btn file-btn">
                  Upload opnieuw
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(e) => {
                      void syUpload(e.target.files?.[0], true);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Kop c={c} />
      <Kennisregel />
      <div className="sy-grid">
        <div className="stack" style={{ gap: 16 }}>
          <Menu c={c} />
        </div>
        <div>
          <Voorbeeld />
        </div>
      </div>
    </div>
  );
}

export function SyntessView() {
  const sy = useSy();
  return sy.cur ? <Editor c={sy.cur} /> : <Startpagina />;
}
```
