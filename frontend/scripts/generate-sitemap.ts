import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { loadGeoCatalog } from "./lib/geoCatalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://lens.mapaph.com";
const LASTMOD = new Date().toISOString().slice(0, 10);

interface SitemapEntry {
    url: string;
    changefreq: "weekly" | "monthly";
    priority: string;
}

async function build() {
    const catalog = await loadGeoCatalog();
    const seen = new Set<string>();
    const entries: SitemapEntry[] = [];

    const add = (urlPath: string, changefreq: "weekly" | "monthly", priority: string) => {
        const url = `${BASE_URL}${urlPath}`;
        if (seen.has(url)) return;
        seen.add(url);
        entries.push({ url, changefreq, priority });
    };

    add("/", "weekly", "1.0");
    add("/directory", "weekly", "0.95");

    for (const r of catalog.regions) {
        add(r.urlPath, "monthly", "0.9");
    }
    for (const p of catalog.provinces) {
        add(p.urlPath, "monthly", "0.85");
    }
    for (const m of catalog.municities) {
        add(m.urlPath, "monthly", "0.75");
    }

    add("/faq", "monthly", "0.7");
    add("/privacy", "monthly", "0.4");
    add("/terms", "monthly", "0.4");

    const xmlEntries = entries
        .map((entry) =>
            [
                "  <url>",
                `    <loc>${entry.url}</loc>`,
                `    <lastmod>${LASTMOD}</lastmod>`,
                `    <changefreq>${entry.changefreq}</changefreq>`,
                `    <priority>${entry.priority}</priority>`,
                "  </url>",
            ].join("\n"),
        )
        .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries}\n</urlset>\n`;

    const outPath = path.resolve(__dirname, "../public/sitemap.xml");
    await fs.writeFile(outPath, xml, "utf8");
    console.log(`Wrote sitemap with ${entries.length} URLs to ${outPath}`);

    const robots = [
        "User-agent: *",
        "Allow: /",
        "",
        "User-agent: Mediapartners-Google",
        "Allow: /",
        "",
        `Sitemap: ${BASE_URL}/sitemap.xml`,
        "",
    ].join("\n");

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
