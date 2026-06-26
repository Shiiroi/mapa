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
│   │   ├── psgc.csv                 # PSA PSGC reference (source of truth for codes/names)
│   │   ├── shape/                   # altcoder shapefiles (Adm0, Adm4)
│   │   └── geo/                     # Generated GeoJSON (source for upload)
│   │       ├── country.json
│   │       ├── regions.json
│   │       ├── provinces.json
│   │       └── municities/
│   │           ├── meta.json        # Metadata only (no geometry)
│   │           ├── manifest.json    # { provincePsgcs: string[] }
│   │           ├── province-{psgc}.json
│   │           └── bgy/
│   │               ├── meta.json
│   │               ├── manifest.json  # { municityPsgcs: string[] }
│   │               ├── {municityPsgc}.json
│   │               └── _unmatched.json
│   ├── scripts/
│   │   ├── build-geo.ts             # Re-key geo JSON to PSGC from psgc.csv
│   │   ├── seed-db.ts               # Seed regions/provinces/municities
│   │   ├── seed-bgy.ts              # Seed barangays table
│   │   ├── upload-geo.ts            # Upload public/geo/** to Supabase Storage
│   │   └── py/                      # Shapefile → GeoJSON pipeline
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

For the Python shapefile pipeline:

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

### 4. Build and upload geo data

```bash
cd frontend

# Re-key region/province/municity GeoJSON to PSGC from psgc.csv
pnpm build:geo

# Convert barangay + country shapefiles to GeoJSON
pnpm shape:geo

# Seed Postgres metadata tables
pnpm seed:db
pnpm seed:bgy

# Upload public/geo/** to Supabase Storage (bucket: geo)
pnpm upload:geo
```

### 5. Run the app

```bash
pnpm dev
```

---

## Data pipeline

```
public/psgc.csv (PSA codes & names)
        │
        ├── build-geo.ts ──────────► public/geo/regions.json, provinces.json,
        │                            municities/province-{psgc}.json
        │
        └── scripts/py/shape_to_geojson.py
                │  (altcoder shapefiles in public/shape/)
                ▼
            country.json + municities/bgy/{municityPsgc}.json
                │
                ▼
        seed:db / seed:bgy ────────► Postgres (metadata, no geometry)
                │
                ▼
        upload:geo ────────────────► Supabase Storage (CDN)
```

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
