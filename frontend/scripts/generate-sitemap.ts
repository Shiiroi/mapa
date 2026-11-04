import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://lens.mapaph.com";

const LASTMOD = new Date().toISOString().slice(0, 10);

async function build() {
    const urls = [
        `${BASE_URL}/`,
        `${BASE_URL}/faq`,
        `${BASE_URL}/privacy`,
        `${BASE_URL}/terms`,
    ];

    const xmlEntries = urls
        .map((url) => {
            const pathName = new URL(url).pathname;
            const isHomePage = pathName === "/";
            const changefreq = isHomePage ? "weekly" : "monthly";
            const priority = isHomePage ? "1.0" : "0.8";

            return [
                "  <url>",
                `    <loc>${url}</loc>`,
                `    <lastmod>${LASTMOD}</lastmod>`,
                `    <changefreq>${changefreq}</changefreq>`,
                `    <priority>${priority}</priority>`,
                "  </url>",
            ].join("\n");
        })
        .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries}\n</urlset>\n`;

    const outPath = path.resolve(__dirname, "../public/sitemap.xml");
    await fs.writeFile(outPath, xml, "utf8");
    console.log(`Wrote sitemap with ${urls.length} URLs to ${outPath}`);

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
