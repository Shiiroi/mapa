// Seeds census population (2010/2015/2020/2024) onto division_stats from the
// combined popcen CSV, and recomputes density_2024 + pct_change_2020_2024 from
// the area_km2 already seeded by seed-stats. Run after seed:stats (which owns area).

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { computeDensity, computePctChange } from "./lib/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POPCEN_CSV = path.join(__dirname, "../public/data/clean/popcen_2010_2024.csv");

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

function toInt(raw: string | undefined): number | null {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : null;
}

// Loads existing division_stats psgc → area_km2 (paginated past the 1k row cap).
async function fetchAreaByPsgc(): Promise<Map<string, number | null>> {
    const map = new Map<string, number | null>();
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("division_stats")
            .select("psgc, area_km2")
            .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        for (const row of data) map.set(row.psgc, row.area_km2 as number | null);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return map;
}

async function main() {
    if (!fs.existsSync(POPCEN_CSV)) {
        console.error(`Missing ${POPCEN_CSV}. Run: pnpm convert:pop`);
        process.exit(1);
    }

    const rows = parse(fs.readFileSync(POPCEN_CSV, "utf8"), {
        columns: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];

    const areaByPsgc = await fetchAreaByPsgc();

    // Only touch psgcs that already exist in division_stats (seeded from geo).
    const payload = rows
        .map((row) => {
            const psgc = (row.psgc ?? "").replace(/\D/g, "").padStart(10, "0");
            const pop_2020 = toInt(row.pop_2020);
            const pop_2024 = toInt(row.pop_2024);
            const area = areaByPsgc.get(psgc) ?? null;
            return {
                psgc,
                level: row.level,
                pop_2010: toInt(row.pop_2010),
                pop_2015: toInt(row.pop_2015),
                pop_2020,
                pop_2024,
                density_2024: computeDensity(pop_2024, area),
                pct_change_2020_2024: computePctChange(pop_2020, pop_2024),
            };
        })
        .filter((row) => areaByPsgc.has(row.psgc));

    const skipped = rows.length - payload.length;
    console.log(`Upserting population for ${payload.length} rows (${skipped} skipped — not in division_stats)…`);

    let total = 0;
    for (const batch of chunks(payload, 500)) {
        const { error } = await supabase.from("division_stats").upsert(batch, { onConflict: "psgc" });
        if (error) throw new Error(error.message);
        total += batch.length;
    }
    console.log(`Done. Updated ${total} division_stats rows.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
