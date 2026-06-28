# Mapa

**Free, interactive maps and downloadable GeoJSON for every Philippine administrative division — country, region, province, city/municipality, and barangay.**

Mapa lets you browse the Philippines on a map, switch between administrative levels, and download standards-compliant GeoJSON. Built for students, developers, researchers, LGUs, and the curious.

🌐 Live: https://mapa.shhiroi.me · Part of [shhiroi.me](https://shhiroi.me)

> Mapa is an independent project. It is **not** affiliated with or endorsed by the Philippine Statistics Authority (PSA) or any government agency.

---

## Table of contents

- [What is Mapa](#what-is-mapa)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Data pipeline](#data-pipeline)
- [GeoJSON format](#geojson-format)
- [Data sources & licenses](#data-sources--licenses)
- [Data corrections](#data-corrections)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## What is Mapa

Mapa is a Philippines-focused geographic reference site. The core experience is an **interactive map** paired with a **download panel**:

- Explore administrative boundaries from **country → region → province → city/municipality → barangay**.
- **Download GeoJSON** scoped by country, region, province, municipality, or barangay.
- Barangay view appears only after a municipality/city is selected (e.g. select Manila → Barangay tab shows).
- Later phases add **population statistics**, **density heatmaps**, and PH-specific tools.

Architecture keeps a clean separation: **administrative metadata lives in Postgres (Supabase)**, while **boundary geometry is served as chunked GeoJSON from object storage / CDN**.

---

## Features

| Status | Feature |
|--------|---------|
| ✅ | Interactive Leaflet map with country / region / province / municipality / barangay view switching |
| ✅ | GeoJSON downloads by country, region, province, municipality, and barangay |
| ✅ | Standards-compliant GeoJSON (RFC 7946) with rich PSGC properties |
| ✅ | Barangay layer (per-municity chunked boundaries + downloads) |
| ✅ | Whole-Philippines country boundary download |
| 🔜 | Population statistics and place detail pages |
| 🔜 | Population density heatmap with filters |
| 🔜 | PSGC code lookup, place comparison, island-group browse |

---

## Tech stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Map:** Leaflet / react-leaflet
- **Data fetching:** TanStack Query
- **Backend:** Supabase (Postgres for metadata, public Storage bucket for GeoJSON)
- **Package manager:** pnpm
- **Hosting:** Vercel (subdomain `mapa.shhiroi.me`)

---

## Project structure

```
mapa/
├── frontend/
│   ├── public/
│   │   ├── geo/                     # GeoJSON (uploaded to Supabase Storage)
│   │   │   ├── country.json, regions.json, provinces.json
│   │   │   └── municities/          # meta.json, manifest, province-*.json, bgy/
│   │   ├── data/
│   │   │   ├── clean/               # PSGC-keyed CSVs — seed scripts read these
│   │   │   └── raw/                 # Provenance extracts (not needed to run the app)
│   │   ├── source/                  # Original xlsx/pdf sources (provenance only)
│   │   └── backup/                  # DB dumps (gitignored; optional local mirror)
│   ├── scripts/
│   │   ├── seed-*.ts                # Seed Postgres from public/data/clean + geo
│   │   ├── upload-geo.ts            # Upload public/geo/** to Supabase Storage
│   │   ├── map-comelec-president.ts # COMELEC scrape → clean election CSVs
│   │   ├── lib/afrMatch.ts          # PSGC name matching for elections pipeline
│   │   └── py/scrape_comelec.py     # Download COMELEC 2022 results (optional regen)
│   └── src/
│       ├── features/map/            # Map rendering, layers, download UI
│       └── pages/
├── supabase/migrations/             # Schema: regions, provinces, municities, barangays
├── DATA_CORRECTIONS.md              # Manual corrections & join derivations
├── NOTICE.md                        # Third-party licenses
└── LICENSE
```

---

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- Python 3.11+ (for shapefile pipeline)
- A Supabase project

### 1. Install

```bash
cd frontend
pnpm install
```

For the COMELEC scraper (optional — only if regenerating election data):

```bash
cd frontend/scripts/py
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Environment

Create `frontend/.env`:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>

# Server-side scripts only (never expose to the client)
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. Apply database schema

Run the migrations in `supabase/migrations/` against your Supabase project.

### 4. Seed database and upload geo

After applying migrations, pick one path:

**Clean (from source — recommended for self-hosters who want transparent, reproducible data):**

```bash
cd frontend
pnpm setup
```

`setup` = `upload:geo` + `seed:all`. Reads `public/geo/` and `public/data/clean/*.csv`, transforms via seed scripts, upserts into Postgres.

**Restore (fast clone — exact mirror from committed CSV snapshots):**

```bash
cd frontend
pnpm restore
```

`restore` = `upload:geo` + `db:restore`. Reads `public/backup/<table>.csv` row-for-row (includes whatever election barangay rows were last exported).

| Command | What it does |
|---------|----------------|
| `pnpm setup` | Upload geo + seed from clean source data |
| `pnpm restore` | Upload geo + restore from `public/backup/*.csv` |
| `pnpm seed:all` | Seed Postgres only (no geo upload) |
| `pnpm db:export` | Dump current DB → refresh `public/backup/*.csv` |
| `pnpm db:restore` | Restore Postgres from backup CSVs only |

Individual seeders (for partial updates): `seed:db`, `seed:bgy`, `seed:stats`, `seed:extrapop`, `seed:gdp`, `seed:afr`, `seed:custom-elections`.

You only need **`public/geo/`** + **`public/data/clean/`** for `setup`, or **`public/geo/`** + **`public/backup/`** for `restore`. `public/data/raw/` and `public/source/` are provenance only.

### 5. Run the app

```bash
pnpm dev
```

---

## Data pipeline

```
public/geo/                    # Boundaries + embedded pop/area stats (committed)
public/data/clean/*.csv        # PSGC-keyed stats overlays (committed)
        │
        ├── seed:db / seed:bgy / seed:stats / seed:extrapop / seed:gdp / seed:afr
        │       └──► Postgres (metadata + division_stats + custom_datasets)
        │
        └── upload:geo ────────► Supabase Storage (CDN)

Optional regen (elections):
  scrape:comelec → map:comelec → public/data/clean/elections_*.csv → seed:custom-elections → db:export

Backup snapshot:
  db:export → public/backup/*.csv  (refresh after DB changes; used by pnpm restore)
```

GDP values use **PSA constant 2018 prices** (real terms, correct for trend lines and growth rates).

### Incremental barangay election results

Barangay **geometry metadata** is seeded once via `seed:bgy` (included in `setup` / `restore`). Barangay **election overlay rows** grow as you scrape COMELEC; re-seed and refresh backup after each stage:

```bash
cd frontend

# Stage 1 — Manila barangays (resumable; same command to continue)
pnpm scrape:comelec -- --max-rank barangay --only-region NCR --only-citymun MANILA
pnpm map:comelec
pnpm seed:custom-elections
pnpm db:export

# Stage 2 — whole NCR (skips Manila files already on disk)
pnpm scrape:comelec -- --max-rank barangay --only-region NCR
pnpm map:comelec && pnpm seed:custom-elections && pnpm db:export

# Stage 3 — whole Philippines
pnpm scrape:comelec -- --max-rank barangay
pnpm map:comelec && pnpm seed:custom-elections && pnpm db:export
```

All seed/restore commands are **upserts** — they never wipe the whole DB.

**Why chunked?** City/municipality and barangay boundaries are large. Splitting into per-province and per-municity files with manifest indexes lets the app load only what the user needs.

---

## GeoJSON format

All exported files are **RFC 7946 GeoJSON** `FeatureCollection`s in **WGS 84 (EPSG:4326)**.

Each feature carries PSGC-keyed properties (10-digit string `psgc`):

```json
{
  "type": "Feature",
  "properties": {
    "psgc": "1830200001",
    "correspondence": "064501001",
    "name": "Alangilan",
    "geo_lvl": "Bgy",
    "city_lvl": null,
    "municity_psgc": "1830200000",
    "province_psgc": "1804500000",
    "region_psgc": "1800000000",
    "level": "barangay"
  },
  "geometry": { "type": "Polygon", "coordinates": [ ... ] }
}
```

| Level | `geo_lvl` | Example `psgc` |
|-------|-----------|----------------|
| Country | `Country` | `0000000000` |
| Region | `Reg` | `1300000000` (NCR) |
| Province | `Prov` | `0128000000` |
| City/Municipality | `City` / `Mun` | `1830200000` |
| Barangay | `Bgy` | `1830200001` |

Downloaded files follow: `mapa-{level}-{slug}-{date}.json`.

---

## Data sources & licenses

| Source | Used for | License |
|--------|----------|---------|
| [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) | Region, province, municipality GeoJSON (re-keyed to PSGC) | MIT © James Faeldon |
| [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) | Barangay + country shapefiles (Adm0, Adm4) | MIT © James Faeldon |
| [PSA PSGC](https://psa.gov.ph/classification/psgc/) | Administrative codes, names, hierarchy | Public (attribution required) |

Full third-party license texts are in [`NOTICE.md`](./NOTICE.md).

> Mapa adds value on top of these datasets (PSGC re-keying, hierarchy linking, downloads, corrections, and tooling). It does not claim ownership of the underlying boundary or statistical data.

---

## Data corrections

Open datasets and shapefile joins occasionally have gaps or code mismatches. Mapa applies deterministic corrections during the barangay pipeline — see [`DATA_CORRECTIONS.md`](./DATA_CORRECTIONS.md) for the full log.

Current result: **42,000 of 42,017** barangay features matched or merged.

---

## Roadmap

1. **Foundation** — Supabase schema, PSGC-keyed GeoJSON, pipeline ✅
2. **Map + downloads** — Country through barangay levels ✅
3. **Population & place pages** — PSA census in `division_stats`
4. **Density heatmap** — Population-density choropleth
5. **PH-specific tools** — PSGC lookup, place comparison, island-group browse

---

## Contributing

Issues and data corrections are welcome — especially boundary errors, missing divisions, and PSGC mismatches. Please open an issue with the problem and, where possible, an authoritative source.

---

## License

- **Mapa source code:** MIT — see [`LICENSE`](./LICENSE)
- **Boundary data:** derived from MIT-licensed sources above — see [`NOTICE.md`](./NOTICE.md). Attribution required when redistributing GeoJSON.
