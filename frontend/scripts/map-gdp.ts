#!/usr/bin/env tsx
// Maps PSA GDP-by-province/HUC CSV rows to PSGC codes (current prices, thousand pesos → pesos).

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import {
    type PlaceRow,
    type PsgcIndexes,
    loadPsgcIndexes,
    matchPlace,
    normalizeAfrName,
    normalizePsgcName,
} from "./lib/afrMatch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public");
const GDP_CSV = path.join(PUBLIC_DIR, "gdp.csv");
const OUT_CSV = path.join(PUBLIC_DIR, "gdp_mapped.csv");
const UNMATCHED_JSON = path.join(PUBLIC_DIR, "gdp_unmatched.json");

interface GdpRawRow extends PlaceRow {
    gdp_2022: number;
    gdp_2023: number;
    gdp_2024: number;
}

interface GdpMappedRow {
    psgc: string;
    level: string;
    gdp_2022: number;
    gdp_2023: number;
    gdp_2024: number;
}

// Strips footnote markers and fixes common mojibake in PSA place names.
function cleanGdpName(name: string): string {
    return name
        .replace(/^\.\./, "")
        .replace(/\s+\d+$/, "")
        .replace(/\s*\*+\s*$/, "")
        .replace(/\uFFFD/g, "Ñ")
        .trim();
}

// Parses a thousand-peso GDP cell into actual pesos.
function parseGdpThousand(raw: string | undefined): number | null {
    if (!raw) return null;
    const cleaned = raw.replace(/,/g, "").trim();
    if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

function inferGdpLevel(name: string): PlaceRow["level"] {
    const upper = cleanGdpName(name).toUpperCase();
    if (
        upper.includes("REGION") ||
        upper.startsWith("NATIONAL CAPITAL") ||
        upper.startsWith("CORDILLERA") ||
        upper.startsWith("BANGSAMORO") ||
        upper === "MIMAROPA REGION" ||
        upper === "MIMAROPA"
    ) {
        return "region";
    }
    if (upper.startsWith("CITY OF ") || upper.endsWith(" CITY") || upper === "QUEZON CITY") {
        return "city";
    }
    return "province";
}

// Tries scoped PSGC match first, then global province/city lookup for NIR rows.
function matchGdpRow(row: PlaceRow, indexes: PsgcIndexes): string | null {
    const direct = matchPlace(row, indexes);
    if (direct) return direct;

    const regionUpper = row.region.toUpperCase();
    if (!regionUpper.includes("NEGROS ISLAND")) return null;

    const normName = normalizeAfrName(row.name);
    if (row.level === "province") {
        const provNorm = normalizePsgcName(row.name);
        return indexes.provinceNameToPsgc.get(provNorm) ?? indexes.provinceNameToPsgc.get(normName) ?? null;
    }
    if (row.level === "city") {
        const candidates = [
            normName,
            normalizePsgcName(`City of ${row.name}`),
            normalizePsgcName(`${row.name} City`),
            normalizePsgcName(row.name),
        ];
        for (const c of candidates) {
            const hit = indexes.citiesGlobal.get(c);
            if (hit) return hit;
        }
    }
    return null;
}

function loadGdpRows(): GdpRawRow[] {
    const raw = fs.readFileSync(GDP_CSV, "utf8");
    const rows = parse(raw, { relax_column_count: true }) as string[][];
    const out: GdpRawRow[] = [];
    let currentRegion = "";
    let inData = false;

    for (const row of rows) {
        const nameRaw = (row[0] ?? "").trim();
        if (!nameRaw) continue;
        if (nameRaw === "At Current Prices" || nameRaw.startsWith("Gross Domestic Product")) continue;
        if (nameRaw === ",2022" || nameRaw === "2022") continue;

        const gdp2022 = parseGdpThousand(row[1]);
        const gdp2023 = parseGdpThousand(row[2]);
        const gdp2024 = parseGdpThousand(row[3]);
        if (gdp2022 == null && gdp2023 == null && gdp2024 == null) continue;
        if (nameRaw.startsWith("Figures for") || nameRaw.startsWith("Latest update") || nameRaw.startsWith("Source")) {
            break;
        }

        const isChild = nameRaw.startsWith("..");
        const name = cleanGdpName(nameRaw);
        const level = isChild ? inferGdpLevel(name) : "region";
        if (!isChild) {
            currentRegion = name;
            inData = true;
        }
        if (!inData) continue;

        out.push({
            level,
            region: currentRegion,
            province: "",
            name,
            gdp_2022: gdp2022 ?? 0,
            gdp_2023: gdp2023 ?? 0,
            gdp_2024: gdp2024 ?? 0,
        });
    }
    return out;
}

function main() {
    if (!fs.existsSync(GDP_CSV)) {
        console.error(`Missing ${GDP_CSV}`);
        process.exit(1);
    }

    const indexes = loadPsgcIndexes(PUBLIC_DIR);
    const rawRows = loadGdpRows();
    const matched: GdpMappedRow[] = [];
    const unmatched: (GdpRawRow & { reason: string })[] = [];
    const seenPsgc = new Set<string>();
    const byLevel = { region: { ok: 0, fail: 0 }, province: { ok: 0, fail: 0 }, city: { ok: 0, fail: 0 } };

    for (const row of rawRows) {
        const psgc = matchGdpRow(row, indexes);
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
        matched.push({
            psgc,
            level: row.level,
            gdp_2022: row.gdp_2022,
            gdp_2023: row.gdp_2023,
            gdp_2024: row.gdp_2024,
        });
    }

    const regionGdp = matched.filter((r) => r.level === "region");
    const countryGdp: GdpMappedRow = {
        psgc: "0000000000",
        level: "country",
        gdp_2022: regionGdp.reduce((s, r) => s + r.gdp_2022, 0),
        gdp_2023: regionGdp.reduce((s, r) => s + r.gdp_2023, 0),
        gdp_2024: regionGdp.reduce((s, r) => s + r.gdp_2024, 0),
    };
    if (!seenPsgc.has(countryGdp.psgc)) {
        matched.push(countryGdp);
        seenPsgc.add(countryGdp.psgc);
    }

    fs.writeFileSync(
        OUT_CSV,
        stringify(matched, {
            header: true,
            columns: ["psgc", "level", "gdp_2022", "gdp_2023", "gdp_2024"],
        }),
    );
    fs.writeFileSync(UNMATCHED_JSON, JSON.stringify(unmatched, null, 2));

    console.log(`gdp_mapped: ${matched.length} rows (${regionGdp.length} regions + country)`);
    console.log(`Unmatched: ${unmatched.length} -> ${path.basename(UNMATCHED_JSON)}`);
    for (const [lvl, counts] of Object.entries(byLevel)) {
        const total = counts.ok + counts.fail;
        const pct = total ? ((counts.ok / total) * 100).toFixed(1) : "—";
        console.log(`  ${lvl}: ${counts.ok}/${total} (${pct}%)`);
    }

    const ncr = matched.find((r) => r.psgc === "1300000000");
    if (ncr) {
        console.log(`  spot-check NCR 2024 GDP: ₱${(ncr.gdp_2024 / 1e12).toFixed(2)}T`);
    }

    if (unmatched.length > 0) {
        console.log("Sample unmatched:");
        for (const u of unmatched.slice(0, 5)) {
            console.log(`  [${u.level}] ${u.region} / ${u.name}`);
        }
    }
}

main();
