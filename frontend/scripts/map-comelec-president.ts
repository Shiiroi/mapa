#!/usr/bin/env tsx
// Parse a local COMELEC 2022 scrape (scripts/py/scrape_comelec.py output) into a
// single multi-level, multi-series CSV that the custom-overlay uploader (and
// seed-custom-elections.ts) understand:
//
//   data-sets/data/clean/elections_2022_president_all.csv
//       region + province + city/municipality + barangay rows in one file.
//
// The COMELEC JSON field names are not publicly documented, so this script
// auto-detects them:
//   * the presidential contest is the one whose candidate set contains both
//     "MARCOS" and "ROBREDO";
//   * the vote field inside each result row is auto-detected.
// Run `tsx scripts/map-comelec-president.ts --inspect` first to dump the raw
// shapes and confirm the auto-detection picked the right fields.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse as parseCsv } from "csv-parse/sync";
import {
    loadPsgcIndexes,
    matchPlace,
    normalizePsgcName,
    type PsgcIndexes,
} from "./lib/afrMatch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASETS_DIR = path.join(__dirname, "../data-sets");
const CLEAN_DIR = path.join(DATASETS_DIR, "data/clean");
const DATA_DIR = path.join(__dirname, "py", "data");
const RESULTS_DIR = path.join(DATA_DIR, "results");
const CONTESTS_DIR = path.join(DATA_DIR, "contests");

const INSPECT = process.argv.includes("--inspect");

// Candidate display names + party colors for the 2022 presidential race.
// Keyed by an uppercased substring of the COMELEC ballot name.
const CANDIDATE_META: { match: string; display: string; color: string }[] = [
    { match: "MARCOS", display: "Bongbong Marcos", color: "#bb1e1e" },
    { match: "ROBREDO", display: "Leni Robredo", color: "#ec1c8f" },
    { match: "MORENO", display: "Isko Moreno", color: "#1f78b4" },
    { match: "PACQUIAO", display: "Manny Pacquiao", color: "#33a02c" },
    { match: "LACSON", display: "Ping Lacson", color: "#6a3d9a" },
    { match: "DE GUZMAN", display: "Leody de Guzman", color: "#ff7f00" },
    { match: "GONZALES", display: "Norberto Gonzales", color: "#8c510a" },
    { match: "ABELLA", display: "Ernesto Abella", color: "#7f7f7f" },
    { match: "MANGONDATO", display: "Faisal Mangondato", color: "#999999" },
    { match: "MONTEMAYOR", display: "Jose Montemayor", color: "#b15928" },
];

interface NodeInfo {
    can?: string; // category / level: Country|Region|Province|Municipality|City|Barangay
    rn?: string; // region/name of this node
    srs?: Record<string, { rn: string; url: string }>;
    pps?: { ppcc?: string; vbs?: { url: string }[] }[];
    [k: string]: unknown;
}

interface SeriesRow {
    psgc: string;
    label: string;
    votes: Record<string, number>; // displayName -> votes
}

// ---------- helpers ----------

// Reads and parses a JSON file, returning null on missing/invalid files.
function readJson<T>(p: string): T | null {
    try {
        return JSON.parse(fs.readFileSync(p, "utf8")) as T;
    } catch {
        return null;
    }
}

// Maps a COMELEC ballot name to a known candidate display name, or null.
function displayForBallotName(ballot: string): string | null {
    const up = ballot.toUpperCase();
    for (const c of CANDIDATE_META) {
        if (up.includes(c.match)) return c.display;
    }
    return null;
}

/** Find the array of candidate dicts inside a contest file and return bo->name. */
function candidatesFromContest(contest: Record<string, unknown>): Map<number, string> | null {
    const out = new Map<number, string>();
    const lists = Object.values(contest).filter(
        (v): v is Record<string, unknown>[] =>
            Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null,
    );
    for (const list of lists) {
        const sample = list[0];
        const orderKey = ["boc", "bo", "ord", "bos"].find((k) => typeof sample[k] === "number");
        const nameKey = ["bon", "name", "cn", "can", "fn"].find((k) => typeof sample[k] === "string");
        if (!orderKey || !nameKey) continue;
        for (const item of list) {
            const bo = item[orderKey] as number;
            const name = item[nameKey] as string;
            if (typeof bo === "number" && typeof name === "string") out.set(bo, name);
        }
        if (out.size) return out;
    }
    return null;
}

/** Detect the per-row vote integer field name from a result file. */
function detectVoteKey(rs: Record<string, unknown>[]): string | null {
    if (!rs.length) return null;
    const sample = rs[0];
    const skip = new Set(["cc", "bo", "boc", "con", "per", "perc", "percentage"]);
    const prefer = ["v", "votes", "vote", "vot", "count", "nvotes"];
    for (const k of prefer) if (typeof sample[k] === "number") return k;
    for (const [k, v] of Object.entries(sample)) {
        if (skip.has(k.toLowerCase())) continue;
        if (typeof v === "number") return k;
    }
    return null;
}

interface PresidentContest {
    cc: number;
    boToDisplay: Map<number, string>;
}

/** Identify the presidential contest by the Marcos+Robredo candidate set. */
function findPresidentContest(): PresidentContest | null {
    if (!fs.existsSync(CONTESTS_DIR)) return null;
    const files = fs.readdirSync(CONTESTS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
        const contest = readJson<Record<string, unknown>>(path.join(CONTESTS_DIR, file));
        if (!contest) continue;
        const cands = candidatesFromContest(contest);
        if (!cands) continue;
        const names = [...cands.values()].map((n) => n.toUpperCase());
        const hasMarcos = names.some((n) => n.includes("MARCOS"));
        const hasRobredo = names.some((n) => n.includes("ROBREDO"));
        if (hasMarcos && hasRobredo) {
            const boToDisplay = new Map<number, string>();
            for (const [bo, name] of cands) {
                const disp = displayForBallotName(name) ?? name.split(",")[0].trim();
                boToDisplay.set(bo, disp);
            }
            const cc = Number(path.basename(file, ".json"));
            return { cc, boToDisplay };
        }
    }
    return null;
}

