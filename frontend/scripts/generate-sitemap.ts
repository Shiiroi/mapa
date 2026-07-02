import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://mapa.shhiroi.me";

function slugify(name: string) {
    return (
        name
            .normalize("NFKD")
            // remove diacritics
            .replace(/\p{Diacritic}+/gu, "")
            .toLowerCase()
            // replace ampersand with and
            .replace(/&/g, " and ")
            // remove apostrophes
            .replace(/[’'`]/g, "")
            // replace non-alphanumeric with hyphens
            .replace(/[^a-z0-9]+/g, "-")
            // collapse multiple hyphens
            .replace(/-+/g, "-")
            // trim hyphens
            .replace(/^-|-$/g, "")
    );
}

async function readNames(jsonPath: string, nameField = "name") {
    try {
        const raw = await fs.readFile(jsonPath, "utf8");
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.map((r: any) => String(r[nameField] ?? "")).filter(Boolean);
    } catch (e) {
        console.warn(`Could not read ${jsonPath}: ${e}`);
        return [];
    }
}

async function build() {
    const regionsPath = path.resolve(__dirname, "../data-sets/geo/regions.json");
    const provincesPath = path.resolve(__dirname, "../data-sets/geo/provinces.json");

    const regions = await readNames(regionsPath);
    const provinces = await readNames(provincesPath);

    const urls = new Set<string>();
    urls.add(`${BASE_URL}/`);

    regions.forEach((r) => {
        const s = slugify(r);
        if (s) urls.add(`${BASE_URL}/region/${s}`);
    });

    provinces.forEach((p) => {
        const s = slugify(p);
        if (s) urls.add(`${BASE_URL}/province/${s}`);
    });

    const items = Array.from(urls).sort();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
        .map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`)
        .join("\n")}\n</urlset>\n`;

    const outPath = path.resolve(__dirname, "../public/sitemap.xml");
    await fs.writeFile(outPath, xml, "utf8");
    console.log(`Wrote sitemap with ${items.length} URLs to ${outPath}`);

    // write robots.txt
    const robots = `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`;
    const robotsPath = path.resolve(__dirname, "../public/robots.txt");
    await fs.writeFile(robotsPath, robots, "utf8");
    console.log(`Wrote robots.txt to ${robotsPath}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generate-sitemap.ts")) {
    build().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

export default build;
