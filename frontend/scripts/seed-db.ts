// Seeds regions, provinces, and municities metadata from public/geo into Supabase.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../public/geo");

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function readJson<T>(relativePath: string): T {
    return JSON.parse(fs.readFileSync(path.join(GEO_DIR, relativePath), "utf8")) as T;
}

function stripGeometry<T extends { geometry?: unknown }>(rows: T[]): Omit<T, "geometry">[] {
    return rows.map((row) => {
        const { ...rest } = row;
        delete rest.geometry;
        return rest as Omit<T, "geometry">;
    });
}

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

// Postgres rejects an upsert batch that touches the same conflict key twice; keep the last row per psgc.
function dedupeByPsgc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const byPsgc = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
        byPsgc.set(String(row.psgc), row);
    }
    if (byPsgc.size !== rows.length) {
        console.warn(`  (deduped ${rows.length - byPsgc.size} duplicate psgc rows)`);
    }
    return [...byPsgc.values()];
}

async function upsertTable(table: string, rows: Record<string, unknown>[]) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "psgc" });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ${table}: ${rows.length} rows`);
}

async function main() {
    console.log("Seeding database from public/geo…");

    const regions = dedupeByPsgc(stripGeometry(readJson<Array<Record<string, unknown>>>("regions.json")));
    const provinces = dedupeByPsgc(stripGeometry(readJson<Array<Record<string, unknown>>>("provinces.json")));
    const municities = dedupeByPsgc(readJson<Array<Record<string, unknown>>>("municities/meta.json"));

    await upsertTable("regions", regions);
    await upsertTable("provinces", provinces);

    console.log("  municities (chunked)…");
    let total = 0;
    for (const chunk of chunks(municities, 500)) {
        await upsertTable("municities", chunk);
        total += chunk.length;
    }

    console.log(`Done. Seeded ${regions.length} regions, ${provinces.length} provinces, ${total} municities.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
