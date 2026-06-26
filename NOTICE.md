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
  corrected or joined during Mapa's pipeline — see `DATA_CORRECTIONS.md`.

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
  converted to GeoJSON via `frontend/scripts/py/shape_to_geojson.py`. Joined
  to PSA PSGC codes from `public/psgc.csv`. Corrections documented in
  `DATA_CORRECTIONS.md`.

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
- **Usage in Mapa:** Administrative codes, names, and hierarchy (`public/psgc.csv`).
  Population and other statistics introduced in later phases are also sourced
  from PSA and attributed with their specific reference year.

> Mapa is an independent project and is not affiliated with, endorsed by, or an
> official product of the PSA or any government agency.

---

## Attribution summary (for site footer / data page)

> Boundary data from
> [philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles)
> and [philippines-json-maps](https://github.com/faeldon/philippines-json-maps)
> © James Faeldon (MIT). Administrative codes and names from the
> [PSA PSGC](https://psa.gov.ph/classification/psgc/). Some boundaries corrected
> or joined by Mapa — see [Data Corrections](./DATA_CORRECTIONS.md).
