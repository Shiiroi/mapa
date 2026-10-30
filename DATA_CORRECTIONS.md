# Data corrections

This document tracks corrections and derivations Lens applies on top of upstream
open-source boundary data. Every entry records **what** was changed, **why**, and
the **basis** for the change. The corrected geometry is committed as GeoJSON under
`frontend/data-sets/geo/`.

## Base datasets

| Layer                            | Source                                                                                                            | Notes                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Region / province / municipality | [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) (2023 GeoJSON, MIT)             | Re-keyed to PSGC                    |
| Barangay + country               | [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) (Adm0, Adm4, MIT) | Converted from shapefile to GeoJSON |
| Codes & names                    | [PSA PSGC](https://psa.gov.ph/classification/psgc/)                                                               | `data-sets/data/raw/psgc.csv`       |

Unless listed below, geometry and attributes come unmodified aside from
reformatting and PSGC property normalization.

---

## Administrative structure notes

### NCR has no province/district level

Lens follows the **official PSGC hierarchy**, in which the National Capital
Region (NCR, `13…`) has **no province or district tier**. Its component units
attach **directly to the region**:

| Level in NCR | Count | Examples                                                        |
| ------------ | ----- | --------------------------------------------------------------- |
| City         | 16    | Manila, Quezon City, Makati…                                    |
| Municipality | 1     | Pateros                                                         |
| SubMun       | 14    | sub-units **of the City of Manila** (Tondo, Sampaloc, Binondo…) |

Because of this, `municities.province_psgc` is **nullable**, and NCR cities are
stored with `province_psgc = null` and `region_psgc = 1300000000`.

> **Why this differs from many other maps:** A lot of third-party PH datasets
> group NCR into **four "districts"** (1st–4th District of NCR / Capital,
> Eastern, Northern, Southern Manila Districts). Those are **congressional /
> legislative groupings**, _not_ PSGC geographic administrative units. PSA does
> not publish census geography (or boundary geometry) at that level, so Lens
> intentionally omits them to stay faithful to PSGC and to keep population /
> density joins keyed on real PSGC codes.

**Implication for downloads:** selecting NCR at the Region level and choosing
"All provinces" yields an empty result (NCR has none) — use "All municipalities"
instead. If congressional-district analysis is ever needed, it should be added
as a separate optional grouping, not folded into the core hierarchy.

### Population and density stats

Lens attaches population and density to every administrative level from PSA
census data:

| Field                                          | Source                                                                     | Notes                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pop_2010`, `pop_2015`, `pop_2020`, `pop_2024` | `data-sets/data/clean/popcen_2010_2024.csv`                                | Region/province/city/municipality from PSA Table B; 2024 down to barangay from the PSGC datafile |
| `area_km2`                                     | Official PSA Table A statutory values (or computed fallback for barangays) | Exact PDF values for country to municipal levels; geometric approximations for barangays         |
| `density_2024`                                 | `pop_2024 / area_km2`                                                      | Derived using statutory areas (approximated for barangays)                                       |
| `pct_change_2020_2024`                         | Derived when both vintages present                                         | Null after boundary/code changes                                                                 |

`popcen_2010_2024.csv` is built by `pnpm convert:pop` from the two PSA workbooks
in `data-sets/source/`. The PSGC datafile is the code/name/2024 spine; Table B is
name-keyed only, so its 2010–2020 counts are matched back to PSGC codes by region
plus name, with the shared 2024 population as the authoritative tiebreaker (this
is what fixes places that were previously missing 2015/2020 figures). Province
totals are accepted only when the row's 2024 value equals the PSGC province total,
which keeps same-named cities (e.g. "City of Cebu" vs. Cebu province) separate.
`area_km2` is owned by `seed:stats` (which maps the exact PDF values compiled by `convert:area` / `enrich:area` and falls back to geometry for unmapped elements/barangays); the population fields and their derived density/change are owned by `seed:pop`.

> **Official Statutory Land Area.** Land area data for the Country, Region, Province, and City/Municipality levels utilizes the exact statutory values explicitly stated in the official PSA Table A (Using 2013 Land Areas) publication to ensure density metric integrity. No approximations are performed on these tiers.
>
> **Barangay Level Approximation.** Because the official PSA Table A publication does not contain a granular breakdown for individual barangays, barangay-level areas are computationally approximated from boundary polygons (geodesic area on WGS84). Since the boundary geometry is simplified and generalized, these areas are approximate. Any value derived from them (such as barangay population density) inherits the same approximation.

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

### 4. Sulu transfer to Region IX (E.O. No. 91, s. 2025 / PSA Ref. 2025-325)

- **Affected:** Province of Sulu (`0906600000`), all 19 Sulu municipalities (`0906601000`–`0906619000`), and 410 barangays
- **Issue:** Following the Supreme Court ruling excluding Sulu from BARMM and Executive Order No. 91, Series of 2025 (PSA Reference No. 2025-325, released August 29, 2025), Sulu was officially transferred to Region IX (Zamboanga Peninsula). Upstream shapefiles still encoded Sulu's `region_psgc` and regional geometry under BARMM (`1900000000`), and `Parang, Sulu` (`0906609000`) was mis-grouped under Maguindanao del Norte (`1908700000`) due to a duplicate municipality name with `Parang, Maguindanao del Norte` (`1908709000`).
- **Action:** Remapped `0906600000` and all 19 Sulu municipalities to `region_psgc: "0900000000"`, moved `Parang, Sulu` (`0906609000`) from `province-1908700000.json` to `province-0906600000.json`, and transferred Sulu's provincial polygon from BARMM (`1900000000`) to Region IX (`0900000000`) in `regions.json`.
- **Basis:** Executive Order No. 91, s. 2025 (30 July 2025) and PSA PSGC Advisory Ref. No. 2025-325 (29 August 2025).
- **Status:** Automated.

### 4b. Cotabato City & 63 North Cotabato Barangays (8 SGA Municipalities) in BARMM

- **Affected:** Cotabato City (`1908703000`), Special Geographic Area (`1909900000`, 8 municipalities / 63 barangays), and Province of Cotabato (`1204700000`)
- **Issue:** Following the January 2019 Bangsamoro Organic Law (R.A. 11054) plebiscite and formal December 2020 turnover, Cotabato City (`1908703000`) and 63 barangays from North Cotabato joined BARMM (with the 63 barangays organized into 8 new SGA municipalities in 2024: `Kapalawan`, `Old Kaabakan`, `Kadayangan`, `Nabalawag`, `Pahamuddin`, `Malidegao`, `Ligawasan`, and `Tugunan`). In the municipal/provincial layers, `Cotabato City` (`1908703000`) remained attached to North Cotabato (`1204700000`), and the `Cotabato` polygon in `provinces.json` still overlapped with the 8 SGA municipalities.
- **Action:** Moved `Cotabato City` (`1908703000`) to `province-1908700000.json` (`Maguindanao del Norte`, `region_psgc: "1900000000"`) and re-dissolved `Cotabato` (`1204700000`) in `provinces.json` from its 18 remaining municipalities.
- **Basis:** R.A. 11054 (Bangsamoro Organic Law), DILG–BARMM Turnover (Dec 15, 2020), BARMM Bangsamoro Autonomy Act Nos. 50–57, and PSA PSGC 2025–2026.
- **Status:** Automated.

### 4c. Negros Island Region (NIR — R.A. 12000)

- **Affected:** Negros Occidental (`1804500000`, including Bacolod City `1830200000`), Negros Oriental (`1804600000`), and Siquijor (`1806100000`) — 3 provinces and 63 cities/municipalities
- **Issue:** While `regions.json` included the `Negros Island Region (NIR)` (`1800000000`) polygon, `provinces.json`, `municities/meta.json`, and `municities/province-18*.json` retained legacy `region_psgc` references to Region VI (`0600000000`) and Region VII (`0700000000`).
- **Action:** Updated `region_psgc` to `"1800000000"` across all 3 provinces and 63 cities/municipalities, and updated statutory land areas for Region VI (`12,771.50 km²`), Region VII (`10,114.52 km²`), and NIR (`13,602.18 km²`).
- **Basis:** Republic Act No. 12000 (Negros Island Region Act, signed June 13, 2024) and PSA PSGC.
- **Status:** Automated.

### 4d. Taguig–Makati EMBO Transfer & Barangay-to-Municipality/Province Boundary Dissolves

- **Affected:** City of Makati (`1380300000`), Taguig City (`1381500000`), Zamboanga Sibugay (`0908300000`: `Imelda`, `Payao`, `Titay`), and all 6 CAR provinces (`Abra`, `Apayao`, `Benguet`, `Ifugao`, `Kalinga`, `Mountain Province`)
- **Issue:** Barangay-level polygons (`municities/bgy/*.json`) reflected recent Supreme Court and cadastral boundary transfers (including the transfer of Fort Bonifacio / BGC and the 10 EMBO barangays from Makati to Taguig under SC G.R. No. 235316, the `7.85 km²` transfer between Payao and Imelda in Zamboanga Sibugay, and Cordillera inter-provincial boundary settlements), but parent municipal and provincial outlines had not been re-dissolved.
- **Action:** Programmatically dissolved updated barangay polygons into their parent municipality outlines and re-dissolved the affected provincial polygons in `provinces.json`.
- **Basis:** Supreme Court G.R. No. 235316 (Taguig vs. Makati) and PSA/NAMRIA Adm4 barangay boundaries.
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

- **Affected:** 2 parcels — Tutuban Mall, Manila Chinese Cemetery
- **Issue:** The altcoder Adm4 shapefile includes polygons for these areas with
  `ADM4_PCODE = null` and no PSGC barangay code. PSA assigns no census unit to
  them (commercial complex with disputed barangay claims; cemetery). They appear
  as holes in barangay-level maps (also visible on citypopulation.de).
- **Action:** Injected as named `Special` parcels into the City of Manila
  barangay file (`1380600000.json`) with sentinel PSGC codes:
    - `1380601901` — Tutuban Mall (Tondo I/II SubMun area)
    - `1380605901` — Manila Chinese Cemetery (Santa Cruz SubMun area)
      Population is `null` (not zero); area is computed from boundary geometry;
      density is `null`.
- **Basis:** Shapefile labels + PSGC confirms SubMun totals only (no barangay
  codes for these parcels); same hole pattern as third-party PH maps.
- **Status:** Automated (post-shapefile injection).

---

## Unmatched shapefile features (superseded)

The altcoder shapefile originally had two empty-named slivers at these locations
that were logged as unmatched:

| Shapefile code | Location                         | Resolution                                         |
| -------------- | -------------------------------- | -------------------------------------------------- |
| `1303901906`   | Tondo / Tutuban area             | Superseded by `1380601901` Tutuban Mall            |
| `1303901907`   | Santa Cruz / North Cemetery area | Superseded by `1380605901` Manila Chinese Cemetery |

Geometry for these areas now comes from the cleaner parcel definitions, not the
shapefile slivers. The shapefile features remain dropped (no PSGC match).

---

## COA CY2024 AFR total assets (LG financial profile)

- **Source:** Commission on Audit (COA) CY 2024 Annual Financial Report (Local Government), Volume I, **Part III: Financial Profile** (`frontend/data-sets/source/afr.pdf`, PDF viewer pages 172–234).
- **Mapping:** Name normalization and alias table in `frontend/scripts/lib/afrMatch.ts`; results seeded via `pnpm seed:afr` into `division_stats.assets_2024`.
- **Units:** Report tables are in **thousand pesos**; Lens stores and displays **actual pesos** (`value × 1000` as `bigint`).
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

---

## 2022 Presidential Election Data Corrections & Audits

Lens integrates presidential election results from the May 2022 national election. The raw data is scraped from the public COMELEC transparency server using `scripts/py/scrape_comelec.py` and processed via `scripts/map-comelec-president.ts`.

### 1. 100% Match to Official Congressional Canvass (National level)

- **Problem:** The raw scraped files from the COMELEC transparency server aggregate to `53,639,140` total valid votes. The official final tally certified by Congress (acting as the National Board of Canvassers) proclaims `53,815,469` total valid votes. The discrepancy of `176,329` votes is due to administrative and legal exclusions from the electronic transmission feed:
    1. **Local Absentee Voting (LAV):** Around 70,000 to 80,000 votes cast by military, police, government employees, teachers, and media practitioners performing election-day duties away from their registration precincts. Under [COMELEC Resolution No. 10725](https://comelec.gov.ph/?r=AboutCOMELEC/Resolutions/ElectionLaws/Resolutions/Res10725), these ballots are manually mailed and canvassed by a Special Board of Canvassers at the Palacio del Gobernador in Intramuros, Manila. Because they are processed centrally, they never pass through a precinct Vote Counting Machine (VCM) and have no electronic files on the transparency server.
    2. **Detention Prisoner Voting (DPV / PDLs):** Ballots cast by pre-trial detainees and individuals serving sentences under one year, governed by [COMELEC Resolution No. 9371](https://comelec.gov.ph/?r=AboutCOMELEC/Resolutions/ElectionLaws/Resolutions/Res9371) (upheld by the Supreme Court in [_Aguinaldo v. New Bilibid Prison_, G.R. No. 221201](https://sc.judiciary.gov.ph/) on March 29, 2022). These are counted manually and consolidated at the municipal or national boards of canvassers, rather than via live media routers.
    3. **Untransmitted Overseas Absentee Voting (OAV):** Out of 92 foreign service posts, around 60% cast manual ballots under the Overseas Absentee Voting Act (R.A. 9189 as amended by R.A. 10590). 38 smaller posts failed to transmit their electronic COCs to the media server due to connectivity or administrative issues, instead submitting physical paper COCs directly to the Senate/NBOC.
- **Correction:** To prevent discrepancy at the country-level view, the mapping script directly injects the official Congressional canvass totals for the root row (`psgc: "0000000000"`, `Philippines`). This provides a **100% exact match** with the official proclaimed results, while sub-national levels (region down to barangay) show the geographical distribution derived from the transparency server.
- **Basis:** [Congress of the Philippines Proclamation of Winners](https://www.pna.gov.ph/articles/1175204) (May 25, 2022); [COMELEC Resolution No. 10725 (LAV rules)](https://comelec.gov.ph/?r=AboutCOMELEC/Resolutions/ElectionLaws/Resolutions/Res10725); [COMELEC Resolution No. 9371 (PDL voting rules)](https://comelec.gov.ph/?r=AboutCOMELEC/Resolutions/ElectionLaws/Resolutions/Res9371); [Supreme Court Resolution G.R. No. 221201](https://sc.judiciary.gov.ph/).

### 2. Omitted Special Geographic Area (SGA) Municipalities

- **Problem:** When mapping municipal-level data, 8 municipalities inside the Special Geographic Area (SGA) of BARMM (Pabalik, Kadayangan, Kapalawan, Tugunan, Ligawasan, Malidegao, Nuling, and SGA-8/Pinaring) do not exist in the 2022 election results.
- **Correction:** These 8 municipalities were created in **April 2024** by virtue of regional laws (BARMM Act Nos. 50-57) and plebiscites. In the 2022 elections, their constituent barangays were still part of their original municipalities in Cotabato province. They are intentionally left blank in the 2022 elections CSV, which is historically correct.
- **Basis:** Bangsamoro Organic Law (R.A. 11054) and BARMM plebiscites of April 2025.

### 3. Highly Urbanized Cities (HUCs) and Independent Cities

- **Problem:** HUCs (such as Cebu City, Davao City, Bacolod City, Zamboanga City) are administratively independent of their geographical provinces. Their Certificates of Canvass (COCs) are uploaded directly to the national level and are not present inside the parent province's COC file.
- **Correction:** The mapping script skips province-level COCs on disk. Instead, it aggregates province totals directly from the constituent municipality rows using PSGC prefix grouping (`loadLguParents`). This ensures that HUCs are correctly rolled up into their geographical provinces for spatial visualization.
- **Basis:** Geographic proximity map design (HUCs are rendered inside their geographic provinces on the map).

### 4. Negros Island Region (NIR) and NCR

- **NCR:** NCR has no provinces in the PSGC hierarchy. The script handles the legislative district COCs (like `NCR - SECOND DISTRICT`) by skipping their empty COCs and descending directly to the component municipalities (Quezon City, Pasig, etc.) to get their individual COCs.
- **NIR:** The script routes the provinces of Negros Occidental and Negros Oriental (PSGC prefix `18`) to Region `1800000000` (Negros Island Region) based on the boundary definition, even though the raw 2022 election data lists them under Region VI and Region VII. This ensures the map correctly renders them inside the newly enacted NIR boundaries.
