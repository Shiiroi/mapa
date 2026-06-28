// Seeds barangay metadata from data-sets/geo/municities/bgy/meta.json into Supabase.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../data-sets/geo");
const BGY_META = path.join(GEO_DIR, "municities/bgy/meta.json");

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

// Keeps the last row per psgc so upsert batches don't touch a key twice.
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

// Upserts rows into a table, keyed on psgc.
async function upsertTable(table: string, rows: Record<string, unknown>[]) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "psgc" });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ${table}: ${rows.length} rows`);
}

// Seeds barangay metadata (chunked) from the bgy meta.json into Supabase.
async function main() {
    if (!fs.existsSync(BGY_META)) {
        console.error(`Missing ${BGY_META}`);
        process.exit(1);
    }

    console.log("Seeding barangays from municities/bgy/meta.json…");
    const barangays = dedupeByPsgc(
        JSON.parse(fs.readFileSync(BGY_META, "utf8")) as Array<Record<string, unknown>>,
    );

    let total = 0;
    for (const chunk of chunks(barangays, 500)) {
        await upsertTable("barangays", chunk);
        total += chunk.length;
    }

    console.log(`Done. Seeded ${total} barangays.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
