# Development Setup & Data Pipeline

## Prerequisites

- Node.js 20+
- pnpm
- Python 3.11+ (optional — only for the COMELEC election scraper)
- A Supabase project

## 1. Install

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

## 2. Environment

Create `frontend/.env`:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-or-publishable-key>

# Server-side scripts only (never expose to the client)
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## 3. Apply database schema

Run the migrations in `supabase/migrations/` against your Supabase project.

## 4. Seed database and upload geo

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

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `pnpm setup`        | Upload geo + seed from clean source data           |
| `pnpm restore`      | Upload geo + restore from `data-sets/backup/*.csv` |
| `pnpm seed:all`     | Seed Postgres only (no geo upload)                 |
| `pnpm upload:geo`   | Upload `data-sets/geo/**` to Supabase Storage      |
| `pnpm convert:area` | Extract land area from Table A PDF to JSON         |
| `pnpm enrich:area`  | Enrich GeoJSON files with PDF land areas           |
| `pnpm db:export`    | Dump current DB to `data-sets/backup/*.csv`        |
| `pnpm db:restore`   | Restore Postgres from backup CSVs only             |

Individual seeders, for partial updates: `seed:db`, `seed:bgy`, `seed:stats`, `seed:pop`, `seed:agesex`, `seed:gdp`, `seed:afr`, `seed:custom-elections`.

Land area at the country, region, province, and city/municipality levels uses statutory values from the official PSA Table A publication. To extract and compile these areas, run `pnpm convert:area`, then `pnpm enrich:area` to update the local GeoJSON dataset files. These values are seeded to the database when running `pnpm setup` or `pnpm seed:stats`.

Population is owned by `seed:pop`, which reads `data-sets/data/clean/popcen_2010_2024.csv` (2010/2015/2020/2024 census counts down to city/municipality, plus 2024 down to barangay) and recomputes `density_2024` and `pct_change_2020_2024`. That CSV is regenerated from the two PSA workbooks in `data-sets/source/` with `pnpm convert:pop`; run it after `seed:stats`, which owns statutory/geometry-derived `area_km2`.

`setup` needs `data-sets/geo/` and `data-sets/data/clean/`; `restore` needs `data-sets/geo/` and `data-sets/backup/`. `data-sets/data/raw/` and `data-sets/source/` are provenance only.

## 5. Run the app

```bash
pnpm dev
```

## Data pipeline overview

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

## Regenerating election data from scratch (optional)

The repository ships with pre-built 2022 presidential election results, so **no scraping is required** for a standard deployment — `pnpm setup` or `pnpm restore` loads them automatically. Details on how that data was assembled are in [GEOJSON_FORMAT.md](./GEOJSON_FORMAT.md#2022-presidential-election-data).

If you want to re-scrape and rebuild it yourself, Python 3.11+ and the scraper virtualenv are required (see Prerequisites above).

### 1. Fast Scrape (Regions, Provinces, Cities/Municipalities only)

By default, the scraper runs to the city/municipality tier (`--max-rank citymun`). This is a **fast crawl** taking only a few minutes. Because municipality COCs contain the fully aggregated votes of all underlying barangays, this is all that is required to generate 100% complete presidential maps for region, province, and city/municipality levels:

```bash
cd frontend

# Scrape down to city/municipality COCs (fast crawl)
pnpm scrape:comelec
pnpm map:comelec
pnpm seed:custom-elections
pnpm db:export                 # refresh committed database backup snapshot
```

### 2. Heavy Scrape (Barangays & Precincts)

If you need detailed spatial shading inside the **Barangay** view tier, execute the heavy scraper with `--max-rank barangay`. This crawls all individual clustered-precinct JSON files, taking several hours and requiring ~3.3GB of space:

```bash
cd frontend

# Scrape all the way down to precinct results (heavy crawl)
pnpm scrape:comelec -- --max-rank barangay
pnpm map:comelec && pnpm seed:custom-elections && pnpm db:export
```

### 3. Staged Scrape by Region

Because the scraper is **resumable** (it automatically skips files already present on disk), you can stage the heavy barangay crawl one region at a time:

```bash
cd frontend

# Crawl NCR barangays only
pnpm scrape:comelec -- --max-rank barangay --only-region "NATIONAL CAPITAL REGION"
pnpm map:comelec && pnpm seed:custom-elections && pnpm db:export
```

Region names must match COMELEC's labels (for example `NATIONAL CAPITAL REGION`, not `NCR`).

Back to [README](../README.md).
