import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "fast-csv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function parseCsv(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const rows: any[] = [];
        fs.createReadStream(filePath)
            .pipe(parse({ headers: true }))
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve(rows))
            .on("error", (err) => reject(err));
    });
}

// CSV column names match DB column names exactly:
//   geometry  → geometry  (PostGIS WKB hex, passed as-is)
//   geojson   → geojson   (jsonb, parsed from string)

function mapRegion(row: any) {
    return {
        id: Number(row.id),
        code: row.code,
        name: row.name,
        geometry: row.geometry || null,
        geojson: row.geojson ? (typeof row.geojson === "string" ? JSON.parse(row.geojson) : row.geojson) : null,
    };
}

function mapProvince(row: any) {
    return {
        id: Number(row.id),
        code: row.code,
        name: row.name,
        region_id: Number(row.region_id),
        geometry: row.geometry || null,
        geojson: row.geojson ? (typeof row.geojson === "string" ? JSON.parse(row.geojson) : row.geojson) : null,
    };
}

function mapMunicity(row: any) {
    return {
        id: Number(row.id),
        name: row.name,
        code: row.code,
        type: row.type,
        province_id: row.province_id ? Number(row.province_id) : null,
        region_id: row.region_id ? Number(row.region_id) : null,
        geometry: row.geometry || null,
        geojson: row.geojson ? (typeof row.geojson === "string" ? JSON.parse(row.geojson) : row.geojson) : null,
    };
}

async function seedTable<T>(tableName: string, fileName: string, mapper: (row: any) => T, batchSize = 100) {
    const csvPath = path.resolve(__dirname, fileName);
    if (!fs.existsSync(csvPath)) {
        console.warn(`⚠️  Skipped ${tableName}: ${fileName} not found.`);
        return;
    }

    console.log(`\n读取 Reading data for ${tableName}...`);
    const raw = await parseCsv(csvPath);
    const records = raw.map(mapper);
    console.log(`🚀 Seeding ${records.length} records into ${tableName} in batches of ${batchSize}...`);

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase.from(tableName).insert(batch);
        if (error) {
            console.error(`  ❌ Error inserting batch at index ${i}:`, error.message);
            throw error;
        }
        console.log(`  ✅ Inserted rows ${i + 1}–${Math.min(i + batchSize, records.length)} of ${records.length}`);
    }

    console.log(`  ✅ Done seeding ${tableName}!`);
}

async function main() {
    try {
        await seedTable("regions", "regions.csv", mapRegion, 50);
        await seedTable("provinces", "provinces.csv", mapProvince, 50);
        await seedTable("municities", "municities.csv", mapMunicity, 100);

        console.log("\n🏁 Remote cloud data pipeline successfully initialized!");
    } catch (err: any) {
        console.error("❌ Seeding execution halted:", err.message);
    }
}

main();
