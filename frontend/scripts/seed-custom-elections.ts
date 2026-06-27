// Seeds the built-in "2022 President" dataset from the official COMELEC-derived
// CSV (scripts/map-comelec-president.ts output).
//
// Uses the all-tiers file (region + province + city/municipality + barangay)
// so the built-in overlay behaves like uploading elections_2022_president_all.csv.
// Re-run after map:comelec to pick up newly scraped barangays (upsert, no reset).

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../public/elections_2022_president_all.csv");

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

interface SeriesDef {
    key: string;
    label: string;
    color?: string;
}

function seriesKeyFromLabel(label: string): string {
    return label.trim().replace(/\s+/g, "_");
}

/** Split a COMELEC CSV into # directive lines and data lines. */
function splitCsv(text: string): { directives: string[]; dataLines: string[] } {
    const directives: string[] = [];
    const dataLines: string[] = [];
    for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("#")) directives.push(line);
        else dataLines.push(line);
    }
    return { directives, dataLines };
}

/** Parse "# colors: Name=#hex; …" into a label -> hex map. */
function parseColors(directives: string[]): Record<string, string> {
    const line = directives.find((d) => /^#\s*colors\s*:/i.test(d));
    if (!line) return {};
    const value = line.replace(/^#\s*colors\s*:/i, "").trim();
    const colors: Record<string, string> = {};
    for (const part of value.split(/[;,]/)) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        const name = part.slice(0, eq).trim();
        const hex = part.slice(eq + 1).trim();
        if (name && /^#[0-9a-fA-F]{3,8}$/.test(hex)) colors[name] = hex;
    }
    return colors;
}

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`Missing ${CSV_PATH}. Run: npm run map:comelec`);
        process.exit(1);
    }

    const { directives, dataLines } = splitCsv(fs.readFileSync(CSV_PATH, "utf8"));
    if (dataLines.length < 2) {
        console.error("No data rows found in all-tiers CSV.");
        process.exit(1);
    }

    const colorByLabel = parseColors(directives);
    const records = parse(dataLines.join("\n"), {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
    }) as Record<string, string>[];

    const header = dataLines[0].split(",").map((h) => h.trim());
    const candidateLabels = header.filter((h) => h.toLowerCase() !== "psgc" && h.toLowerCase() !== "label");

    // Order series by national total (desc) so the legend leads with the winner.
    const totals = new Map<string, number>();
    for (const rec of records) {
        for (const label of candidateLabels) {
            totals.set(label, (totals.get(label) ?? 0) + (Number(rec[label]) || 0));
        }
    }
    const series: SeriesDef[] = [...candidateLabels]
        .sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
        .map((label) => ({ key: seriesKeyFromLabel(label), label, color: colorByLabel[label] }));

    const DATASET = {
        id: "elections-2022-president",
        title: "2022 presidential results",
        description:
            "Presidential vote totals by region, province, city/municipality, and barangay from official COMELEC 2022 transparency results. Metro Manila and the Negros Island Region are derived from their cities/municipalities. Barangay coverage grows as more areas are scraped.",
        category: "Elections",
        kind: "series" as const,
        level: "region",
        unit: "votes",
        value_label: null,
        source_name: "COMELEC 2022 transparency results",
        source_url: "https://2022electionresults.comelec.gov.ph/",
        series,
    };

    console.log(`Upserting dataset ${DATASET.id} with ${series.length} series…`);
    const { error: dsErr } = await supabase.from("custom_datasets").upsert(DATASET, { onConflict: "id" });
    if (dsErr) throw new Error(dsErr.message);

    const values = records.map((rec) => {
        const detail: Record<string, number> = {};
        let winner = "";
        let winnerVotes = -1;
        for (const label of candidateLabels) {
            const votes = Number(rec[label]) || 0;
            detail[seriesKeyFromLabel(label)] = votes;
            if (votes > winnerVotes) {
                winnerVotes = votes;
                winner = label;
            }
        }
        return {
            dataset_id: DATASET.id,
            psgc: (rec.psgc ?? "").replace(/\D/g, "").padStart(10, "0"),
            value: null,
            category: winner,
            detail,
        };
    });

    // NCR (1300000000) may appear as both region and province in the all CSV; keep one row per PSGC.
    const deduped = [...new Map(values.map((row) => [row.psgc, row])).values()];

    console.log(`Upserting ${deduped.length} values…`);
    for (const batch of chunks(deduped, 200)) {
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
