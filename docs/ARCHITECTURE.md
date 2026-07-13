# Architecture

Administrative metadata (names, hierarchy, statistics, overlays) is stored in Postgres through Supabase. Boundary geometry is served as chunked GeoJSON from a public Supabase Storage bucket (CDN); the committed source GeoJSON lives under `data-sets/geo/` and is uploaded there by `pnpm upload:geo`. The frontend is a static single-page application and all runtime queries are read-only; data is written only by the seed scripts in `frontend/scripts/`.

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
│       │   │   └── Index.tsx
│       │   │       ├── CompareTab.tsx
│       │   │       ├── CustomTab.tsx
│       │   │       ├── DownloadTab.tsx
│       │   │       ├── InfoTab.tsx
│       │   │       └── into-sections
│       │   │       └── custom-sections
│       │   │       └── download-sections
│       │   │       └── compare-sections
│       │   ├── hooks/
│       │   ├── services/
│       │   └── utils/
│       └── pages/
├── supabase/migrations/             # Schema: regions, provinces, municities, barangays
├── DATA_CORRECTIONS.md              # Boundary corrections summary
├── NOTICE.md                        # Third-party licenses
└── LICENSE
```

Back to [README](../README.md).
