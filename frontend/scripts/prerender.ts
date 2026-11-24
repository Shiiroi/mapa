import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
    computeMetricRanks,
    computeMunicityAdjacency,
    getCityNameAliases,
    loadCoaFinanceCatalog,
    loadElection2022Catalog,
    loadGeoCatalog,
    loadMunicityBarangays,
    loadPsgcExtraMeta,
    loadZipCodeCatalog,
    summarizeAgeCohorts,
    type BarangayRecord,
    type CoaFinanceRecord,
    type ElectionSummary,
    type GeoBounds,
    type MunicityRecord,
    type PlaceZipInfo,
    type PsgcExtraMeta,
    type ProvinceRecord,
    type RankInfo,
    type RawGeoEntity,
} from "./lib/geoCatalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://lens.mapaph.com";

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function fmtInt(val: number | null | undefined): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "N/A";
    return Math.round(val).toLocaleString("en-US");
}

function fmtDec(val: number | null | undefined, digits = 1): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "N/A";
    return val.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPct(val: number | null | undefined): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "N/A";
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toFixed(2)}%`;
}

function fmtPhp(val: number | null | undefined): string {
    if (val === null || val === undefined || !Number.isFinite(val)) return "N/A";
    const sign = val < 0 ? "-" : "";
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000_000) return `${sign}PHP ${(abs / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `${sign}PHP ${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}PHP ${(abs / 1_000_000).toFixed(1)}M`;
    return `${sign}PHP ${Math.round(abs).toLocaleString("en-US")}`;
}

interface PageMeta {
    title: string;
    description: string;
    keywords: string;
    canonical: string;
    jsonLd: Record<string, unknown>[];
    bodyHtml: string;
    dossierHtml?: string;
    initialPlace?: Record<string, unknown>;
}

function renderBreadcrumbsHtml(items: { label: string; href?: string }[]): string {
    const links = items
        .map((item, idx) =>
            item.href && idx < items.length - 1
                ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
                : `<span>${escapeHtml(item.label)}</span>`,
        )
        .join(' <span aria-hidden="true">&rsaquo;</span> ');
    return `<nav aria-label="Breadcrumb">${links}</nav>`;
}

interface EntityRanks {
    scope: string;
    pop?: RankInfo;
    density?: RankInfo;
    area?: RankInfo;
    assets?: RankInfo;
}

interface TelemetryExtra {
    meta?: PsgcExtraMeta;
    bounds?: GeoBounds | null;
    urbanCount?: number;
    ruralCount?: number;
    zipInfo?: PlaceZipInfo;
}

function buildInitialPlacePayload(
    entity: RawGeoEntity,
    level: "region" | "province" | "municipality",
    breadcrumb: string,
    ids: { region_psgc?: string | null; province_psgc?: string | null; municity_psgc?: string | null },
): Record<string, unknown> {
    return {
        psgc: entity.psgc,
        name: entity.name.trim(),
        level,
        geo_lvl: entity.geo_lvl,
        breadcrumb,
        region_psgc: ids.region_psgc ?? null,
        province_psgc: ids.province_psgc ?? null,
        municity_psgc: ids.municity_psgc ?? null,
        pop_2010: entity.pop_2010 ?? null,
        pop_2015: entity.pop_2015 ?? null,
        pop_2020: entity.pop_2020 ?? null,
        pop_2024: entity.pop_2024 ?? null,
        pop_male_2020: entity.pop_male_2020 ?? null,
        pop_female_2020: entity.pop_female_2020 ?? null,
        age_sex_2020: entity.age_sex_2020 ?? null,
        area_km2: entity.area_km2 ?? null,
        density_2024: entity.density_2024 ?? null,
        pct_change_2020_2024: entity.pct_change_2020_2024 ?? null,
        assets_2024: entity.assets_2024 ?? null,
        gdp_2022: entity.gdp_2022 ?? null,
        gdp_2023: entity.gdp_2023 ?? null,
        gdp_2024: entity.gdp_2024 ?? null,
    };
}

function buildDatasetDistribution(canonical: string) {
    return {
        license: "https://opensource.org/licenses/MIT",
        creator: { "@type": "Organization", name: "MapaPH", url: "https://www.mapaph.com" },
        distribution: [
            {
                "@type": "DataDownload",
                encodingFormat: "application/geo+json",
                contentUrl: `${canonical}?tab=geojson`,
            },
        ],
    };
}

function renderDossierActionBar(urlPath: string): string {
    return `
        <div class="lens-dossier-actions" aria-label="Interactive Map &amp; Export Tools">
            <a href="${urlPath}?tab=geojson">Export GeoJSON Boundary</a>
            <a href="${urlPath}?tab=compare">Compare Side-by-Side</a>
            <a href="${urlPath}?tab=custom">2022 Election &amp; Custom CSV Map</a>
            <a href="/directory">National Rankings Directory</a>
        </div>
    `;
}

function formatRank(rank: RankInfo | undefined, scope: string): string {
    return rank ? ` (#${rank.rank} of ${rank.total} in ${scope})` : "";
}

function renderTelemetryHtml(
    entity: RawGeoEntity,
    classification: string,
    ranks?: EntityRanks,
    extra?: TelemetryExtra,
): string {
    const scope = ranks?.scope ?? "";
    const fullClass = extra?.meta?.isCapital ? `${classification} (Provincial Capital)` : classification;
    const rows: [string, string][] = [
        ["Classification", fullClass],
        ["10-Digit PSGC Code", entity.psgc],
        ...(entity.correspondence && entity.correspondence !== entity.psgc
            ? [["Legacy 9-Digit Correspondence Code", entity.correspondence] as [string, string]]
            : []),
        ...(extra?.zipInfo
            ? [
                [
                    "PHLPost ZIP / Postal Code",
                    extra.zipInfo.uniqueZips.length > 1
                        ? `${extra.zipInfo.zipRange} (Primary: ${extra.zipInfo.primaryZip})`
                        : extra.zipInfo.primaryZip,
                ] as [string, string],
            ]
            : []),
        ...(extra?.meta?.incomeClass
            ? [["DOF Income Classification", `${extra.meta.incomeClass} Class`] as [string, string]]
            : []),
        ...(extra?.meta?.oldNames
            ? [["Former / Historical Name", extra.meta.oldNames] as [string, string]]
            : []),
        ["2024 Census Population", `${fmtInt(entity.pop_2024)}${formatRank(ranks?.pop, scope)}`],
        ...(entity.pct_change_2020_2024 != null
            ? [["2020–2024 Population Change", fmtPct(entity.pct_change_2020_2024)] as [string, string]]
            : []),
        ["Land Area (km²)", `${fmtDec(entity.area_km2, 2)}${formatRank(ranks?.area, scope)}`],
        ["Population Density (/km²)", `${fmtInt(entity.density_2024)}${formatRank(ranks?.density, scope)}`],
    ];

    if (extra?.bounds) {
        rows.push([
            "Geographic Coordinates (WGS 84)",
            `${extra.bounds.lat.toFixed(4)}° N, ${extra.bounds.lng.toFixed(4)}° E (Bounds: ${extra.bounds.minLat.toFixed(2)}°–${extra.bounds.maxLat.toFixed(2)}° N, ${extra.bounds.minLng.toFixed(2)}°–${extra.bounds.maxLng.toFixed(2)}° E)`,
        ]);
    }
    if (extra?.urbanCount != null && extra?.ruralCount != null && extra.urbanCount + extra.ruralCount > 0) {
        rows.push([
            "Barangay Urbanization (2020 CPH)",
            `${extra.urbanCount} Urban, ${extra.ruralCount} Rural (${extra.urbanCount + extra.ruralCount} total)`,
        ]);
    }
    if (entity.assets_2024 != null) {
        rows.push(["COA Financial Assets (2024)", `${fmtPhp(entity.assets_2024)}${formatRank(ranks?.assets, scope)}`]);
    }
    if (entity.gdp_2024 != null) {
        rows.push(["Gross Domestic Product (2024)", fmtPhp(entity.gdp_2024)]);
    }

    const trs = rows
        .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>Key Geographic &amp; Statistical Profile</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <tbody>${trs}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderZipDirectoryHtml(placeName: string, zipInfo: PlaceZipInfo | undefined): string {
    if (!zipInfo || zipInfo.entries.length <= 1) return "";
    const rows = zipInfo.entries
        .map((e) => `<tr><td>${escapeHtml(e.name)}</td><td><code>${escapeHtml(e.zip)}</code></td></tr>`)
        .join("\n");
    return `
        <section class="lens-dossier-section">
            <h2>Postal &amp; ZIP Code Directory for ${escapeHtml(placeName)} (PHLPost)</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <thead><tr><th>Post Office / Postal Zone</th><th>4-Digit ZIP Code</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderProvinceSuperlativesHtml(province: ProvinceRecord): string {
    if (province.municities.length === 0) return "";
    const citiesCount = province.municities.filter((m) => m.geo_lvl === "City").length;
    const munsCount = province.municities.length - citiesCount;
    const pickMax = (fn: (m: MunicityRecord) => number | null) =>
        [...province.municities]
            .filter((m) => fn(m) != null && Number.isFinite(fn(m)!))
            .sort((a, b) => (fn(b) ?? -Infinity) - (fn(a) ?? -Infinity))[0] ?? null;

    const topPop = pickMax((m) => m.pop_2024);
    const topArea = pickMax((m) => m.area_km2);
    const topDensity = pickMax((m) => m.density_2024);
    const topAssets = pickMax((m) => m.assets_2024);

    const rows: string[] = [
        `<tr><th>Municipal Composition</th><td>${citiesCount} ${citiesCount === 1 ? "City" : "Cities"} and ${munsCount} ${munsCount === 1 ? "Municipality" : "Municipalities"} (${province.municities.length} total LGUs)</td></tr>`,
    ];
    if (topPop) {
        rows.push(`<tr><th>Most Populous Jurisdiction</th><td><a href="${topPop.urlPath}">${escapeHtml(topPop.name)}</a> (${fmtInt(topPop.pop_2024)} residents)</td></tr>`);
    }
    if (topArea) {
        rows.push(`<tr><th>Largest by Land Area</th><td><a href="${topArea.urlPath}">${escapeHtml(topArea.name)}</a> (${fmtDec(topArea.area_km2, 1)} km²)</td></tr>`);
    }
    if (topDensity) {
        rows.push(`<tr><th>Highest Population Density</th><td><a href="${topDensity.urlPath}">${escapeHtml(topDensity.name)}</a> (${fmtInt(topDensity.density_2024)} /km²)</td></tr>`);
    }
    if (topAssets) {
        rows.push(`<tr><th>Highest COA Assets (2024)</th><td><a href="${topAssets.urlPath}">${escapeHtml(topAssets.name)}</a> (${escapeHtml(fmtPhp(topAssets.assets_2024))})</td></tr>`);
    }

    return `
        <section class="lens-dossier-section">
            <h2>Provincial Highlights &amp; Municipal Breakdown</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <tbody>${rows.join("\n")}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderCoaFinanceHtml(entityName: string, fin: CoaFinanceRecord | undefined): string {
    if (!fin) return "";
    const entries: [string, number | null][] = [
        ["Total Assets", fin.assets],
        ["Total Liabilities", fin.liabilities],
        ["Net Equity", fin.equity],
        ["Annual Revenue", fin.revenue],
        ["Annual Expenses", fin.expenses],
        ["Net Surplus / Deficit", fin.surplus],
    ];
    const valid = entries.filter(([, v]) => v != null && Number.isFinite(v));
    if (valid.length < 2) return "";

    const rows = valid
        .map(([label, val]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(fmtPhp(val))}</td></tr>`)
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>COA Financial Profile (CY 2024 Annual Financial Report)</h2>
            <p>Commission on Audit (COA) fiscal statement summary for ${escapeHtml(entityName)}:</p>
            <div class="lens-dossier-table-wrap">
                <table>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderElection2022Html(entityName: string, urlPath: string, election: ElectionSummary | undefined): string {
    if (!election || election.candidates.length === 0) return "";
    const rows = election.candidates
        .map(
            (c) =>
                `<tr><td>${escapeHtml(c.name)}</td><td>${fmtInt(c.votes)}</td><td>${c.pct.toFixed(1)}%</td></tr>`,
        )
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>2022 Presidential Election Results (COMELEC)</h2>
            <p>Top presidential candidates in ${escapeHtml(entityName)} out of ${fmtInt(election.totalVotes)} total votes cast:</p>
            <div class="lens-dossier-table-wrap">
                <table>
                    <thead><tr><th>Candidate</th><th>Votes</th><th>Share</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p style="padding-bottom: 0.85rem;"><a href="${urlPath}?tab=custom">Visualize Election Choropleth Overlay on Interactive Map</a></p>
        </section>
    `;
}

function renderCensusHistoryHtml(entity: RawGeoEntity): string {
    const years: { year: number; value: number | null }[] = [
        { year: 2010, value: entity.pop_2010 },
        { year: 2015, value: entity.pop_2015 },
        { year: 2020, value: entity.pop_2020 },
        { year: 2024, value: entity.pop_2024 },
    ].filter((y) => y.value != null);

    if (years.length < 2) return "";

    const rows = years
        .map((row, idx) => {
            const prev = idx > 0 ? years[idx - 1].value : null;
            const change =
                prev && prev > 0 && row.value != null ? `${(((row.value - prev) / prev) * 100).toFixed(2)}%` : "—";
            return `<tr><td>${row.year}</td><td>${fmtInt(row.value)}</td><td>${change}</td></tr>`;
        })
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>PSA Population Census History</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <thead><tr><th>Census Year</th><th>Population</th><th>Change vs Prior</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderGdpHistoryHtml(entity: RawGeoEntity): string {
    const years = [
        { year: 2022, value: entity.gdp_2022 },
        { year: 2023, value: entity.gdp_2023 },
        { year: 2024, value: entity.gdp_2024 },
    ].filter((y) => y.value != null);

    if (years.length === 0) return "";

    const rows = years
        .map((y) => `<tr><td>${y.year}</td><td>${fmtPhp(y.value)}</td></tr>`)
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>GDP Series (PSA Regional &amp; Provincial Accounts)</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <thead><tr><th>Year</th><th>GDP (Constant Prices)</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderDemographicsHtml(entity: RawGeoEntity): string {
    const hasSex = entity.pop_male_2020 != null && entity.pop_female_2020 != null;
    const cohorts = summarizeAgeCohorts(entity.age_sex_2020);
    if (!hasSex && !cohorts) return "";

    const parts: string[] = [];
    if (hasSex) {
        const total = (entity.pop_male_2020 || 0) + (entity.pop_female_2020 || 0);
        const malePct = total > 0 ? (((entity.pop_male_2020 || 0) / total) * 100).toFixed(1) : "N/A";
        const femalePct = total > 0 ? (((entity.pop_female_2020 || 0) / total) * 100).toFixed(1) : "N/A";
        parts.push(`
            <tr><td>Male (2020 CPH)</td><td>${fmtInt(entity.pop_male_2020)} (${malePct}%)</td></tr>
            <tr><td>Female (2020 CPH)</td><td>${fmtInt(entity.pop_female_2020)} (${femalePct}%)</td></tr>
        `);
    }
    if (cohorts) {
        parts.push(`
            <tr><td>Young Dependents (0–14 yrs)</td><td>${fmtInt(cohorts.young)} (${cohorts.youngPct.toFixed(1)}%)</td></tr>
            <tr><td>Working-Age Population (15–64 yrs)</td><td>${fmtInt(cohorts.working)} (${cohorts.workingPct.toFixed(1)}%)</td></tr>
            <tr><td>Senior Population (65+ yrs)</td><td>${fmtInt(cohorts.senior)} (${cohorts.seniorPct.toFixed(1)}%)</td></tr>
            ${cohorts.dependencyRatio != null ? `<tr><td>Age Dependency Ratio (2020 CPH)</td><td>${cohorts.dependencyRatio.toFixed(1)} dependents per 100 working-age</td></tr>` : ""}
        `);
    }

    return `
        <section class="lens-dossier-section">
            <h2>Age &amp; Sex Demographic Structure (2020 CPH)</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <tbody>${parts.join("\n")}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderSubdivisionsTableHtml(title: string, items: { name: string; urlPath: string; pop_2024: number | null; area_km2: number | null; density_2024: number | null; assets_2024: number | null }[], preSorted = false): string {
    if (items.length === 0) return "";
    const sorted = preSorted ? items : [...items].sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1));
    const rows = sorted
        .map(
            (item) => `
            <tr>
                <td><a href="${item.urlPath}">${escapeHtml(item.name)}</a></td>
                <td>${fmtInt(item.pop_2024)}</td>
                <td>${fmtDec(item.area_km2, 1)}</td>
                <td>${fmtInt(item.density_2024)}</td>
                <td>${item.assets_2024 != null ? escapeHtml(fmtPhp(item.assets_2024)) : "—"}</td>
            </tr>
        `,
        )
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>${escapeHtml(title)} (${sorted.length})</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Jurisdiction</th>
                            <th>2024 Population</th>
                            <th>Area (km²)</th>
                            <th>Density (/km²)</th>
                            <th>COA Assets (2024)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderBarangaysTableHtml(
    municityName: string,
    barangays: BarangayRecord[],
    totalMunicityPop: number | null,
    psgcMeta: Map<string, PsgcExtraMeta>,
): string {
    if (barangays.length === 0) return "";
    const sorted = [...barangays].sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1));
    const rows = sorted
        .map((b) => {
            const share =
                b.pop_2024 != null && totalMunicityPop != null && totalMunicityPop > 0
                    ? `${((b.pop_2024 / totalMunicityPop) * 100).toFixed(1)}%`
                    : "—";
            const ur = psgcMeta.get(b.psgc)?.urbanRural;
            const urLabel = ur === "U" ? "Urban" : ur === "R" ? "Rural" : "—";
            const changeStr = b.pct_change_2020_2024 != null ? fmtPct(b.pct_change_2020_2024) : "—";
            return `
            <tr>
                <td>${escapeHtml(b.name)}</td>
                <td><code>${escapeHtml(b.psgc)}</code></td>
                <td>${urLabel}</td>
                <td>${fmtInt(b.pop_2024)}</td>
                <td>${share}</td>
                <td>${escapeHtml(changeStr)}</td>
                <td>${fmtDec(b.area_km2, 2)}</td>
                <td>${fmtInt(b.density_2024)}</td>
            </tr>
        `;
        })
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>Barangays in ${escapeHtml(municityName)} (${sorted.length})</h2>
            <div class="lens-dossier-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Barangay</th>
                            <th>PSGC Code</th>
                            <th>Classification</th>
                            <th>2024 Population</th>
                            <th>Share</th>
                            <th>2020–24 Change</th>
                            <th>Area (km²)</th>
                            <th>Density (/km²)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

function buildPlaceFaqSchemaAndHtml(opts: {
    placeName: string;
    locationName: string;
    levelLabel: string;
    urlPath: string;
    popStr: string;
    areaStr: string;
    densityStr: string;
    incomeClass: string | null;
    bounds: GeoBounds | null;
    zipInfo?: PlaceZipInfo;
    subdivisionLabel: string;
    subdivisionCount: number;
    topSubdivisions: string[];
}): { faqJsonLd: Record<string, unknown>; faqHtml: string } {
    const {
        placeName,
        locationName,
        levelLabel,
        urlPath,
        popStr,
        areaStr,
        densityStr,
        incomeClass,
        bounds,
        zipInfo,
        subdivisionLabel,
        subdivisionCount,
        topSubdivisions,
    } = opts;

    const topText = topSubdivisions.length > 0 ? `, with the most populous being ${topSubdivisions.join(", ")}` : "";
    const incomeText = incomeClass ? ` It is classified as a ${incomeClass} income-class ${levelLabel.toLowerCase()}.` : "";
    const coordText = bounds
        ? ` Its geographic center in WGS 84 coordinates is ${bounds.lat.toFixed(4)}° N, ${bounds.lng.toFixed(4)}° E.`
        : "";

    const qa: { q: string; a: string }[] = [
        {
            q: `What is the population of ${locationName} in 2024?`,
            a: `According to the 2024 PSA census, ${locationName} has a population of ${popStr} and a population density of ${densityStr} residents per square kilometer.`,
        },
        ...(zipInfo
            ? [
                {
                    q: `What is the ZIP code (postal code) of ${locationName}?`,
                    a:
                        zipInfo.uniqueZips.length > 1
                            ? `The official PHLPost 4-digit ZIP / postal codes for ${locationName} span ${zipInfo.zipRange}, with ${zipInfo.primaryZip} as the primary postal code across ${zipInfo.uniqueZips.length} postal zones.`
                            : `The official PHLPost 4-digit ZIP / postal code for ${locationName} is ${zipInfo.primaryZip}.`,
                },
            ]
            : []),
        {
            q: `How many ${subdivisionLabel} are in ${locationName}?`,
            a: `${placeName} comprises ${subdivisionCount} ${subdivisionLabel}${topText}.`,
        },
        {
            q: `What is the land area, income classification, and coordinates of ${locationName}?`,
            a: `${locationName} covers a land area of ${areaStr} km².${incomeText}${coordText}`,
        },
        {
            q: `How can I view the interactive map or download GeoJSON boundaries for ${locationName}?`,
            a: `You can explore the interactive choropleth map and export standards-compliant RFC 7946 GeoJSON polygons (WGS 84) directly from Lens at ${BASE_URL}${urlPath}?tab=geojson.`,
        },
    ];

    const faqJsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: qa.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
            },
        })),
    };

    const faqItems = qa
        .map((item) => `<dt><strong>${escapeHtml(item.q)}</strong></dt><dd>${escapeHtml(item.a)}</dd>`)
        .join("\n");

    const faqHtml = `
        <section class="lens-dossier-section">
            <h2>Quick Facts &amp; Frequently Asked Questions about ${escapeHtml(placeName)}</h2>
            <dl>
                ${faqItems}
            </dl>
        </section>
    `;

    return { faqJsonLd, faqHtml };
}

function renderAdjacentMunicitiesHtml(municityName: string, neighbors: MunicityRecord[]): string {
    if (neighbors.length === 0) return "";
    const links = neighbors
        .map((n) => {
            const label = n.province ? `${n.name}, ${n.province.name}` : n.name;
            return `<li><a href="${n.urlPath}">${escapeHtml(label)}</a> (${fmtInt(n.pop_2024)} pop.)</li>`;
        })
        .join("\n");

    return `
        <section class="lens-dossier-section">
            <h2>Bordering Cities &amp; Municipalities of ${escapeHtml(municityName)} (${neighbors.length})</h2>
            <ul>
                ${links}
            </ul>
        </section>
    `;
}

function buildGeoJsonFooterLinks(urlPath: string): string {
    return `
        <section class="lens-dossier-section">
            <h2>GeoJSON Downloads &amp; Interactive Exploration</h2>
            <ul>
                <li><a href="${urlPath}?tab=geojson">Open Interactive GeoJSON Boundary Exporter</a> (IETF RFC 7946 / WGS 84 EPSG:4326)</li>
                <li><a href="${urlPath}">Inspect Interactive Choropleth Map &amp; Demographic Charts</a></li>
                <li><a href="/directory">Browse All Philippine Regions, Provinces &amp; Cities</a></li>
                <li><a href="/faq">Technical Methodology, PSGC Standard &amp; GeoJSON FAQ</a></li>
            </ul>
        </section>
    `;
}

async function prerender() {
    const distPath = path.resolve(__dirname, "../dist");
    const templatePath = path.resolve(distPath, "index.html");

    let templateHtml: string;
    try {
        templateHtml = await fs.readFile(templatePath, "utf8");
    } catch {
        console.error(`[prerender] Dist index.html not found at ${templatePath}. Run 'vite build' first.`);
        process.exit(1);
    }

    const [catalog, psgcMeta, coaFinance, elections2022] = await Promise.all([
        loadGeoCatalog(),
        loadPsgcExtraMeta(),
        loadCoaFinanceCatalog(),
        loadElection2022Catalog(),
    ]);
    const [municityAdjacency, zipCatalog] = await Promise.all([
        computeMunicityAdjacency(catalog.municities),
        loadZipCodeCatalog(catalog.provinces, catalog.municities, psgcMeta),
    ]);

    const provincePopRanks = computeMetricRanks(catalog.provinces, (p) => p.pop_2024);
    const provinceDensityRanks = computeMetricRanks(catalog.provinces, (p) => p.density_2024);
    const provinceAreaRanks = computeMetricRanks(catalog.provinces, (p) => p.area_km2);
    const provinceAssetRanks = computeMetricRanks(catalog.provinces, (p) => p.assets_2024);

    const muniRanksByProv = new Map<
        string,
        {
            pop: Map<string, RankInfo>;
            density: Map<string, RankInfo>;
            area: Map<string, RankInfo>;
            assets: Map<string, RankInfo>;
        }
    >();
    for (const prov of catalog.provinces) {
        muniRanksByProv.set(prov.psgc, {
            pop: computeMetricRanks(prov.municities, (m) => m.pop_2024),
            density: computeMetricRanks(prov.municities, (m) => m.density_2024),
            area: computeMetricRanks(prov.municities, (m) => m.area_km2),
            assets: computeMetricRanks(prov.municities, (m) => m.assets_2024),
        });
    }

    const pagesToRender = new Map<string, PageMeta>();

    const sortedRegions = [...catalog.regions].sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1));
    const totalPop = catalog.regions.reduce((sum, r) => sum + (r.pop_2024 ?? 0), 0);

    // 1. Homepage
    pagesToRender.set("/", {
        title: "Philippines GeoJSON Boundaries & Interactive Maps | Lens (MapaPH)",
        description:
            "Free GeoJSON administrative boundaries for every Philippine region, province, city, municipality, and barangay. Visualize population density, census metrics, GDP, and COA LGU data.",
        keywords:
            "philippines geojson, geojson philippines, ph map, philippines map, gis mapping philippines, population density map philippines, PSGC map, mapaph",
        canonical: `${BASE_URL}/`,
        jsonLd: [
            {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "Lens (MapaPH)",
                url: `${BASE_URL}/`,
                applicationCategory: "GeographicInformationSystem",
                operatingSystem: "All",
                description:
                    "Interactive Philippines map for visualizing census, economic, and election data, and downloading standards-compliant GeoJSON boundaries.",
            },
            {
                "@context": "https://schema.org",
                "@type": "Dataset",
                name: "Philippine Administrative Boundaries GeoJSON & Census Dataset",
                description:
                    "Complete Philippine administrative boundary vector data down to the barangay level, aligned with 10-digit PSGC classification, 2024 PSA census, GDP, and COA financial datasets.",
                url: `${BASE_URL}/`,
                spatialCoverage: { "@type": "Place", name: "Philippines" },
                distribution: [
                    {
                        "@type": "DataDownload",
                        encodingFormat: "application/geo+json",
                        contentUrl: `${BASE_URL}/`,
                    },
                ],
            },
        ],
        bodyHtml: `
            <div class="seo-fallback-content">
                <h1>Philippines GeoJSON Boundaries &amp; Interactive Choropleth Maps</h1>
                <p>
                    Lens (MapaPH) is an open-source Philippine geospatial data visualizer and administrative reference covering ${fmtInt(totalPop)} residents across ${catalog.regions.length} regions, ${catalog.provinces.length} provinces &amp; NCR, ${catalog.municities.length.toLocaleString("en-US")} cities &amp; municipalities, and 42,011 barangays.
                </p>
                ${renderSubdivisionsTableHtml("Regions of the Philippines", sortedRegions)}
                <h2>Core Datasets &amp; Tools</h2>
                <ul>
                    <li><a href="/directory">Complete Geographic Directory &amp; Statistical Rankings (Regions, Provinces, Cities)</a></li>
                    <li><a href="/faq">Technical FAQ &amp; Cartographic Methodology (RFC 7946 / PSGC 1Q 2026)</a></li>
                </ul>
            </div>
        `,
    });

    // 2. Directory page
    const sortedProvinces = [...catalog.provinces].sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1));
    const topMunicitiesByPop = [...catalog.municities]
        .sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1))
        .slice(0, 100)
        .map((m) => ({
            ...m,
            name: m.province ? `${m.name}, ${m.province.name}` : m.name,
        }));
    const topMunicitiesByAssets = [...catalog.municities]
        .filter((m) => m.assets_2024 != null)
        .sort((a, b) => (b.assets_2024 ?? -1) - (a.assets_2024 ?? -1))
        .slice(0, 50)
        .map((m) => ({
            ...m,
            name: m.province ? `${m.name}, ${m.province.name}` : m.name,
        }));
    pagesToRender.set("/directory", {
        title: "Philippines Geographic Directory, PSGC Codes, Population & GeoJSON Index | Lens",
        description:
            "Search and rank all 18 Philippine regions, 84 provinces, and 1,642 cities & municipalities by 2024 census population, density, land area, GDP, COA assets, and GeoJSON downloads.",
        keywords:
            "philippines provinces by population, list of cities philippines, psgc directory, philippines geojson index, coa lgu assets ranking",
        canonical: `${BASE_URL}/directory`,
        jsonLd: [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` },
                    { "@type": "ListItem", position: 2, name: "Directory", item: `${BASE_URL}/directory` },
                ],
            },
        ],
        bodyHtml: `
            <div class="seo-fallback-content">
                ${renderBreadcrumbsHtml([{ label: "Philippines", href: "/" }, { label: "Geographic Directory" }])}
                <h1>Philippine Geographic Directory &amp; Statistical Rankings</h1>
                <p>
                    Ranked national registry of ${catalog.regions.length} regions, ${catalog.provinces.length} provinces, and ${catalog.municities.length.toLocaleString("en-US")} cities and municipalities keyed by 10-digit PSGC codes with RFC 7946 GeoJSON boundary downloads.
                </p>
                ${renderSubdivisionsTableHtml("Philippine Regions Ranked by Population (2024)", sortedRegions, true)}
                ${renderSubdivisionsTableHtml("Philippine Provinces Ranked by Population (2024)", sortedProvinces, true)}
                ${renderSubdivisionsTableHtml("Top 100 Most Populous Philippine Cities & Municipalities (2024 Census)", topMunicitiesByPop, true)}
                ${renderSubdivisionsTableHtml("Top 50 Philippine Cities & Municipalities by COA Assets (2024)", topMunicitiesByAssets, true)}
            </div>
        `,
    });

    // 3. Static Docs: FAQ, Privacy, Terms
    pagesToRender.set("/faq", {
        title: "Frequently Asked Questions & Technical Methodology | Lens (MapaPH)",
        description:
            "Find answers about Philippine GeoJSON boundary downloads, 10-digit PSGC codes, PSA census data sources, geometric accuracy, and custom CSV mapping on Lens.",
        keywords: "philippines geojson faq, mapaph faq, psgc boundaries help, rfc 7946 geojson philippines",
        canonical: `${BASE_URL}/faq`,
        jsonLd: [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
                    { "@type": "ListItem", position: 2, name: "FAQ", item: `${BASE_URL}/faq` },
                ],
            },
        ],
        bodyHtml: `
            <div class="seo-fallback-content">
                <h1>Frequently Asked Questions &amp; Cartographic Methodology</h1>
                <p>Technical documentation covering Philippine GeoJSON boundary exports, 10-digit PSGC alignment, PSA 2024 Census metrics, COA financial statements, and custom CSV choropleth overlays in Lens.</p>
                <p><a href="/">Back to Map</a> · <a href="/directory">Geographic Directory</a></p>
            </div>
        `,
    });

    pagesToRender.set("/privacy", {
        title: "Privacy Policy & Data Protection | Lens (MapaPH)",
        description:
            "Privacy Policy for Lens (MapaPH). Explains client-side map processing, browser caching, Google AdSense partner disclosures, and RA 10173 compliance.",
        keywords: "privacy policy lens mapaph, data protection mapaph, ra 10173 compliance",
        canonical: `${BASE_URL}/privacy`,
        jsonLd: [],
        bodyHtml: `
            <div class="seo-fallback-content">
                <h1>Privacy Policy — Lens (MapaPH)</h1>
                <p>Lens is an open-source geospatial visualization utility in the mapaPH ecosystem compliant with the Philippine Data Privacy Act (RA 10173).</p>
            </div>
        `,
    });

    pagesToRender.set("/terms", {
        title: "Terms of Service & Open Data Licensing | Lens (MapaPH)",
        description:
            "Terms of Service and open-source MIT / public-domain data licensing guidelines for using Lens (MapaPH) GeoJSON boundaries.",
        keywords: "terms of service lens mapaph, open source gis license philippines",
        canonical: `${BASE_URL}/terms`,
        jsonLd: [],
        bodyHtml: `
            <div class="seo-fallback-content">
                <h1>Terms of Service — Lens (MapaPH)</h1>
                <p>Lens is an open-source MIT-licensed utility compiling public-domain PSA, COA, and COMELEC datasets.</p>
            </div>
        `,
    });

    // 4. Region Pages (18)
    for (const region of catalog.regions) {
        const canonical = `${BASE_URL}${region.urlPath}`;
        const popStr = fmtInt(region.pop_2024);
        const areaStr = fmtDec(region.area_km2, 1);
        const gdpStr = region.gdp_2024 != null ? `2024 GDP ${fmtPhp(region.gdp_2024)}, ` : "";
        const regMeta = psgcMeta.get(region.psgc);

        pagesToRender.set(region.urlPath, {
            title: `${region.name} Profile: 2024 Population, Provinces, GDP & GeoJSON Map | Lens`,
            description: `Explore ${region.name}, Philippines: 2024 population (${popStr}), ${gdpStr}area (${areaStr} km²), ${region.provinces.length} constituent provinces/metro units, ${region.municitiesCount} cities & municipalities, and free GeoJSON boundaries.`,
            keywords: `${region.name.toLowerCase()} population, ${region.name.toLowerCase()} provinces, ${region.name.toLowerCase()} geojson, ${region.name.toLowerCase()} gdp, psgc ${region.psgc}`,
            canonical,
            initialPlace: buildInitialPlacePayload(region, "region", `Philippines › ${region.name.trim()}`, {
                region_psgc: region.psgc,
            }),
            jsonLd: [
                {
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: [
                        { "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` },
                        { "@type": "ListItem", position: 2, name: region.name, item: canonical },
                    ],
                },
                {
                    "@context": "https://schema.org",
                    "@type": "AdministrativeArea",
                    name: region.name,
                    alternateName: [`PSGC ${region.psgc}`, region.correspondence ? `Legacy PSGC ${region.correspondence}` : ""].filter(Boolean),
                    description: `${region.name} is an administrative region in the Philippines with a 2024 population of ${popStr} and a land area of ${areaStr} sq km.`,
                    url: canonical,
                    geo: region.bounds
                        ? { "@type": "GeoCoordinates", latitude: region.bounds.lat, longitude: region.bounds.lng }
                        : undefined,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Dataset",
                    name: `${region.name} GeoJSON Boundary & Economic Dataset`,
                    description: `RFC 7946 GeoJSON boundary files, 2024 census counts, and GDP data for ${region.name}.`,
                    url: canonical,
                    spatialCoverage: { "@type": "Place", name: region.name },
                    ...buildDatasetDistribution(canonical),
                },
            ],
            bodyHtml: "",
            dossierHtml: `
                ${renderBreadcrumbsHtml([{ label: "Philippines", href: "/" }, { label: region.name }])}
                <header class="lens-dossier-hero">
                    <h1>${escapeHtml(region.name)} — Population (2024), Provinces, GDP &amp; GeoJSON Map</h1>
                    <p>
                        <strong>${escapeHtml(region.name)}</strong> (PSGC <code>${region.psgc}</code>) has a 2024 census population of <strong>${popStr}</strong> across <strong>${areaStr} km²</strong> (${fmtInt(region.density_2024)} residents/km²), encompassing ${region.provinces.length} provincial-level divisions and ${region.municitiesCount} cities and municipalities.
                    </p>
                </header>
                ${renderDossierActionBar(region.urlPath)}
                ${renderTelemetryHtml(region, "Region", undefined, { meta: regMeta, bounds: region.bounds })}
                ${renderCensusHistoryHtml(region)}
                ${renderGdpHistoryHtml(region)}
                ${renderDemographicsHtml(region)}
                ${renderElection2022Html(region.name, region.urlPath, elections2022.get(region.psgc))}
                ${renderSubdivisionsTableHtml(`Provinces & Subdivisions in ${region.name}`, region.provinces)}
                ${buildGeoJsonFooterLinks(region.urlPath)}
            `,
        });
    }

    // 5. Province Pages (84)
    for (const province of catalog.provinces) {
        const canonical = `${BASE_URL}${province.urlPath}`;
        const reg = province.region;
        const popStr = fmtInt(province.pop_2024);
        const areaStr = fmtDec(province.area_km2, 1);
        const densityStr = fmtInt(province.density_2024);
        const provMeta = psgcMeta.get(province.psgc);
        const provCoa = coaFinance.get(province.psgc);
        const provElection = elections2022.get(province.psgc);
        const provZip = zipCatalog.get(province.psgc);
        const topSubdivisions = [...province.municities]
            .sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1))
            .slice(0, 3)
            .map((m) => m.name);
        const { faqJsonLd, faqHtml } = buildPlaceFaqSchemaAndHtml({
            placeName: province.name,
            locationName: reg ? `${province.name}, ${reg.name}` : province.name,
            levelLabel: "Province",
            urlPath: province.urlPath,
            popStr,
            areaStr,
            densityStr,
            incomeClass: provMeta?.incomeClass ?? null,
            bounds: province.bounds,
            zipInfo: provZip,
            subdivisionLabel: "cities and municipalities",
            subdivisionCount: province.municities.length,
            topSubdivisions,
        });

        const breadcrumbs: { label: string; href?: string }[] = [{ label: "Philippines", href: "/" }];
        const ldBreadcrumbs: Record<string, unknown>[] = [{ "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` }];
        if (reg) {
            breadcrumbs.push({ label: reg.name, href: reg.urlPath });
            ldBreadcrumbs.push({ "@type": "ListItem", position: 2, name: reg.name, item: `${BASE_URL}${reg.urlPath}` });
        }
        breadcrumbs.push({ label: province.name });
        ldBreadcrumbs.push({ "@type": "ListItem", position: ldBreadcrumbs.length + 1, name: province.name, item: canonical });

        const provBreadcrumbText = reg ? `Philippines › ${reg.name.trim()} › ${province.name.trim()}` : `Philippines › ${province.name.trim()}`;
        const provZipDesc = provZip ? `ZIP codes ${provZip.zipRange}, ` : "";
        const provZipKeywords = provZip ? `, ${province.name.toLowerCase()} zip code, ${province.name.toLowerCase()} postal code` : "";

        pagesToRender.set(province.urlPath, {
            title: `${province.name} Profile: 2024 Population, Municipalities, Map & GeoJSON | Lens`,
            description: `Explore ${province.name}, ${reg ? reg.name : "Philippines"}: 2024 census population (${popStr}), density (${densityStr}/km²), area (${areaStr} km²), ${provZipDesc}${province.municities.length} cities & municipalities, COA assets, and free GeoJSON boundaries.`,
            keywords: `${province.name.toLowerCase()} population 2024, municipalities in ${province.name.toLowerCase()}, ${province.name.toLowerCase()} geojson, ${province.name.toLowerCase()} map, psgc ${province.psgc}${provZipKeywords}`,
            canonical,
            initialPlace: buildInitialPlacePayload(province, "province", provBreadcrumbText, {
                region_psgc: province.region_psgc ?? reg?.psgc ?? null,
                province_psgc: province.psgc,
            }),
            jsonLd: [
                { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: ldBreadcrumbs },
                {
                    "@context": "https://schema.org",
                    "@type": "AdministrativeArea",
                    name: province.name,
                    alternateName: [`PSGC ${province.psgc}`, province.correspondence ? `Legacy PSGC ${province.correspondence}` : ""].filter(Boolean),
                    description: `${province.name} is in ${reg ? reg.name : "the Philippines"} with a 2024 population of ${popStr} and a land area of ${areaStr} sq km.`,
                    url: canonical,
                    postalCode: provZip?.primaryZip,
                    geo: province.bounds
                        ? { "@type": "GeoCoordinates", latitude: province.bounds.lat, longitude: province.bounds.lng }
                        : undefined,
                    containedInPlace: reg ? { "@type": "AdministrativeArea", name: reg.name, url: `${BASE_URL}${reg.urlPath}` } : undefined,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Dataset",
                    name: `${province.name} GeoJSON Boundary & Municipal Dataset`,
                    description: `RFC 7946 GeoJSON boundary files and municipal census/COA/GDP records for ${province.name}.`,
                    url: canonical,
                    spatialCoverage: { "@type": "Place", name: province.name },
                    ...buildDatasetDistribution(canonical),
                },
                faqJsonLd,
            ],
            bodyHtml: "",
            dossierHtml: `
                ${renderBreadcrumbsHtml(breadcrumbs)}
                <header class="lens-dossier-hero">
                    <h1>${escapeHtml(province.name)} — Population (2024), Municipalities, COA Assets &amp; GeoJSON Map</h1>
                    <p>
                        <strong>${escapeHtml(province.name)}</strong>${reg ? ` in <a href="${reg.urlPath}">${escapeHtml(reg.name)}</a>` : ""} (PSGC <code>${province.psgc}</code>) recorded a 2024 census population of <strong>${popStr}</strong> across <strong>${areaStr} km²</strong> (${densityStr} residents/km²), comprising ${province.municities.length} constituent cities and municipalities${provZip ? ` (ZIP range <code>${escapeHtml(provZip.zipRange)}</code>)` : ""}.
                    </p>
                </header>
                ${renderDossierActionBar(province.urlPath)}
                ${renderTelemetryHtml(
                    province,
                    "Province / Metro Division",
                    {
                        scope: "Philippines",
                        pop: provincePopRanks.get(province.psgc),
                        density: provinceDensityRanks.get(province.psgc),
                        area: provinceAreaRanks.get(province.psgc),
                        assets: provinceAssetRanks.get(province.psgc),
                    },
                    { meta: provMeta, bounds: province.bounds, zipInfo: provZip },
                )}
                ${renderProvinceSuperlativesHtml(province)}
                ${renderCensusHistoryHtml(province)}
                ${renderGdpHistoryHtml(province)}
                ${renderCoaFinanceHtml(province.name, provCoa)}
                ${renderDemographicsHtml(province)}
                ${renderElection2022Html(province.name, province.urlPath, provElection)}
                ${renderSubdivisionsTableHtml(`Cities & Municipalities in ${province.name}`, province.municities)}
                ${renderZipDirectoryHtml(province.name, provZip)}
                ${faqHtml}
                ${buildGeoJsonFooterLinks(province.urlPath)}
            `,
        });
    }

    // 6. City & Municipality Pages (1,642)
    const MUNI_LOAD_BATCH = 64;
    for (let i = 0; i < catalog.municities.length; i += MUNI_LOAD_BATCH) {
        const batch = catalog.municities.slice(i, i + MUNI_LOAD_BATCH);
        const batchBarangays = await Promise.all(batch.map((m) => loadMunicityBarangays(m.psgc)));

        batch.forEach((muni, idx) => {
            const barangays = batchBarangays[idx];
            const canonical = `${BASE_URL}${muni.urlPath}`;
            const reg = muni.region;
            const prov = muni.province;
            const { displayTitle, shortName, aliases } = getCityNameAliases(muni.name);
            const titleName = aliases.length > 0 ? shortName : muni.name;
            const locationStr = prov ? `${muni.name}, ${prov.name}` : muni.name;
            const titleLocationStr = prov ? `${titleName}, ${prov.name}` : titleName;
            const displayLocationStr = prov ? `${displayTitle}, ${prov.name}` : displayTitle;
            const levelLabel = muni.city_lvl ? `${muni.geo_lvl} (${muni.city_lvl})` : muni.geo_lvl === "City" ? "City" : "Municipality";
            const popStr = fmtInt(muni.pop_2024);
            const areaStr = fmtDec(muni.area_km2, 1);
            const densityStr = fmtInt(muni.density_2024);
            const muniMetaExtra = psgcMeta.get(muni.psgc);
            const muniCoa = coaFinance.get(muni.psgc);
            const muniElection = elections2022.get(muni.psgc);
            const muniZip = zipCatalog.get(muni.psgc);

            let urbanCount = 0;
            let ruralCount = 0;
            for (const b of barangays) {
                const ur = psgcMeta.get(b.psgc)?.urbanRural;
                if (ur === "U") urbanCount += 1;
                else if (ur === "R") ruralCount += 1;
            }

            const provRanks = prov ? muniRanksByProv.get(prov.psgc) : undefined;
            const muniRanks: EntityRanks | undefined = prov && provRanks
                ? {
                    scope: prov.name,
                    pop: provRanks.pop.get(muni.psgc),
                    density: provRanks.density.get(muni.psgc),
                    area: provRanks.area.get(muni.psgc),
                    assets: provRanks.assets.get(muni.psgc),
                }
                : undefined;

            const topBarangays = [...barangays]
                .sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1))
                .slice(0, 3)
                .map((b) => b.name);
            const bgySummary =
                barangays.length > 0
                    ? ` Comprises ${barangays.length} barangays${topBarangays.length > 0 ? `, led by ${topBarangays.join(", ")}` : ""}.`
                    : "";

            const { faqJsonLd, faqHtml } = buildPlaceFaqSchemaAndHtml({
                placeName: titleName,
                locationName: titleLocationStr,
                levelLabel: muni.geo_lvl === "City" ? "City" : "Municipality",
                urlPath: muni.urlPath,
                popStr,
                areaStr,
                densityStr,
                incomeClass: muniMetaExtra?.incomeClass ?? null,
                bounds: muni.bounds,
                zipInfo: muniZip,
                subdivisionLabel: "barangays",
                subdivisionCount: barangays.length,
                topSubdivisions: topBarangays,
            });

            const breadcrumbs: { label: string; href?: string }[] = [{ label: "Philippines", href: "/" }];
            const ldBreadcrumbs: Record<string, unknown>[] = [{ "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` }];
            if (reg) {
                breadcrumbs.push({ label: reg.name, href: reg.urlPath });
                ldBreadcrumbs.push({ "@type": "ListItem", position: ldBreadcrumbs.length + 1, name: reg.name, item: `${BASE_URL}${reg.urlPath}` });
            }
            if (prov) {
                breadcrumbs.push({ label: prov.name, href: prov.urlPath });
                ldBreadcrumbs.push({ "@type": "ListItem", position: ldBreadcrumbs.length + 1, name: prov.name, item: `${BASE_URL}${prov.urlPath}` });
            }
            breadcrumbs.push({ label: muni.name });
            ldBreadcrumbs.push({ "@type": "ListItem", position: ldBreadcrumbs.length + 1, name: muni.name, item: canonical });

            const siblings = prov ? prov.municities.filter((s) => s.psgc !== muni.psgc) : [];
            const neighbors = municityAdjacency.get(muni.psgc) ?? [];

            const aliasKeywords = aliases.length > 0
                ? `, ${aliases.map((a) => `${a.toLowerCase()} population 2024, ${a.toLowerCase()} barangays, ${a.toLowerCase()} geojson, ${a.toLowerCase()} zip code`).join(", ")}`
                : "";
            const muniZipKeyword = muniZip
                ? `, ${muni.name.toLowerCase()} zip code, ${muni.name.toLowerCase()} postal code, zip code ${muniZip.primaryZip}`
                : "";
            const muniZipDesc = muniZip ? `ZIP code ${muniZip.zipRange}, ` : "";
            const muniBreadcrumbText = [
                "Philippines",
                reg?.name.trim(),
                prov?.name.trim(),
                muni.name.trim(),
            ]
                .filter(Boolean)
                .join(" › ");

            pagesToRender.set(muni.urlPath, {
                title: `${titleLocationStr} Profile: 2024 Population, Barangays, ${muniZip ? `ZIP Code ${muniZip.primaryZip}, ` : ""}Map & GeoJSON | Lens`,
                description: `Interactive map, 2024 census population (${popStr}), density (${densityStr}/km²), area (${areaStr} km²), ${muniZipDesc}${muniMetaExtra?.incomeClass ? `${muniMetaExtra.incomeClass} income class, ` : ""}${muni.assets_2024 != null ? `COA assets (${fmtPhp(muni.assets_2024)}), ` : ""}${barangays.length > 0 ? `${barangays.length} barangays, ` : ""}and GeoJSON boundaries for ${titleLocationStr}.`,
                keywords: `${muni.name.toLowerCase()} population 2024, ${muni.name.toLowerCase()} barangays, ${muni.name.toLowerCase()} geojson, ${locationStr.toLowerCase()} map, barangays in ${muni.name.toLowerCase()}, psgc ${muni.psgc}${muniZipKeyword}${aliasKeywords}`,
                canonical,
                initialPlace: buildInitialPlacePayload(muni, "municipality", muniBreadcrumbText, {
                    region_psgc: muni.region_psgc ?? reg?.psgc ?? null,
                    province_psgc: muni.province_psgc ?? prov?.psgc ?? null,
                    municity_psgc: muni.psgc,
                }),
                jsonLd: [
                    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: ldBreadcrumbs },
                    {
                        "@context": "https://schema.org",
                        "@type": "AdministrativeArea",
                        name: muni.name,
                        alternateName: [`PSGC ${muni.psgc}`, muni.correspondence ? `Legacy PSGC ${muni.correspondence}` : "", ...aliases].filter(Boolean),
                        description: `${muni.name} is a ${levelLabel.toLowerCase()} in ${prov ? prov.name : "the Philippines"} with a 2024 population of ${popStr} and a land area of ${areaStr} sq km.${bgySummary}`,
                        url: canonical,
                        postalCode: muniZip?.primaryZip,
                        geo: muni.bounds
                            ? { "@type": "GeoCoordinates", latitude: muni.bounds.lat, longitude: muni.bounds.lng }
                            : undefined,
                        containedInPlace: prov ? { "@type": "AdministrativeArea", name: prov.name, url: `${BASE_URL}${prov.urlPath}` } : undefined,
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "Dataset",
                        name: `${muni.name} GeoJSON Boundary & Census Dataset`,
                        description: `RFC 7946 GeoJSON boundary polygons and census metrics for ${locationStr}.`,
                        url: canonical,
                        spatialCoverage: { "@type": "Place", name: locationStr },
                        ...buildDatasetDistribution(canonical),
                    },
                    faqJsonLd,
                ],
                bodyHtml: "",
                dossierHtml: `
                    ${renderBreadcrumbsHtml(breadcrumbs)}
                    <header class="lens-dossier-hero">
                        <h1>${escapeHtml(displayLocationStr)} — Population (2024), Barangays, ${muniZip ? `ZIP Code ${escapeHtml(muniZip.primaryZip)}, ` : ""}COA Assets &amp; GeoJSON Map</h1>
                        <p>
                            <strong>${escapeHtml(muni.name)}</strong> is a ${muniMetaExtra?.incomeClass ? `${escapeHtml(muniMetaExtra.incomeClass)} income class ` : ""}${escapeHtml(levelLabel.toLowerCase())}${muniMetaExtra?.isCapital ? " and provincial capital" : ""}${prov ? ` in <a href="${prov.urlPath}">${escapeHtml(prov.name)}</a>` : ""}${reg ? ` (${escapeHtml(reg.name)})` : ""} with PSGC code <code>${muni.psgc}</code>${muniZip ? ` and PHLPost ZIP code <code>${escapeHtml(muniZip.zipRange)}</code>` : ""}. It spans <strong>${areaStr} km²</strong> with a 2024 population of <strong>${popStr}</strong> (${densityStr} residents/km²).${escapeHtml(bgySummary)}
                        </p>
                    </header>
                    ${renderDossierActionBar(muni.urlPath)}
                    ${renderTelemetryHtml(muni, levelLabel, muniRanks, {
                        meta: muniMetaExtra,
                        bounds: muni.bounds,
                        urbanCount,
                        ruralCount,
                        zipInfo: muniZip,
                    })}
                    ${renderCensusHistoryHtml(muni)}
                    ${renderGdpHistoryHtml(muni)}
                    ${renderCoaFinanceHtml(muni.name, muniCoa)}
                    ${renderDemographicsHtml(muni)}
                    ${renderElection2022Html(muni.name, muni.urlPath, muniElection)}
                    ${renderZipDirectoryHtml(titleName, muniZip)}
                    ${renderBarangaysTableHtml(muni.name, barangays, muni.pop_2024, psgcMeta)}
                    ${renderAdjacentMunicitiesHtml(muni.name, neighbors)}
                    ${renderSubdivisionsTableHtml(`Other Cities & Municipalities in ${prov ? prov.name : "Province"}`, siblings)}
                    ${faqHtml}
                    ${buildGeoJsonFooterLinks(muni.urlPath)}
                `,
            });
        });
    }

    console.log(`[prerender] Total pages to generate: ${pagesToRender.size}`);

    const entries = Array.from(pagesToRender.entries());
    const BATCH_SIZE = 64;
    let renderedCount = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map(async ([routePath, meta]) => {
                const isHome = routePath === "/";
                const targetDir = isHome ? distPath : path.resolve(distPath, routePath.replace(/^\//, ""));
                const targetFile = isHome ? templatePath : path.resolve(targetDir, "index.html");

                if (!isHome) {
                    await fs.mkdir(targetDir, { recursive: true });
                }

                let pageHtml = templateHtml;

                pageHtml = pageHtml.replace(/<title>.*?<\/title>/gi, `<title>${escapeHtml(meta.title)}</title>`);
                pageHtml = pageHtml.replace(/<meta name="title" content=".*?" \/>/gi, `<meta name="title" content="${escapeHtml(meta.title)}" />`);
                pageHtml = pageHtml.replace(/<meta property="og:title" content=".*?" \/>/gi, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
                pageHtml = pageHtml.replace(/<meta property="twitter:title" content=".*?" \/>/gi, `<meta property="twitter:title" content="${escapeHtml(meta.title)}" />`);

                pageHtml = pageHtml.replace(/<meta name="description"\s+content=".*?" \/>/gis, `<meta name="description" content="${escapeHtml(meta.description)}" />`);
                pageHtml = pageHtml.replace(/<meta property="og:description"\s+content=".*?" \/>/gis, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
                pageHtml = pageHtml.replace(/<meta property="twitter:description"\s+content=".*?" \/>/gis, `<meta property="twitter:description" content="${escapeHtml(meta.description)}" />`);

                pageHtml = pageHtml.replace(/<meta name="keywords"\s+content=".*?" \/>/gis, `<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`);

                pageHtml = pageHtml.replace(/<link rel="canonical" href=".*?" \/>/gi, `<link rel="canonical" href="${meta.canonical}" />`);
                pageHtml = pageHtml.replace(/<meta property="og:url" content=".*?" \/>/gi, `<meta property="og:url" content="${meta.canonical}" />`);
                pageHtml = pageHtml.replace(/<meta property="twitter:url" content=".*?" \/>/gi, `<meta property="twitter:url" content="${meta.canonical}" />`);

                const jsonLdString = meta.jsonLd
                    .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
                    .join("\n    ");
                if (pageHtml.includes('type="application/ld+json"')) {
                    pageHtml = pageHtml.replace(/<script type="application\/ld\+json">.*?<\/script>/gis, jsonLdString);
                } else {
                    pageHtml = pageHtml.replace("</head>", `    ${jsonLdString}\n</head>`);
                }

                if (meta.initialPlace) {
                    const safeSeedJson = JSON.stringify({ routePath, place: meta.initialPlace }).replace(/</g, "\\u003c");
                    pageHtml = pageHtml.replace(
                        "</head>",
                        `    <script id="lens-initial-place" type="application/json">${safeSeedJson}</script>\n</head>`,
                    );
                }

                pageHtml = pageHtml.replace(/<noscript>[\s\S]*?<\/noscript>\s*/gi, "");
                if (meta.dossierHtml) {
                    pageHtml = pageHtml.replace(
                        /<div id="root">[\s\S]*?(?=\s*<\/body>)/i,
                        `<div id="root"></div>\n    <article id="lens-place-dossier" class="lens-dossier" data-route-path="${escapeHtml(routePath)}">\n${meta.dossierHtml}\n    </article>`,
                    );
                } else {
                    pageHtml = pageHtml.replace(
                        /<div id="root">[\s\S]*?(?=\s*<\/body>)/i,
                        `<div id="root">\n${meta.bodyHtml}\n    </div>`,
                    );
                }

                await fs.writeFile(targetFile, pageHtml, "utf8");
            }),
        );
        renderedCount += batch.length;
    }

    console.log(`[prerender] Successfully generated ${renderedCount} static HTML pages in dist/!`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("prerender.ts")) {
    prerender().catch((err) => {
        console.error("[prerender] Error:", err);
        process.exit(1);
    });
}

export default prerender;