/** Sum presidential votes (display -> votes) from one result file. */
function votesFromResult(
    resultPath: string,
    pres: PresidentContest,
    voteKeyRef: { key: string | null },
): Record<string, number> | null {
    const res = readJson<{ rs?: Record<string, unknown>[] }>(resultPath);
    if (!res?.rs) return null;
    const rows = res.rs.filter((r) => Number(r.cc) === pres.cc);
    if (!rows.length) return null;
    if (!voteKeyRef.key) voteKeyRef.key = detectVoteKey(rows);
    const voteKey = voteKeyRef.key;
    if (!voteKey) return null;

    const out: Record<string, number> = {};
    for (const r of rows) {
        const bo = Number(r.bo);
        const disp = pres.boToDisplay.get(bo);
        if (!disp) continue;
        const v = Number(r[voteKey]) || 0;
        out[disp] = (out[disp] ?? 0) + v;
    }
    return Object.keys(out).length ? out : null;
}

// ---------- barangay PSGC index & tiered matcher from psgc.csv ----------

// City of Manila: its barangays are stored under SubMun district codes
// (1380601000…1380614000), not directly under the city, so they need rolling up.
const MANILA_CITY_PSGC = "1380600000";

interface BarangayRec {
    psgc: string;
    name: string;
    oldNames: string;
}

interface PendingBarangay {
    region: string;
    province: string;
    parentName: string;
    muni: string | null;
    name: string;
    votes: Record<string, number>;
}

const ROMAN_TO_ARABIC: Record<string, string> = {
    I: "1",
    II: "2",
    III: "3",
    IV: "4",
    V: "5",
    VI: "6",
    VII: "7",
    VIII: "8",
    IX: "9",
    X: "10",
    XI: "11",
    XII: "12",
    XIII: "13",
    XIV: "14",
    XV: "15",
    XVI: "16",
    XVII: "17",
    XVIII: "18",
    XIX: "19",
    XX: "20",
};

function stripParens(s: string): string {
    return s.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

function canonicalBgy(s: string): string {
    let x = s
        .replace(/\u00a0/g, " ")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toUpperCase();
    x = x.replace(/\s*\([^)]*\)/g, " ");
    x = x.replace(/\bPOB\.?\b/g, " ");
    x = x.replace(/\bPOBLACION\b/g, " POBLACION ");
    x = x.replace(/\b(BARANGAY|BRGY\.?|BGY\.?)\s*(NO\.?\s*)?/g, "BGY ");
    x = x.replace(/\bSTO\.?\b/g, "SANTO");
    x = x.replace(/\bSTA\.?\b/g, "SANTA");
    x = x.replace(/\bST\.?\b/g, "SAINT");
    x = x.replace(/\b(GEN|HEN)\.?\b/g, "GENERAL");
    x = x.replace(/\bPRES\.?\b/g, "PRESIDENT");
    x = x.replace(/\bDR\.?\b/g, "DOCTOR");
    x = x.replace(/\bMT\.?\b/g, "MOUNT");
    x = x.replace(/\bBLVD\.?\b/g, "BOULEVARD");
    x = x.replace(/\bNSTRA\.?\s*SRA\.?\b/g, "NUESTRA SENORA");
    x = x.replace(/\bSR\.?\b/g, "SR");
    x = x.replace(/\bJR\.?\b/g, "JR");
    x = x.replace(/\bDIST\.?\b/g, "DISTRICT");
    x = x.replace(/\bWESTE\b/g, "WEST");
    x = x.replace(/\bESTE\b/g, "EAST");
    x = x.replace(/&/g, " AND ");
    x = x.replace(/\b0+(\d+)\b/g, "$1");
    x = x.replace(
        /\b(XX|XIX|XVIII|XVII|XVI|XV|XIV|XIII|XII|XI|IX|VIII|VII|VI|IV|V|III|II|I)\b/g,
        (m) => ROMAN_TO_ARABIC[m] ?? m,
    );
    x = x.replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    return x;
}

