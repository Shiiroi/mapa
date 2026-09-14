// Uploads data-sets/geo JSON files to Cloudflare R2 bucket with immutable cache headers.

import { S3Client, PutObjectCommand, ListObjectsV2Command, type ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../data-sets/geo");

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET ?? "mapa-geo";

if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error("Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY");
    process.exit(1);
}

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

const CONCURRENCY = 12;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1500;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadExistingSizes(into: Map<string, number>) {
    let token: string | undefined = undefined;
    console.log("Checking existing objects in R2 bucket…");
    while (true) {
        const res: ListObjectsV2CommandOutput = await s3.send(
            new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: token,
            }),
        );
        for (const item of res.Contents ?? []) {
            if (item.Key && typeof item.Size === "number") {
                into.set(item.Key, item.Size);
            }
        }
        if (!res.IsTruncated || !res.NextContinuationToken) break;
        token = res.NextContinuationToken;
    }
    console.log(`Found ${into.size} existing objects in R2.`);
}

// Collects all relative JSON paths under directory
function collectFiles(dir: string, baseDir = dir): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(fullPath, baseDir));
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            results.push(path.relative(baseDir, fullPath));
        }
    }
    return results;
}

const existingSizes = new Map<string, number>();

async function uploadFile(relativePath: string) {
    const filePath = path.join(GEO_DIR, relativePath);
    const body = fs.readFileSync(filePath);

    // Skip if existing file matches size
    if (existingSizes.get(relativePath) === body.byteLength) {
        return "skipped";
    }

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await s3.send(
                new PutObjectCommand({
                    Bucket: bucketName,
                    Key: relativePath,
                    Body: body,
                    ContentType: "application/json",
                    CacheControl: "public, max-age=31536000, immutable",
                }),
            );
            return "uploaded";
        } catch (err) {
            lastError = err;
            if (attempt === MAX_RETRIES) break;
            await sleep(RETRY_BASE_MS * attempt);
        }
    }

    throw lastError ?? new Error("Upload failed");
}

async function main() {
    console.log(`Uploading geo layers to R2 bucket "${bucketName}"…`);
    await loadExistingSizes(existingSizes);

    const allFiles = collectFiles(GEO_DIR).sort();
    const total = allFiles.length;
    console.log(`Total files to process: ${total}`);

    let completed = 0;
    let uploadedCount = 0;
    let skippedCount = 0;
    const failedFiles: string[] = [];

    let index = 0;
    async function worker() {
        while (index < allFiles.length) {
            const currentIdx = index++;
            const relativePath = allFiles[currentIdx];
            try {
                const status = await uploadFile(relativePath);
                if (status === "uploaded") uploadedCount++;
                else skippedCount++;
            } catch (err) {
                console.error(`Failed ${relativePath}:`, err);
                failedFiles.push(relativePath);
            }
            completed++;
            if (completed % 50 === 0 || completed === total) {
                const pct = ((completed / total) * 100).toFixed(1);
                console.log(`Progress: [${completed}/${total}] (${pct}%) — uploaded: ${uploadedCount}, skipped: ${skippedCount}, failed: ${failedFiles.length}`);
            }
        }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    console.log("\n--- Sync Summary ---");
    console.log(`Total files: ${total}`);
    console.log(`Uploaded: ${uploadedCount}`);
    console.log(`Skipped (identical): ${skippedCount}`);
    console.log(`Failed: ${failedFiles.length}`);

    if (failedFiles.length > 0) {
        console.error("\nFailed paths:");
        for (const f of failedFiles) console.error(` - ${f}`);
        process.exit(1);
    }

    console.log("\nAll files successfully synced to Cloudflare R2!");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
