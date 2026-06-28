# Data corrections

This document tracks corrections and derivations Mapa applies on top of upstream
open-source boundary data. Every entry records **what** was changed, **why**, and
the **basis** for the change. The corrected geometry is committed as GeoJSON under
`frontend/data-sets/geo/`.

## Base datasets

| Layer | Source | Notes |
|-------|--------|-------|
| Region / province / municipality | [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) (2023 GeoJSON, MIT) | Re-keyed to PSGC |
| Barangay + country | [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) (Adm0, Adm4, MIT) | Converted from shapefile to GeoJSON |
| Codes & names | [PSA PSGC](https://psa.gov.ph/classification/psgc/) | `data-sets/data/raw/psgc.csv` |

Unless listed below, geometry and attributes come unmodified aside from
reformatting and PSGC property normalization.

---

## Administrative structure notes

### NCR has no province/district level

Mapa follows the **official PSGC hierarchy**, in which the National Capital
Region (NCR, `13…`) has **no province or district tier**. Its component units
attach **directly to the region**:

| Level in NCR | Count | Examples |
|--------------|-------|----------|
| City | 16 | Manila, Quezon City, Makati… |
| Municipality | 1 | Pateros |
| SubMun | 14 | sub-units **of the City of Manila** (Tondo, Sampaloc, Binondo…) |

Because of this, `municities.province_psgc` is **nullable**, and NCR cities are
stored with `province_psgc = null` and `region_psgc = 1300000000`.

> **Why this differs from many other maps:** A lot of third-party PH datasets
> group NCR into **four "districts"** (1st–4th District of NCR / Capital,
> Eastern, Northern, Southern Manila Districts). Those are **congressional /
> legislative groupings**, *not* PSGC geographic administrative units. PSA does
> not publish census geography (or boundary geometry) at that level, so Mapa
> intentionally omits them to stay faithful to PSGC and to keep population /
> density joins keyed on real PSGC codes.

**Implication for downloads:** selecting NCR at the Region level and choosing
"All provinces" yields an empty result (NCR has none) — use "All municipalities"
instead. If congressional-district analysis is ever needed, it should be added
as a separate optional grouping, not folded into the core hierarchy.

### Population and density stats

Mapa attaches population and density to every administrative level from PSA
census data:

| Field | Source | Notes |
|-------|--------|-------|
| `pop_2010`, `pop_2015`, `pop_2020`, `pop_2024` | `data-sets/data/clean/popcen_2010_2024.csv` | Region/province/city/municipality from PSA Table B; 2024 down to barangay from the PSGC datafile |
| `area_km2` | Computed from boundary GeoJSON (`@turf/area`, WGS84) | Estimate from polygon |
| `density_2024` | `pop_2024 / area_km2` | Null when area unavailable |
| `pct_change_2020_2024` | Derived when both vintages present | Null after boundary/code changes |

`popcen_2010_2024.csv` is built by `pnpm convert:pop` from the two PSA workbooks
in `data-sets/source/`. The PSGC datafile is the code/name/2024 spine; Table B is
name-keyed only, so its 2010–2020 counts are matched back to PSGC codes by region
plus name, with the shared 2024 population as the authoritative tiebreaker (this
is what fixes places that were previously missing 2015/2020 figures). Province
totals are accepted only when the row's 2024 value equals the PSGC province total,
which keeps same-named cities (e.g. "City of Cebu" vs. Cebu province) separate.
`area_km2` is owned by `seed:stats`; the population fields and their derived
density/change are owned by `seed:pop`.

> **Area is computed from geospatial shapes.** Population counts come from PSA
> PSGC publications, but `area_km2` is **not** an official figure — it is
> calculated directly from each boundary polygon (geodesic area on WGS84 via
> `@turf/area` for region/province/municipality and `pyproj` for barangay/
> country). Because boundary geometry is simplified and generalized, these areas
> are **approximate** and may differ slightly from official land-area
> statistics. Any value derived from area — notably `density_2024`
> (`pop_2024 / area_km2`) — inherits the same approximation.

---

## Barangay shapefile join corrections

The altcoder Adm4 shapefile has 42,017 features. A direct PSGC code join initially
matched only 39,335. The following deterministic corrections recovered
**42,000 of 42,017** (99.96%).

### 1. Correspondence digit-swap (NIR-renumbered regions)

- **Affected:** ~1,293 barangays
- **Issue:** Shapefile encodes correspondence codes with the first two digits
  swapped (e.g. shapefile `604502001` ↔ CSV correspondence `064502001`).
- **Action:** Try the digit-swap transform before falling back.
- **Basis:** Verified 1:1 name match per municity after transform (e.g. Abuanan,
  Bago City barangays).
- **Status:** Automated.

### 2. Parent municity from matched PSGC + Manila SubMun roll-up

- **Affected:** 911 barangays (all Manila district barangays)
- **Issue:** Shapefile parent `adm3_psgc` uses Manila SubMun districts
  (`1380601000` Tondo, `1380606000` Sampaloc, etc.) not present in municity
  metadata; only `1380600000` (City of Manila) exists.
- **Action:** Derive parent from the matched barangay's canonical PSGC; roll
  SubMun codes up to parent city (`1380606xxx` → `1380600000`).
- **Basis:** PSGC lists districts as SubMun under City of Manila.
- **Status:** Automated.

### 3. Bacolod City municity override

- **Affected:** 61 barangays
- **Issue:** Shapefile uses stale adm3 code `630200000`; PSGC canonical is
  `1830200000`. No arithmetic correspondence path exists.
- **Action:** Map `630200000` → `1830200000`, then match barangays by name
  within the municity.
- **Basis:** 61:61 exact name overlap with PSGC CSV.
- **Status:** Automated override + name match.

### 4. Sulu region-19 → region-09 remap

- **Affected:** 410 barangays (all 19 Sulu municities)
- **Issue:** Shapefile encodes Sulu under BARMM region-19 prefix (`19066xxxx`);
  PSGC canonical municities use region-09 (`09066xxxx`).
- **Action:** Automatic remap `19066…` → `09066…`, then name-match within
  municity.
- **Basis:** 100% name overlap across all 19 Sulu municities (Talipao, Siasi,
  Jolo, etc.).
- **Status:** Automated.

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
- **Action:** Union San Rafael's polygon into Dacanlao (`0401007019`).
- **Basis:** [SC upholds merger of Barangay San Rafael with Barangay Dacanlao](https://sc.judiciary.gov.ph/) (April 2025).
- **Status:** Automated merge.

### 7. Caloocan "Barangay 176" kept as one barangay

- **Affected:** 1 barangay
- **Issue:** Shapefile has one polygon for "Barangay 176"; PSGC split it into
  176-A through 176-F (`1380100189`–`1380100194`). Cannot assign one geometry
  to six barangays without manual GIS splitting.
- **Action:** Keep it as `psgc 1380100176`, name "Barangay 176".
- **Basis:** Shapefile represents the pre-split boundary; PSGC has no single
  code for the unified barangay.
- **Status:** Synthetic entry.

### 8. Manila non-barangay parcels (NCR, City of Manila)

- **Affected:** 2 parcels — Tutuban Mall, Manila North Cemetery
- **Issue:** The altcoder Adm4 shapefile includes polygons for these areas with
  `ADM4_PCODE = null` and no PSGC barangay code. PSA assigns no census unit to
  them (commercial complex with disputed barangay claims; cemetery). They appear
  as holes in barangay-level maps (also visible on citypopulation.de).
- **Action:** Injected as named `Special` parcels into the City of Manila
  barangay file (`1380600000.json`) with sentinel PSGC codes:
  - `1380601901` — Tutuban Mall (Tondo I/II SubMun area)
  - `1380605901` — Manila North Cemetery (Santa Cruz SubMun area)
  Population is `null` (not zero); area is computed from boundary geometry;
  density is `null`.
- **Basis:** Shapefile labels + PSGC confirms SubMun totals only (no barangay
  codes for these parcels); same hole pattern as third-party PH maps.
- **Status:** Automated (post-shapefile injection).

---

## Unmatched shapefile features (superseded)

The altcoder shapefile originally had two empty-named slivers at these locations
that were logged as unmatched:

| Shapefile code | Location | Resolution |
|----------------|----------|------------|
| `1303901906` | Tondo / Tutuban area | Superseded by `1380601901` Tutuban Mall |
| `1303901907` | Santa Cruz / North Cemetery area | Superseded by `1380605901` Manila North Cemetery |

Geometry for these areas now comes from the cleaner parcel definitions, not the
shapefile slivers. The shapefile features remain dropped (no PSGC match).

---

## COA CY2024 AFR total assets (LG financial profile)

- **Source:** Commission on Audit (COA) CY 2024 Annual Financial Report (Local Government), Volume I, **Part III: Financial Profile** (`frontend/data-sets/source/afr.pdf`, PDF viewer pages 172–234).
- **Mapping:** Name normalization and alias table in `frontend/scripts/lib/afrMatch.ts`; results seeded via `pnpm seed:afr` into `division_stats.assets_2024`.
- **Units:** Report tables are in **thousand pesos**; Mapa stores and displays **actual pesos** (`value × 1000` as `bigint`).
- **Coverage:** ~98.5% of LGUs submitted financial statements; rows with all `-` in the PDF are stored as null. Component units (city colleges, hospitals, etc.) are skipped during extraction.
- **Region / country totals:** Computed as the sum of matched province, city, and municipality rows per region (not copied from provinces-only `Regional Total` subtotal lines, which omit cities and municipalities).
- **UI:** Info panel shows **Total assets [2024]** only (other financial columns are extracted but not surfaced in the app yet).

---

## How corrections are applied

Corrections are deterministic and baked into the committed GeoJSON under
`frontend/data-sets/geo/`. The boundary build pipeline that originally produced
these files (shapefile → GeoJSON conversion) is no longer part of the repo;
self-hosters consume the committed geo directly via `pnpm upload:geo` and
`pnpm seed:bgy`.

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
