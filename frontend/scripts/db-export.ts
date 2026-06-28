// Export all Mapa Postgres tables to public/backup/<table>.csv for fast db:restore.

import { createClient } from "@supabase/supabase-js";
import { stringify } from "csv-stringify/sync";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { DB_TABLES } from "./lib/dbTables.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "../public/backup");
const PAGE_SIZE = 1000;

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function serializeRow(row: Record<string, unknown>, jsonColumns: readonly string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
        if (value == null) {
            out[key] = "";
        } else if (jsonColumns.includes(key)) {
            out[key] = JSON.stringify(value);
        } else {
            out[key] = String(value);
        }
    }
    return out;
}

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        if (!data?.length) break;
        all.push(...(data as Record<string, unknown>[]));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }
    return all;
}

async function exportTable(table: string, jsonColumns: readonly string[]): Promise<number> {
    const rows = await fetchAllRows(table);
    if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (skipped empty file)`);
        return 0;
    }

    const serialized = rows.map((row) => serializeRow(row, jsonColumns));
    const columns = Object.keys(serialized[0]);
    const csv = stringify(serialized, { header: true, columns });
    const outPath = path.join(BACKUP_DIR, `${table}.csv`);
    fs.writeFileSync(outPath, csv);
    console.log(`  ${table}: ${rows.length} rows -> ${path.basename(outPath)}`);
    return rows.length;
}

async function main() {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Exporting to ${BACKUP_DIR}…`);

    let total = 0;
    for (const { table, jsonColumns } of DB_TABLES) {
        total += await exportTable(table, jsonColumns);
    }

    console.log(`Done. Exported ${total} rows across ${DB_TABLES.length} tables.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