function compactKey(s: string): string {
    return s.replace(/[^A-Z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

// Explicit barangay overrides for post-2022 legal boundary changes, mergers, and
// verified spelling/renaming gaps. Keyed by `${muniPsgc}|${canonicalBgy(name)}`.
// When `merge: true`, multiple 2022 COMELEC barangays are summed into the target 2024 PSGC.
const BARANGAY_OVERRIDES: Record<string, { psgc: string; label?: string; merge?: boolean }> = {
    // --- 2023 SC ruling: 10 EMBO barangays moved from Makati (1380300000) to Taguig (1381500000) ---
    "1380300000|CEMBO": { psgc: "1381500029", label: "Cembo" },
    "1380300000|COMEMBO": { psgc: "1381500030", label: "Comembo" },
    "1380300000|EAST REMBO": { psgc: "1381500031", label: "East Rembo" },
    "1380300000|PEMBO": { psgc: "1381500032", label: "Pembo" },
    "1380300000|PITOGO": { psgc: "1381500033", label: "Pitogo" },
    "1380300000|POST PROPER NORTHSIDE": { psgc: "1381500034", label: "Post Proper Northside" },
    "1380300000|POST PROPER SOUTHSIDE": { psgc: "1381500035", label: "Post Proper Southside" },
    "1380300000|RIZAL": { psgc: "1381500036", label: "Rizal" },
    "1380300000|SOUTH CEMBO": { psgc: "1381500037", label: "South Cembo" },
    "1380300000|WEST REMBO": { psgc: "1381500038", label: "West Rembo" },

    // --- City of Bacoor (0402103000): City Ordinance No. 275-2023 (July 29, 2023 plebiscite, 73 -> 47) ---
    "0402103000|ALIMA": { psgc: "0402103089", label: "Sinbanali", merge: true },
    "0402103000|BANALO": { psgc: "0402103089", label: "Sinbanali", merge: true },
    "0402103000|SINEGUELASAN": { psgc: "0402103089", label: "Sinbanali", merge: true },
    "0402103000|KAINGIN": { psgc: "0402103078", label: "Kaingin Digman", merge: true },
    "0402103000|DIGMAN": { psgc: "0402103078", label: "Kaingin Digman", merge: true },
    "0402103000|CAMPO SANTO": { psgc: "0402103086", label: "Poblacion", merge: true },
    "0402103000|DAANG BUKID": { psgc: "0402103086", label: "Poblacion", merge: true },
    "0402103000|TABING DAGAT": { psgc: "0402103086", label: "Poblacion", merge: true },
    "0402103000|ANIBAN 1": { psgc: "0402103076", label: "Aniban 1", merge: true },
    "0402103000|ANIBAN 3": { psgc: "0402103076", label: "Aniban 1", merge: true },
    "0402103000|ANIBAN 5": { psgc: "0402103076", label: "Aniban 1", merge: true },
    "0402103000|ANIBAN 2": { psgc: "0402103077", label: "Aniban 2", merge: true },
    "0402103000|ANIBAN 4": { psgc: "0402103077", label: "Aniban 2", merge: true },
    "0402103000|LIGAS 1": { psgc: "0402103079", label: "Ligas 1", merge: true },
    "0402103000|LIGAS 2": { psgc: "0402103079", label: "Ligas 1", merge: true },
    "0402103000|LIGAS 3": { psgc: "0402103036", label: "Ligas 2", merge: true },
    "0402103000|MABOLO 1": { psgc: "0402103080", label: "Mabolo", merge: true },
    "0402103000|MABOLO 2": { psgc: "0402103080", label: "Mabolo", merge: true },
    "0402103000|MABOLO 3": { psgc: "0402103080", label: "Mabolo", merge: true },
    "0402103000|MALIKSI 1": { psgc: "0402103012", label: "Maliksi 1", merge: true },
    "0402103000|MALIKSI 2": { psgc: "0402103081", label: "Maliksi 2", merge: true },
    "0402103000|MALIKSI 3": { psgc: "0402103081", label: "Maliksi 2", merge: true },
    "0402103000|MAMBOG 1": { psgc: "0402103013", label: "Mambog 1", merge: true },
    "0402103000|MAMBOG 2": { psgc: "0402103082", label: "Mambog 2", merge: true },
    "0402103000|MAMBOG 5": { psgc: "0402103082", label: "Mambog 2", merge: true },
    "0402103000|MAMBOG 3": { psgc: "0402103042", label: "Mambog 3", merge: true },
    "0402103000|MAMBOG 4": { psgc: "0402103043", label: "Mambog 4", merge: true },
    "0402103000|NIOG 1": { psgc: "0402103083", label: "Niog", merge: true },
    "0402103000|NIOG 2": { psgc: "0402103083", label: "Niog", merge: true },
    "0402103000|NIOG 3": { psgc: "0402103083", label: "Niog", merge: true },
    "0402103000|P F ESPIRITU 1": { psgc: "0402103018", label: "P.F. Espiritu 1", merge: true },
    "0402103000|P F ESPIRITU 2": { psgc: "0402103084", label: "P.F. Espiritu 2", merge: true },
    "0402103000|P F ESPIRITU 3": { psgc: "0402103084", label: "P.F. Espiritu 2", merge: true },
    "0402103000|P F ESPIRITU 4": { psgc: "0402103055", label: "P.F. Espiritu 3", merge: true },
    "0402103000|P F ESPIRITU 5": { psgc: "0402103085", label: "P.F. Espiritu 4", merge: true },
    "0402103000|P F ESPIRITU 6": { psgc: "0402103085", label: "P.F. Espiritu 4", merge: true },
    "0402103000|P F ESPIRITU 7": { psgc: "0402103058", label: "P.F. Espiritu 5", merge: true },
    "0402103000|P F ESPIRITU 8": { psgc: "0402103059", label: "P.F. Espiritu 6", merge: true },
    "0402103000|REAL 1": { psgc: "0402103087", label: "Real", merge: true },
    "0402103000|REAL 2": { psgc: "0402103087", label: "Real", merge: true },
    "0402103000|SALINAS 1": { psgc: "0402103020", label: "Salinas I", merge: true },
    "0402103000|SALINAS 2": { psgc: "0402103088", label: "Salinas 2", merge: true },
    "0402103000|SALINAS 3": { psgc: "0402103088", label: "Salinas 2", merge: true },
    "0402103000|SALINAS 4": { psgc: "0402103088", label: "Salinas 2", merge: true },
    "0402103000|TALABA 1": { psgc: "0402103090", label: "Talaba 1", merge: true },
    "0402103000|TALABA 3": { psgc: "0402103090", label: "Talaba 1", merge: true },
    "0402103000|TALABA 7": { psgc: "0402103090", label: "Talaba 1", merge: true },
    "0402103000|TALABA 2": { psgc: "0402103066", label: "Talaba 2", merge: true },
    "0402103000|TALABA 4": { psgc: "0402103091", label: "Talaba 3", merge: true },
    "0402103000|TALABA 5": { psgc: "0402103091", label: "Talaba 3", merge: true },
    "0402103000|TALABA 6": { psgc: "0402103091", label: "Talaba 3", merge: true },
    "0402103000|ZAPOTE 1": { psgc: "0402103092", label: "Zapote 1", merge: true },
    "0402103000|ZAPOTE 2": { psgc: "0402103092", label: "Zapote 1", merge: true },
    "0402103000|ZAPOTE 3": { psgc: "0402103093", label: "Zapote 2", merge: true },
    "0402103000|ZAPOTE 4": { psgc: "0402103093", label: "Zapote 2", merge: true },
    "0402103000|ZAPOTE 5": { psgc: "0402103075", label: "Zapote 3", merge: true },

    // --- Ormoc City (0803738000): Ordinance No. 052 (Oct 8, 2022 plebiscite, Bgy 1-28 -> East/South/West) ---
    ...[1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 15, 17, 23, 27].reduce<
        Record<string, { psgc: string; label: string; merge: boolean }>
    >((acc, n) => {
        acc[`0803738000|BGY ${n}`] = { psgc: "0803738116", label: "Barangay South", merge: true };
        return acc;
    }, {}),
    ...[9, 10, 11, 16, 18, 25, 28].reduce<
        Record<string, { psgc: string; label: string; merge: boolean }>
    >((acc, n) => {
        acc[`0803738000|BGY ${n}`] = { psgc: "0803738115", label: "Barangay East", merge: true };
        return acc;
    }, {}),
    ...[14, 19, 20, 21, 22, 24, 26].reduce<
        Record<string, { psgc: string; label: string; merge: boolean }>
    >((acc, n) => {
        acc[`0803738000|BGY ${n}`] = { psgc: "0803738117", label: "Barangay West", merge: true };
        return acc;
    }, {}),

    // --- Verified single-barangay boundary / renaming overrides ---
    "0908311000|GUINTOLAN": { psgc: "0908304019", label: "Guintolan" }, // Payao -> Imelda, Zamboanga Sibugay
};

// Indexes psgc.csv barangays as municityPsgc → BarangayRec[].
function loadBarangayIndex(): Map<string, BarangayRec[]> {
    // psgc.csv uses MacRoman byte 0x96 for 'ñ' (472 occurrences); decode cleanly to UTF-8.
    const rawBuf = fs.readFileSync(path.join(DATASETS_DIR, "data/raw/psgc.csv"));
    const bytes: number[] = [];
    for (const b of rawBuf) {
        if (b === 0x96) bytes.push(0xc3, 0xb1);
        else bytes.push(b);
    }
    const raw = Buffer.from(bytes).toString("utf8");
    const rows = parseCsv(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
    }) as Record<string, string>[];
    const byMuni = new Map<string, BarangayRec[]>();
    const add = (muni: string, rec: BarangayRec) => {
        if (!byMuni.has(muni)) byMuni.set(muni, []);
        byMuni.get(muni)!.push(rec);
    };
    for (const row of rows) {
        if (row["Geographic Level"]?.trim() !== "Bgy") continue;
        const psgc = row["10-digit PSGC"]?.trim().padStart(10, "0");
        if (!psgc) continue;
        const muni = `${psgc.slice(0, 7)}000`;
        const rec: BarangayRec = {
            psgc,
            name: (row.Name ?? "").trim(),
            oldNames: (row["Old names"] ?? "").trim(),
        };
        add(muni, rec);
        // COMELEC nests Manila as NCR - MANILA → SubMun → barangay, and we resolve
        // the parent to the City of Manila. Index Manila barangays under the city
        // code too so that lookup succeeds (barangay numbers are unique citywide).
        if (psgc.startsWith("13806") && muni !== MANILA_CITY_PSGC) {
            add(MANILA_CITY_PSGC, rec);
        }
    }
    return byMuni;
}

// Resolves collected COMELEC barangay nodes per municipality using tiered matching
// and explicit merger vote-summing.
function resolveBarangays(
    pendingAll: PendingBarangay[],
    bgyIdx: Map<string, BarangayRec[]>,
    unmatched: { tier: string; region: string; province: string; name: string }[],
): SeriesRow[] {
    const byMuni = new Map<string, PendingBarangay[]>();
    for (const item of pendingAll) {
        if (!item.muni) {
            unmatched.push({ tier: "barangay", region: item.region, province: item.province, name: item.name });
            continue;
        }
        if (!byMuni.has(item.muni)) byMuni.set(item.muni, []);
        byMuni.get(item.muni)!.push(item);
    }

    const mergedBuckets = new Map<string, SeriesRow>();
    const normalRows: SeriesRow[] = [];

    const addMerged = (psgc: string, label: string, votes: Record<string, number>) => {
        const existing = mergedBuckets.get(psgc);
        if (!existing) {
            mergedBuckets.set(psgc, { psgc, label, votes: { ...votes } });
        } else {
            for (const [k, v] of Object.entries(votes)) {
                existing.votes[k] = (existing.votes[k] ?? 0) + v;
            }
        }
    };

    for (const [muni, items] of byMuni) {
        const recs = bgyIdx.get(muni) ?? [];
        const usedPsgc = new Set<string>();
        const fuzzyPending: PendingBarangay[] = [];

        for (const item of items) {
            const c3 = canonicalBgy(item.name);
            const ov = BARANGAY_OVERRIDES[`${muni}|${c3}`];
            if (ov) {
                usedPsgc.add(ov.psgc);
                if (ov.merge) addMerged(ov.psgc, ov.label ?? item.name, item.votes);
                else normalRows.push({ psgc: ov.psgc, label: ov.label ?? item.name, votes: item.votes });
                continue;
            }

            // Stage 1: Exact normalizePsgcName (now with ñ decoded cleanly)
            const n1 = normalizePsgcName(item.name);
            const h1 = recs.find((r) => normalizePsgcName(r.name) === n1);
            if (h1) {
                usedPsgc.add(h1.psgc);
                normalRows.push({ psgc: h1.psgc, label: item.name, votes: item.votes });
                continue;
            }

            // Stage 2: Strip (POB.) / parentheticals on both sides (must be unique)
            const n2 = normalizePsgcName(stripParens(item.name));
            const h2 = recs.filter((r) => normalizePsgcName(stripParens(r.name)) === n2);
            if (h2.length === 1) {
                usedPsgc.add(h2[0].psgc);
                normalRows.push({ psgc: h2[0].psgc, label: item.name, votes: item.votes });
                continue;
            }

            // Stage 3: Canonical key (Roman↔Arabic, BGY/BRGY, STO/STA/ST/HEN/BLVD, &↔AND, punct)
            const c3c = compactKey(c3);
            const h3 = recs.filter(
                (r) => canonicalBgy(r.name) === c3 || compactKey(canonicalBgy(r.name)) === c3c,
            );
            if (h3.length === 1) {
                usedPsgc.add(h3[0].psgc);
                normalRows.push({ psgc: h3[0].psgc, label: item.name, votes: item.votes });
                continue;
            }
            const c3nb = compactKey(c3.replace(/^BGY\s+/, ""));
            const h3nb = recs.filter(
                (r) => compactKey(canonicalBgy(r.name).replace(/^BGY\s+/, "")) === c3nb,
            );
            if (h3nb.length === 1) {
                usedPsgc.add(h3nb[0].psgc);
                normalRows.push({ psgc: h3nb[0].psgc, label: item.name, votes: item.votes });
                continue;
            }

            // Stage 4: Unique Old names match or parenthetical inner alias
            const h4 = recs.filter(
                (r) =>
                    r.oldNames &&
                    (canonicalBgy(r.oldNames) === c3 || compactKey(canonicalBgy(r.oldNames)) === c3c),
            );
            if (h4.length === 1) {
                usedPsgc.add(h4[0].psgc);
                normalRows.push({ psgc: h4[0].psgc, label: item.name, votes: item.votes });
                continue;
            }

            const mParen = item.name.match(/\(([^)]+)\)/);
            if (mParen) {
                const inner = canonicalBgy(mParen[1]);
                if (inner && inner !== "POBLACION") {
                    const hP = recs.filter(
                        (r) =>
                            canonicalBgy(r.name) === inner ||
                            compactKey(canonicalBgy(r.name)) === compactKey(inner),
                    );
                    if (hP.length === 1) {
                        usedPsgc.add(hP[0].psgc);
                        normalRows.push({ psgc: hP[0].psgc, label: item.name, votes: item.votes });
                        continue;
                    }
                }
            }
            const hP2 = recs.filter((r) => {
                const mp = r.name.match(/\(([^)]+)\)/);
                if (!mp) return false;
                const inner = canonicalBgy(mp[1]);
                return inner && inner !== "POBLACION" && (inner === c3 || compactKey(inner) === c3c);
            });
            if (hP2.length === 1) {
                usedPsgc.add(hP2[0].psgc);
                normalRows.push({ psgc: hP2[0].psgc, label: item.name, votes: item.votes });
                continue;
            }

            fuzzyPending.push(item);
        }

        // Stage 5: Safe intra-municipality fallback among ONLY remaining unmatched PSGC barangays.
        // Guards: trailing digits must match (if both have digits), unique best match, tight edit distance.
        const remPsgc = recs.filter((r) => !usedPsgc.has(r.psgc));
        for (const item of fuzzyPending) {
            const c3 = canonicalBgy(item.name);
            const c3c = compactKey(c3);
            const cDigits = c3.match(/\d+/g)?.join("-") ?? "";

            const eligible = remPsgc.filter((r) => {
                if (usedPsgc.has(r.psgc)) return false;
                const rDigits = canonicalBgy(r.name).match(/\d+/g)?.join("-") ?? "";
                // If both carry digits, they must agree (prevents Zone 1 matching Zone 2)
                if (cDigits && rDigits && cDigits !== rDigits) return false;
                return true;
            });

            // 5a: Exact prefix/suffix token containment on remaining unmatched (e.g. "ACMAC" -> "Acmac-Mariano Badelles Sr.", "BARANGAY NG MGA MANGINGISDA" -> "Mangingisda", "CONCORDIA" -> "Concordia Norte")
            const tokHits = eligible.filter((r) => {
                const rc = canonicalBgy(r.name);
                return (
                    (c3.length >= 5 && (rc.startsWith(`${c3} `) || rc.endsWith(` ${c3}`))) ||
                    (rc.length >= 5 && (c3.startsWith(`${rc} `) || c3.endsWith(` ${rc}`)))
                );
            });
            if (tokHits.length === 1) {
                usedPsgc.add(tokHits[0].psgc);
                normalRows.push({ psgc: tokHits[0].psgc, label: item.name, votes: item.votes });
                continue;
            }

            // 5b: Tight Levenshtein edit distance (<= 2 for len >= 7, <= 1 for len >= 4, or <= 3 if sole remaining PSGC in muni with >= 60% similarity)
            const scored = eligible
                .map((r) => ({ r, d: levenshtein(c3c, compactKey(canonicalBgy(r.name))) }))
                .sort((a, b) => a.d - b.d);
            const maxD = c3c.length >= 7 ? 2 : c3c.length >= 4 ? 1 : 0;
            const soleClose =
                eligible.length === 1 &&
                scored[0].d <= 3 &&
                scored[0].d / Math.max(c3c.length, compactKey(canonicalBgy(scored[0].r.name)).length, 1) <= 0.4;

            if (
                scored.length > 0 &&
                ((scored[0].d <= maxD && (scored.length === 1 || scored[1].d > scored[0].d)) || soleClose)
            ) {
                usedPsgc.add(scored[0].r.psgc);
                normalRows.push({ psgc: scored[0].r.psgc, label: item.name, votes: item.votes });
                continue;
            }

            // 5c: Transposition / 3-edit match on long names (>= 10 chars) like GIMENARAT EAST -> Gimiranat East
            if (
                c3c.length >= 10 &&
                scored.length > 0 &&
                scored[0].d === 3 &&
                (scored.length === 1 || scored[1].d > 4)
            ) {
                usedPsgc.add(scored[0].r.psgc);
                normalRows.push({ psgc: scored[0].r.psgc, label: item.name, votes: item.votes });
                continue;
            }

            unmatched.push({ tier: "barangay", region: item.region, province: item.province, name: item.name });
        }
    }

    return [...normalRows, ...mergedBuckets.values()];
}

