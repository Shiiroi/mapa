# Data Sources & Licenses

## Geospatial Boundaries

- **Region, province, municipality GeoJSON (re-keyed to PSGC):** [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) (MIT © James Faeldon)
- **Barangay + country shapefiles (Adm0, Adm4):** [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles) (MIT © James Faeldon)

## Statistical Citations

- **Administrative Boundaries & Spatial Codes**
  - Citation: [Philippine Statistics Authority (PSA). PSGC 1Q 2026 Publication Datafile.](https://psa.gov.ph/classification/psgc/node/1684083211)
- **Population Statistics Baseline**
  - Citation: [Philippine Statistics Authority (PSA). 2024 Census of Population (2024 POPCEN) Population Counts Declared Official by the President.](https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president)
- **Demographic Distributions**
  - Citation: [Philippine Statistics Authority (PSA). PSA 2020 Census of Population and Housing: Age and Sex Distribution.](https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing)
- **Socioeconomic Baseline Matrix**
  - Citation: [Philippine Statistics Authority (PSA). Gross Domestic Product, by Province and HUCs (Constant 2018 Prices).](https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2A__PPA__2025/?tablelist=true&rxid=bdf9d8da-96f1-4100-ae09-18cb3eaeb313)
- **Local Government Financial Profiles**
  - Citation: [Commission on Audit (COA). 2024 Annual Financial Report for the Local Government, Including Bangsamoro Government (Volume I).](https://www.coa.gov.ph/reports/annual-financial-reports/afr-local-government-units/)
- **Electoral Overlays**
  - Citation: [Commission on Elections (COMELEC). 2022 National and Local Elections Results Transparency Portal.](https://2022electionresults.comelec.gov.ph/#/dashboard)
- **Geospatial Baseline Area & Density Metric Spine**
  - Citation: [Philippine Statistics Authority (PSA). Population, Land Area, Population Density, and Percent Change in Population Density of the Philippines by Region, Province/Highly Urbanized City, and City/Municipality: 2010, 2015, and 2020.](https://psa.gov.ph/system/files/phcd/2022-12/2010-2015-2020%2520Population%2520Density_Table%2520A_Using%25202013%2520Land%2520Areas_12%2520July%25202021.pdf)

Full third-party license texts are in [`NOTICE.md`](../NOTICE.md). Mapa re-keys, links, corrects, and packages these datasets; it does not claim ownership of the underlying boundary or statistical data.

## 📊 Land Area & Population Density

- **National to Municipal Levels:** Land area data utilizes the exact statutory values from the official **Philippine Statistics Authority (PSA)** [2010-2015-2020 Population Density (Table A using 2013 Land Areas)](https://psa.gov.ph/system/files/phcd/2022-12/2010-2015-2020%2520Population%2520Density_Table%2520A_Using%25202013%2520Land%2520Areas_12%2520July%25202021.pdf) publication. No data approximations are performed on these tiers.
- **Barangay Level:** Computationally approximated from geometric boundaries due to an absence of granular breakdown in the official source document.

## Notes & Disclosures

### Notes

- **a1/** Land area is based on the cadastral survey and estimated land areas (certified and provided to the Department of Budget and Management) from the Land Management Bureau, Department of Environment and Natural Resources, as of December 2013.
- **a2/** Due to unfinished cadastral survey, details do not add up to the national total.
- **a3/** Due to rounding off, the provincial totals may not be equal to the sum of the individual figures.
- **b1/** Excludes 2,739 Filipinos in Philippine embassies, consulates, and missions abroad but includes 18,989 persons in the areas disputed by the City of Pasig (National Capital Region) and the province of Rizal (Region IV-A).
- **b2/** Excludes 2,134 Filipinos in Philippine embassies, consulates, and missions abroad.
- **b3/** Excludes 2,098 Filipinos in Philippine embassies, consulates, and missions abroad.
- **\*** Land area is based on cadastral survey (certified and provided to the DBM) from the LMB, DENR, as of December 2013.
- **\*\*** Estimated land area (certified and provided to the DBM) from the LMB, DENR, as of December 2013.
- **\*\*\*** Population counts for the provinces exclude the counts of Highly Urbanized Cities.

### Administrative & Historical Corrections

1. The Negros Island Region (NIR) was abolished through Executive Order No. 38 "Revoking Executive Order No. 183 (s. 2015) which Created a Negros Island Region and for Other Purposes", signed by President Rodrigo Roa Duterte on 07 August 2017. The abolition of NIR reverted the provinces, cities, municipalities, and barangays of Negros Occidental and City of Bacolod to Region VI (Western Visayas) and Negros Oriental to Region VII (Central Visayas).
2. Renamed province from Compostela Valley under Republic Act No. 11297, dated April 17, 2019; ratified on December 7, 2019.
3. Renamed region from ARMM under Republic Act No. 11054, dated July 27, 2018; ratified on January 25, 2019.
4. Converted into a city under Republic Act No. 11086; ratified on 7 September 2019.
5. Correction of municipality name from Pinamungahan; under Municipal Mayor Certification.

## Data corrections

Open datasets and shapefile joins occasionally have gaps or code mismatches. Mapa applies deterministic corrections before committing GeoJSON; see [`DATA_CORRECTIONS.md`](../DATA_CORRECTIONS.md) for details. Current result: 42,000 of 42,017 barangay features matched or merged.

Back to [README](../README.md).
