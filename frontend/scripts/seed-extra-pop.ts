// Seed division_stats pop_2010 and 2020 household age/sex from mapped CSVs.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public");
const POP_2010_CSV = path.join(PUBLIC_DIR, "pop_2010.csv");
const AGESEX_CSV = path.join(PUBLIC_DIR, "household_agesex_2020.csv");

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

// Loads all existing division_stats psgc → level pairs (paginated past the 1k cap).
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

// Merges 2010 population and 2020 age/sex CSVs and upserts them onto division_stats.
async function main() {
    if (!fs.existsSync(POP_2010_CSV) || !fs.existsSync(AGESEX_CSV)) {
        console.error("Missing mapped CSVs. Run: pnpm map:extrapop");
        process.exit(1);
    }

    const popRows = parse(fs.readFileSync(POP_2010_CSV, "utf8"), {
        columns: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];

    const agesexRows = parse(fs.readFileSync(AGESEX_CSV, "utf8"), {
        columns: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];

    const levelByPsgc = new Map<string, string>();
    for (const row of agesexRows) {
        levelByPsgc.set(row.psgc.padStart(10, "0"), row.level);
    }

    const byPsgc = new Map<
        string,
        {
            psgc: string;
            level?: string;
            pop_2010?: number;
            pop_male_2020?: number;
            pop_female_2020?: number;
            age_sex_2020?: unknown;
        }
    >();

    for (const row of popRows) {
        const psgc = row.psgc.padStart(10, "0");
        byPsgc.set(psgc, {
            ...byPsgc.get(psgc),
            psgc,
            level: row.level,
            pop_2010: Number(row.pop_2010),
        });
    }

    for (const row of agesexRows) {
        const psgc = row.psgc.padStart(10, "0");
        const existing = byPsgc.get(psgc) ?? { psgc };
        byPsgc.set(psgc, {
            ...existing,
            level: row.level,
            pop_male_2020: Number(row.pop_male_2020),
            pop_female_2020: Number(row.pop_female_2020),
            age_sex_2020: JSON.parse(row.age_sex_2020),
        });
    }

    const existingByPsgc = await fetchAllDivisionPsgc();

    const upserts = [...byPsgc.values()].filter((row) => existingByPsgc.has(row.psgc));
    const skipped = byPsgc.size - upserts.length;
    console.log(`Upserting extra population fields for ${upserts.length} rows (${skipped} skipped — not in division_stats)…`);

    for (const batch of chunks(upserts, 200)) {
        const payload = batch.map((row) => ({
            psgc: row.psgc,
            level: existingByPsgc.get(row.psgc) ?? row.level ?? "unknown",
            pop_2010: row.pop_2010 ?? null,
            pop_male_2020: row.pop_male_2020 ?? null,
            pop_female_2020: row.pop_female_2020 ?? null,
            age_sex_2020: row.age_sex_2020 ?? null,
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
