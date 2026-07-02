import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { geoAreaKm2 } from "./lib/stats.js";
import type { Geometry } from "geojson";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../data-sets/geo");
const MUNI_DIR = path.join(GEO_DIR, "municities");
const PDF_LAND_AREA_JSON = path.join(__dirname, "../data-sets/data/clean/pdf_land_area.json");

interface GeoElement {
    psgc: string;
    name: string;
    area_km2: number | null;
    density_2024: number | null;
    pop_2024?: number | null;
    geometry?: Geometry;
    [key: string]: unknown;
}

function computeDensity(pop2024: number | null | undefined, areaKm2: number | null | undefined): number | null {
    if (pop2024 == null || areaKm2 == null || areaKm2 <= 0) return null;
    return pop2024 / areaKm2;
}

function main() {
    if (!fs.existsSync(PDF_LAND_AREA_JSON)) {
        console.error(`Missing PDF land area mappings: ${PDF_LAND_AREA_JSON}. Run the Python extraction script first.`);
        process.exit(1);
    }

    console.log("Loading PDF land area mappings...");
    const pdfLandArea = JSON.parse(fs.readFileSync(PDF_LAND_AREA_JSON, "utf8")) as Record<string, number>;

    // Helper to enrich a single element
    function enrichElement(el: GeoElement) {
        const psgc = el.psgc;
        let area = pdfLandArea[psgc];
        if (area === undefined || area === null || area <= 0) {
            // Fall back to computing geodesic area from geometry
            const computedArea = geoAreaKm2(el.geometry);
            if (computedArea != null && computedArea > 0) {
                area = computedArea;
            } else {
                area = el.area_km2 ?? 0;
            }
        }
        el.area_km2 = area > 0 ? area : null;
        el.density_2024 = computeDensity(el.pop_2024, el.area_km2);
    }

    // Helper to enrich a file (can be a single object or an array of objects)
    function enrichFile(filePath: string) {
        if (!fs.existsSync(filePath)) {
            console.warn(`File does not exist: ${filePath}`);
            return;
        }
        const raw = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            data.forEach((el: GeoElement) => enrichElement(el));
        } else {
            enrichElement(data as GeoElement);
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        console.log(`  Enriched: ${path.basename(filePath)}`);
    }

    console.log("Enriching geographic files...");
    
    // 1. Country
    enrichFile(path.join(GEO_DIR, "country.json"));
    
    // 2. Regions
    enrichFile(path.join(GEO_DIR, "regions.json"));
    
    // 3. Provinces
    enrichFile(path.join(GEO_DIR, "provinces.json"));
    
    // 4. Municipalities meta
    enrichFile(path.join(MUNI_DIR, "meta.json"));

    // 5. Province geometry files
    const manifestPath = path.join(MUNI_DIR, "manifest.json");
    if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { provincePsgcs: string[] };
        manifest.provincePsgcs.forEach((provincePsgc) => {
            const rel = `province-${provincePsgc}.json`;
            enrichFile(path.join(MUNI_DIR, rel));
        });
        console.log(`  Enriched ${manifest.provincePsgcs.length} province geometry files.`);
    }

    console.log("Geographic enrichment complete.");
}

main();
