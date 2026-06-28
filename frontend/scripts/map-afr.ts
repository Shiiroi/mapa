#!/usr/bin/env tsx
// Map raw COA AFR CSV rows to PSGC codes; compute region/country asset totals.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import {
    type AfrMappedRow,
    type AfrRawRow,
    loadPsgcIndexes,
    matchAfrRow,
    regionPsgcFromLguPsgc,
} from "./lib/afrMatch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public");
const RAW_CSV = path.join(PUBLIC_DIR, "lgu_finance_2024_raw.csv");
const OUT_CSV = path.join(PUBLIC_DIR, "lgu_finance_2024.csv");
const UNMATCHED_JSON = path.join(PUBLIC_DIR, "lgu_finance_2024_unmatched.json");

const FIN_COLS = [
    "assets",
    "liabilities",
    "equity",
    "revenue",
    "expenses",
    "net_assistance_subsidy",
    "surplus_deficit",
    "cash_begin",
    "net_cash",
    "cash_end",
] as const;

const OUT_COLS = ["psgc", "level", "name", "region", "province", ...FIN_COLS];

function parseNum(raw: string | undefined): number | null {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

// Parses the raw COA AFR CSV into typed rows with numeric financial fields.
function loadRawRows(): AfrRawRow[] {
    const raw = fs.readFileSync(RAW_CSV, "utf8");
    const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    return rows.map((r) => ({
        level: r.level,
        region: r.region,
        province: r.province ?? "",
        name: r.name,
        assets: parseNum(r.assets),
        liabilities: parseNum(r.liabilities),
        equity: parseNum(r.equity),
        revenue: parseNum(r.revenue),
        expenses: parseNum(r.expenses),
        net_assistance_subsidy: parseNum(r.net_assistance_subsidy),
        surplus_deficit: parseNum(r.surplus_deficit),
        cash_begin: parseNum(r.cash_begin),
        net_cash: parseNum(r.net_cash),
        cash_end: parseNum(r.cash_end),
    }));
}

// Matches AFR rows to PSGC, derives region/country asset totals, and writes outputs.
function main() {
    if (!fs.existsSync(RAW_CSV)) {
        console.error(`Missing ${RAW_CSV}. Run: pnpm extract:afr`);
        process.exit(1);
    }

    const indexes = loadPsgcIndexes(PUBLIC_DIR);
    const rawRows = loadRawRows();
    const matched: AfrMappedRow[] = [];
    const unmatched: (AfrRawRow & { reason?: string })[] = [];
    const seenPsgc = new Set<string>();

    const byLevel = { province: { ok: 0, fail: 0 }, city: { ok: 0, fail: 0 }, municipality: { ok: 0, fail: 0 } };

    for (const row of rawRows) {
        const psgc = matchAfrRow(row, indexes);
        const lvl = row.level as keyof typeof byLevel;
        if (!psgc) {
            if (lvl in byLevel) byLevel[lvl].fail++;
            unmatched.push({ ...row, reason: "no PSGC match" });
            continue;
        }
        if (seenPsgc.has(psgc)) {
            unmatched.push({ ...row, reason: `duplicate PSGC ${psgc}` });
            continue;
        }
        seenPsgc.add(psgc);
        if (lvl in byLevel) byLevel[lvl].ok++;
        matched.push({ ...row, psgc });
    }

    const regionAssets = new Map<string, number>();
    for (const row of matched) {
        if (!["province", "city", "municipality"].includes(row.level)) continue;
        const regionPsgc = regionPsgcFromLguPsgc(row.psgc);
        if (row.assets == null) continue;
        regionAssets.set(regionPsgc, (regionAssets.get(regionPsgc) ?? 0) + row.assets);
    }

    for (const [psgc, assets] of regionAssets) {
        if (seenPsgc.has(psgc)) continue;
        seenPsgc.add(psgc);
        matched.push({
            psgc,
            level: "region",
            name: "",
            region: "",
            province: "",
            assets,
            liabilities: null,
            equity: null,
            revenue: null,
            expenses: null,
            net_assistance_subsidy: null,
            surplus_deficit: null,
            cash_begin: null,
            net_cash: null,
            cash_end: null,
        });
    }

    const countryAssets = [...regionAssets.values()].reduce((a, b) => a + b, 0);
    matched.push({
        psgc: "0000000000",
        level: "country",
        name: "Philippines",
        region: "",
        province: "",
        assets: countryAssets,
        liabilities: null,
        equity: null,
        revenue: null,
        expenses: null,
        net_assistance_subsidy: null,
        surplus_deficit: null,
        cash_begin: null,
        net_cash: null,
        cash_end: null,
    });

    const csvRows = matched.map((r) => {
        const out: Record<string, string | number | null> = {
            psgc: r.psgc,
            level: r.level,
            name: r.name,
            region: r.region,
            province: r.province,
        };
        for (const c of FIN_COLS) out[c] = r[c];
        return out;
    });

    fs.writeFileSync(OUT_CSV, stringify(csvRows, { header: true, columns: OUT_COLS }));
    fs.writeFileSync(UNMATCHED_JSON, JSON.stringify(unmatched, null, 2));

    console.log(`Matched ${matched.length - regionAssets.size - 1} LGUs + ${regionAssets.size} regions + country`);
    console.log(`Unmatched: ${unmatched.length} -> ${path.basename(UNMATCHED_JSON)}`);
    for (const [lvl, counts] of Object.entries(byLevel)) {
        const total = counts.ok + counts.fail;
        const pct = total ? ((counts.ok / total) * 100).toFixed(1) : "—";
        console.log(`  ${lvl}: ${counts.ok}/${total} (${pct}%)`);
    }
    if (unmatched.length > 0) {
        console.log("Sample unmatched:");
        for (const u of unmatched.slice(0, 8)) {
            console.log(`  [${u.level}] ${u.region} / ${u.province} / ${u.name}`);
        }
    }
}

main();
