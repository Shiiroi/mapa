// Rebuilds public/geo JSON into PSGC-keyed shape, enriched from public/psgc.csv.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { attachStats, computeDensity, computePctChange, createStatsContext, type DivisionStatsFields } from "./lib/stats.js";

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

// Country has no row in psgc.csv, so its population is summed from the regions
// (which is, by construction, the national total).
type CountryPopAggregate = Pick<DivisionStatsFields, "pop_2015" | "pop_2020" | "pop_2024">;

// Sums a population field across rows, returning null when no row has a value.
function sumPop(rows: DivisionStatsFields[], key: keyof CountryPopAggregate): number | null {
    let total = 0;
    let seen = false;
    for (const row of rows) {
        const value = row[key];
        if (typeof value === "number") {
            total += value;
            seen = true;
        }
    }
    return seen ? total : null;
}

// National population totals derived by summing all region rows.
function aggregateCountryPop(regions: DivisionStatsFields[]): CountryPopAggregate {
    return {
        pop_2015: sumPop(regions, "pop_2015"),
        pop_2020: sumPop(regions, "pop_2020"),
        pop_2024: sumPop(regions, "pop_2024"),
    };
}

// Resolves the canonical 10-digit PSGC from either the original `code` or a rebuilt `psgc`.
function resolvePsgc(row: { code?: string; psgc?: string }): string {
    const raw = row.psgc ?? row.code;
    if (raw == null || String(raw).trim() === "") {
        throw new Error(`Row missing code/psgc: ${JSON.stringify(row).slice(0, 120)}`);
    }
    return padPsgc(raw);
}

// Writes pretty-printed JSON under GEO_DIR, creating parent dirs and logging size.
function writeJson(relativePath: string, data: unknown) {
    const outPath = path.join(GEO_DIR, relativePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(data));
    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`  ${relativePath} — ${kb} KB`);
}

// Indexes psgc.csv by PSGC → correspondence code, geographic level, and city class.
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

// Resolves a municity's geo level (City/Mun), preferring the CSV then existing/old fields.
function muniGeoLvl(
    psgcRow: PsgcRow | undefined,
    oldType: "city" | "municipality" | undefined,
    existingGeoLvl: string | undefined,
): string {
    if (psgcRow?.geo_lvl === "City" || psgcRow?.geo_lvl === "Mun") return psgcRow.geo_lvl;
    if (existingGeoLvl === "City" || existingGeoLvl === "Mun") return existingGeoLvl;
    return oldType === "city" ? "City" : "Mun";
}

// Rebuilds region/province/municity geo JSON into PSGC-keyed, stats-enriched files.
async function main() {
    console.log("Building PSGC-keyed geo layers…");

    const psgcMap = loadPsgcMap();
    console.log(`  Loaded ${psgcMap.size} PSGC rows from CSV`);
    const statsCtx = createStatsContext(PUBLIC_DIR);
    console.log(`  Loaded population stats from psgc.csv + psgc0.csv`);

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
        return attachStats(
            {
                psgc,
                correspondence: row?.correspondence ?? null,
                name: r.name,
                geo_lvl: "Reg" as const,
                city_lvl: null,
                geometry: r.geometry,
            },
            statsCtx,
        );
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
        return attachStats(
            {
                psgc,
                correspondence: row?.correspondence ?? null,
                name: p.name,
                geo_lvl: "Prov" as const,
                city_lvl: null,
                region_psgc: provinceRegionPsgc(p),
                geometry: p.geometry,
            },
            statsCtx,
        );
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
        return attachStats(
            {
                psgc,
                correspondence: row?.correspondence ?? null,
                name: m.name,
                geo_lvl: muniGeoLvl(row, m.type, m.geo_lvl),
                city_lvl: row?.city_lvl ?? null,
                province_psgc,
                region_psgc,
            },
            statsCtx,
        );
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
            return attachStats(
                {
                    psgc,
                    correspondence: row?.correspondence ?? null,
                    name: m.name,
                    geo_lvl: muniGeoLvl(row, m.type, m.geo_lvl),
                    city_lvl: row?.city_lvl ?? null,
                    province_psgc,
                    region_psgc,
                    geometry: m.geometry,
                },
                statsCtx,
            );
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

    const countryPop = aggregateCountryPop(regions);
    console.log(
        `  Country totals (summed from regions): 2015=${countryPop.pop_2015}, 2020=${countryPop.pop_2020}, 2024=${countryPop.pop_2024}`,
    );

    enrichCountryAndBarangays(statsCtx, countryPop);
}

