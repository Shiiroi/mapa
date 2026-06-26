// Seeds division_stats from enriched public/geo JSON (pop, area, density).

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { DivisionStatsFields } from "./lib/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../public/geo");
const MUNI_DIR = path.join(GEO_DIR, "municities");
const BGY_DIR = path.join(MUNI_DIR, "bgy");

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

type StatsRow = DivisionStatsFields & { psgc: string; geo_lvl?: string };

function levelFromGeoLvl(geoLvl: string | undefined): string {
    switch (geoLvl) {
        case "Country":
            return "country";
        case "Reg":
            return "region";
        case "Prov":
            return "province";
        case "City":
        case "Mun":
            return "municipality";
        case "Bgy":
            return "barangay";
        case "Special":
            return "special";
        default:
            return "unknown";
    }
}

function toDbRow(row: StatsRow): Record<string, unknown> {
    return {
        psgc: row.psgc,
        level: levelFromGeoLvl(row.geo_lvl),
        pop_2015: row.pop_2015,
        pop_2020: row.pop_2020,
        pop_2024: row.pop_2024,
        area_km2: row.area_km2,
        density_2024: row.density_2024,
        pct_change_2020_2024: row.pct_change_2020_2024,
    };
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(fs.readFileSync(path.join(GEO_DIR, relativePath), "utf8")) as T;
}

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function upsertChunk(rows: Record<string, unknown>[]) {
    const { error } = await supabase.from("division_stats").upsert(rows, { onConflict: "psgc" });
    if (error) throw new Error(error.message);
}

async function main() {
    console.log("Seeding division_stats from public/geo…");
    const allRows: Record<string, unknown>[] = [];
    const seen = new Set<string>();

    function collect(rows: StatsRow[]) {
        for (const row of rows) {
            if (seen.has(row.psgc)) continue;
            seen.add(row.psgc);
            allRows.push(toDbRow(row));
        }
    }

    if (fs.existsSync(path.join(GEO_DIR, "country.json"))) {
        collect([readJson<StatsRow>("country.json")]);
    }

    collect(readJson<StatsRow[]>("regions.json"));
    collect(readJson<StatsRow[]>("provinces.json"));

    const manifestPath = path.join(MUNI_DIR, "manifest.json");
    if (fs.existsSync(manifestPath)) {
        const manifest = readJson<{ provincePsgcs: string[] }>("municities/manifest.json");
        for (const provincePsgc of manifest.provincePsgcs) {
            const rel = `municities/province-${provincePsgc}.json`;
            if (fs.existsSync(path.join(GEO_DIR, rel))) {
                collect(readJson<StatsRow[]>(rel));
            }
        }
        console.log(`  Loaded municipalities from ${manifest.provincePsgcs.length} province files`);
    }

    if (fs.existsSync(BGY_DIR)) {
        let bgyFiles = 0;
        for (const file of fs.readdirSync(BGY_DIR)) {
            if (!/^\d+\.json$/.test(file)) continue;
            const rows = JSON.parse(fs.readFileSync(path.join(BGY_DIR, file), "utf8")) as StatsRow[];
            collect(rows);
            bgyFiles++;
        }
        console.log(`  Loaded barangays from ${bgyFiles} per-municity files`);
    }

    console.log(`  Upserting ${allRows.length} stat rows…`);
    let total = 0;
    for (const chunk of chunks(allRows, 500)) {
        await upsertChunk(chunk);
        total += chunk.length;
    }

    console.log(`Done. Seeded ${total} division_stats rows.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