// ---------- tree walk ----------

interface Ctx {
    region: string;
    province: string;
    // Set once we descend into the City of Manila, whose COMELEC SubMun children
    // (tagged "City/Municipality") and barangays all belong to this one city.
    municityPsgc?: string;
}

// Exact PSGC overrides for nodes that name-matching cannot resolve, due to
// BARMM boundary changes (Maguindanao split, 2022) and PSGC index gaps.
// Keyed by REGION|PROVINCE|NAME (uppercased, COMELEC labels).
const PSGC_OVERRIDES: Record<string, string> = {
    "REGION VII|BOHOL|PRESIDENT CARLOS P. GARCIA": "0701235000",
    "BARMM|LANAO DEL SUR|AMAI MANABILANG": "1903637000",
    "BARMM|MAGUINDANAO|PARANG": "1908709000",
};

function isNcr(region: string): boolean {
    return /NATIONAL CAPITAL REGION/i.test(region);
}

function stripNcrPrefix(name: string): string {
    return name.replace(/^NCR\s*-\s*/i, "").trim();
}

// Resolves a COMELEC city/municipality node to a PSGC, honoring overrides and CITY hints.
function matchCityMun(region: string, province: string, name: string, idx: PsgcIndexes): string | null {
    const key = `${region.trim().toUpperCase()}|${province.trim().toUpperCase()}|${name.trim().toUpperCase()}`;
    if (PSGC_OVERRIDES[key]) return PSGC_OVERRIDES[key];

    const asCity = () => matchPlace({ level: "city", region, province, name }, idx);
    const asMun = () => matchPlace({ level: "municipality", region, province, name }, idx);
    // COMELEC city nodes carry "CITY" in their name; match those as cities first.
    // Municipalities are matched province-scoped first, so a municipality named
    // like a city elsewhere (e.g. Quezon, San Juan) doesn't collide with that
    // city's PSGC via the global city fallback.
    return /\bCITY\b/i.test(name) ? (asCity() ?? asMun()) : (asMun() ?? asCity());
}