// Enriches country.json (with region-summed totals) and every barangay file with stats.
function enrichCountryAndBarangays(statsCtx: ReturnType<typeof createStatsContext>, countryPop: CountryPopAggregate) {
    const countryPath = path.join(GEO_DIR, "country.json");
    if (fs.existsSync(countryPath)) {
        const country = JSON.parse(fs.readFileSync(countryPath, "utf8")) as Record<string, unknown>;
        const base = attachStats(
            {
                psgc: String(country.psgc ?? "0000000000"),
                correspondence: (country.correspondence as string | null) ?? null,
                name: String(country.name ?? "Philippines"),
                geo_lvl: "Country",
                city_lvl: null,
                geometry: country.geometry,
            },
            statsCtx,
            typeof country.area_km2 === "number" ? country.area_km2 : null,
        );
        // Neither CSV has a national row; the all-zero country PSGC can spuriously
        // match a blank-coded CSV row, so always use the region-summed totals.
        const pop_2015 = countryPop.pop_2015;
        const pop_2020 = countryPop.pop_2020;
        const pop_2024 = countryPop.pop_2024;
        const enriched = {
            ...base,
            pop_2015,
            pop_2020,
            pop_2024,
            density_2024: computeDensity(pop_2024, base.area_km2),
            pct_change_2020_2024: computePctChange(pop_2020, pop_2024),
        };
        writeJson("country.json", enriched);
    }

    const bgyDir = path.join(MUNI_DIR, "bgy");
    if (!fs.existsSync(bgyDir)) return;

    let bgyFiles = 0;
    for (const file of fs.readdirSync(bgyDir)) {
        if (!file.endsWith(".json") || file === "meta.json" || file === "manifest.json" || file.startsWith("_")) {
            continue;
        }
        const filePath = path.join(bgyDir, file);
        const rows = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<Record<string, unknown>>;
        const enriched = rows.map((row) =>
            attachStats(
                {
                    psgc: String(row.psgc),
                    correspondence: (row.correspondence as string | null) ?? null,
                    name: String(row.name),
                    geo_lvl: String(row.geo_lvl ?? "Bgy"),
                    city_lvl: (row.city_lvl as string | null) ?? null,
                    municity_psgc: String(row.municity_psgc),
                    province_psgc: (row.province_psgc as string | null) ?? null,
                    region_psgc: (row.region_psgc as string | null) ?? null,
                    note: (row.note as string | null | undefined) ?? null,
                    geometry: row.geometry,
                },
                statsCtx,
                typeof row.area_km2 === "number" ? row.area_km2 : null,
            ),
        );
        fs.writeFileSync(filePath, JSON.stringify(enriched));
        bgyFiles++;
    }

    const metaPath = path.join(bgyDir, "meta.json");
    if (fs.existsSync(metaPath)) {
        const metaRows = JSON.parse(fs.readFileSync(metaPath, "utf8")) as Array<Record<string, unknown>>;
        const enrichedMeta = metaRows.map((row) =>
            attachStats(
                {
                    psgc: String(row.psgc),
                    correspondence: (row.correspondence as string | null) ?? null,
                    name: String(row.name),
                    geo_lvl: String(row.geo_lvl ?? "Bgy"),
                    city_lvl: (row.city_lvl as string | null) ?? null,
                    municity_psgc: String(row.municity_psgc),
                    province_psgc: (row.province_psgc as string | null) ?? null,
                    region_psgc: (row.region_psgc as string | null) ?? null,
                    note: (row.note as string | null | undefined) ?? null,
                },
                statsCtx,
                typeof row.area_km2 === "number" ? row.area_km2 : null,
            ),
        );
        fs.writeFileSync(metaPath, JSON.stringify(enrichedMeta));
    }

    if (bgyFiles > 0) {
        console.log(`  Enriched stats on country + ${bgyFiles} barangay files`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
