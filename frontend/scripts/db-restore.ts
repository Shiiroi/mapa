// Restore Postgres tables from data-sets/backup/<table>.csv (row-for-row upsert, FK-safe order).

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { DB_TABLES } from "./lib/dbTables.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "../data-sets/backup");
const CHUNK_SIZE = 500;

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

function parseCell(raw: string | undefined, isJson: boolean): unknown {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return null;
    if (isJson) {
        try {
            return JSON.parse(trimmed);
        } catch {
            throw new Error(`Invalid JSON in cell: ${trimmed.slice(0, 80)}…`);
        }
    }
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
    if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed;
}

function csvRowToRecord(row: Record<string, string>, jsonColumns: readonly string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
        out[key] = parseCell(value, jsonColumns.includes(key));
    }
    return out;
}

async function restoreTable(table: string, conflict: string, jsonColumns: readonly string[]): Promise<number> {
    const csvPath = path.join(BACKUP_DIR, `${table}.csv`);
    if (!fs.existsSync(csvPath)) {
        console.warn(`  ${table}: missing ${path.basename(csvPath)} — skipped`);
        return 0;
    }

    const records = parse(fs.readFileSync(csvPath, "utf8"), {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
        console.log(`  ${table}: 0 rows`);
        return 0;
    }

    const rows = records.map((rec) => csvRowToRecord(rec, jsonColumns));
    let total = 0;
    for (const batch of chunks(rows, CHUNK_SIZE)) {
        const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict });
        if (error) throw new Error(`${table}: ${error.message}`);
        total += batch.length;
    }

    console.log(`  ${table}: ${total} rows restored`);
    return total;
}

async function main() {
    console.log(`Restoring from ${BACKUP_DIR}…`);

    let total = 0;
    for (const { table, conflict, jsonColumns } of DB_TABLES) {
        total += await restoreTable(table, conflict, jsonColumns);
    }

    console.log(`Done. Restored ${total} rows across ${DB_TABLES.length} tables.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
