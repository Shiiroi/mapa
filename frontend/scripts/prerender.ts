import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
    computeMetricRanks,
    computeMunicityAdjacency,
    getCityNameAliases,
    loadGeoCatalog,
    loadMunicityBarangays,
    summarizeAgeCohorts,
    type BarangayRecord,
    type MunicityRecord,
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
    if (val >= 1_000_000_000_000) return `PHP ${(val / 1_000_000_000_000).toFixed(2)}T`;
    if (val >= 1_000_000_000) return `PHP ${(val / 1_000_000_000).toFixed(2)}B`;
    if (val >= 1_000_000) return `PHP ${(val / 1_000_000).toFixed(1)}M`;
    return `PHP ${Math.round(val).toLocaleString("en-US")}`;
}

interface PageMeta {
    title: string;
    description: string;
    keywords: string;
    canonical: string;
    jsonLd: Record<string, unknown>[];
    bodyHtml: string;
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

function formatRank(rank: RankInfo | undefined, scope: string): string {
    return rank ? ` (#${rank.rank} of ${rank.total} in ${scope})` : "";
}

function renderTelemetryHtml(entity: RawGeoEntity, classification: string, ranks?: EntityRanks): string {
    const scope = ranks?.scope ?? "";
    const rows: [string, string][] = [
        ["Classification", classification],
        ["10-Digit PSGC Code", entity.psgc],
        ...(entity.correspondence && entity.correspondence !== entity.psgc
            ? [["Legacy 9-Digit Correspondence Code", entity.correspondence] as [string, string]]
            : []),
        ["2024 Census Population", `${fmtInt(entity.pop_2024)}${formatRank(ranks?.pop, scope)}`],
        ...(entity.pct_change_2020_2024 != null
            ? [["2020–2024 Population Change", fmtPct(entity.pct_change_2020_2024)] as [string, string]]
            : []),
        ["Land Area (km²)", `${fmtDec(entity.area_km2, 2)}${formatRank(ranks?.area, scope)}`],
        ["Population Density (/km²)", `${fmtInt(entity.density_2024)}${formatRank(ranks?.density, scope)}`],
    ];

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
        <h2>Key Geographic &amp; Statistical Profile</h2>
        <table>
            <tbody>${trs}</tbody>
        </table>
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
        <h2>PSA Population Census History</h2>
        <table>
            <thead><tr><th>Census Year</th><th>Population</th><th>Change vs Prior</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
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
        <h2>GDP Series (PSA Regional &amp; Provincial Accounts)</h2>
        <table>
            <thead><tr><th>Year</th><th>GDP (Constant Prices)</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
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
        <h2>Age &amp; Sex Demographic Structure (2020 CPH)</h2>
        <table>
            <tbody>${parts.join("\n")}</tbody>
        </table>
    `;
}

function renderSubdivisionsTableHtml(title: string, items: { name: string; urlPath: string; pop_2024: number | null; area_km2: number | null; density_2024: number | null; assets_2024: number | null }[]): string {
    if (items.length === 0) return "";
    const sorted = [...items].sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1));
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
        <h2>${escapeHtml(title)} (${sorted.length})</h2>
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
    `;
}

function renderBarangaysTableHtml(
    municityName: string,
    barangays: BarangayRecord[],
    totalMunicityPop: number | null,
): string {
    if (barangays.length === 0) return "";
    const sorted = [...barangays].sort((a, b) => (b.pop_2024 ?? -1) - (a.pop_2024 ?? -1));
    const rows = sorted
        .map((b) => {
            const share =
                b.pop_2024 != null && totalMunicityPop != null && totalMunicityPop > 0
                    ? `${((b.pop_2024 / totalMunicityPop) * 100).toFixed(1)}%`
                    : "—";
            return `
            <tr>
                <td>${escapeHtml(b.name)}</td>
                <td><code>${escapeHtml(b.psgc)}</code></td>
                <td>${fmtInt(b.pop_2024)}</td>
                <td>${share}</td>
                <td>${fmtDec(b.area_km2, 2)}</td>
                <td>${fmtInt(b.density_2024)}</td>
            </tr>
        `;
        })
        .join("\n");

    return `
        <h2>Barangays in ${escapeHtml(municityName)} (${sorted.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Barangay</th>
                    <th>PSGC Code</th>
                    <th>2024 Population</th>
                    <th>Share</th>
                    <th>Area (km²)</th>
                    <th>Density (/km²)</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
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
        <h2>Bordering Cities &amp; Municipalities of ${escapeHtml(municityName)} (${neighbors.length})</h2>
        <ul>
            ${links}
        </ul>
    `;
}

function buildGeoJsonFooterLinks(urlPath: string): string {
    return `
        <h2>GeoJSON Downloads &amp; Interactive Exploration</h2>
        <ul>
            <li><a href="${urlPath}?tab=geojson">Open Interactive GeoJSON Boundary Exporter</a> (IETF RFC 7946 / WGS 84 EPSG:4326)</li>
            <li><a href="${urlPath}">Inspect Interactive Choropleth Map &amp; Demographic Charts</a></li>
            <li><a href="/directory">Browse All Philippine Regions, Provinces &amp; Cities</a></li>
            <li><a href="/faq">Technical Methodology, PSGC Standard &amp; GeoJSON FAQ</a></li>
        </ul>
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

    const catalog = await loadGeoCatalog();
    const municityAdjacency = await computeMunicityAdjacency(catalog.municities);

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
                ${renderSubdivisionsTableHtml("Philippine Regions Ranked by Population (2024)", sortedRegions)}
                ${renderSubdivisionsTableHtml("Philippine Provinces Ranked by Population (2024)", sortedProvinces)}
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

        pagesToRender.set(region.urlPath, {
            title: `${region.name} Provinces, Population (2024), GDP & GeoJSON Map | Lens`,
            description: `Explore ${region.name}, Philippines: 2024 population (${popStr}), ${gdpStr}area (${areaStr} km²), ${region.provinces.length} constituent provinces/metro units, ${region.municitiesCount} cities & municipalities, and free GeoJSON boundaries.`,
            keywords: `${region.name.toLowerCase()} population, ${region.name.toLowerCase()} provinces, ${region.name.toLowerCase()} geojson, ${region.name.toLowerCase()} gdp, psgc ${region.psgc}`,
            canonical,
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
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Dataset",
                    name: `${region.name} GeoJSON Boundary & Economic Dataset`,
                    description: `RFC 7946 GeoJSON boundary files, 2024 census counts, and GDP data for ${region.name}.`,
                    url: canonical,
                    spatialCoverage: { "@type": "Place", name: region.name },
                },
            ],
            bodyHtml: `
                <div class="seo-fallback-content">
                    ${renderBreadcrumbsHtml([{ label: "Philippines", href: "/" }, { label: region.name }])}
                    <h1>${escapeHtml(region.name)} — Population (2024), Provinces, GDP &amp; GeoJSON Map</h1>
                    <p>
                        <strong>${escapeHtml(region.name)}</strong> (PSGC <code>${region.psgc}</code>) has a 2024 census population of <strong>${popStr}</strong> across <strong>${areaStr} km²</strong> (${fmtInt(region.density_2024)} residents/km²), encompassing ${region.provinces.length} provincial-level divisions and ${region.municitiesCount} cities and municipalities.
                    </p>
                    ${renderTelemetryHtml(region, "Region")}
                    ${renderCensusHistoryHtml(region)}
                    ${renderGdpHistoryHtml(region)}
                    ${renderDemographicsHtml(region)}
                    ${renderSubdivisionsTableHtml(`Provinces & Subdivisions in ${region.name}`, region.provinces)}
                    ${buildGeoJsonFooterLinks(region.urlPath)}
                </div>
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

        const breadcrumbs: { label: string; href?: string }[] = [{ label: "Philippines", href: "/" }];
        const ldBreadcrumbs: Record<string, unknown>[] = [{ "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` }];
        if (reg) {
            breadcrumbs.push({ label: reg.name, href: reg.urlPath });
            ldBreadcrumbs.push({ "@type": "ListItem", position: 2, name: reg.name, item: `${BASE_URL}${reg.urlPath}` });
        }
        breadcrumbs.push({ label: province.name });
        ldBreadcrumbs.push({ "@type": "ListItem", position: ldBreadcrumbs.length + 1, name: province.name, item: canonical });

        pagesToRender.set(province.urlPath, {
            title: `${province.name} Population (2024), Municipalities, Map & GeoJSON | Lens`,
            description: `Explore ${province.name}, ${reg ? reg.name : "Philippines"}: 2024 census population (${popStr}), density (${densityStr}/km²), area (${areaStr} km²), ${province.municities.length} cities & municipalities, COA assets, and free GeoJSON boundaries.`,
            keywords: `${province.name.toLowerCase()} population 2024, municipalities in ${province.name.toLowerCase()}, ${province.name.toLowerCase()} geojson, ${province.name.toLowerCase()} map, psgc ${province.psgc}`,
            canonical,
            jsonLd: [
                { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: ldBreadcrumbs },
                {
                    "@context": "https://schema.org",
                    "@type": "AdministrativeArea",
                    name: province.name,
                    alternateName: [`PSGC ${province.psgc}`, province.correspondence ? `Legacy PSGC ${province.correspondence}` : ""].filter(Boolean),
                    description: `${province.name} is in ${reg ? reg.name : "the Philippines"} with a 2024 population of ${popStr} and a land area of ${areaStr} sq km.`,
                    url: canonical,
                    containedInPlace: reg ? { "@type": "AdministrativeArea", name: reg.name, url: `${BASE_URL}${reg.urlPath}` } : undefined,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Dataset",
                    name: `${province.name} GeoJSON Boundary & Municipal Dataset`,
                    description: `RFC 7946 GeoJSON boundary files and municipal census/COA/GDP records for ${province.name}.`,
                    url: canonical,
                    spatialCoverage: { "@type": "Place", name: province.name },
                },
            ],
            bodyHtml: `
                <div class="seo-fallback-content">
                    ${renderBreadcrumbsHtml(breadcrumbs)}
                    <h1>${escapeHtml(province.name)} — Population (2024), Municipalities, COA Assets &amp; GeoJSON Map</h1>
                    <p>
                        <strong>${escapeHtml(province.name)}</strong>${reg ? ` in <a href="${reg.urlPath}">${escapeHtml(reg.name)}</a>` : ""} (PSGC <code>${province.psgc}</code>) recorded a 2024 census population of <strong>${popStr}</strong> across <strong>${areaStr} km²</strong> (${densityStr} residents/km²), comprising ${province.municities.length} constituent cities and municipalities.
                    </p>
                    ${renderTelemetryHtml(province, "Province / Metro Division", {
                        scope: "Philippines",
                        pop: provincePopRanks.get(province.psgc),
                        density: provinceDensityRanks.get(province.psgc),
                        area: provinceAreaRanks.get(province.psgc),
                        assets: provinceAssetRanks.get(province.psgc),
                    })}
                    ${renderCensusHistoryHtml(province)}
                    ${renderGdpHistoryHtml(province)}
                    ${renderDemographicsHtml(province)}
                    ${renderSubdivisionsTableHtml(`Cities & Municipalities in ${province.name}`, province.municities)}
                    ${buildGeoJsonFooterLinks(province.urlPath)}
                </div>
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
                ? `, ${aliases.map((a) => `${a.toLowerCase()} population 2024, ${a.toLowerCase()} barangays, ${a.toLowerCase()} geojson`).join(", ")}`
                : "";

            pagesToRender.set(muni.urlPath, {
                title: `${titleLocationStr} Population (2024), Barangays, Area & GeoJSON | Lens`,
                description: `Interactive map, 2024 census population (${popStr}), density (${densityStr}/km²), area (${areaStr} km²), ${muni.assets_2024 != null ? `COA assets (${fmtPhp(muni.assets_2024)}), ` : ""}${barangays.length > 0 ? `${barangays.length} barangays, ` : ""}and GeoJSON boundaries for ${titleLocationStr}.`,
                keywords: `${muni.name.toLowerCase()} population 2024, ${muni.name.toLowerCase()} barangays, ${muni.name.toLowerCase()} geojson, ${locationStr.toLowerCase()} map, barangays in ${muni.name.toLowerCase()}, psgc ${muni.psgc}${aliasKeywords}`,
                canonical,
                jsonLd: [
                    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: ldBreadcrumbs },
                    {
                        "@context": "https://schema.org",
                        "@type": "AdministrativeArea",
                        name: muni.name,
                        alternateName: [`PSGC ${muni.psgc}`, muni.correspondence ? `Legacy PSGC ${muni.correspondence}` : "", ...aliases].filter(Boolean),
                        description: `${muni.name} is a ${levelLabel.toLowerCase()} in ${prov ? prov.name : "the Philippines"} with a 2024 population of ${popStr} and a land area of ${areaStr} sq km.${bgySummary}`,
                        url: canonical,
                        containedInPlace: prov ? { "@type": "AdministrativeArea", name: prov.name, url: `${BASE_URL}${prov.urlPath}` } : undefined,
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "Dataset",
                        name: `${muni.name} GeoJSON Boundary & Census Dataset`,
                        description: `RFC 7946 GeoJSON boundary polygons and census metrics for ${locationStr}.`,
                        url: canonical,
                        spatialCoverage: { "@type": "Place", name: locationStr },
                    },
                ],
                bodyHtml: `
                    <div class="seo-fallback-content">
                        ${renderBreadcrumbsHtml(breadcrumbs)}
                        <h1>${escapeHtml(displayLocationStr)} — Population (2024), Barangays, COA Assets &amp; GeoJSON Map</h1>
                        <p>
                            <strong>${escapeHtml(muni.name)}</strong> is a ${escapeHtml(levelLabel.toLowerCase())}${prov ? ` in <a href="${prov.urlPath}">${escapeHtml(prov.name)}</a>` : ""}${reg ? ` (${escapeHtml(reg.name)})` : ""} with PSGC code <code>${muni.psgc}</code>. It spans <strong>${areaStr} km²</strong> with a 2024 population of <strong>${popStr}</strong> (${densityStr} residents/km²).${escapeHtml(bgySummary)}
                        </p>
                        ${renderTelemetryHtml(muni, levelLabel, muniRanks)}
                        ${renderCensusHistoryHtml(muni)}
                        ${renderGdpHistoryHtml(muni)}
                        ${renderDemographicsHtml(muni)}
                        ${renderBarangaysTableHtml(muni.name, barangays, muni.pop_2024)}
                        ${renderAdjacentMunicitiesHtml(muni.name, neighbors)}
                        ${renderSubdivisionsTableHtml(`Other Cities & Municipalities in ${prov ? prov.name : "Province"}`, siblings)}
                        ${buildGeoJsonFooterLinks(muni.urlPath)}
                    </div>
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

                pageHtml = pageHtml.replace(/<noscript>[\s\S]*?<\/noscript>\s*/gi, "");
                pageHtml = pageHtml.replace(
                    /<div id="root">[\s\S]*?(?=\s*<\/body>)/i,
                    `<div id="root">\n${meta.bodyHtml}\n    </div>`,
                );

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
