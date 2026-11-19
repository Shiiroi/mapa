import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.resolve(__dirname, "../../data-sets/geo");

export interface AgeSexBand {
    age: string;
    both: number;
    male: number;
    female: number;
}

export interface RawGeoEntity {
    psgc: string;
    correspondence: string | null;
    name: string;
    geo_lvl: string;
    city_lvl: string | null;
    region_psgc?: string | null;
    province_psgc?: string | null;
    pop_2010: number | null;
    pop_2015: number | null;
    pop_2020: number | null;
    pop_2024: number | null;
    pop_male_2020: number | null;
    pop_female_2020: number | null;
    age_sex_2020: AgeSexBand[] | null;
    area_km2: number | null;
    density_2024: number | null;
    pct_change_2020_2024: number | null;
    assets_2024: number | null;
    gdp_2022: number | null;
    gdp_2023: number | null;
    gdp_2024: number | null;
}

// Mirrors src/lib/slugUtils.ts so pre-rendered paths match runtime routes identically.
export function slugify(name: string): string {
    return name
        .normalize("NFKD")
        .replace(/\p{Diacritic}+/gu, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[''`]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export interface RegionRecord extends RawGeoEntity {
    slug: string;
    urlPath: string;
    provinces: ProvinceRecord[];
    municitiesCount: number;
}

export interface ProvinceRecord extends RawGeoEntity {
    slug: string;
    urlPath: string;
    region: RegionRecord | null;
    municities: MunicityRecord[];
}

export interface MunicityRecord extends RawGeoEntity {
    slug: string;
    urlPath: string;
    region: RegionRecord | null;
    province: ProvinceRecord | null;
}

export interface GeoCatalog {
    regions: RegionRecord[];
    provinces: ProvinceRecord[];
    municities: MunicityRecord[];
}

export interface BarangayRecord {
    psgc: string;
    correspondence: string | null;
    name: string;
    pop_2015: number | null;
    pop_2020: number | null;
    pop_2024: number | null;
    area_km2: number | null;
    density_2024: number | null;
    pct_change_2020_2024: number | null;
}

export interface RankInfo {
    rank: number;
    total: number;
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`Expected array in ${filePath}`);
    }
    return parsed as T[];
}

export function summarizeAgeCohorts(bands: AgeSexBand[] | null | undefined) {
    if (!bands || bands.length === 0) return null;
    let young = 0;
    let working = 0;
    let senior = 0;

    for (const band of bands) {
        const m = band.age.match(/\d+/);
        const lower = m ? Number(m[0]) : 0;
        const count = Number.isFinite(band.both) ? band.both : (band.male || 0) + (band.female || 0);
        if (lower < 15) {
            young += count;
        } else if (lower < 65) {
            working += count;
        } else {
            senior += count;
        }
    }

    const total = young + working + senior;
    if (total <= 0) return null;
    const dependencyRatio = working > 0 ? ((young + senior) / working) * 100 : null;
    return {
        young,
        working,
        senior,
        total,
        youngPct: (young / total) * 100,
        workingPct: (working / total) * 100,
        seniorPct: (senior / total) * 100,
        dependencyRatio,
    };
}

export async function loadGeoCatalog(): Promise<GeoCatalog> {
    const [rawRegions, rawProvinces, rawMunicities] = await Promise.all([
        readJsonArray<RawGeoEntity>(path.join(GEO_DIR, "regions.json")),
        readJsonArray<RawGeoEntity>(path.join(GEO_DIR, "provinces.json")),
        readJsonArray<RawGeoEntity>(path.join(GEO_DIR, "municities/meta.json")),
    ]);

    const regionMap = new Map<string, RegionRecord>();
    const regions: RegionRecord[] = rawRegions.map((r) => {
        const slug = slugify(r.name);
        const rec: RegionRecord = {
            ...r,
            slug,
            urlPath: `/${slug}`,
            provinces: [],
            municitiesCount: 0,
        };
        regionMap.set(r.psgc, rec);
        return rec;
    });

    const provinceMap = new Map<string, ProvinceRecord>();
    const provinces: ProvinceRecord[] = rawProvinces.map((p) => {
        const reg = p.region_psgc ? regionMap.get(p.region_psgc) ?? null : null;
        const slug = slugify(p.name);
        const rec: ProvinceRecord = {
            ...p,
            slug,
            urlPath: reg ? `${reg.urlPath}/${slug}` : `/${slug}`,
            region: reg,
            municities: [],
        };
        provinceMap.set(p.psgc, rec);
        if (reg) reg.provinces.push(rec);
        return rec;
    });

    const municities: MunicityRecord[] = rawMunicities.map((m) => {
        const reg = m.region_psgc ? regionMap.get(m.region_psgc) ?? null : null;
        const prov = m.province_psgc ? provinceMap.get(m.province_psgc) ?? null : null;
        const slug = slugify(m.name);
        const urlPath = prov ? `${prov.urlPath}/${slug}` : reg ? `${reg.urlPath}/${slug}` : `/${slug}`;
        const rec: MunicityRecord = {
            ...m,
            slug,
            urlPath,
            region: reg,
            province: prov,
        };
        if (prov) prov.municities.push(rec);
        if (reg) reg.municitiesCount += 1;
        return rec;
    });

    return { regions, provinces, municities };
}

export async function loadMunicityBarangays(municityPsgc: string): Promise<BarangayRecord[]> {
    const filePath = path.join(GEO_DIR, "municities/bgy", `${municityPsgc}.json`);
    let raw: string;
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((b: Record<string, unknown>) => ({
        psgc: String(b.psgc ?? ""),
        correspondence: typeof b.correspondence === "string" ? b.correspondence : null,
        name: String(b.name ?? ""),
        pop_2015: typeof b.pop_2015 === "number" ? b.pop_2015 : null,
        pop_2020: typeof b.pop_2020 === "number" ? b.pop_2020 : null,
        pop_2024: typeof b.pop_2024 === "number" ? b.pop_2024 : null,
        area_km2: typeof b.area_km2 === "number" ? b.area_km2 : null,
        density_2024: typeof b.density_2024 === "number" ? b.density_2024 : null,
        pct_change_2020_2024: typeof b.pct_change_2020_2024 === "number" ? b.pct_change_2020_2024 : null,
    }));
}

export function computeMetricRanks<T extends { psgc: string }>(
    items: T[],
    getValue: (item: T) => number | null,
): Map<string, RankInfo> {
    const valid = items
        .map((item) => ({ psgc: item.psgc, val: getValue(item) }))
        .filter((x): x is { psgc: string; val: number } => x.val != null && Number.isFinite(x.val))
        .sort((a, b) => b.val - a.val);

    const ranks = new Map<string, RankInfo>();
    const total = valid.length;
    valid.forEach((entry, idx) => {
        ranks.set(entry.psgc, { rank: idx + 1, total });
    });
    return ranks;
}

interface RawGeometry {
    type?: string;
    coordinates?: unknown;
}

function collectRingVertices(ring: unknown, psgc: string, vertexIndex: Map<string, Set<string>>) {
    if (!Array.isArray(ring)) return;
    for (const pt of ring) {
        if (!Array.isArray(pt) || pt.length < 2) continue;
        const lng = Number(pt[0]);
        const lat = Number(pt[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        // ~11m grid cell captures shared NAMRIA/PSA polygon boundary vertices across adjacent LGUs
        const key = `${Math.round(lng * 10000)},${Math.round(lat * 10000)}`;
        let set = vertexIndex.get(key);
        if (!set) {
            set = new Set<string>();
            vertexIndex.set(key, set);
        }
        set.add(psgc);
    }
}

function indexGeometryVertices(geom: RawGeometry | null | undefined, psgc: string, vertexIndex: Map<string, Set<string>>) {
    if (!geom || !Array.isArray(geom.coordinates)) return;
    if (geom.type === "Polygon") {
        for (const ring of geom.coordinates) {
            collectRingVertices(ring, psgc, vertexIndex);
        }
    } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
            if (!Array.isArray(poly)) continue;
            for (const ring of poly) {
                collectRingVertices(ring, psgc, vertexIndex);
            }
        }
    }
}

export async function computeMunicityAdjacency(
    municities: MunicityRecord[],
): Promise<Map<string, MunicityRecord[]>> {
    const muniByPsgc = new Map(municities.map((m) => [m.psgc, m]));
    const munisDir = path.join(GEO_DIR, "municities");
    const entries = await fs.readdir(munisDir);
    const provFiles = entries.filter((f) => f.startsWith("province-") && f.endsWith(".json"));

    const vertexIndex = new Map<string, Set<string>>();
    const BATCH = 16;
    for (let i = 0; i < provFiles.length; i += BATCH) {
        const slice = provFiles.slice(i, i + BATCH);
        await Promise.all(
            slice.map(async (file) => {
                const raw = await fs.readFile(path.join(munisDir, file), "utf8");
                const list = JSON.parse(raw);
                if (!Array.isArray(list)) return;
                for (const item of list) {
                    if (item && typeof item.psgc === "string" && muniByPsgc.has(item.psgc)) {
                        indexGeometryVertices(item.geometry as RawGeometry, item.psgc, vertexIndex);
                    }
                }
            }),
        );
    }

    const pairCounts = new Map<string, Map<string, number>>();
    for (const psgcs of vertexIndex.values()) {
        if (psgcs.size < 2) continue;
        const arr = Array.from(psgcs);
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                const a = arr[i];
                const b = arr[j];
                let mapA = pairCounts.get(a);
                if (!mapA) {
                    mapA = new Map();
                    pairCounts.set(a, mapA);
                }
                mapA.set(b, (mapA.get(b) ?? 0) + 1);

                let mapB = pairCounts.get(b);
                if (!mapB) {
                    mapB = new Map();
                    pairCounts.set(b, mapB);
                }
                mapB.set(a, (mapB.get(a) ?? 0) + 1);
            }
        }
    }

    const adjacency = new Map<string, MunicityRecord[]>();
    for (const [psgc, counts] of pairCounts.entries()) {
        const neighbors: MunicityRecord[] = [];
        for (const [otherPsgc, sharedVertices] of counts.entries()) {
            if (sharedVertices >= 2) {
                const rec = muniByPsgc.get(otherPsgc);
                if (rec) neighbors.push(rec);
            }
        }
        neighbors.sort((a, b) => a.name.localeCompare(b.name));
        adjacency.set(psgc, neighbors);
    }
    return adjacency;
}
