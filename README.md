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
- Interactive Stacked Bar Chart Distribution — a compact, hoverable breakdown of any place into its immediate sub-levels with an integrated data table and floating tooltip.
- Modular tabbed UI (Compare, Custom, Download) with extractable components (`ComparePicker`, `MetricRow`, `DatasetToggle`, etc.) for easier reuse and testing.

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
│       │   ├── constants.ts
│       │   ├── types.ts
│       │   ├── components/
│       │   │   ├── Map.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── tabs/
│       │   │       ├── CompareTab.tsx
│       │   │       ├── CustomTab.tsx
│       │   │       ├── DownloadTab.tsx
│       │   │       ├── InfoTab.tsx
│       │   │       └── Index.tsx
│       │   ├── hooks/
│       │   ├── services/
│       │   └── utils/
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

| Level             | `geo_lvl`      | Example `psgc`     |
| ----------------- | -------------- | ------------------ |
| Country           | `Country`      | `0000000000`       |
| Region            | `Reg`          | `1300000000` (NCR) |
| Province          | `Prov`         | `0128000000`       |
| City/Municipality | `City` / `Mun` | `1830200000`       |
| Barangay          | `Bgy`          | `1830200001`       |

Downloaded files are named `mapa-{level}-{slug}-{date}.json`.

### 2022 Presidential election data

The repository ships with pre-built election results in `data-sets/data/clean/elections_2022_president_all.csv` and in `data-sets/backup/custom_dataset_values.csv`. Running `pnpm setup` or `pnpm restore` loads these results into the database automatically — **no scraping is required** for a standard deployment.

The national (country-level) total is hardcoded to the official Congressional canvass proclamation (53,815,469 votes across 10 candidates), providing a **100% exact match** to the certified results. Sub-national rows (region, province, city/municipality, barangay) are aggregated from municipal Certificates of Canvass (COCs) scraped from the COMELEC transparency server. Province and region totals are derived by summing their constituent cities/municipalities, which correctly groups Highly Urbanized Cities (HUCs) under their geographical provinces and routes the Negros provinces to the Negros Island Region (NIR). See `DATA_CORRECTIONS.md` for full details.

All seed commands, including `seed:custom-elections`, are upserts and never wipe the database. Re-running the seeder after a fresh scrape merges new data (e.g. additional barangays) with existing rows.

#### Regenerating from scratch (optional)

If you want to re-scrape and rebuild the election data yourself, use the pipeline below. Python 3.11+ and the scraper virtualenv are required (see Prerequisites).

##### 1. Fast Scrape (Regions, Provinces, Cities/Municipalities only)

By default, the scraper runs to the city/municipality tier (`--max-rank citymun`). This is a **fast crawl** taking only a few minutes. Because municipality COCs contain the fully aggregated votes of all underlying barangays, this is all that is required to generate 100% complete presidential maps for region, province, and city/municipality levels:

```bash
cd frontend

# Scrape down to city/municipality COCs (fast crawl)
pnpm scrape:comelec
pnpm map:comelec
pnpm seed:custom-elections
pnpm db:export                 # refresh committed database backup snapshot
```

##### 2. Heavy Scrape (Barangays & Precincts)

If you need detailed spatial shading inside the **Barangay** view tier, execute the heavy scraper with `--max-rank barangay`. This crawls all individual clustered-precinct JSON files, taking several hours and requiring ~3.3GB of space:

```bash
cd frontend

# Scrape all the way down to precinct results (heavy crawl)
pnpm scrape:comelec -- --max-rank barangay
pnpm map:comelec && pnpm seed:custom-elections && pnpm db:export
```

##### 3. Staged Scrape by Region

Because the scraper is **resumable** (it automatically skips files already present on disk), you can stage the heavy barangay crawl one region at a time:

```bash
cd frontend

# Crawl NCR barangays only
pnpm scrape:comelec -- --max-rank barangay --only-region "NATIONAL CAPITAL REGION"
pnpm map:comelec && pnpm seed:custom-elections && pnpm db:export
```

Region names must match COMELEC's labels (for example `NATIONAL CAPITAL REGION`, not `NCR`).

## Data sources & licenses

### Geospatial Boundaries

- **Region, province, municipality GeoJSON (re-keyed to PSGC):** [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) (MIT © James Faeldon)
- **Barangay + country shapefiles (Adm0, Adm4):** [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) (MIT © James Faeldon)

### Statistical Citations

