// Seeds custom_datasets osm-hospitals (numeric count per province).

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../public/osm_hospitals_by_province.csv");

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const DATASET = {
    id: "osm-hospitals",
    title: "Hospitals by province",
    description: "Count of OpenStreetMap features tagged amenity=hospital within each province boundary.",
    category: "Places",
    kind: "numeric" as const,
    level: "province",
    unit: "hospitals",
    value_label: "Hospitals",
    source_name: "OpenStreetMap contributors (ODbL)",
    source_url: "https://www.openstreetmap.org/copyright",
};

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// Seeds the osm-hospitals numeric dataset and its per-province counts from the CSV.
async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`Missing ${CSV_PATH}. Run: pnpm extract:osm`);
        process.exit(1);
    }

    const rows = parse(fs.readFileSync(CSV_PATH, "utf8"), {
        columns: true,
        skip_empty_lines: true,
    }) as Record<string, string>[];

    console.log(`Upserting dataset ${DATASET.id}…`);
    const { error: dsErr } = await supabase.from("custom_datasets").upsert(DATASET, { onConflict: "id" });
    if (dsErr) throw new Error(dsErr.message);

    const values = rows.map((row) => ({
        dataset_id: DATASET.id,
        psgc: row.psgc.padStart(10, "0"),
        value: Number(row.hospital_count),
        category: null,
        detail: null,
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
