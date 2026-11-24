import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseCsv } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASETS_DIR = path.resolve(__dirname, "../../data-sets");
const GEO_DIR = path.resolve(DATASETS_DIR, "geo");

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

export interface CityNameAliases {
    displayTitle: string;
    shortName: string;
    aliases: string[];
    aliasSlugs: string[];
}

export function getCityNameAliases(name: string): CityNameAliases {
    const trimmed = name.trim();
    const match = trimmed.match(/^City of\s+(.+)$/i);
    if (!match) {
        return {
            displayTitle: trimmed,
            shortName: trimmed,
            aliases: [],
            aliasSlugs: [slugify(trimmed)],
        };
    }

    const core = match[1].trim();
    const shortName = `${core} City`;
    const displayTitle = `${shortName} (${trimmed})`;
    const aliases = [shortName, core];
    return {
        displayTitle,
        shortName,
        aliases,
        aliasSlugs: [slugify(trimmed), slugify(shortName), slugify(core)],
    };
}

export interface GeoBounds {
    lat: number;
    lng: number;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

export interface PsgcExtraMeta {
    oldNames: string | null;
    cityClass: string | null;
    incomeClass: string | null;
    urbanRural: "U" | "R" | null;
    isCapital: boolean;
}

export interface CoaFinanceRecord {
    assets: number | null;
    liabilities: number | null;
    equity: number | null;
    revenue: number | null;
    expenses: number | null;
    surplus: number | null;
}

export interface ElectionCandidateResult {
    name: string;
    votes: number;
    pct: number;
}

export interface ElectionSummary {
    totalVotes: number;
    candidates: ElectionCandidateResult[];
}

export interface ZipOfficeEntry {
    zip: string;
    name: string;
    location: string;
}

export interface PlaceZipInfo {
    primaryZip: string;
    zipRange: string;
    uniqueZips: string[];
    entries: ZipOfficeEntry[];
}

export interface RegionRecord extends RawGeoEntity {
    slug: string;
    urlPath: string;
    provinces: ProvinceRecord[];
    municitiesCount: number;
    bounds: GeoBounds | null;
}

export interface ProvinceRecord extends RawGeoEntity {
    slug: string;
    urlPath: string;
    region: RegionRecord | null;
    municities: MunicityRecord[];
    bounds: GeoBounds | null;
}

export interface MunicityRecord extends RawGeoEntity {
    slug: string;
    urlPath: string;
    region: RegionRecord | null;
    province: ProvinceRecord | null;
    bounds: GeoBounds | null;
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
            bounds: computeGeometryBounds((r as unknown as { geometry?: RawGeometry }).geometry),
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
            bounds: computeGeometryBounds((p as unknown as { geometry?: RawGeometry }).geometry),
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
            bounds: null,
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

function forEachRingPoint(ring: unknown, onPoint: (lng: number, lat: number) => void) {
    if (!Array.isArray(ring)) return;
    for (const pt of ring) {
        if (!Array.isArray(pt) || pt.length < 2) continue;
        const lng = Number(pt[0]);
        const lat = Number(pt[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
            onPoint(lng, lat);
        }
    }
}

function forEachGeometryPoint(geom: RawGeometry | null | undefined, onPoint: (lng: number, lat: number) => void) {
    if (!geom || !Array.isArray(geom.coordinates)) return;
    if (geom.type === "Polygon") {
        for (const ring of geom.coordinates) {
            forEachRingPoint(ring, onPoint);
        }
    } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
            if (!Array.isArray(poly)) continue;
            for (const ring of poly) {
                forEachRingPoint(ring, onPoint);
            }
        }
    }
}

export function computeGeometryBounds(geom: RawGeometry | null | undefined): GeoBounds | null {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let hasPoint = false;

    forEachGeometryPoint(geom, (lng, lat) => {
        hasPoint = true;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    });

    if (!hasPoint) return null;
    return {
        lat: Number(((minLat + maxLat) / 2).toFixed(4)),
        lng: Number(((minLng + maxLng) / 2).toFixed(4)),
        minLat: Number(minLat.toFixed(4)),
        maxLat: Number(maxLat.toFixed(4)),
        minLng: Number(minLng.toFixed(4)),
        maxLng: Number(maxLng.toFixed(4)),
    };
}

function indexGeometryVertices(geom: RawGeometry | null | undefined, psgc: string, vertexIndex: Map<string, Set<string>>) {
    forEachGeometryPoint(geom, (lng, lat) => {
        // ~11m grid cell captures shared NAMRIA/PSA polygon boundary vertices across adjacent LGUs
        const key = `${Math.round(lng * 10000)},${Math.round(lat * 10000)}`;
        let set = vertexIndex.get(key);
        if (!set) {
            set = new Set<string>();
            vertexIndex.set(key, set);
        }
        set.add(psgc);
    });
}

export async function loadPsgcExtraMeta(): Promise<Map<string, PsgcExtraMeta>> {
    const raw = await fs.readFile(path.join(DATASETS_DIR, "data/raw/psgc.csv"), "latin1");
    const rows = parseCsv(raw, {
        skip_empty_lines: true,
        relax_column_count: true,
    }) as string[][];

    const map = new Map<string, PsgcExtraMeta>();
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rawPsgc = (row[0] ?? "").trim();
        if (!rawPsgc) continue;
        const psgc = rawPsgc.padStart(10, "0");
        if (!/^\d{10}$/.test(psgc)) continue;

        const oldNames = (row[4] ?? "").trim() || null;
        const cityClass = (row[5] ?? "").trim() || null;
        const incomeRaw = (row[6] ?? "").trim();
        const incomeClass = incomeRaw && incomeRaw !== "-" ? incomeRaw : null;
        const urRaw = (row[7] ?? "").trim().toUpperCase();
        const urbanRural = urRaw === "U" || urRaw === "R" ? urRaw : null;
        const isCapital = (row[10] ?? "").trim().toLowerCase() === "capital";

        map.set(psgc, { oldNames, cityClass, incomeClass, urbanRural, isCapital });
    }
    return map;
}

