import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://lens.mapaph.com";

interface GeoEntity {
    psgc: string;
    name: string;
    geo_lvl?: string;
    province_psgc?: string;
    region_psgc?: string;
    pop_2024?: number | null;
    area_km2?: number | null;
    density_2024?: number | null;
    assets_2024?: number | null;
}

function slugify(name: string): string {
    return name
        .normalize("NFKD")
        .replace(/\p{Diacritic}+/gu, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[’'`]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined || isNaN(num)) return "N/A";
    return Math.round(num).toLocaleString("en-US");
}

function formatDecimal(num: number | null | undefined, decimals = 1): string {
    if (num === null || num === undefined || isNaN(num)) return "N/A";
    return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadJson<T>(filePath: string): Promise<T[]> {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn(`[prerender] Could not read ${filePath}: ${e}`);
        return [];
    }
}

interface PageMeta {
    title: string;
    description: string;
    keywords: string;
    canonical: string;
    jsonLd: Record<string, unknown>[];
    bodyHtml: string;
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

    const regions = await loadJson<GeoEntity>(path.resolve(__dirname, "../data-sets/geo/regions.json"));
    const provinces = await loadJson<GeoEntity>(path.resolve(__dirname, "../data-sets/geo/provinces.json"));
    const municities = await loadJson<GeoEntity>(path.resolve(__dirname, "../data-sets/geo/municities/meta.json"));

    // Maps for lookups
    const regionByPsgc = new Map<string, GeoEntity>();
    const provinceByPsgc = new Map<string, GeoEntity>();
    const municityByPsgc = new Map<string, GeoEntity>();

    regions.forEach((r) => regionByPsgc.set(r.psgc, r));
    provinces.forEach((p) => provinceByPsgc.set(p.psgc, p));
    municities.forEach((m) => municityByPsgc.set(m.psgc, m));

    // Grouping
    const provincesByRegion = new Map<string, GeoEntity[]>();
    provinces.forEach((p) => {
        if (p.region_psgc) {
            const list = provincesByRegion.get(p.region_psgc) || [];
            list.push(p);
            provincesByRegion.set(p.region_psgc, list);
        }
    });

    const municitiesByProvince = new Map<string, GeoEntity[]>();
    municities.forEach((m) => {
        if (m.province_psgc) {
            const list = municitiesByProvince.get(m.province_psgc) || [];
            list.push(m);
            municitiesByProvince.set(m.province_psgc, list);
        }
    });

    const pagesToRender = new Map<string, PageMeta>();

    // 1. Homepage
    pagesToRender.set("/", {
        title: "Philippines GeoJSON Boundaries & Interactive Maps | Lens (MapaPH)",
        description: "Free GeoJSON administrative boundaries for every Philippine region, province, city, municipality, and barangay. Visualize population density, census metrics, GDP, and LGU data.",
        keywords: "philippines geojson, geojson philippines, ph map, philippines map, gis mapping philippines, population density map philippines, PSGC map, mapaph",
        canonical: `${BASE_URL}/`,
        jsonLd: [
            {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "Lens (MapaPH)",
                url: `${BASE_URL}/`,
                applicationCategory: "GeographicInformationSystem",
                operatingSystem: "All",
                description: "Interactive Philippines map for visualizing census, economic, and election data, and downloading standards-compliant GeoJSON boundaries.",
            },
            {
                "@context": "https://schema.org",
                "@type": "Dataset",
                name: "Philippine Administrative Boundaries GeoJSON Dataset",
                description: "Complete Philippine administrative boundary vector data down to the barangay level, aligned with standard PSGC classification.",
                url: `${BASE_URL}/`,
                spatialCoverage: {
                    "@type": "Place",
                    name: "Philippines",
                },
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
                <h1>Philippines GeoJSON Boundaries &amp; Interactive Maps</h1>
                <p>
                    Lens (MapaPH) is an open civic data platform providing standards-compliant GeoJSON boundary downloads and interactive maps for every region, province, municipality, city, and barangay in the Philippines.
                </p>
                <h2>Core Datasets &amp; Features</h2>
                <ul>
                    <li><strong>GeoJSON Downloads:</strong> Download clean, lightweight administrative boundaries for all PSGC levels.</li>
                    <li><strong>Population &amp; Density Visualization:</strong> Choropleth maps based on 2024 Philippine statistics.</li>
                    <li><strong>Custom CSV Upload:</strong> Overlay custom datasets onto official Philippine maps.</li>
                </ul>
                <h2>Explore Regions of the Philippines</h2>
                <ul>
                    ${regions
                        .map((r) => {
                            const slug = slugify(r.name);
                            return `<li><a href="/region/${slug}">${escapeHtml(r.name)} GeoJSON Map &amp; Data</a></li>`;
                        })
                        .join("\n")}
                </ul>
            </div>
        `,
    });

    // 2. Static Pages: FAQ, Privacy, Terms
    pagesToRender.set("/faq", {
        title: "Frequently Asked Questions — Philippines GeoJSON & Maps | Lens PH",
        description: "Find answers about Philippine GeoJSON boundary downloads, PSGC codes, data sources, accuracy, and usage guidelines on Lens.",
        keywords: "philippines geojson faq, mapaph faq, psgc boundaries help",
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
                <h1>Frequently Asked Questions (FAQ)</h1>
                <p>Learn more about Lens (MapaPH), Philippine GeoJSON vector datasets, and how to use administrative maps.</p>
            </div>
        `,
    });

    pagesToRender.set("/privacy", {
        title: "Privacy Policy | Lens PH",
        description: "Privacy Policy for Lens (MapaPH). Learn how user data and analytics are handled.",
        keywords: "privacy policy lens mapaph",
        canonical: `${BASE_URL}/privacy`,
        jsonLd: [],
        bodyHtml: `<div class="seo-fallback-content"><h1>Privacy Policy</h1><p>Privacy terms for Lens (MapaPH).</p></div>`,
    });

    pagesToRender.set("/terms", {
        title: "Terms of Service | Lens PH",
        description: "Terms of Service and data license terms for using Lens (MapaPH) GeoJSON boundaries.",
        keywords: "terms of service lens mapaph",
        canonical: `${BASE_URL}/terms`,
        jsonLd: [],
        bodyHtml: `<div class="seo-fallback-content"><h1>Terms of Service</h1><p>Terms of service for Lens (MapaPH).</p></div>`,
    });

    // 3. Regions
    regions.forEach((r) => {
        const rSlug = slugify(r.name);
        if (!rSlug) return;
        const route = `/region/${rSlug}`;
        const childProvinces = provincesByRegion.get(r.psgc) || [];

        const pop = formatNumber(r.pop_2024);
        const area = formatDecimal(r.area_km2);
        const density = formatDecimal(r.density_2024);

        pagesToRender.set(route, {
            title: `${r.name} GeoJSON Map & Geographic Data | Lens PH`,
            description: `Explore ${r.name}, Philippines boundary map, GeoJSON download, population (${pop}), land area (${area} sq km), and density (${density} people/sq km).`,
            keywords: `${r.name.toLowerCase()} geojson, ${r.name.toLowerCase()} map, philippine regions, psgc ${r.psgc}`,
            canonical: `${BASE_URL}${route}`,
            jsonLd: [
                {
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: [
                        { "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` },
                        { "@type": "ListItem", position: 2, name: r.name, item: `${BASE_URL}${route}` },
                    ],
                },
                {
                    "@context": "https://schema.org",
                    "@type": "AdministrativeArea",
                    name: r.name,
                    alternateName: `PSGC ${r.psgc}`,
                    description: `${r.name} is an administrative region in the Philippines with a 2024 population of ${pop} and an area of ${area} sq km.`,
                    url: `${BASE_URL}${route}`,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Dataset",
                    name: `${r.name} GeoJSON Boundary Dataset`,
                    description: `GeoJSON administrative boundaries and census statistics for ${r.name}, Philippines.`,
                    url: `${BASE_URL}${route}`,
                    spatialCoverage: { "@type": "Place", name: r.name },
                },
            ],
            bodyHtml: `
                <div class="seo-fallback-content">
                    <nav aria-label="Breadcrumb">
                        <a href="/">Philippines</a> &gt; <span>${escapeHtml(r.name)}</span>
                    </nav>
                    <h1>${escapeHtml(r.name)} — GeoJSON Map &amp; Administrative Data</h1>
                    <p>
                        ${escapeHtml(r.name)} is an administrative region in the Philippines (PSGC code <code>${r.psgc}</code>).
                        It covers a total land area of <strong>${area} km²</strong> with a 2024 population of <strong>${pop}</strong> (density: <strong>${density} people/km²</strong>).
                    </p>
                    <h2>Provinces in ${escapeHtml(r.name)}</h2>
                    <ul>
                        ${childProvinces
                            .map((p) => {
                                const pSlug = slugify(p.name);
                                return `<li><a href="/province/${pSlug}">${escapeHtml(p.name)} GeoJSON &amp; Boundary Map</a></li>`;
                            })
                            .join("\n")}
                    </ul>
                </div>
            `,
        });
    });

    // 4. Provinces
    provinces.forEach((p) => {
        const pSlug = slugify(p.name);
        if (!pSlug) return;
        const route = `/province/${pSlug}`;

        const parentRegion = p.region_psgc ? regionByPsgc.get(p.region_psgc) : null;
        const regionSlug = parentRegion ? slugify(parentRegion.name) : "";

        const childMunicities = municitiesByProvince.get(p.psgc) || [];

        const pop = formatNumber(p.pop_2024);
        const area = formatDecimal(p.area_km2);
        const density = formatDecimal(p.density_2024);

        const breadcrumbs = [
            { "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` },
        ];
        if (parentRegion && regionSlug) {
            breadcrumbs.push({ "@type": "ListItem", position: 2, name: parentRegion.name, item: `${BASE_URL}/region/${regionSlug}` });
            breadcrumbs.push({ "@type": "ListItem", position: 3, name: p.name, item: `${BASE_URL}${route}` });
        } else {
            breadcrumbs.push({ "@type": "ListItem", position: 2, name: p.name, item: `${BASE_URL}${route}` });
        }

        pagesToRender.set(route, {
            title: `${p.name} GeoJSON Map, Population & Boundaries | Lens PH`,
            description: `Download GeoJSON boundaries and view population (${pop}), area (${area} sq km), and municipal map data for ${p.name}, ${parentRegion ? parentRegion.name : "Philippines"}.`,
            keywords: `${p.name.toLowerCase()} geojson, ${p.name.toLowerCase()} map, ${p.name.toLowerCase()} province boundaries, psgc ${p.psgc}`,
            canonical: `${BASE_URL}${route}`,
            jsonLd: [
                {
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: breadcrumbs,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "AdministrativeArea",
                    name: p.name,
                    alternateName: `PSGC ${p.psgc}`,
                    description: `${p.name} is a province in ${parentRegion ? parentRegion.name : "the Philippines"} with a 2024 population of ${pop} and an area of ${area} sq km.`,
                    url: `${BASE_URL}${route}`,
                    containedInPlace: parentRegion
                        ? { "@type": "AdministrativeArea", name: parentRegion.name, url: `${BASE_URL}/region/${regionSlug}` }
                        : undefined,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Dataset",
                    name: `${p.name} GeoJSON Boundary Dataset`,
                    description: `GeoJSON administrative boundary vector data and municipal metrics for ${p.name}, Philippines.`,
                    url: `${BASE_URL}${route}`,
                    spatialCoverage: { "@type": "Place", name: p.name },
                },
            ],
            bodyHtml: `
                <div class="seo-fallback-content">
                    <nav aria-label="Breadcrumb">
                        <a href="/">Philippines</a>
                        ${parentRegion && regionSlug ? `&gt; <a href="/region/${regionSlug}">${escapeHtml(parentRegion.name)}</a>` : ""}
                        &gt; <span>${escapeHtml(p.name)}</span>
                    </nav>
                    <h1>${escapeHtml(p.name)} — GeoJSON Map &amp; Boundary Data</h1>
                    <p>
                        ${escapeHtml(p.name)} is a province located in ${parentRegion ? escapeHtml(parentRegion.name) : "the Philippines"} (PSGC code <code>${p.psgc}</code>).
                        It covers an area of <strong>${area} km²</strong> with a population of <strong>${pop}</strong> (${density} people/km²).
                    </p>
                    <h2>Cities &amp; Municipalities in ${escapeHtml(p.name)}</h2>
                    <ul>
                        ${childMunicities
                            .map((m) => {
                                const mSlug = slugify(m.name);
                                return `<li><a href="/municipality/${mSlug}">${escapeHtml(m.name)} GeoJSON &amp; Map Data</a></li>`;
                            })
                            .join("\n")}
                    </ul>
                </div>
            `,
        });
    });

    // 5. Municipalities
    municities.forEach((m) => {
        const mSlug = slugify(m.name);
        if (!mSlug) return;
        const route = `/municipality/${mSlug}`;

        const parentProvince = m.province_psgc ? provinceByPsgc.get(m.province_psgc) : null;
        const parentRegion = m.region_psgc ? regionByPsgc.get(m.region_psgc) : null;

        const provinceSlug = parentProvince ? slugify(parentProvince.name) : "";
        const regionSlug = parentRegion ? slugify(parentRegion.name) : "";

        const siblings = parentProvince ? municitiesByProvince.get(parentProvince.psgc) || [] : [];

        const pop = formatNumber(m.pop_2024);
        const area = formatDecimal(m.area_km2);
        const density = formatDecimal(m.density_2024);
        const locationStr = parentProvince ? `${m.name}, ${parentProvince.name}` : m.name;

        const breadcrumbs = [
            { "@type": "ListItem", position: 1, name: "Philippines", item: `${BASE_URL}/` },
        ];
        if (parentRegion && regionSlug) {
            breadcrumbs.push({ "@type": "ListItem", position: 2, name: parentRegion.name, item: `${BASE_URL}/region/${regionSlug}` });
        }
        if (parentProvince && provinceSlug) {
            breadcrumbs.push({ "@type": "ListItem", position: breadcrumbs.length + 1, name: parentProvince.name, item: `${BASE_URL}/province/${provinceSlug}` });
        }
        breadcrumbs.push({ "@type": "ListItem", position: breadcrumbs.length + 1, name: m.name, item: `${BASE_URL}${route}` });

        pagesToRender.set(route, {
            title: `${locationStr} — Boundary Map & GeoJSON Data | Lens PH`,
            description: `Download GeoJSON boundaries, view population density (${density}/sq km), area (${area} sq km), and barangay map data for ${locationStr}, Philippines.`,
            keywords: `${m.name.toLowerCase()} geojson, ${m.name.toLowerCase()} boundary map, ${locationStr.toLowerCase()} map, psgc ${m.psgc}`,
            canonical: `${BASE_URL}${route}`,
            jsonLd: [
                {
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: breadcrumbs,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "AdministrativeArea",
                    name: m.name,
                    alternateName: `PSGC ${m.psgc}`,
                    description: `${m.name} is a ${m.geo_lvl === "City" ? "city" : "municipality"} in ${parentProvince ? parentProvince.name : "the Philippines"} with a 2024 population of ${pop} and an area of ${area} sq km.`,
                    url: `${BASE_URL}${route}`,
                    containedInPlace: parentProvince
                        ? { "@type": "AdministrativeArea", name: parentProvince.name, url: `${BASE_URL}/province/${provinceSlug}` }
                        : undefined,
                },
                {
                    "@context": "https://schema.org",
                    "@type": "Dataset",
                    name: `${m.name} GeoJSON Boundary Dataset`,
                    description: `GeoJSON administrative boundary vector data and barangay metrics for ${locationStr}, Philippines.`,
                    url: `${BASE_URL}${route}`,
                    spatialCoverage: { "@type": "Place", name: locationStr },
                },
            ],
            bodyHtml: `
                <div class="seo-fallback-content">
                    <nav aria-label="Breadcrumb">
                        <a href="/">Philippines</a>
                        ${parentRegion && regionSlug ? `&gt; <a href="/region/${regionSlug}">${escapeHtml(parentRegion.name)}</a>` : ""}
                        ${parentProvince && provinceSlug ? `&gt; <a href="/province/${provinceSlug}">${escapeHtml(parentProvince.name)}</a>` : ""}
                        &gt; <span>${escapeHtml(m.name)}</span>
                    </nav>
                    <h1>${escapeHtml(m.name)}, ${parentProvince ? escapeHtml(parentProvince.name) : "Philippines"} — GeoJSON Boundary &amp; Map Data</h1>
                    <p>
                        ${escapeHtml(m.name)} is a ${m.geo_lvl === "City" ? "city" : "municipality"} in ${parentProvince ? escapeHtml(parentProvince.name) : "the Philippines"} (PSGC code <code>${m.psgc}</code>).
                        It covers a land area of <strong>${area} km²</strong> with a 2024 population of <strong>${pop}</strong> (${density} residents per km²).
                    </p>
                    ${
                        siblings.length > 1
                            ? `
                        <h2>Other Localities in ${parentProvince ? escapeHtml(parentProvince.name) : "this area"}</h2>
                        <ul>
                            ${siblings
                                .filter((s) => s.psgc !== m.psgc)
                                .slice(0, 12)
                                .map((s) => {
                                    const sSlug = slugify(s.name);
                                    return `<li><a href="/municipality/${sSlug}">${escapeHtml(s.name)} GeoJSON Map</a></li>`;
                                })
                                .join("\n")}
                        </ul>
                    `
                            : ""
                    }
                </div>
            `,
        });
    });

    console.log(`[prerender] Total pages to generate: ${pagesToRender.size}`);

    let renderedCount = 0;
    for (const [routePath, meta] of pagesToRender.entries()) {
        const isHome = routePath === "/";
        const targetDir = isHome ? distPath : path.resolve(distPath, routePath.replace(/^\//, ""));
        const targetFile = isHome ? templatePath : path.resolve(targetDir, "index.html");

        if (!isHome) {
            await fs.mkdir(targetDir, { recursive: true });
        }

        // Replace metadata in template
        let pageHtml = templateHtml;

        // Title
        pageHtml = pageHtml.replace(/<title>.*?<\/title>/gi, `<title>${escapeHtml(meta.title)}</title>`);
        pageHtml = pageHtml.replace(/<meta name="title" content=".*?" \/>/gi, `<meta name="title" content="${escapeHtml(meta.title)}" />`);
        pageHtml = pageHtml.replace(/<meta property="og:title" content=".*?" \/>/gi, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
        pageHtml = pageHtml.replace(/<meta property="twitter:title" content=".*?" \/>/gi, `<meta property="twitter:title" content="${escapeHtml(meta.title)}" />`);

        // Description
        pageHtml = pageHtml.replace(/<meta name="description"\s+content=".*?" \/>/gis, `<meta name="description" content="${escapeHtml(meta.description)}" />`);
        pageHtml = pageHtml.replace(/<meta property="og:description"\s+content=".*?" \/>/gis, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
        pageHtml = pageHtml.replace(/<meta property="twitter:description"\s+content=".*?" \/>/gis, `<meta property="twitter:description" content="${escapeHtml(meta.description)}" />`);

        // Keywords
        pageHtml = pageHtml.replace(/<meta name="keywords"\s+content=".*?" \/>/gis, `<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`);

        // Canonical & OG URL
        pageHtml = pageHtml.replace(/<link rel="canonical" href=".*?" \/>/gi, `<link rel="canonical" href="${meta.canonical}" />`);
        pageHtml = pageHtml.replace(/<meta property="og:url" content=".*?" \/>/gi, `<meta property="og:url" content="${meta.canonical}" />`);
        pageHtml = pageHtml.replace(/<meta property="twitter:url" content=".*?" \/>/gi, `<meta property="twitter:url" content="${meta.canonical}" />`);

        // JSON-LD
        const jsonLdString = meta.jsonLd.map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`).join("\n    ");
        if (pageHtml.includes('type="application/ld+json"')) {
            pageHtml = pageHtml.replace(/<script type="application\/ld\+json">.*?<\/script>/gis, jsonLdString);
        } else {
            pageHtml = pageHtml.replace("</head>", `    ${jsonLdString}\n</head>`);
        }

        // Body / noscript fallback content
        const fallbackContent = `<noscript>\n${meta.bodyHtml}\n</noscript>`;
        if (pageHtml.includes("<noscript>")) {
            pageHtml = pageHtml.replace(/<noscript>.*?<\/noscript>/gis, fallbackContent);
        } else {
            pageHtml = pageHtml.replace('<div id="root"></div>', `${fallbackContent}\n    <div id="root"></div>`);
        }

        await fs.writeFile(targetFile, pageHtml, "utf8");
        renderedCount++;
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
