// Uploads public/geo JSON files to the Supabase Storage geo bucket.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../public/geo");
const BUCKET = "geo";
const CONCURRENCY = 8;

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function uploadFile(relativePath: string) {
    const filePath = path.join(GEO_DIR, relativePath);
    if (!fs.existsSync(filePath)) {
        console.warn(`  skip (missing): ${relativePath}`);
        return;
    }
    const body = fs.readFileSync(filePath);
    const kb = Math.round(body.byteLength / 1024);

    const { error } = await supabase.storage.from(BUCKET).upload(relativePath, body, {
        contentType: "application/json",
        cacheControl: "3600",
        upsert: true,
    });

    if (error) {
        throw new Error(`${relativePath} (${kb} KB): ${error.message}`);
    }

    console.log(`  ${relativePath} — ${kb} KB`);
}

function listProvinceFiles(): string[] {
    const dir = path.join(GEO_DIR, "municities");
    return fs
        .readdirSync(dir)
        .filter((name) => /^province-\d+\.json$/.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function listBgyFiles(): string[] {
    const dir = path.join(GEO_DIR, "municities/bgy");
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((name) => /^\d+\.json$/.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function uploadMany(relativePaths: string[]) {
    let i = 0;
    async function worker() {
        while (i < relativePaths.length) {
            const idx = i++;
            await uploadFile(relativePaths[idx]);
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

async function main() {
    console.log(`Uploading geo layers to bucket "${BUCKET}"…`);

    await uploadFile("regions.json");
    await uploadFile("provinces.json");
    await uploadFile("municities/meta.json");
    await uploadFile("municities/manifest.json");

    const provinceFiles = listProvinceFiles();
    console.log(`Uploading ${provinceFiles.length} province municity files…`);
    for (const fileName of provinceFiles) {
        await uploadFile(`municities/${fileName}`);
    }

    if (fs.existsSync(path.join(GEO_DIR, "country.json"))) {
        await uploadFile("country.json");
    }

    const bgyMeta = path.join(GEO_DIR, "municities/bgy/meta.json");
    if (fs.existsSync(bgyMeta)) {
        await uploadFile("municities/bgy/meta.json");
        await uploadFile("municities/bgy/manifest.json");

        const bgyFiles = listBgyFiles();
        console.log(`Uploading ${bgyFiles.length} per-municity barangay files (concurrency ${CONCURRENCY})…`);
        await uploadMany(bgyFiles.map((f) => `municities/bgy/${f}`));
    }

    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