- **Administrative Boundaries & Spatial Codes**
    - Citation: [Philippine Statistics Authority (PSA). PSGC 1Q 2026 Publication Datafile.](https://psa.gov.ph/classification/psgc/node/1684083211)
- **Population Statistics Baseline**
    - Citation: [Philippine Statistics Authority (PSA). 2024 Census of Population (2024 POPCEN) Population Counts Declared Official by the President.](https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president)
- **Demographic Distributions**
    - Citation: [Philippine Statistics Authority (PSA). PSA 2020 Census of Population and Housing: Age and Sex Distribution.](https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing)
- **Socioeconomic Baseline Matrix**
    - Citation: [Philippine Statistics Authority (PSA). Gross Domestic Product, by Province and HUCs (Constant 2018 Prices).](https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2A__PPA__2025/?tablelist=true&rxid=bdf9d8da-96f1-4100-ae09-18cb3eaeb313)
- **Local Government Financial Profiles**
    - Citation: [Commission on Audit (COA). 2024 Annual Financial Report for the Local Government, Including Bangsamoro Government (Volume I).](https://www.coa.gov.ph/reports/annual-financial-reports/afr-local-government-units/)
- **Electoral Overlays**
    - Citation: [Commission on Elections (COMELEC). 2022 National and Local Elections Results Transparency Portal.](https://2022electionresults.comelec.gov.ph/#/dashboard)
- **Geospatial Baseline Area & Density Metric Spine**
    - Citation: [Philippine Statistics Authority (PSA). Population, Land Area, Population Density, and Percent Change in Population Density of the Philippines by Region, Province/Highly Urbanized City, and City/Municipality: 2010, 2015, and 2020.](https://psa.gov.ph/system/files/phcd/2022-12/2010-2015-2020%2520Population%2520Density_Table%2520A_Using%25202013%2520Land%2520Areas_12%2520July%25202021.pdf)

Full third-party license texts are in [`NOTICE.md`](./NOTICE.md). Mapa re-keys, links, corrects, and packages these datasets; it does not claim ownership of the underlying boundary or statistical data.

### 📊 Land Area & Population Density

- **National to Municipal Levels:** Land area data utilizes the exact statutory values from the official **Philippine Statistics Authority (PSA)** [2010-2015-2020 Population Density (Table A using 2013 Land Areas)](https://psa.gov.ph/system/files/phcd/2022-12/2010-2015-2020%2520Population%2520Density_Table%2520A_Using%25202013%2520Land%2520Areas_12%2520July%25202021.pdf) publication. No data approximations are performed on these tiers.
- **Barangay Level:** Computationally approximated from geometric boundaries due to an absence of granular breakdown in the official source document.

## Notes & Disclosures

### Notes

- **a1/** Land area is based on the cadastral survey and estimated land areas (certified and provided to the Department of Budget and Management) from the Land Management Bureau, Department of Environment and Natural Resources, as of December 2013.
- **a2/** Due to unfinished cadastral survey, details do not add up to the national total.
- **a3/** Due to rounding off, the provincial totals may not be equal to the sum of the individual figures.
- **b1/** Excludes 2,739 Filipinos in Philippine embassies, consulates, and missions abroad but includes 18,989 persons in the areas disputed by the City of Pasig (National Capital Region) and the province of Rizal (Region IV-A).
- **b2/** Excludes 2,134 Filipinos in Philippine embassies, consulates, and missions abroad.
- **b3/** Excludes 2,098 Filipinos in Philippine embassies, consulates, and missions abroad.
- **\*** Land area is based on cadastral survey (certified and provided to the DBM) from the LMB, DENR, as of December 2013.
- **\*\*** Estimated land area (certified and provided to the DBM) from the LMB, DENR, as of December 2013.
- **\*\*\*** Population counts for the provinces exclude the counts of Highly Urbanized Cities.

### Administrative & Historical Corrections

1. The Negros Island Region (NIR) was abolished through Executive Order No. 38 “Revoking Executive Order No. 183 (s. 2015) which Created a Negros Island Region and for Other Purposes”, signed by President Rodrigo Roa Duterte on 07 August 2017. The abolition of NIR reverted the provinces, cities, municipalities, and barangays of Negros Occidental and City of Bacolod to Region VI (Western Visayas) and Negros Oriental to Region VII (Central Visayas).
2. Renamed province from Compostela Valley under Republic Act No. 11297, dated April 17, 2019; ratified on December 7, 2019.
3. Renamed region from ARMM under Republic Act No. 11054, dated July 27, 2018; ratified on January 25, 2019.
4. Converted into a city under Republic Act No. 11086; ratified on 7 September 2019.
5. Correction of municipality name from Pinamungahan; under Municipal Mayor Certification.

## Data corrections

Open datasets and shapefile joins occasionally have gaps or code mismatches. Mapa applies deterministic corrections before committing GeoJSON; see [`DATA_CORRECTIONS.md`](./DATA_CORRECTIONS.md) for details. Current result: 42,000 of 42,017 barangay features matched or merged.

## Contributing

Issues and data corrections are welcome, especially boundary errors, missing divisions, and PSGC mismatches. Please open an issue describing the problem with an authoritative source where possible.

## License

- Source code: MIT — see [`LICENSE`](./LICENSE).
- Boundary data: derived from the MIT-licensed sources above — see [`NOTICE.md`](./NOTICE.md). Attribution is required when redistributing GeoJSON.
