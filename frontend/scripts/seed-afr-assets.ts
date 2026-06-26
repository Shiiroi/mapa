// Seed division_stats.assets_2024 from mapped COA AFR CSV (thousand pesos × 1000).

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../public/lgu_finance_2024.csv");

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

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`Missing ${CSV_PATH}. Run: pnpm map:afr`);
        process.exit(1);
    }

    const raw = fs.readFileSync(CSV_PATH, "utf8");
    const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

    const upserts: { psgc: string; level: string; assets_2024: number | null }[] = [];
    for (const row of rows) {
        const assetsRaw = row.assets?.trim();
        const assets =
            assetsRaw === "" || assetsRaw == null ? null : Math.round(Number(assetsRaw) * 1000);
        upserts.push({
            psgc: row.psgc.padStart(10, "0"),
            level: row.level,
            assets_2024: assets,
        });
    }

    console.log(`Upserting assets_2024 for ${upserts.length} rows…`);
    for (const batch of chunks(upserts, 200)) {
        const { error } = await supabase.from("division_stats").upsert(batch, { onConflict: "psgc" });
        if (error) throw new Error(error.message);
    }
    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
