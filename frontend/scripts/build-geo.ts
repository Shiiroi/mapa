// Rebuilds public/geo JSON into PSGC-keyed shape, enriched from public/psgc.csv.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public");
const GEO_DIR = path.join(PUBLIC_DIR, "geo");
const MUNI_DIR = path.join(GEO_DIR, "municities");
const PSGC_CSV = path.join(PUBLIC_DIR, "psgc.csv");

interface PsgcRow {
    correspondence: string | null;
    geo_lvl: string;
    city_lvl: string | null;
}

// Inputs may be the original integer-keyed shape OR an already-rebuilt PSGC shape.
// Supporting both keeps this transform idempotent (safe to re-run).
interface OldRegion {
    id?: number;
    code?: string;
    psgc?: string;
    name: string;
    geometry: unknown;
}

interface OldProvince {
    id?: number;
    code?: string;
    psgc?: string;
    name: string;
    region_id?: number;
    region_psgc?: string;
    geometry: unknown;
}

interface OldMunicity {
    id?: number;
    code?: string;
    psgc?: string;
    name: string;
    province_id?: number | null;
    province_psgc?: string | null;
    region_id?: number | null;
    region_psgc?: string | null;
    type?: "city" | "municipality";
    geo_lvl?: string;
    geometry?: unknown;
}

function padPsgc(code: string | number): string {
    return String(code).trim().padStart(10, "0");
}

// Resolves the canonical 10-digit PSGC from either the original `code` or a rebuilt `psgc`.
function resolvePsgc(row: { code?: string; psgc?: string }): string {
    const raw = row.psgc ?? row.code;
    if (raw == null || String(raw).trim() === "") {
        throw new Error(`Row missing code/psgc: ${JSON.stringify(row).slice(0, 120)}`);
    }
    return padPsgc(raw);
}

function writeJson(relativePath: string, data: unknown) {
    const outPath = path.join(GEO_DIR, relativePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(data));
    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`  ${relativePath} — ${kb} KB`);
}

function loadPsgcMap(): Map<string, PsgcRow> {
    const raw = fs.readFileSync(PSGC_CSV);
    const rows = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
    }) as Record<string, string>[];

    const map = new Map<string, PsgcRow>();
    for (const row of rows) {
        const psgc = padPsgc(row["10-digit PSGC"]);
        const correspondence = (row["Correspondence Code"] ?? "").trim() || null;
        const geo_lvl = (row["Geographic Level"] ?? "").trim();
        const cityClass = (row["City Class"] ?? "").trim();
        const city_lvl = cityClass || null;
        if (geo_lvl) {
            map.set(psgc, { correspondence, geo_lvl, city_lvl });
        }
    }
    return map;
}

function lookupPsgc(map: Map<string, PsgcRow>, code: string | number): PsgcRow | undefined {
    return map.get(padPsgc(code));
}

function muniGeoLvl(
    psgcRow: PsgcRow | undefined,
    oldType: "city" | "municipality" | undefined,
    existingGeoLvl: string | undefined,
): string {
    if (psgcRow?.geo_lvl === "City" || psgcRow?.geo_lvl === "Mun") return psgcRow.geo_lvl;
    if (existingGeoLvl === "City" || existingGeoLvl === "Mun") return existingGeoLvl;
    return oldType === "city" ? "City" : "Mun";
}