export async function loadCoaFinanceCatalog(): Promise<Map<string, CoaFinanceRecord>> {
    const raw = await fs.readFile(path.join(DATASETS_DIR, "data/clean/lgu_finance_2024.csv"), "utf8");
    const rows = parseCsv(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as Record<string, string>[];

    const toPhp = (v: string | undefined): number | null => {
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n * 1000 : null;
    };

    const map = new Map<string, CoaFinanceRecord>();
    for (const row of rows) {
        const psgc = (row.psgc ?? "").trim().padStart(10, "0");
        if (!/^\d{10}$/.test(psgc)) continue;
        map.set(psgc, {
            assets: toPhp(row.assets),
            liabilities: toPhp(row.liabilities),
            equity: toPhp(row.equity),
            revenue: toPhp(row.revenue),
            expenses: toPhp(row.expenses),
            surplus: toPhp(row.surplus_deficit),
        });
    }
    return map;
}

export async function loadElection2022Catalog(): Promise<Map<string, ElectionSummary>> {
    const raw = await fs.readFile(path.join(DATASETS_DIR, "data/clean/elections_2022_president_all.csv"), "utf8");
    const rows = parseCsv(raw, {
        columns: true,
        comment: "#",
        skip_empty_lines: true,
        trim: true,
    }) as Record<string, string>[];

    const map = new Map<string, ElectionSummary>();
    for (const row of rows) {
        const psgc = (row.psgc ?? "").trim().padStart(10, "0");
        if (!/^\d{10}$/.test(psgc)) continue;

        const candidates: { name: string; votes: number }[] = [];
        let totalVotes = 0;

        for (const [key, val] of Object.entries(row)) {
            if (key === "psgc" || key === "label") continue;
            const votes = Number(val);
            if (!Number.isFinite(votes) || votes <= 0) continue;
            totalVotes += votes;
            candidates.push({ name: key, votes });
        }

        if (totalVotes <= 0) continue;
        candidates.sort((a, b) => b.votes - a.votes);
        map.set(psgc, {
            totalVotes,
            candidates: candidates.slice(0, 5).map((c) => ({
                name: c.name,
                votes: c.votes,
                pct: (c.votes / totalVotes) * 100,
            })),
        });
    }
    return map;
}

interface RawZipFileEntry {
    zip?: unknown;
    name?: unknown;
    location?: unknown;
    region?: unknown;
}

function normZipName(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\([^)]*\)/g, " ")
        .replace(/\bsta\.?\s+/g, "santa ")
        .replace(/\bsto\.?\s+/g, "santo ")
        .replace(/\bgen\.?\s+/g, "general ")
        .replace(/\bsen\.?\s+/g, "senator ")
        .replace(/\bpres\.?\s+/g, "president ")
        .replace(/\bdr\.?\s+/g, "doctor ")
        .replace(/\bscience city of\b/g, " ")
        .replace(/\bcity of\b/g, " ")
        .replace(/\bmunicipality of\b/g, " ")
        .replace(/\b(city|province|cpo|po|poblacion|capitol|area|north|south)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function buildPlaceZipInfo(entries: ZipOfficeEntry[]): PlaceZipInfo | null {
    if (entries.length === 0) return null;
    const dedupedMap = new Map<string, ZipOfficeEntry>();
    for (const e of entries) {
        const key = `${e.zip}|${e.name}`;
        if (!dedupedMap.has(key)) dedupedMap.set(key, e);
    }
    const deduped = Array.from(dedupedMap.values()).sort(
        (a, b) => a.zip.localeCompare(b.zip) || a.name.localeCompare(b.name),
    );
    const uniqueZips = Array.from(new Set(deduped.map((e) => e.zip))).sort();
    const minZip = uniqueZips[0];
    const maxZip = uniqueZips[uniqueZips.length - 1];
    const primaryEntry =
        deduped.find((e) => /\b(cpo|capitol|poblacion)\b/i.test(e.name)) ?? deduped[0];
    return {
        primaryZip: primaryEntry.zip,
        zipRange: minZip === maxZip ? minZip : `${minZip}–${maxZip}`,
        uniqueZips,
        entries: deduped,
    };
}

export async function loadZipCodeCatalog(
    provinces: ProvinceRecord[],
    municities: MunicityRecord[],
    psgcMeta: Map<string, PsgcExtraMeta>,
): Promise<Map<string, PlaceZipInfo>> {
    const raw = await fs.readFile(path.join(DATASETS_DIR, "data/clean/philippine-zip-codes.json"), "utf8");
    const parsed = JSON.parse(raw) as { entries?: RawZipFileEntry[] };
    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];

    const validEntries: (ZipOfficeEntry & { region: string; locNorm: string; nameNorm: string; parenNorms: string[] })[] = [];
    for (const item of rawEntries) {
        const zip = String(item.zip ?? "").trim();
        const name = String(item.name ?? "").trim();
        const location = String(item.location ?? "").trim();
        const region = String(item.region ?? "").trim();
        if (!zip || !name || !location || location === "Companies/Institutions") continue;
        const parenNorms = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => normZipName(m[1])).filter(Boolean);
        validEntries.push({
            zip,
            name,
            location,
            region,
            locNorm: normZipName(location),
            nameNorm: normZipName(name),
            parenNorms,
        });
    }

    const PROV_ALIASES: Record<string, string[]> = {
        cotabato: ["north cotabato", "cotabato"],
        "davao de oro": ["davao de oro", "compostela valley"],
        samar: ["samar", "western samar"],
        "maguindanao del norte": ["maguindanao"],
        "maguindanao del sur": ["maguindanao"],
    };

    const LGU_ALIASES: Record<string, string[]> = {
        ozamiz: ["ozamis"],
        "general mariano alvarez": ["gma", "g m a"],
        pinamungajan: ["pinamungahan"],
        "datu odin sinsuat": ["dinaig"],
    };

    const map = new Map<string, PlaceZipInfo>();

    // Index Provinces (and Metro Manila)
    for (const prov of provinces) {
        const pNorm = normZipName(prov.name);
        const isMetroManila = prov.psgc === "1300000000";
        const allowedLocs = new Set([pNorm, ...(PROV_ALIASES[pNorm] ?? [])]);
        const matched = validEntries.filter((e) =>
            isMetroManila ? e.region === "NCR" : allowedLocs.has(e.locNorm),
        );
        const info = buildPlaceZipInfo(matched.map(({ zip, name, location }) => ({ zip, name, location })));
        if (info) map.set(prov.psgc, info);
    }

    // Index Cities & Municipalities
    const provByPsgc = new Map(provinces.map((p) => [p.psgc, p]));
    for (const muni of municities) {
        const mNorm = normZipName(muni.name);
        if (!mNorm) continue;
        const mNorms = new Set([mNorm, ...(LGU_ALIASES[mNorm] ?? [])]);
        const oldNames = psgcMeta.get(muni.psgc)?.oldNames;
        if (oldNames) {
            for (const part of oldNames.split(/[;/,]/)) {
                const n = normZipName(part);
                if (n && n.length >= 3) mNorms.add(n);
            }
        }

        const isNcr = muni.region_psgc === "1300000000";
        let matched: typeof validEntries;
        if (isNcr) {
            matched = validEntries.filter((e) => e.region === "NCR" && mNorms.has(e.locNorm));
        } else {
            const prov = muni.province_psgc ? provByPsgc.get(muni.province_psgc) : undefined;
            const pNorm = prov ? normZipName(prov.name) : "";
            const allowedLocs = new Set([pNorm, ...(PROV_ALIASES[pNorm] ?? [])]);
            matched = validEntries.filter((e) => {
                if (!allowedLocs.has(e.locNorm)) return false;
                for (const candidate of mNorms) {
                    if (
                        e.nameNorm === candidate ||
                        e.nameNorm.startsWith(`${candidate} `) ||
                        e.parenNorms.includes(candidate)
                    ) {
                        return true;
                    }
                }
                return false;
            });
        }

        const info = buildPlaceZipInfo(matched.map(({ zip, name, location }) => ({ zip, name, location })));
        if (info) map.set(muni.psgc, info);
    }

    return map;
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
                    if (item && typeof item.psgc === "string") {
                        const muniRec = muniByPsgc.get(item.psgc);
                        if (muniRec) {
                            const geom = item.geometry as RawGeometry;
                            indexGeometryVertices(geom, item.psgc, vertexIndex);
                            if (!muniRec.bounds) {
                                muniRec.bounds = computeGeometryBounds(geom);
                            }
                        }
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
