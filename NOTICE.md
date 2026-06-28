# NOTICE

Mapa includes and builds upon third-party open data and software. The original
licenses and attributions are reproduced below and must be retained in
redistributions of the corresponding data or code.

---

## 1. philippines-json-maps (region / province / municipality GeoJSON)

- **Project:** philippines-json-maps
- **Author:** James Faeldon
- **Source:** https://github.com/faeldon/philippines-json-maps
- **License:** MIT
- **Usage in Mapa:** Region, province, and municipality boundary geometry is
  re-keyed to PSGC from this project's GeoJSON. Some geometries have been
  corrected or joined — see [`DATA_CORRECTIONS.md`](./DATA_CORRECTIONS.md).

```
The MIT License (MIT)

Copyright (c) James Faeldon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. philippines-psgc-shapefiles (barangay + country shapefiles)

- **Project:** philippines-psgc-shapefiles
- **Source:** https://github.com/altcoder/philippines-psgc-shapefiles
- **License:** MIT
- **Usage in Mapa:** Barangay (Adm4) and country (Adm0) boundary shapefiles
  were joined to PSA PSGC codes and committed as GeoJSON under `frontend/data-sets/geo/`.
  Corrections are documented in [`DATA_CORRECTIONS.md`](./DATA_CORRECTIONS.md).

```
MIT License

Copyright (c) James Faeldon.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. Philippine Standard Geographic Code (PSGC)

- **Publisher:** Philippine Statistics Authority (PSA)
- **Source:** https://psa.gov.ph/classification/psgc/
- **Usage in Mapa:** Administrative codes, names, hierarchy, and population
  counts (`frontend/data-sets/data/raw/psgc.csv`). Census and economic statistics
  are sourced from PSA publications (see sections 4–5 below).

> Mapa is an independent project and is not affiliated with, endorsed by, or an
> official product of the PSA or any government agency.

---

## 4. PSA statistics (population, age/sex, GDP)

- **Population (2010, 2015, 2020, 2024 censuses):** PSA PSGC publication datafile
  (2024 counts, down to barangay) and PSA Table B — Population by Province, City,
  and Municipality (2010/2015/2020/2024 counts down to city/municipality)
  (https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president)
- **Age & sex distribution:** PSA 2020 Census of Population and Housing
  (https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing)
- **GDP (constant 2018 prices):** PSA Subnational Economic Accounts
  (https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2B__GP__RG__GRD/0012B5CPGD1.px/)

---

## 5. Commission on Audit (COA) — local government assets

- **Source:** COA CY 2024 Annual Financial Report, Local Government Units
  (https://www.coa.gov.ph/reports/annual-financial-reports/afr-local-government-units/)
- **Usage in Mapa:** Total assets per LGU (`division_stats.assets_2024`).

---

## 6. COMELEC 2022 election results

- **Source:** Commission on Elections — 2022 transparency results
  (https://2022electionresults.comelec.gov.ph/)
- **License:** Public domain (Republic Act No. 8293, Section 176 — works of the
  Philippine government)
- **Usage in Mapa:** Built-in presidential election overlay (`custom_datasets` /
  `custom_stats`), seeded from `data-sets/data/clean/elections_2022_president_all.csv`.
- **Scraper credit:** Download tooling is vendored and adapted from
  [ianalis/scraper2022](https://github.com/ianalis/scraper2022) (MIT). See
  `frontend/scripts/py/COMELEC_SCRAPER_LICENSE.txt`.

---

## Attribution summary (for site footer / data page)

> Boundary data from
> [philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles)
> and [philippines-json-maps](https://github.com/faeldon/philippines-json-maps)
> © James Faeldon (MIT). Administrative codes and names from the
> [PSA PSGC](https://psa.gov.ph/classification/psgc/). Population, age/sex, and
> GDP from PSA. Total assets from
> [COA CY 2024 AFR (Local Government)](https://www.coa.gov.ph/reports/annual-financial-reports/afr-local-government-units/).
> 2022 election results from
> [COMELEC transparency results](https://2022electionresults.comelec.gov.ph/)
> (public domain). Some boundaries corrected or joined by Mapa — see
> [Data Corrections](./DATA_CORRECTIONS.md).
