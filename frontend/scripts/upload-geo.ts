// Uploads public/geo JSON files to the Supabase Storage geo bucket.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.join(__dirname, "../public/geo");
const BUCKET = "geo";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function uploadFile(relativePath: string) {
    const filePath = path.join(GEO_DIR, relativePath);
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

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(relativePath);
    console.log(`  ${relativePath} — ${kb} KB → ${urlData.publicUrl}`);
}

function listProvinceFiles(): string[] {
    const dir = path.join(GEO_DIR, "municities");
    return fs
        .readdirSync(dir)
        .filter((name) => /^province-\d+\.json$/.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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

    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
