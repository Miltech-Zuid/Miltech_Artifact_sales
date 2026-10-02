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
