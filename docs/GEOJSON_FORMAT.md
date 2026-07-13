# GeoJSON Format

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

## 2022 Presidential election data

The repository ships with pre-built election results in `data-sets/data/clean/elections_2022_president_all.csv` and in `data-sets/backup/custom_dataset_values.csv`. Running `pnpm setup` or `pnpm restore` loads these results into the database automatically — **no scraping is required** for a standard deployment.

The national (country-level) total is hardcoded to the official Congressional canvass proclamation (53,815,469 votes across 10 candidates), providing a **100% exact match** to the certified results. Sub-national rows (region, province, city/municipality, barangay) are aggregated from municipal Certificates of Canvass (COCs) scraped from the COMELEC transparency server. Province and region totals are derived by summing their constituent cities/municipalities, which correctly groups Highly Urbanized Cities (HUCs) under their geographical provinces and routes the Negros provinces to the Negros Island Region (NIR). See [`DATA_CORRECTIONS.md`](../DATA_CORRECTIONS.md) for full details.

All seed commands, including `seed:custom-elections`, are upserts and never wipe the database. Re-running the seeder after a fresh scrape merges new data (e.g. additional barangays) with existing rows.

For instructions on regenerating this data yourself, see [DEVELOPMENT.md](./DEVELOPMENT.md#regenerating-election-data-from-scratch-optional).

Back to [README](../README.md).
