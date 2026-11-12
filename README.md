# Lens

[![Version](https://img.shields.io/badge/version-1.1.0-1a4d2e.svg)](https://github.com/Shiiroi/mapa/releases/tag/v1.1.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-1a4d2e.svg)](https://github.com/Shiiroi/mapa/blob/main/LICENSE)
[![Part of mapaPH](https://img.shields.io/badge/ecosystem-mapaPH-1a4d2e.svg)](https://www.mapaph.com)

Lens is an interactive choropleth map visualizer and GeoJSON boundary export tool for Philippine administrative divisions. It covers country, region, province, city/municipality, and barangay levels. Lens is part of the open-source [mapaPH](https://www.mapaph.com) ecosystem.

Live application: [lens.mapaph.com](https://lens.mapaph.com)

> Lens is an independent civic project. It is not affiliated with or endorsed by the Philippine Statistics Authority (PSA) or any government agency.

## Table of Contents

- [Features](#features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Interactive Multi-Level Map**: Switch between country, 18 regions, 82 provinces, 1,634 cities and municipalities, and 42,000+ barangays.
- **RFC 7946 GeoJSON Export**: Export clean vector boundaries in WGS 84 (EPSG:4326) keyed by 9-digit PSGC numeric codes.
- **Pre-Loaded Civic Metrics**: Inspect 2010 to 2024 PSA census populations, sex ratios, age-dependency ratios, regional GDP, and COA municipal financial audit assets.
- **2025 to 2026 Boundary Alignments**: Reflects recent statutory updates, including the Supreme Court transfer of Bonifacio Global City (BGC) and 10 EMBO barangays from Makati to Taguig City.
- **Custom CSV Overlays**: Upload custom datasets using 9-digit PSGC codes to render instant choropleth heatmaps.
- **Ecosystem Integration**: Directly links to the [mapaPH Tools](https://www.mapaph.com/tools) suite from the geographic navigation sidebar.
- **Place Comparison**: Compare demographic and economic indicators between any two local government units side by side.
- **Distribution Visualizer**: Inspect sub-level population distributions with stacked charts and interactive data tables.

## Architecture & Tech Stack

Lens separates heavy geometric vector files from relational statistical data:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS | Client-side single-page application hosted on Vercel with build-time SSR HTML pre-rendering. |
| **Map Engine** | Leaflet / react-leaflet, D3 | Interactive polygon rendering, pan/zoom handling, and statistical binning (Jenks, Quantile, Logarithmic). |
| **Vector Storage CDN** | Cloudflare R2 | Pre-chunked TopoJSON and GeoJSON boundary files served with edge proxying, gzip compression, and $0 egress bandwidth costs. |
| **Fallback Storage** | Supabase Storage | Automatic failover origin if direct CDN requests encounter network timeouts. |
| **Tabular Database** | Supabase (PostgreSQL + PostgREST) | PSGC administrative hierarchy, demographic stats, financial audits, and 2022 election results queried via public read-only APIs. |
| **Data Fetching** | TanStack Query | Client-side caching and background revalidation for map metadata and statistical series. |

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed pipeline schematics.

## Getting Started

### Prerequisites

- Node.js 20 or higher
- pnpm 9 or higher
- A Supabase project (for running the full local database)
- Python 3.11+ (optional, required only for regenerating COMELEC scraper datasets)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Shiiroi/mapa.git
cd mapa/frontend
pnpm install
```

### Environment Configuration

Create `frontend/.env` using the template in `frontend/.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Cloudflare R2 CDN. If omitted, Lens serves shapes directly from Supabase Storage:
# VITE_GEO_CDN_URL=https://your-r2-bucket.r2.dev
```

### Database Setup

Apply SQL migrations located in `supabase/migrations/`, then populate the database tables:

```bash
# Seed from clean source CSVs:
pnpm setup

# Or restore directly from committed database backup snapshots:
pnpm restore
```

### Development Server

Start the local development server:

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Full environment configuration, seed script references, and data regeneration workflows are documented in [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## Documentation

- [Architecture & Project Structure](./docs/ARCHITECTURE.md)
- [Development Setup & Data Pipeline](./docs/DEVELOPMENT.md)
- [GeoJSON Format & Export Specifications](./docs/GEOJSON_FORMAT.md)
- [Data Sources & Methodology](./docs/DATA_SOURCES.md)
- [Boundary Corrections Changelog](./DATA_CORRECTIONS.md)
- [mapaPH Hub Documentation](https://www.mapaph.com/docs/lens)

## Contributing

We welcome contributions, bug reports, and boundary corrections. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Review our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

- Source code: [MIT License](./LICENSE)
- Boundary data: Derived from open public domain and open-licensed sources (PSA, NAMRIA, UN OCHA). Attribution is required when redistributing boundary files. See [`NOTICE.md`](./NOTICE.md) and [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md).
