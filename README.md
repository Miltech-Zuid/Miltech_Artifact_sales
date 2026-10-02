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
