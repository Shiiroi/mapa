#!/usr/bin/env tsx
// Map population.csv (2010) and household age/sex raw CSV to PSGC-keyed seed files.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import {
    type PlaceRow,
    loadPsgcIndexes,
    matchPlace,
} from "./lib/afrMatch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public");
const POP_CSV = path.join(PUBLIC_DIR, "population.csv");
const HOUSEHOLD_RAW = path.join(PUBLIC_DIR, "household_agesex_2020_raw.csv");
const OUT_POP_2010 = path.join(PUBLIC_DIR, "pop_2010.csv");
const OUT_AGESEX = path.join(PUBLIC_DIR, "household_agesex_2020.csv");
const UNMATCHED_POP = path.join(PUBLIC_DIR, "pop_2010_unmatched.json");
const UNMATCHED_AGESEX = path.join(PUBLIC_DIR, "household_agesex_2020_unmatched.json");

interface Pop2010Row extends PlaceRow {
    pop_2010: number;
}

interface AgeSexBand {
    age: string;
    both: number;
    male: number;
    female: number;
}

interface HouseholdPlace extends PlaceRow {
    pop_male_2020: number;
    pop_female_2020: number;
    age_sex_2020: AgeSexBand[];
}

// Strips footnote markers and fixes mojibake in census place names.
function cleanCensusName(name: string): string {
    return name
        .replace(/\s+\d+$/, "")
        .replace(/\s*\*+\s*$/, "")
        .replace(/\uFFFD/g, "Ñ")
        .trim();
}

