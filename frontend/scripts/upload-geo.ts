// Uploads data-sets/geo JSON files to the Supabase Storage geo bucket.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../data-sets/geo");
const BUCKET = "geo";
const CONCURRENCY = 4;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 2000;

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// True for transient upload errors (timeouts, rate limits, 5xx, network) worth retrying.
function isRetryableUploadError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes("gateway timeout") ||
        lower.includes("timeout") ||
        lower.includes("bad request") ||
        lower.includes("400") ||
        lower.includes("429") ||
        lower.includes("too many") ||
        lower.includes("502") ||
        lower.includes("503") ||
        lower.includes("504") ||
        lower.includes("fetch failed") ||
        lower.includes("network")
    );
}

// SKIP_EXISTING=1 resumes an interrupted run by skipping files already present
// in the bucket with a matching byte size.
const SKIP_EXISTING = process.env.SKIP_EXISTING === "1";

// Pages through a bucket prefix, recording each object's byte size for skip-existing checks.
async function loadExistingSizes(prefix: string, into: Map<string, number>) {
    const pageSize = 1000;
    let offset = 0;
    for (;;) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(prefix, { limit: pageSize, offset });
        if (error) {
            console.warn(`  (could not list ${prefix || "/"}: ${error.message})`);
            return;
        }
        if (!data || data.length === 0) break;
        for (const obj of data) {
            const size = (obj.metadata as { size?: number } | null)?.size;
            if (typeof size === "number") {
                const key = prefix ? `${prefix}/${obj.name}` : obj.name;
                into.set(key, size);
            }
        }
        if (data.length < pageSize) break;
        offset += pageSize;
    }
}

const existingSizes = new Map<string, number>();

// Uploads one geo file to the bucket with retry/backoff, skipping unchanged files.
async function uploadFile(relativePath: string) {
    const filePath = path.join(GEO_DIR, relativePath);
    if (!fs.existsSync(filePath)) {
        console.warn(`  skip (missing): ${relativePath}`);
        return;
    }
    const body = fs.readFileSync(filePath);
    const kb = Math.round(body.byteLength / 1024);

    if (SKIP_EXISTING && existingSizes.get(relativePath) === body.byteLength) {
        return;
    }

    let lastError: string | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const { error } = await supabase.storage.from(BUCKET).upload(relativePath, body, {
            contentType: "application/json",
            cacheControl: "3600",
            upsert: true,
        });

        if (!error) {
            console.log(`  ${relativePath} — ${kb} KB`);
            return;
        }

        lastError = error.message;
        if (!isRetryableUploadError(error.message) || attempt === MAX_RETRIES) {
            throw new Error(`${relativePath} (${kb} KB): ${error.message}`);
        }

        const waitMs = RETRY_BASE_MS * attempt;
        console.warn(`  retry ${attempt}/${MAX_RETRIES} for ${relativePath} in ${waitMs}ms — ${error.message}`);
        await sleep(waitMs);
    }

    throw new Error(`${relativePath} (${kb} KB): ${lastError ?? "upload failed"}`);
}

// Lists province-*.json municity files in numeric order.
function listProvinceFiles(): string[] {
    const dir = path.join(GEO_DIR, "municities");
    return fs
        .readdirSync(dir)
        .filter((name) => /^province-\d+\.json$/.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// Lists per-municity barangay JSON files in numeric order.
function listBgyFiles(): string[] {
    const dir = path.join(GEO_DIR, "municities/bgy");
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((name) => /^\d+\.json$/.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const failures: string[] = [];

// Uploads a file, recording the path in `failures` instead of throwing on error.
async function tryUpload(relativePath: string) {
    try {
        await uploadFile(relativePath);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED: ${message}`);
        failures.push(relativePath);
    }
}

// Uploads many files with a fixed pool of concurrent workers.
async function uploadMany(relativePaths: string[]) {
    let i = 0;
    async function worker() {
        while (i < relativePaths.length) {
            const idx = i++;
            await tryUpload(relativePaths[idx]);
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

// Uploads all geo layers (top-level, province, country, barangay) to the bucket.
async function main() {
    console.log(`Uploading geo layers to bucket "${BUCKET}"…`);

    if (SKIP_EXISTING) {
        console.log("  SKIP_EXISTING=1 — listing already-uploaded files…");
        await loadExistingSizes("", existingSizes);
        await loadExistingSizes("municities", existingSizes);
        await loadExistingSizes("municities/bgy", existingSizes);
        console.log(`  found ${existingSizes.size} existing objects; matching ones will be skipped`);
    }

    await tryUpload("regions.json");
    await tryUpload("provinces.json");
    await tryUpload("municities/meta.json");
    await tryUpload("municities/manifest.json");

    const provinceFiles = listProvinceFiles();
    console.log(`Uploading ${provinceFiles.length} province municity files…`);
    for (const fileName of provinceFiles) {
        await tryUpload(`municities/${fileName}`);
    }

    if (fs.existsSync(path.join(GEO_DIR, "country.json"))) {
        await tryUpload("country.json");
    }

    const bgyMeta = path.join(GEO_DIR, "municities/bgy/meta.json");
    if (fs.existsSync(bgyMeta)) {
        await tryUpload("municities/bgy/meta.json");
        await tryUpload("municities/bgy/manifest.json");

        const bgyFiles = listBgyFiles();
        console.log(`Uploading ${bgyFiles.length} per-municity barangay files (concurrency ${CONCURRENCY})…`);
        await uploadMany(bgyFiles.map((f) => `municities/bgy/${f}`));
    }

    if (failures.length > 0) {
        console.error(`\nDone with ${failures.length} failed file(s):`);
        for (const f of failures) console.error(`  - ${f}`);
        console.error(`\nRe-run with SKIP_EXISTING=1 to retry only the missing files:`);
        console.error(`  SKIP_EXISTING=1 pnpm upload:geo`);
        process.exit(1);
    }

    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