const tiers: Record<string, SeriesRow[]> = {
    country: [],
    region: [],
    province: [],
    citymun: [],
    barangay: [],
};

const unmatchedMunicipalVotes: Record<string, number>[] = [];

let inspected = 0;

// Recursively walks the scraped result tree, collecting per-city/municipality and
// barangay presidential vote rows into the `tiers` / `pendingBarangays` accumulators.
function walk(
    nodeDir: string,
    ctx: Ctx,
    idx: PsgcIndexes,
    pendingBarangays: PendingBarangay[],
    visitedDirs: Set<string>,
    pres: PresidentContest,
    voteKeyRef: { key: string | null },
    unmatched: { tier: string; region: string; province: string; name: string }[],
) {
    const absDir = path.join(RESULTS_DIR, nodeDir);
    if (visitedDirs.has(absDir)) return;
    visitedDirs.add(absDir);
    const info = readJson<NodeInfo>(path.join(absDir, "info.json"));
    if (!info) return;
    const can = (info.can ?? "").trim();
    const name = info.rn ?? path.basename(absDir);

    const nextCtx: Ctx = { ...ctx };
    if (can === "Region") nextCtx.region = name;
    // NCR "provinces" are legislative districts, not real provinces; keep the
    // province context empty so cities/municipalities match by region only.
    else if (can === "Province") nextCtx.province = isNcr(ctx.region) ? "" : name;

    if (INSPECT && inspected < 1 && fs.existsSync(path.join(absDir, "coc.json"))) {
        const coc = readJson<{ rs?: Record<string, unknown>[] }>(path.join(absDir, "coc.json"));
        console.log("\n=== INSPECT: info.json keys ===", Object.keys(info));
        console.log("can:", can, "| name:", name);
        console.log("=== INSPECT: coc.json rs[0] ===", coc?.rs?.[0]);
        inspected++;
    }

    if (can === "Barangay") {
        // Aggregate clustered-precinct ERs into one barangay total.
        const merged: Record<string, number> = {};
        for (const f of fs.readdirSync(absDir)) {
            if (f === "info.json" || !f.endsWith(".json")) continue;
            const part = votesFromResult(path.join(absDir, f), pres, voteKeyRef);
            if (part) for (const [k, v] of Object.entries(part)) merged[k] = (merged[k] ?? 0) + v;
        }
        if (Object.keys(merged).length) {
            // Inside Manila, every barangay belongs to the City of Manila; elsewhere
            // a barangay's parent city/municipality is its parent directory name.
            const parentName = path.basename(path.dirname(absDir));
            const muni = nextCtx.municityPsgc ?? matchCityMun(nextCtx.region, nextCtx.province, parentName, idx);
            pendingBarangays.push({
                region: nextCtx.region,
                province: nextCtx.province,
                parentName,
                muni,
                name,
                votes: merged,
            });
        }
        return;
    }

    const coc = votesFromResult(path.join(absDir, "coc.json"), pres, voteKeyRef);
    if (coc) {
        let psgc: string | null = null;
        let tier = "";
        let label = name;
        if (can === "Region") {
            // Region totals are derived by aggregating city/municipality rows.
        } else if (can === "Province") {
            if (isNcr(nextCtx.region)) {
                // NCR - MANILA carries Manila's citywide COC -> emit as a city.
                // Other NCR "provinces" are pure district groupers: skip their
                // COC (their child cities each have their own) but still recurse.
                const cleaned = stripNcrPrefix(name);
                const cityPsgc = matchCityMun(nextCtx.region, "", cleaned, idx);
                if (cityPsgc) {
                    psgc = cityPsgc;
                    tier = "citymun";
                    label = cleaned;
                    // Carry the city down: Manila's SubMun + barangay children all
                    // belong to this PSGC (e.g. NCR - MANILA → 1380600000).
                    nextCtx.municityPsgc = cityPsgc;
                }
            }
            // Non-NCR province COCs are skipped — province totals are derived
            // from city/municipality aggregation (2024 PSGC boundaries).
        } else if (can !== "Country" && !nextCtx.municityPsgc) {
            // Skipped when inside Manila: its SubMun nodes are tagged
            // "City/Municipality" but are not real municities (the city COC was
            // already emitted at the NCR - MANILA node above).
            psgc = matchCityMun(nextCtx.region, nextCtx.province, name, idx);
            tier = "citymun";
        }
        if (tier) {
            if (psgc) {
                tiers[tier].push({ psgc, label, votes: coc });
            } else {
                unmatched.push({ tier, region: nextCtx.region, province: nextCtx.province, name });
                if (tier === "citymun") {
                    unmatchedMunicipalVotes.push(coc);
                }
            }
        }
    }

    for (const child of Object.values(info.srs ?? {})) {
        const childDir = path.join(nodeDir, child.rn.replace(/\//g, "_"));
        walk(childDir, nextCtx, idx, pendingBarangays, visitedDirs, pres, voteKeyRef, unmatched);
    }
}

// ---------- parent lookup for aggregation ----------

interface LguParent {
    provincePsgc: string;
    regionPsgc: string;
}

// Maps each LGU PSGC to its province and (prefix-derived) region for aggregation.
function loadLguParents(publicDir: string): Map<string, LguParent> {
    const meta = JSON.parse(
        fs.readFileSync(path.join(publicDir, "geo/municities/meta.json"), "utf8"),
    ) as { psgc: string; province_psgc: string | null; region_psgc: string | null }[];
    const out = new Map<string, LguParent>();
    for (const row of meta) {
        if (!row.province_psgc) continue;
        const provincePsgc = row.province_psgc.padStart(10, "0");
        // Derive region from the province PSGC prefix, not meta's region_psgc
        // back-pointer: that pointer is stale for the Negros Island Region (NIR),
        // whose provinces are coded 18xxxxxxxx but still point to Region VI/VII.
        // The prefix routes them to NIR (1800000000) so the polygon gets colored.
        out.set(row.psgc.padStart(10, "0"), {
            provincePsgc,
            regionPsgc: `${provincePsgc.slice(0, 2)}00000000`,
        });
    }
    return out;
}

// Maps region PSGC → region display name.
function loadRegionLabels(publicDir: string): Map<string, string> {
    const regions = JSON.parse(fs.readFileSync(path.join(publicDir, "geo/regions.json"), "utf8")) as {
        psgc: string;
        name: string;
    }[];
    const out = new Map<string, string>();
    for (const row of regions) out.set(row.psgc.padStart(10, "0"), row.name);
    return out;
}

// Maps province PSGC → province display name.
function loadProvinceLabels(publicDir: string): Map<string, string> {
    const provinces = JSON.parse(fs.readFileSync(path.join(publicDir, "geo/provinces.json"), "utf8")) as {
        psgc: string;
        name: string;
    }[];
    const out = new Map<string, string>();
    for (const row of provinces) out.set(row.psgc.padStart(10, "0"), row.name);
    return out;
}

/** Sum city/municipality vote rows into parent buckets (province or region). */
function aggregateByParent(
    rows: SeriesRow[],
    parentKey: (parent: LguParent) => string,
    parents: Map<string, LguParent>,
    labels: Map<string, string>,
): SeriesRow[] {
    const buckets = new Map<string, SeriesRow>();
    for (const row of rows) {
        const parent = parents.get(row.psgc);
        if (!parent) continue;
        const key = parentKey(parent);
        const existing = buckets.get(key);
        if (!existing) {
            buckets.set(key, { psgc: key, label: labels.get(key) ?? key, votes: { ...row.votes } });
        } else {
            for (const [candidate, votes] of Object.entries(row.votes)) {
                existing.votes[candidate] = (existing.votes[candidate] ?? 0) + votes;
            }
        }
    }
    return [...buckets.values()];
}

// ---------- CSV emit ----------

// Candidates ordered by total votes (desc) with their party colors.
function orderedCandidates(rows: SeriesRow[]): { display: string; color: string }[] {
    const totals = new Map<string, number>();
    for (const r of rows) for (const [k, v] of Object.entries(r.votes)) totals.set(k, (totals.get(k) ?? 0) + v);
    return [...totals.keys()]
        .sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
        .map((display) => ({
            display,
            color: CANDIDATE_META.find((c) => c.display === display)?.color ?? "#888888",
        }));
}

// Writes all tiers (region→barangay) into a single combined custom-overlay CSV.
function writeUniversalCsv(
    tiers: Record<string, SeriesRow[]>,
    title: string,
    cands: { display: string; color: string }[],
) {
    const tierOrder = ["country", "region", "province", "citymun", "barangay"] as const;
    const rows = tierOrder.flatMap((tier) => tiers[tier] ?? []);
    if (!rows.length) return;

    const safe = (s: string) => s.replace(/,/g, "");
    const header = ["psgc", "label", ...cands.map((c) => safe(c.display))];
    // Use "; " in directives so the comment stays in one cell when opened in a spreadsheet.
    const colors = cands.map((c) => `${safe(c.display)}=${c.color}`).join("; ");
    const series = cands.map((c) => safe(c.display)).join("; ");

    const lines = [
        `# title: ${title}`,
        `# unit: votes`,
        `# mode: lead`,
        `# colors: ${colors}`,
        `# series: ${series}`,
        `# Multi-level: region, province, city/municipality, and barangay rows in one file.`,
        `# Source: COMELEC 2022 transparency results (public domain, RA 8293 s.176)`,
        header.join(","),
    ];
    for (const r of rows) {
        const cols = [r.psgc, safe(r.label), ...cands.map((c) => String(r.votes[c.display] ?? 0))];
        lines.push(cols.join(","));
    }
    const out = path.join(CLEAN_DIR, "elections_2022_president_all.csv");
    fs.writeFileSync(out, lines.join("\n") + "\n");
    console.log(`  all: ${rows.length} areas, ${cands.length} candidates -> ${path.basename(out)}`);
}

// Keep one row per PSGC. A duplicate means two COMELEC nodes resolved to the
// same area (a matching bug); warn loudly instead of silently double-counting.
function dedupeRows(rows: SeriesRow[], tier: string): SeriesRow[] {
    const seen = new Map<string, SeriesRow>();
    for (const row of rows) {
        const existing = seen.get(row.psgc);
        if (!existing) {
            seen.set(row.psgc, row);
        } else {
            console.warn(
                `  ! ${tier}: duplicate PSGC ${row.psgc} ("${existing.label}" vs "${row.label}") — keeping first`,
            );
        }
    }
    return [...seen.values()];
}

// ---------- main ----------

// Parses the scrape, aggregates city/municipality rows up to province/region, and
// writes per-tier and combined presidential-result CSVs.
function main() {
    if (!fs.existsSync(RESULTS_DIR)) {
        throw new Error(
            `No scrape found at ${RESULTS_DIR}.\n` +
                `Run the scraper first:\n` +
                `  npm run scrape:comelec            # region+province+citymun\n` +
                `  npm run scrape:comelec -- --max-rank barangay   # full, heavy`,
        );
    }

    const pres = findPresidentContest();
    if (!pres) {
        throw new Error(
            `Could not find the presidential contest in ${CONTESTS_DIR}.\n` +
                `Make sure the scrape completed and contest files were downloaded.\n` +
                `Run with --inspect to dump the raw JSON shapes.`,
        );
    }
    console.log(`President contest cc=${pres.cc}, candidates: ${pres.boToDisplay.size}`);

    const idx = loadPsgcIndexes(DATASETS_DIR);
    const bgyIdx = loadBarangayIndex();
    const voteKeyRef = { key: null as string | null };
    const unmatched: { tier: string; region: string; province: string; name: string }[] = [];
    const pendingBarangays: PendingBarangay[] = [];
    const visitedDirs = new Set<string>();

    walk("", { region: "", province: "" }, idx, pendingBarangays, visitedDirs, pres, voteKeyRef, unmatched);

    if (INSPECT) {
        console.log(`\nDetected vote field: "${voteKeyRef.key}"`);
        console.log("Sample president boToDisplay:", [...pres.boToDisplay.entries()].slice(0, 12));
        return;
    }

    tiers.barangay = resolveBarangays(pendingBarangays, bgyIdx, unmatched);

    for (const [tier, rows] of Object.entries(tiers)) {
        if (tier === "citymun" || tier === "barangay") {
            tiers[tier] = dedupeRows(rows, tier);
        }
    }

    const lguParents = loadLguParents(DATASETS_DIR);
    const regionLabels = loadRegionLabels(DATASETS_DIR);
    const provinceLabels = loadProvinceLabels(DATASETS_DIR);

    tiers.province = dedupeRows(
        aggregateByParent(tiers.citymun, (p) => p.provincePsgc, lguParents, provinceLabels),
        "province",
    );
    tiers.region = dedupeRows(
        aggregateByParent(tiers.citymun, (p) => p.regionPsgc, lguParents, regionLabels),
        "region",
    );

    // Use the official Congress Proclamation final canvass counts for the national Country total.
    // This includes Local Absentee Voting (LAV) and manual OAV results that are not present
    // in any municipal/precinct transmission files on the COMELEC transparency server.
    const countryVotes: Record<string, number> = {
        "Bongbong Marcos": 31629783,
        "Leni Robredo": 15035773,
        "Manny Pacquiao": 3663113,
        "Isko Moreno": 1933909,
        "Ping Lacson": 892375,
        "Faisal Mangondato": 301629,
        "Ernesto Abella": 114627,
        "Leody de Guzman": 93027,
        "Norberto Gonzales": 90641,
        "Jose Montemayor": 60592,
    };
    tiers.country = [{ psgc: "0000000000", label: "Philippines", votes: countryVotes }];

    const allRows = [...tiers.country, ...tiers.region, ...tiers.province, ...tiers.citymun, ...tiers.barangay];
    const cands = orderedCandidates(allRows);

    console.log("Writing CSV:");
    writeUniversalCsv(tiers, "2022 President (all levels)", cands);

    if (unmatched.length) {
        const out = path.join(CLEAN_DIR, "elections_2022_president_unmatched.json");
        fs.writeFileSync(out, JSON.stringify(unmatched, null, 2));
        const byTier = unmatched.reduce<Record<string, number>>((a, u) => {
            a[u.tier] = (a[u.tier] ?? 0) + 1;
            return a;
        }, {});
        console.log(`Unmatched: ${JSON.stringify(byTier)} -> ${path.basename(out)}`);
    }
}

main();