// Parses a 2010 census population cell (strips commas and footnote letters).
function parsePop2010(raw: string | undefined): number | null {
    if (!raw) return null;
    const cleaned = raw.replace(/,/g, "").replace(/[a-d]/gi, "").trim();
    if (!/^\d+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

// Infers a census row's admin level from its place name (Pateros is the lone municipality).
function inferPopLevel(name: string): PlaceRow["level"] {
    const upper = cleanCensusName(name).toUpperCase();
    if (upper === "PHILIPPINES") return "country";
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
    if (
        upper.startsWith("CITY OF ") ||
        upper.endsWith(" CITY") ||
        upper === "QUEZON CITY"
    ) {
        return "city";
    }
    if (upper === "PATEROS") return "municipality";
    return "province";
}

function regionLabelForMatch(regionContext: string, level: string): string {
    if (level === "country") return "";
    return regionContext;
}

// Parses the 2010 population CSV into flat rows, tracking the current region context.
function loadPopulation2010(): Pop2010Row[] {
    const raw = fs.readFileSync(POP_CSV, "utf8");
    const rows = parse(raw, { relax_column_count: true }) as string[][];
    const out: Pop2010Row[] = [];
    let started = false;
    let currentRegion = "";

    for (const row of rows) {
        const nameRaw = (row[0] ?? "").trim();
        if (!nameRaw) continue;
        if (nameRaw === "PHILIPPINES") started = true;
        if (!started) continue;
        if (
            nameRaw.startsWith("Notes:") ||
            nameRaw.startsWith("Sources:") ||
            nameRaw.startsWith("*") ||
            /^[a-d],/i.test(nameRaw)
        ) {
            continue;
        }

        const pop = parsePop2010(row[2]);
        if (pop == null) continue;

        const name = cleanCensusName(nameRaw);
        const level = inferPopLevel(name);
        if (level === "region") currentRegion = name;

        out.push({
            level,
            region: regionLabelForMatch(currentRegion, level),
            province: "",
            name,
            pop_2010: pop,
        });
    }
    return out;
}

function placeKey(row: PlaceRow): string {
    return [row.level, row.region, row.province, row.name].join("|");
}

// Groups raw household age/sex rows by place, accumulating per-age bands and totals.
function loadHouseholdRaw(): Map<string, HouseholdPlace> {
    const raw = fs.readFileSync(HOUSEHOLD_RAW, "utf8");
    const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const byPlace = new Map<string, HouseholdPlace>();

    for (const row of rows) {
        const place: PlaceRow = {
            level: row.level,
            region: row.region ?? "",
            province: row.province ?? "",
            name: row.name,
        };
        const key = placeKey(place);
        if (!byPlace.has(key)) {
            byPlace.set(key, {
                ...place,
                pop_male_2020: 0,
                pop_female_2020: 0,
                age_sex_2020: [],
            });
        }
        const entry = byPlace.get(key)!;
        const age = row.age_group;
        const both = Number(row.both_sexes);
        const male = Number(row.male);
        const female = Number(row.female);
        if (age === "Total") {
            if (entry.pop_male_2020 === 0 && entry.pop_female_2020 === 0) {
                entry.pop_male_2020 = male;
                entry.pop_female_2020 = female;
            }
        } else if (!entry.age_sex_2020.some((b) => b.age === age)) {
            entry.age_sex_2020.push({ age, both, male, female });
        }
    }
    return byPlace;
}

// Tallies matched/unmatched counts per admin level for reporting.
function countByLevel<T extends { level: string }>(rows: T[], matched: boolean[], getLevel?: (r: T) => string) {
    const counts = new Map<string, { ok: number; fail: number }>();
    rows.forEach((row, i) => {
        const lvl = getLevel ? getLevel(row) : row.level;
        if (!counts.has(lvl)) counts.set(lvl, { ok: 0, fail: 0 });
        const c = counts.get(lvl)!;
        if (matched[i]) c.ok++;
        else c.fail++;
    });
    return counts;
}

// Matches both 2010 population and 2020 household age/sex rows to PSGC and writes seed CSVs.
function main() {
    if (!fs.existsSync(POP_CSV)) {
        console.error(`Missing ${POP_CSV}`);
        process.exit(1);
    }
    if (!fs.existsSync(HOUSEHOLD_RAW)) {
        console.error(`Missing ${HOUSEHOLD_RAW}. Run: pnpm extract:agesex`);
        process.exit(1);
    }

    const indexes = loadPsgcIndexes(PUBLIC_DIR);

    // --- 2010 population ---
    const popRows = loadPopulation2010();
    const popMatched: { psgc: string; level: string; pop_2010: number }[] = [];
    const popUnmatched: (Pop2010Row & { reason: string })[] = [];
    const popMatchedFlags: boolean[] = [];
    const seenPopPsgc = new Set<string>();

    for (const row of popRows) {
        const psgc = matchPlace(row, indexes);
        if (!psgc) {
            popUnmatched.push({ ...row, reason: "no PSGC match" });
            popMatchedFlags.push(false);
            continue;
        }
        if (seenPopPsgc.has(psgc)) {
            popUnmatched.push({ ...row, reason: `duplicate PSGC ${psgc}` });
            popMatchedFlags.push(false);
            continue;
        }
        seenPopPsgc.add(psgc);
        popMatched.push({ psgc, level: row.level, pop_2010: row.pop_2010 });
        popMatchedFlags.push(true);
    }

    fs.writeFileSync(OUT_POP_2010, stringify(popMatched, { header: true, columns: ["psgc", "level", "pop_2010"] }));
    fs.writeFileSync(UNMATCHED_POP, JSON.stringify(popUnmatched, null, 2));

    console.log(`pop_2010: matched ${popMatched.length}/${popRows.length}`);
    for (const [lvl, c] of countByLevel(popRows, popMatchedFlags)) {
        const total = c.ok + c.fail;
        console.log(`  ${lvl}: ${c.ok}/${total} (${total ? ((c.ok / total) * 100).toFixed(1) : "—"}%)`);
    }

    const ph = popMatched.find((r) => r.psgc === "0000000000");
    const ncr = popMatched.find((r) => r.psgc === "1300000000");
    if (ph) console.log(`  spot-check Philippines 2010: ${ph.pop_2010.toLocaleString()}`);
    if (ncr) console.log(`  spot-check NCR 2010: ${ncr.pop_2010.toLocaleString()}`);

    // --- household age/sex ---
    const householdPlaces = [...loadHouseholdRaw().values()];
    const agesexMatched: {
        psgc: string;
        level: string;
        pop_male_2020: number;
        pop_female_2020: number;
        age_sex_2020: string;
    }[] = [];
    const agesexUnmatched: (HouseholdPlace & { reason: string })[] = [];
    const agesexMatchedFlags: boolean[] = [];
    const seenAgePsgc = new Set<string>();

    for (const row of householdPlaces) {
        const psgc = matchPlace(row, indexes);
        if (!psgc) {
            agesexUnmatched.push({ ...row, reason: "no PSGC match" });
            agesexMatchedFlags.push(false);
            continue;
        }
        if (seenAgePsgc.has(psgc)) {
            agesexUnmatched.push({ ...row, reason: `duplicate PSGC ${psgc}` });
            agesexMatchedFlags.push(false);
            continue;
        }
        seenAgePsgc.add(psgc);
        agesexMatched.push({
            psgc,
            level: row.level,
            pop_male_2020: row.pop_male_2020,
            pop_female_2020: row.pop_female_2020,
            age_sex_2020: JSON.stringify(row.age_sex_2020),
        });
        agesexMatchedFlags.push(true);
    }

    fs.writeFileSync(
        OUT_AGESEX,
        stringify(agesexMatched, {
            header: true,
            columns: ["psgc", "level", "pop_male_2020", "pop_female_2020", "age_sex_2020"],
        }),
    );
    fs.writeFileSync(UNMATCHED_AGESEX, JSON.stringify(agesexUnmatched, null, 2));

    console.log(`household_agesex_2020: matched ${agesexMatched.length}/${householdPlaces.length}`);
    for (const [lvl, c] of countByLevel(householdPlaces, agesexMatchedFlags)) {
        const total = c.ok + c.fail;
        console.log(`  ${lvl}: ${c.ok}/${total} (${total ? ((c.ok / total) * 100).toFixed(1) : "—"}%)`);
    }

    const ncrAge = agesexMatched.find((r) => r.psgc === "1300000000");
    const phAge = agesexMatched.find((r) => r.psgc === "0000000000");
    if (ncrAge) {
        const total = ncrAge.pop_male_2020 + ncrAge.pop_female_2020;
        console.log(`  spot-check NCR 2020 household: ${total.toLocaleString()} (male ${ncrAge.pop_male_2020.toLocaleString()})`);
    }
    if (phAge) {
        console.log(`  spot-check Philippines 2020 male: ${phAge.pop_male_2020.toLocaleString()}`);
    }

    if (popUnmatched.length > 0) {
        console.log("Sample pop_2010 unmatched:");
        for (const u of popUnmatched.slice(0, 5)) {
            console.log(`  [${u.level}] ${u.region} / ${u.name}`);
        }
    }
    if (agesexUnmatched.length > 0) {
        console.log("Sample household unmatched:");
        for (const u of agesexUnmatched.slice(0, 5)) {
            console.log(`  [${u.level}] ${u.region} / ${u.province} / ${u.name}`);
        }
    }
}

main();
