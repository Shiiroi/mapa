# Mapa

Mapa is an interactive map and GeoJSON download tool for Philippine administrative divisions — country, region, province, city/municipality, and barangay. It overlays census, economic, and election statistics on those boundaries, supports side-by-side comparison of places, and exports standards-compliant GeoJSON.

Live: https://mapa.shhiroi.me

> Mapa is an independent project. It is not affiliated with or endorsed by the Philippine Statistics Authority (PSA) or any government agency.

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Data pipeline](#data-pipeline)
- [GeoJSON format](#geojson-format)
- [Data sources & licenses](#data-sources--licenses)
- [Data corrections](#data-corrections)
- [Contributing](#contributing)
- [License](#license)

## Features

- Interactive Leaflet map with level switching across country, region, province, city/municipality, and barangay.
- GeoJSON downloads scoped to any level, in RFC 7946 / WGS 84 with PSGC-keyed feature properties.
- Per-place statistics: population, age and sex distribution, GDP (PSA constant 2018 prices), and LGU total assets.
- Built-in COMELEC 2022 presidential results overlay, plus custom CSV overlay uploads keyed by PSGC.
- Side-by-side comparison of any two places.

## Architecture

Administrative metadata (names, hierarchy, statistics, overlays) is stored in Postgres through Supabase. Boundary geometry is served as chunked GeoJSON from a public Supabase Storage bucket (CDN); the committed source GeoJSON lives under `data-sets/geo/` and is uploaded there by `pnpm upload:geo`. The frontend is a static single-page application and all runtime queries are read-only; data is written only by the seed scripts in `frontend/scripts/`.

## Tech stack

- Frontend: Vite, React, TypeScript, Tailwind CSS
- Map: Leaflet / react-leaflet
- Data fetching: TanStack Query
- Backend: Supabase (Postgres for metadata, public Storage bucket for GeoJSON)
- Package manager: pnpm
- Hosting: Vercel

## Project structure

```
mapa/
├── frontend/
│   ├── public/                      # Web-served static assets (favicon, etc.)
│   ├── data-sets/                   # Source data + DB snapshots (not web-served)
│   │   ├── geo/                     # GeoJSON — uploaded to Supabase Storage
│   │   │   ├── country.json, regions.json, provinces.json
│   │   │   └── municities/          # meta.json, manifest, province-*.json, bgy/
│   │   ├── data/
│   │   │   ├── clean/               # PSGC-keyed CSVs — seed scripts read these
│   │   │   └── raw/                 # Provenance extracts (not needed to run the app)
│   │   ├── source/                  # Original xlsx/pdf sources (provenance only)
│   │   └── backup/                  # DB CSV snapshots — input to pnpm restore
│   ├── scripts/
│   │   ├── seed-*.ts                # Seed Postgres from data-sets/data/clean + geo
│   │   ├── upload-geo.ts            # Upload data-sets/geo/** to Supabase Storage
│   │   ├── db-export.ts / db-restore.ts
│   │   ├── map-comelec-president.ts # COMELEC scrape → clean election CSVs
│   │   └── py/scrape_comelec.py     # Download COMELEC 2022 results (optional regen)
│   └── src/
│       ├── map/                     # Map rendering, layers, download UI
│       └── pages/
├── supabase/migrations/             # Schema: regions, provinces, municities, barangays
├── DATA_CORRECTIONS.md              # Boundary corrections summary
├── NOTICE.md                        # Third-party licenses
└── LICENSE
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- Python 3.11+ (optional — only for the COMELEC election scraper)
- A Supabase project

### 1. Install

```bash
cd frontend
pnpm install
```

For the COMELEC scraper (optional):

```bash
cd frontend/scripts/py
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Environment

Create `frontend/.env`:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-or-publishable-key>

# Server-side scripts only (never expose to the client)
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. Apply database schema

Run the migrations in `supabase/migrations/` against your Supabase project.

### 4. Seed database and upload geo

Clean — seeds from source CSVs; recommended for self-hosters who want transparent, reproducible data:

```bash
cd frontend
pnpm setup
```

`setup` runs `upload:geo` then `seed:all`, reading `data-sets/geo/` and `data-sets/data/clean/*.csv`.

Restore — mirrors the database from committed CSV snapshots; faster for a clone:

```bash
cd frontend
pnpm restore
```

`restore` runs `upload:geo` then `db:restore`, reading `data-sets/backup/<table>.csv`.

| Command | What it does |
|---------|----------------|
| `pnpm setup` | Upload geo + seed from clean source data |
| `pnpm restore` | Upload geo + restore from `data-sets/backup/*.csv` |
| `pnpm seed:all` | Seed Postgres only (no geo upload) |
| `pnpm upload:geo` | Upload `data-sets/geo/**` to Supabase Storage |
| `pnpm db:export` | Dump current DB to `data-sets/backup/*.csv` |
| `pnpm db:restore` | Restore Postgres from backup CSVs only |

Individual seeders, for partial updates: `seed:db`, `seed:bgy`, `seed:stats`, `seed:pop`, `seed:agesex`, `seed:gdp`, `seed:afr`, `seed:custom-elections`.

Population is owned by `seed:pop`, which reads `data-sets/data/clean/popcen_2010_2024.csv` (2010/2015/2020/2024 census counts down to city/municipality, plus 2024 down to barangay) and recomputes `density_2024` and `pct_change_2020_2024`. That CSV is regenerated from the two PSA workbooks in `data-sets/source/` with `pnpm convert:pop`; run it after `seed:stats`, which owns geometry-derived `area_km2`.

`setup` needs `data-sets/geo/` and `data-sets/data/clean/`; `restore` needs `data-sets/geo/` and `data-sets/backup/`. `data-sets/data/raw/` and `data-sets/source/` are provenance only.

### 5. Run the app

```bash
pnpm dev
```

## Data pipeline

```
data-sets/source/*.xlsx        # PSA source workbooks (provenance)
        │   convert:pop ──► data-sets/data/clean/popcen_2010_2024.csv
        ▼
data-sets/geo/                 # Boundaries + geometry-derived area (committed)
data-sets/data/clean/*.csv     # PSGC-keyed stats overlays (committed)
        │
        ├── seed:db / seed:bgy / seed:stats / seed:pop / seed:agesex / seed:gdp / seed:afr
        │       └──► Postgres (metadata + division_stats + custom_datasets)
        │
        └── upload:geo ────────► Supabase Storage (CDN)

Optional regeneration (elections):
  scrape:comelec → map:comelec → data-sets/data/clean/elections_2022_president_all.csv → seed:custom-elections → db:export

Backup snapshot:
  db:export → data-sets/backup/*.csv  (refresh after DB changes; used by pnpm restore)
```

GDP values use PSA constant 2018 prices (real terms), which are appropriate for trend lines and growth rates.

Boundaries are split into per-province and per-municity files with manifest indexes so the app loads only the geometry the current view needs.

### Incremental barangay election results

Barangay geometry metadata is seeded once via `seed:bgy` (included in `setup` and `restore`). Barangay election rows grow as you scrape COMELEC. The scraper is resumable, so you can stage the crawl by region and re-seed after each stage. All seed and restore commands are upserts and never wipe the database.

```bash
cd frontend

# One region at a time (COMELEC region label; resumable)
pnpm scrape:comelec -- --max-rank barangay --only-region "NATIONAL CAPITAL REGION"
pnpm map:comelec
pnpm seed:custom-elections
pnpm db:export        # refresh the committed backup snapshot

# Or the whole country in one crawl
pnpm scrape:comelec -- --max-rank barangay
pnpm map:comelec && pnpm seed:custom-elections && pnpm db:export
```

Region names must match COMELEC's labels (for example `NATIONAL CAPITAL REGION`, not `NCR`).

## GeoJSON format

All exported files are RFC 7946 GeoJSON `FeatureCollection`s in WGS 84 (EPSG:4326). Each feature carries PSGC-keyed properties (10-digit string `psgc`):

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

Downloaded files are named `mapa-{level}-{slug}-{date}.json`.

## Data sources & licenses

| Source | Used for | License |
|--------|----------|---------|
| [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) | Region, province, municipality GeoJSON (re-keyed to PSGC) | MIT © James Faeldon |
| [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) | Barangay + country shapefiles (Adm0, Adm4) | MIT © James Faeldon |
| [PSA PSGC](https://psa.gov.ph/classification/psgc/) | Administrative codes, names, hierarchy, population | Public (attribution required) |
| [PSA 2024 Census](https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president) | Population counts | Public (attribution required) |
| [PSA 2020 Census](https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing) | Age & sex distribution | Public (attribution required) |
| [PSA Subnational Economic Accounts](https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2B__GP__RG__GRD/0012B5CPGD1.px/) | GDP (constant 2018 prices) | Public (attribution required) |
| [COA CY 2024 AFR (Local Government)](https://www.coa.gov.ph/reports/annual-financial-reports/afr-local-government-units/) | LGU total assets | Public (attribution required) |
| [COMELEC 2022 transparency results](https://2022electionresults.comelec.gov.ph/) | Presidential election results | Public domain (RA 8293 s.176) |

Full third-party license texts are in [`NOTICE.md`](./NOTICE.md). Mapa re-keys, links, corrects, and packages these datasets; it does not claim ownership of the underlying boundary or statistical data.

## Data corrections

Open datasets and shapefile joins occasionally have gaps or code mismatches. Mapa applies deterministic corrections before committing GeoJSON; see [`DATA_CORRECTIONS.md`](./DATA_CORRECTIONS.md) for details. Current result: 42,000 of 42,017 barangay features matched or merged.

## Contributing

Issues and data corrections are welcome, especially boundary errors, missing divisions, and PSGC mismatches. Please open an issue describing the problem with an authoritative source where possible.

## License

- Source code: MIT — see [`LICENSE`](./LICENSE).
- Boundary data: derived from the MIT-licensed sources above — see [`NOTICE.md`](./NOTICE.md). Attribution is required when redistributing GeoJSON.
