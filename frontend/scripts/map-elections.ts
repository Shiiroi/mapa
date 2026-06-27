#!/usr/bin/env tsx
// Maps GMA Eleksyon 2022 presidential votes to province PSGC (latest batch per province).

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { stringify } from "csv-stringify/sync";
import { loadPsgcIndexes, matchPlace, type PlaceRow } from "./lib/afrMatch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public");
const ELECTION_JSON = path.join(PUBLIC_DIR, "gma_election_data.json");
const OUT_CSV = path.join(PUBLIC_DIR, "elections_2022_president_mapped.csv");
const OUT_JSON = path.join(PUBLIC_DIR, "elections_2022_president_mapped.json");
const UNMATCHED_JSON = path.join(PUBLIC_DIR, "elections_2022_president_unmatched.json");
const GMA_JSON_URL =
    "https://raw.githubusercontent.com/AstroMC98/GMA-Eleksyon-2022-Data/main/gma_election_data.json";

const PRESIDENT_CONTEST = "PRESIDENT PHILIPPINES";

interface GmaBatch {
    location_code?: string;
    result?: {
        contest: string;
        candidates: { name: string; vote_count: number }[];
    }[];
}

interface GmaRegion {
    PROVINCE?: string[];
    PROVINCIAL_DATA?: Record<string, Record<string, GmaBatch>>;
}

interface MappedElectionRow {
    psgc: string;
    level: string;
    region: string;
    province: string;
    winner: string;
    winner_votes: number;
    total_votes: number;
    detail: Record<string, number>;
}

function ensureElectionJson(): never {
    throw new Error(
        `Missing ${ELECTION_JSON}. Download from ${GMA_JSON_URL} or: curl -sL "${GMA_JSON_URL}" -o "${ELECTION_JSON}"`,
    );
}

async function downloadElectionJsonIfMissing(): Promise<void> {
    if (fs.existsSync(ELECTION_JSON)) return;
    console.log(`Downloading ${path.basename(ELECTION_JSON)}…`);
    const res = await fetch(GMA_JSON_URL, {
        headers: { "User-Agent": "mapa-frontend/1.0 (data pipeline)" },
    });
    if (!res.ok) throw new Error(`Failed to download election JSON: ${res.status}`);
    fs.writeFileSync(ELECTION_JSON, await res.text());
}

function candidateKey(ballotName: string): string {
    return ballotName.split("(")[0].trim();
}

function candidateDisplayName(ballotName: string): string {
    const base = candidateKey(ballotName);
    const comma = base.indexOf(",");
    if (comma === -1) return base;
    const last = base.slice(0, comma).trim();
    const first = base.slice(comma + 1).trim().replace(/^["']|["']$/g, "");
    if (!first) return last;
    const titleCase = (s: string) =>
        s
            .split(/\s+/)
            .map((w) => (w ? w[0] + w.slice(1).toLowerCase() : w))
            .join(" ");
    return `${titleCase(first)} ${titleCase(last)}`;
}

function presidentVotesFromBatch(batch: GmaBatch): Record<string, number> {
    const votes: Record<string, number> = {};
    for (const contest of batch.result ?? []) {
        if (contest.contest.trim().toUpperCase() !== PRESIDENT_CONTEST) continue;
        for (const cand of contest.candidates ?? []) {
            const key = candidateDisplayName(cand.name);
            votes[key] = (votes[key] ?? 0) + cand.vote_count;
        }
        break;
    }
    return votes;
}

function latestBatch(provBatches: Record<string, GmaBatch>): GmaBatch | null {
    const nums = Object.keys(provBatches)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    const max = String(Math.max(...nums));
    return provBatches[max] ?? null;
}

function winnerFromVotes(votes: Record<string, number>): { winner: string; winnerVotes: number; total: number } | null {
    const entries = Object.entries(votes).filter(([, v]) => v > 0);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return { winner: entries[0][0], winnerVotes: entries[0][1], total };
}

async function main() {
    await downloadElectionJsonIfMissing();
    if (!fs.existsSync(ELECTION_JSON)) {
        ensureElectionJson();
    }

    const raw = JSON.parse(fs.readFileSync(ELECTION_JSON, "utf8")) as Record<string, GmaRegion>;
    const indexes = loadPsgcIndexes(PUBLIC_DIR);
    const matched: MappedElectionRow[] = [];
    const unmatched: { region: string; province: string; reason: string }[] = [];

    for (const [regionName, regionData] of Object.entries(raw)) {
        if (regionName === "OAV") continue;
        const provincialData = regionData.PROVINCIAL_DATA ?? {};
        for (const [provinceName, batches] of Object.entries(provincialData)) {
            const batch = latestBatch(batches);
            if (!batch) {
                unmatched.push({ region: regionName, province: provinceName, reason: "no batches" });
                continue;
            }
            const votes = presidentVotesFromBatch(batch);
            const win = winnerFromVotes(votes);
            if (!win) {
                unmatched.push({ region: regionName, province: provinceName, reason: "no president contest" });
                continue;
            }

            const row: PlaceRow = {
                level: "province",
                region: regionName,
                province: "",
                name: provinceName,
            };
            const psgc = matchPlace(row, indexes);
            if (!psgc) {
                unmatched.push({ region: regionName, province: provinceName, reason: "no PSGC match" });
                continue;
            }

            matched.push({
                psgc,
                level: "province",
                region: regionName,
                province: provinceName,
                winner: win.winner,
                winner_votes: win.winnerVotes,
                total_votes: win.total,
                detail: votes,
            });
        }
    }

    fs.writeFileSync(
        OUT_CSV,
        stringify(matched, {
            header: true,
            columns: ["psgc", "level", "region", "province", "winner", "winner_votes", "total_votes"],
        }),
    );
    fs.writeFileSync(OUT_JSON, JSON.stringify(matched, null, 2));
    fs.writeFileSync(UNMATCHED_JSON, JSON.stringify(unmatched, null, 2));

    console.log(`elections_2022_president_mapped: ${matched.length} provinces`);
    console.log(`Unmatched: ${unmatched.length} -> ${path.basename(UNMATCHED_JSON)}`);
    if (matched.length) {
        const sample = matched[0];
        console.log(`  sample: ${sample.province} -> ${sample.winner} (${sample.winner_votes}/${sample.total_votes})`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
