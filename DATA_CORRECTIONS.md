# Data corrections

This document tracks corrections and derivations Mapa applies on top of upstream
open-source boundary data. Every entry records **what** was changed, **why**, and
the **basis** for the change.

## Base datasets

| Layer | Source | Notes |
|-------|--------|-------|
| Region / province / municipality | [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) (2023 GeoJSON, MIT) | Re-keyed to PSGC via `build-geo.ts` + `public/psgc.csv` |
| Barangay + country | [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) (Adm0, Adm4, MIT) | Converted via `scripts/py/shape_to_geojson.py` |
| Codes & names | [PSA PSGC](https://psa.gov.ph/classification/psgc/) | `public/psgc.csv` |

Unless listed below, geometry and attributes come unmodified aside from
reformatting and PSGC property normalization.

---

## Barangay shapefile join corrections

The altcoder Adm4 shapefile has 42,017 features. A direct PSGC code join initially
matched only 39,335. The following deterministic corrections recovered
**42,000 of 42,017** (99.96%).

### 1. Correspondence digit-swap (NIR-renumbered regions)

- **Affected:** ~1,293 barangays
- **Issue:** Shapefile encodes correspondence codes with the first two digits
  swapped (e.g. shapefile `604502001` ↔ CSV correspondence `064502001`).
- **Action:** Added `correspondence_candidates()` in `psgc_lookup.py` to try
  the digit-swap transform before falling back.
- **Basis:** Verified 1:1 name match per municity after transform (e.g. Abuanan,
  Bago City barangays).
- **Status:** Automated in pipeline.

### 2. Parent municity from matched PSGC + Manila SubMun roll-up

- **Affected:** 911 barangays (all Manila district barangays)
- **Issue:** Shapefile parent `adm3_psgc` uses Manila SubMun districts
  (`1380601000` Tondo, `1380606000` Sampaloc, etc.) not present in municity
  metadata; only `1380600000` (City of Manila) exists.
- **Action:** Derive parent from the matched barangay's canonical PSGC; roll
  SubMun codes up to parent city (`1380606xxx` → `1380600000`).
- **Basis:** PSGC lists districts as SubMun under City of Manila.
- **Status:** Automated in `shape_to_geojson.py`.

### 3. Bacolod City municity override

- **Affected:** 61 barangays
- **Issue:** Shapefile uses stale adm3 code `630200000`; PSGC canonical is
  `1830200000`. No arithmetic correspondence path exists.
- **Action:** `MUNI_CODE_OVERRIDES` maps `630200000` → `1830200000`, then
  matches barangays by name within the municity.
- **Basis:** 61:61 exact name overlap with PSGC CSV.
- **Status:** Automated override + name match.

### 4. Sulu region-19 → region-09 remap

- **Affected:** 410 barangays (all 19 Sulu municities)
- **Issue:** Shapefile encodes Sulu under BARMM region-19 prefix (`19066xxxx`);
  PSGC canonical municities use region-09 (`09066xxxx`).
- **Action:** Automatic remap `19066…` → `09066…` in `resolve_muni_override()`,
  then name-match within municity.
- **Basis:** 100% name overlap across all 19 Sulu municities (Talipao, Siasi,
  Jolo, etc.).
- **Status:** Automated in pipeline.

### 5. SGA unique-name recovery

- **Affected:** 3 barangays (Panicupan, Macabual, Dunguan)
- **Issue:** Shapefile assigns them to wrong SGA municity codes; names are
  globally unique in PSGC.
- **Action:** Global unique-name fallback when code and municity-scoped match
  both fail.
- **Basis:** Each name appears exactly once in `psgc.csv`.
- **Status:** Automated fallback.

### 6. San Rafael → Dacanlao merge (Calaca, Batangas)

- **Affected:** 1 barangay (San Rafael, code `041007038`)
- **Issue:** Barangay abolished and merged into Dacanlao per Supreme Court
  ruling upheld April 2025. Code no longer exists in PSGC.
- **Action:** `BGY_MERGE` unions San Rafael's polygon into Dacanlao
  (`0401007019`) via geometric `unary_union`.
- **Basis:** [SC upholds merger of Barangay San Rafael with Barangay Dacanlao](https://sc.judiciary.gov.ph/) (April 2025).
- **Status:** Automated merge.

### 7. Caloocan "Barangay 176" kept as one barangay

- **Affected:** 1 barangay
- **Issue:** Shapefile has one polygon for "Barangay 176"; PSGC split it into
  176-A through 176-F (`1380100189`–`1380100194`). Cannot assign one geometry
  to six barangays without manual GIS splitting.
- **Action:** `SYNTHETIC_BGY` keeps it as `psgc 1380100176`, name "Barangay 176".
- **Basis:** Shapefile represents the pre-split boundary; PSGC has no single
  code for the unified barangay.
- **Status:** Synthetic entry.

---

## Unmatched features (2 remaining)

| Shapefile code | Location | Notes |
|----------------|----------|-------|
| `1303901906` | `14.634°N, 120.985°E` (Manila Bay / Tondo area) | Empty name, ~0 km² sliver |
| `1303901907` | `14.608°N, 120.973°E` (Manila Bay shoreline) | Empty name, ~0 km² sliver |

These use non-standard NCR codes (`13039xxxx`) with no PSGC match. Likely
digitizing artifacts or reclaimed-land slivers. Left unmatched pending
authoritative identification.

---

## How corrections are applied

Corrections live in:

- `frontend/scripts/py/psgc_lookup.py` — correspondence digit-swap
- `frontend/scripts/py/shape_to_geojson.py` — overrides, merges, synthetic entries,
  parent roll-up, name fallbacks

After editing, regenerate and re-publish:

```bash
cd frontend
pnpm shape:geo      # rebuild country.json + municities/bgy/**
pnpm seed:bgy       # reseed barangays table
pnpm upload:geo     # upload to Supabase Storage
```

Unmatched features are logged to `public/geo/municities/bgy/_unmatched.json`.

---

## Template for new entries

```
### N. <short title> (<region / area>)

- **Affected:** <count or names>
- **Issue:** <what was wrong or missing>
- **Action:** <what was changed>
- **Basis:** <authoritative source / reasoning>
- **Status:** Automated | Manual | Unmatched
```
