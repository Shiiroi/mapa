// Seeds division_stats gdp_2022/2023/2024 from mapped PSA GDP CSV (thousand pesos × 1000).

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../public/gdp_mapped.csv");

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// Loads all existing division_stats psgc/level pairs (paginated past the 1k default cap).
async function fetchAllDivisionPsgc(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("division_stats")
            .select("psgc, level")
            .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        for (const row of data) map.set(row.psgc, row.level as string);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return map;
}

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`Missing ${CSV_PATH}. Run: pnpm map:gdp`);
        process.exit(1);
    }

    const rows = parse(fs.readFileSync(CSV_PATH, "utf8"), {
        columns: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];

    const existingByPsgc = await fetchAllDivisionPsgc();
    const upserts = rows
        .map((row) => ({
            psgc: row.psgc.padStart(10, "0"),
            level: row.level,
            gdp_2022: Number(row.gdp_2022),
            gdp_2023: Number(row.gdp_2023),
            gdp_2024: Number(row.gdp_2024),
        }))
        .filter((row) => existingByPsgc.has(row.psgc));

    const skipped = rows.length - upserts.length;
    console.log(`Upserting GDP for ${upserts.length} rows (${skipped} skipped — not in division_stats)…`);

    for (const batch of chunks(upserts, 200)) {
        const payload = batch.map((row) => ({
            psgc: row.psgc,
            level: existingByPsgc.get(row.psgc) ?? row.level,
            gdp_2022: row.gdp_2022,
            gdp_2023: row.gdp_2023,
            gdp_2024: row.gdp_2024,
        }));
        const { error } = await supabase.from("division_stats").upsert(payload, { onConflict: "psgc" });
        if (error) throw new Error(error.message);
    }
    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
