// Seeds custom_datasets elections-2022-president (categorical winner per province).

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, "../public/elections_2022_president_mapped.json");

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const DATASET = {
    id: "elections-2022-president",
    title: "2022 presidential winner by province",
    description:
        "Leading presidential candidate per province from GMA Eleksyon partial returns (May 10, 2022, ~12:00 PM). Unofficial; not COMELEC final results.",
    category: "Elections",
    kind: "categorical" as const,
    level: "province",
    unit: null,
    value_label: "Winner",
    source_name: "GMA Eleksyon 2022 (MIT, unofficial partial)",
    source_url: "https://github.com/AstroMC98/GMA-Eleksyon-2022-Data",
};

interface MappedRow {
    psgc: string;
    winner: string;
    detail: Record<string, number>;
}

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function main() {
    if (!fs.existsSync(JSON_PATH)) {
        console.error(`Missing ${JSON_PATH}. Run: pnpm map:elections`);
        process.exit(1);
    }

    const rows = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as MappedRow[];
    console.log(`Upserting dataset ${DATASET.id}…`);

    const { error: dsErr } = await supabase.from("custom_datasets").upsert(DATASET, { onConflict: "id" });
    if (dsErr) throw new Error(dsErr.message);

    const values = rows.map((row) => ({
        dataset_id: DATASET.id,
        psgc: row.psgc.padStart(10, "0"),
        value: null,
        category: row.winner,
        detail: row.detail,
    }));

    console.log(`Upserting ${values.length} province values…`);
    for (const batch of chunks(values, 200)) {
        const { error } = await supabase
            .from("custom_dataset_values")
            .upsert(batch, { onConflict: "dataset_id,psgc" });
        if (error) throw new Error(error.message);
    }

    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
