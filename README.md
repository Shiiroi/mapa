# Mapa

Mapa is an interactive map and GeoJSON download tool for Philippine administrative divisions — country, region, province, city/municipality, and barangay. It overlays census, economic, and election statistics on those boundaries, supports side-by-side comparison of places, and exports standards-compliant GeoJSON.

Live: https://mapa.shhiroi.me

> Mapa is an independent project. It is not affiliated with or endorsed by the Philippine Statistics Authority (PSA) or any government agency.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Documentation](#documentation)
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

## Tech stack

- Frontend: Vite, React, TypeScript, Tailwind CSS
- Map: Leaflet / react-leaflet
- Data fetching: TanStack Query
- Backend: Supabase (Postgres for metadata, public Storage bucket for GeoJSON)
- Package manager: pnpm
- Hosting: Vercel

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for how the pieces fit together and the full project layout.

## Getting started

**Prerequisites:** Node.js 20+, pnpm, a Supabase project. Python 3.11+ is optional, only needed for the COMELEC election scraper.

```bash
cd frontend
pnpm install
```

Create `frontend/.env` with your Supabase credentials, apply the migrations in `supabase/migrations/`, then seed the database:

```bash
pnpm setup     # seeds from source CSVs (transparent, reproducible)
# or
pnpm restore   # restores from committed DB backup snapshots (faster)
```

Run the app:

```bash
pnpm dev
```

Full environment variables, seed command reference, and the data regeneration pipeline (including the COMELEC scraper) are in [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## Documentation

- [Architecture & project structure](./docs/ARCHITECTURE.md)
- [Development setup & data pipeline](./docs/DEVELOPMENT.md)
- [GeoJSON format & export details](./docs/GEOJSON_FORMAT.md)
- [Data sources, licenses & corrections](./docs/DATA_SOURCES.md)
- [Data corrections log](./DATA_CORRECTIONS.md)

## Contributing

Issues and data corrections are welcome, especially boundary errors, missing divisions, and PSGC mismatches. See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to report a data error, propose a code change, and the review process. Please also review our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

- Source code: MIT — see [`LICENSE`](./LICENSE).
- Boundary data: derived from MIT-licensed sources — see [`NOTICE.md`](./NOTICE.md) and [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md). Attribution is required when redistributing GeoJSON.
