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

// Official national totals (0000000000 country row), hardcoded so the Philippines
// view always shows the canonical headline numbers instead of a sum of whatever
// barangays happen to be scraped. Source: COMELEC 2022 transparency results,
// partial/unofficial as of May 13, 2022 (98.35% of ERs).
const COUNTRY_TOTALS: Record<string, number> = {
    "Bongbong Marcos": 31104175,
    "Leni Robredo": 14822051,
    "Manny Pacquiao": 3629805,
    "Isko Moreno": 1900010,
    "Ping Lacson": 882236,
    "Faisal Mangondato": 259576,
    "Ernesto Abella": 113242,
    "Leody de Guzman": 92070,
    "Norberto Gonzales": 89097,
    "Jose Montemayor": 59944,
};

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

// ---------- barangay PSGC index from psgc.csv ----------

// City of Manila: its barangays are stored under SubMun district codes
// (1380601000…1380614000), not directly under the city, so they need rolling up.
const MANILA_CITY_PSGC = "1380600000";

// Indexes psgc.csv barangays as municityPsgc → (normalized name → barangay PSGC).
function loadBarangayIndex(): Map<string, Map<string, string>> {
    const raw = fs.readFileSync(path.join(DATASETS_DIR, "data/raw/psgc.csv"), "latin1");
    const rows = parseCsv(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
    }) as Record<string, string>[];
    const byMuni = new Map<string, Map<string, string>>();
    const add = (muni: string, norm: string, psgc: string) => {
        if (!byMuni.has(muni)) byMuni.set(muni, new Map());
        byMuni.get(muni)!.set(norm, psgc);
    };
    for (const row of rows) {
        if (row["Geographic Level"]?.trim() !== "Bgy") continue;
        const psgc = row["10-digit PSGC"]?.trim().padStart(10, "0");
        if (!psgc) continue;
        const muni = `${psgc.slice(0, 7)}000`;
        const norm = normalizePsgcName(row.Name ?? "");
        add(muni, norm, psgc);
        // COMELEC nests Manila as NCR - MANILA → SubMun → barangay, and we resolve
        // the parent to the City of Manila. Index Manila barangays under the city
        // code too so that lookup succeeds (barangay numbers are unique citywide).
        if (psgc.startsWith("13806") && muni !== MANILA_CITY_PSGC) {
            add(MANILA_CITY_PSGC, norm, psgc);
        }
    }
    return byMuni;
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

let inspected = 0;

// Recursively walks the scraped result tree, collecting per-city/municipality and
// barangay presidential vote rows into the `tiers` accumulator.
function walk(
    nodeDir: string,
    ctx: Ctx,
    idx: PsgcIndexes,
    bgyIdx: Map<string, Map<string, string>>,
    pres: PresidentContest,
    voteKeyRef: { key: string | null },
    unmatched: { tier: string; region: string; province: string; name: string }[],
) {
    const absDir = path.join(RESULTS_DIR, nodeDir);
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
            const bgyPsgc = muni ? bgyIdx.get(muni)?.get(normalizePsgcName(name)) : undefined;
            if (bgyPsgc) tiers.barangay.push({ psgc: bgyPsgc, label: name, votes: merged });
            else unmatched.push({ tier: "barangay", region: nextCtx.region, province: nextCtx.province, name });
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
            if (psgc) tiers[tier].push({ psgc, label, votes: coc });
            else unmatched.push({ tier, region: nextCtx.region, province: nextCtx.province, name });
        }
    }

    for (const child of Object.values(info.srs ?? {})) {
        const childDir = path.join(nodeDir, child.rn.replace(/\//g, "_"));
        walk(childDir, nextCtx, idx, bgyIdx, pres, voteKeyRef, unmatched);
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

    walk("", { region: "", province: "" }, idx, bgyIdx, pres, voteKeyRef, unmatched);

    if (INSPECT) {
        console.log(`\nDetected vote field: "${voteKeyRef.key}"`);
        console.log("Sample president boToDisplay:", [...pres.boToDisplay.entries()].slice(0, 12));
        return;
    }

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

    // Whole-country row uses the hardcoded official national totals, not a sum of
    // the scraped tiers (which are partial until every barangay is scraped).
    tiers.country = [{ psgc: "0000000000", label: "Philippines", votes: { ...COUNTRY_TOTALS } }];

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
