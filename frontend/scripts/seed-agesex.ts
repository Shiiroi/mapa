// Seeds the 2020 CPH household age/sex distribution onto division_stats from the
// mapped CSV (pop_male_2020, pop_female_2020, age_sex_2020 bands). Census head
// counts (2010-2024) are handled separately by seed-pop.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASETS_DIR = path.join(__dirname, "../data-sets");
const AGESEX_CSV = path.join(DATASETS_DIR, "data/clean/household_agesex_2020.csv");

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

// Loads all existing division_stats psgcs (paginated past the 1k cap).
async function fetchAllDivisionPsgc(): Promise<Set<string>> {
    const set = new Set<string>();
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("division_stats")
            .select("psgc")
            .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        for (const row of data) set.add(row.psgc);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return set;
}

// Upserts 2020 household age/sex fields onto existing division_stats rows.
async function main() {
    if (!fs.existsSync(AGESEX_CSV)) {
        console.error(`Missing ${AGESEX_CSV}.`);
        process.exit(1);
    }

    const rows = parse(fs.readFileSync(AGESEX_CSV, "utf8"), {
        columns: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];

    const existing = await fetchAllDivisionPsgc();

    const payload = rows
        .map((row) => ({
            psgc: row.psgc.padStart(10, "0"),
            pop_male_2020: Number(row.pop_male_2020),
            pop_female_2020: Number(row.pop_female_2020),
            age_sex_2020: JSON.parse(row.age_sex_2020),
        }))
        .filter((row) => existing.has(row.psgc));

    const skipped = rows.length - payload.length;
    console.log(`Upserting age/sex for ${payload.length} rows (${skipped} skipped — not in division_stats)…`);

    for (const batch of chunks(payload, 200)) {
        const { error } = await supabase.from("division_stats").upsert(batch, { onConflict: "psgc" });
        if (error) throw new Error(error.message);
    }
    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
