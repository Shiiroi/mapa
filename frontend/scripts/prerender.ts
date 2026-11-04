import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

    const pagesToRender = new Map<string, PageMeta>();

    // 1. Homepage
    pagesToRender.set("/", {
        title: "Philippines GeoJSON Boundaries & Interactive Maps | Lens (MapaPH)",
        description:
            "Free GeoJSON administrative boundaries for every Philippine region, province, city, municipality, and barangay. Visualize population density, census metrics, GDP, and LGU data.",
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
                name: "Philippine Administrative Boundaries GeoJSON Dataset",
                description:
                    "Complete Philippine administrative boundary vector data down to the barangay level, aligned with standard PSGC classification.",
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
                <h1>Philippines GeoJSON Boundaries &amp; Interactive Choropleth Maps</h1>
                <p>
                    Lens (MapaPH) is an open-source civic geospatial platform providing standards-compliant IETF RFC 7946 GeoJSON boundary downloads and interactive choropleth maps across all 18 regions, 82 provinces, 149 cities, 1,493 municipalities, and 42,011 barangays in the Philippines.
                </p>
                <h2>Core Datasets &amp; Cartographic Capabilities</h2>
                <ul>
                    <li><strong>Multi-Tier GeoJSON Exports:</strong> Download clean, WGS 84 (EPSG:4326) administrative boundary polygons keyed by official 10-digit Philippine Standard Geographic Codes (PSGC).</li>
                    <li><strong>2024 PSA Census &amp; Demographic Overlays:</strong> Inspect population counts, geodesic land area (km²), and population density derived from the Philippine Statistics Authority (PSA) Census of Population (POPCEN).</li>
                    <li><strong>Municipal Financial &amp; Economic Layers:</strong> Compare regional Gross Domestic Product (GDP) and Local Government Unit (LGU) financial asset statements published by the Commission on Audit (COA).</li>
                    <li><strong>Custom CSV Choropleth Joining:</strong> Upload any spreadsheet keyed by PSGC code or locality name to generate bivariate and sequential thematic maps in the browser without desktop GIS software.</li>
                </ul>
                <h2>Related Documentation &amp; Civic Utilities</h2>
                <ul>
                    <li><a href="https://www.mapaph.com/docs/lens">Lens User Manual &amp; Technical Methodology</a></li>
                    <li><a href="https://www.mapaph.com/docs/psgc">Philippine Standard Geographic Code (PSGC) Reference Guide</a></li>
                    <li><a href="https://www.mapaph.com/docs/geojson-guide">GeoJSON RFC 7946 Developer Guide</a></li>
                    <li><a href="https://www.mapaph.com/tools">mapaPH Civic Cartography Tools Directory</a></li>
                </ul>
            </div>
        `,
    });

    // 2. Static Pages: FAQ, Privacy, Terms
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
                <p>
                    Technical documentation covering Philippine GeoJSON boundary exports, 10-digit Philippine Standard Geographic Code (PSGC) alignment, PSA 2024 Census of Population (POPCEN) metrics, COA financial statements, and custom CSV choropleth overlays in Lens.
                </p>
                <h2>Key Topics Covered</h2>
                <ul>
                    <li><strong>RFC 7946 GeoJSON Specification:</strong> All boundary exports use World Geodetic System 1984 (WGS 84 / EPSG:4326) decimal degree coordinates and right-hand polygon winding rules compatible with MapLibre GL JS, Leaflet, QGIS, and PostGIS.</li>
                    <li><strong>PSGC 10-Digit Standard Alignment:</strong> Administrative divisions follow the Philippine Statistics Authority (PSA) quarterly PSGC updates, including the Bangsamoro Autonomous Region in Muslim Mindanao (BARMM), Negros Island Region (NIR), and the Makati-Taguig EMBO barangay transfers.</li>
                    <li><strong>Authoritative Public Domain Sources:</strong> Demographic, economic, and electoral layers are compiled from official releases by the PSA, Commission on Audit (COA), and Commission on Elections (COMELEC) under Republic Act No. 8293 Section 176 and Executive Order No. 2 (s. 2016).</li>
                </ul>
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
                <p>
                    Lens is an open-source geospatial visualization utility in the mapaPH ecosystem. We do not require user accounts or transmit custom CSV uploads to backend servers. All custom spreadsheet joins and optional geolocation centering happen locally inside your browser.
                </p>
                <p>
                    This policy details our client-side storage architecture (IndexedDB and localStorage caching for boundary vectors), aggregate analytics via Vercel Web Analytics, third-party advertising cookie disclosures for Google AdSense across the mapaph.com domain, and your statutory rights under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
                </p>
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
                <p>
                    Lens is an independent, community-maintained open-source project released under the MIT License and is not affiliated with the Philippine Statistics Authority (PSA), NAMRIA, COMELEC, or COA. Administrative boundary vectors are provided for thematic mapping, research, and visualization purposes and do not substitute for licensed cadastral surveys under Republic Act No. 8560.
                </p>
            </div>
        `,
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