async function main() {
    console.log("Building PSGC-keyed geo layers…");

    const psgcMap = loadPsgcMap();
    console.log(`  Loaded ${psgcMap.size} PSGC rows from CSV`);

    const oldRegions = JSON.parse(fs.readFileSync(path.join(GEO_DIR, "regions.json"), "utf8")) as OldRegion[];
    const oldProvinces = JSON.parse(fs.readFileSync(path.join(GEO_DIR, "provinces.json"), "utf8")) as OldProvince[];
    const oldMeta = JSON.parse(fs.readFileSync(path.join(MUNI_DIR, "meta.json"), "utf8")) as OldMunicity[];

    const regionIdToPsgc = new Map<number, string>();
    for (const r of oldRegions) {
        if (r.id != null) regionIdToPsgc.set(r.id, resolvePsgc(r));
    }

    const provinceIdToPsgc = new Map<number, string>();
    for (const p of oldProvinces) {
        if (p.id != null) provinceIdToPsgc.set(p.id, resolvePsgc(p));
    }

    const regions = oldRegions.map((r) => {
        const psgc = resolvePsgc(r);
        const row = lookupPsgc(psgcMap, psgc);
        return {
            psgc,
            correspondence: row?.correspondence ?? null,
            name: r.name,
            geo_lvl: "Reg" as const,
            city_lvl: null,
            geometry: r.geometry,
        };
    });

    // Resolves a province's parent region psgc from either an integer id or a rebuilt region_psgc.
    function provinceRegionPsgc(p: OldProvince): string {
        const fromId = p.region_id != null ? regionIdToPsgc.get(p.region_id) : undefined;
        const region_psgc = fromId ?? p.region_psgc;
        if (!region_psgc) throw new Error(`Province ${p.name}: cannot resolve region psgc`);
        return region_psgc;
    }

    const provinces = oldProvinces.map((p) => {
        const psgc = resolvePsgc(p);
        const row = lookupPsgc(psgcMap, psgc);
        return {
            psgc,
            correspondence: row?.correspondence ?? null,
            name: p.name,
            geo_lvl: "Prov" as const,
            city_lvl: null,
            region_psgc: provinceRegionPsgc(p),
            geometry: p.geometry,
        };
    });

    const provincePsgcToRegionPsgc = new Map<string, string>();
    for (const p of provinces) {
        provincePsgcToRegionPsgc.set(p.psgc, p.region_psgc);
    }

    // Resolves a municity's parent psgcs from either integer ids or rebuilt psgc fields.
    function muniParents(m: OldMunicity): { province_psgc: string | null; region_psgc: string | null } {
        const province_psgc =
            (m.province_id != null ? provinceIdToPsgc.get(m.province_id) : undefined) ??
            m.province_psgc ??
            null;
        const region_psgc =
            (province_psgc ? provincePsgcToRegionPsgc.get(province_psgc) : null) ??
            (m.region_id != null ? regionIdToPsgc.get(m.region_id) : undefined) ??
            m.region_psgc ??
            null;
        return { province_psgc, region_psgc };
    }

    const meta = oldMeta.map((m) => {
        const psgc = resolvePsgc(m);
        const row = lookupPsgc(psgcMap, psgc);
        const { province_psgc, region_psgc } = muniParents(m);
        return {
            psgc,
            correspondence: row?.correspondence ?? null,
            name: m.name,
            geo_lvl: muniGeoLvl(row, m.type, m.geo_lvl),
            city_lvl: row?.city_lvl ?? null,
            province_psgc,
            region_psgc,
        };
    });

    writeJson("regions.json", regions);
    writeJson("provinces.json", provinces);
    writeJson("municities/meta.json", meta);

    // Drive off the rebuilt provinces (each has a psgc); source file may be id- or psgc-named.
    const provincePsgcs: string[] = [];
    const writtenFiles = new Set<string>();

    console.log(`Rewriting ${oldProvinces.length} province municity files…`);
    for (let i = 0; i < oldProvinces.length; i++) {
        const provincePsgc = provinces[i].psgc;
        const oldId = oldProvinces[i].id;

        const idPath = oldId != null ? path.join(MUNI_DIR, `province-${oldId}.json`) : null;
        const psgcPath = path.join(MUNI_DIR, `province-${provincePsgc}.json`);
        const sourcePath = idPath && fs.existsSync(idPath) ? idPath : psgcPath;
        if (!fs.existsSync(sourcePath)) {
            console.warn(`  Missing source for province ${provincePsgc}`);
            continue;
        }
        provincePsgcs.push(provincePsgc);

        const munis = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as OldMunicity[];
        const transformed = munis.map((m) => {
            const psgc = resolvePsgc(m);
            const row = lookupPsgc(psgcMap, psgc);
            const { province_psgc, region_psgc } = muniParents(m);
            return {
                psgc,
                correspondence: row?.correspondence ?? null,
                name: m.name,
                geo_lvl: muniGeoLvl(row, m.type, m.geo_lvl),
                city_lvl: row?.city_lvl ?? null,
                province_psgc,
                region_psgc,
                geometry: m.geometry,
            };
        });

        writeJson(`municities/province-${provincePsgc}.json`, transformed);
        writtenFiles.add(`province-${provincePsgc}.json`);
    }

    provincePsgcs.sort();
    writeJson("municities/manifest.json", { provincePsgcs });

    // Remove any stale province files (e.g. old integer-named ones) not just written.
    for (const file of fs.readdirSync(MUNI_DIR)) {
        if (/^province-.+\.json$/.test(file) && !writtenFiles.has(file)) {
            fs.unlinkSync(path.join(MUNI_DIR, file));
            console.log(`  removed stale ${file}`);
        }
    }

    console.log(`Done → ${GEO_DIR}`);
    console.log(`  regions: ${regions.length}, provinces: ${provinces.length}, municities: ${meta.length}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
