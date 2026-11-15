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
        const label = band.age.trim().toLowerCase();
        const count = Number.isFinite(band.both) ? band.both : (band.male || 0) + (band.female || 0);
        if (label.startsWith("under") || label === "0-4" || label === "5-9" || label === "10-14") {
            young += count;
        } else if (
            label === "65-69" ||
            label === "70-74" ||
            label === "75-79" ||
            label.startsWith("80")
        ) {
            senior += count;
        } else {
            working += count;
        }
    }

    const total = young + working + senior;
    if (total <= 0) return null;
    return {
        young,
        working,
        senior,
        total,
        youngPct: (young / total) * 100,
        workingPct: (working / total) * 100,
        seniorPct: (senior / total) * 100,
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
