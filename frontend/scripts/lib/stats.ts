// Population + area helpers for geo enrichment (psgc.csv + psgc0.csv).

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import area from "@turf/area";
import type { Geometry } from "geojson";

export interface DivisionStatsFields {
    pop_2010: number | null;
    pop_2015: number | null;
    pop_2020: number | null;
    pop_2024: number | null;
    pop_male_2020: number | null;
    pop_female_2020: number | null;
    age_sex_2020: { age: string; both: number; male: number; female: number }[] | null;
    area_km2: number | null;
    density_2024: number | null;
    pct_change_2020_2024: number | null;
    assets_2024: number | null;
    gdp_2022: number | null;
    gdp_2023: number | null;
    gdp_2024: number | null;
}

interface PopVintageRow {
    pop_2015: number | null;
    pop_2020: number | null;
}

interface Pop2024Row {
    pop_2024: number | null;
    correspondence: string | null;
}

// Parses a comma-grouped population string into an integer, or null if non-numeric.
export function parsePop(raw: string | undefined | null): number | null {
    if (raw == null) return null;
    const cleaned = String(raw).replace(/,/g, "").trim();
    if (!cleaned || !/^\d+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

function padPsgc(code: string | number): string {
    return String(code).trim().padStart(10, "0");
}

function padCorrespondence(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, "");
    return digits ? digits.padStart(9, "0") : null;
}

// Finds the first column whose (whitespace-normalized) header matches the pattern.
function findPopColumn(row: Record<string, string>, pattern: RegExp): string | undefined {
    for (const key of Object.keys(row)) {
        if (pattern.test(key.replace(/\s+/g, " "))) return row[key];
    }
    return undefined;
}

// Indexes psgc.csv by PSGC → 2024 population and correspondence code.
export function loadPop2024Map(csvPath: string): Map<string, Pop2024Row> {
    const raw = fs.readFileSync(csvPath);
    const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true }) as Record<
        string,
        string
    >[];
    const map = new Map<string, Pop2024Row>();
    for (const row of rows) {
        const psgc = padPsgc(row["10-digit PSGC"]);
        const pop = parsePop(findPopColumn(row, /2024.*population/i));
        const correspondence = padCorrespondence(row["Correspondence Code"]);
        if (pop != null || correspondence) {
            map.set(psgc, { pop_2024: pop, correspondence });
        }
    }
    return map;
}

// Indexes psgc0.csv by both PSGC and correspondence code → 2015/2020 populations.
export function loadHistoricalPopMaps(csvPath: string): {
    byPsgc: Map<string, PopVintageRow>;
    byCorrespondence: Map<string, PopVintageRow>;
} {
    const raw = fs.readFileSync(csvPath);
    const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true }) as Record<
        string,
        string
    >[];
    const byPsgc = new Map<string, PopVintageRow>();
    const byCorrespondence = new Map<string, PopVintageRow>();
    for (const row of rows) {
        const psgc = padPsgc(row["10-digit PSGC"]);
        const pop2015 = parsePop(findPopColumn(row, /2015.*population/i));
        const pop2020 = parsePop(findPopColumn(row, /2020.*population/i));
        const correspondence = padCorrespondence(row["Correspondence Code"]);
        const entry: PopVintageRow = { pop_2015: pop2015, pop_2020: pop2020 };
        if (pop2015 != null || pop2020 != null) {
            byPsgc.set(psgc, entry);
            if (correspondence) byCorrespondence.set(correspondence, entry);
        }
    }
    return { byPsgc, byCorrespondence };
}

// Looks up historical population by PSGC, falling back to correspondence code.
export function resolveHistoricalPop(
    psgc: string,
    correspondence: string | null,
    byPsgc: Map<string, PopVintageRow>,
    byCorrespondence: Map<string, PopVintageRow>,
): PopVintageRow {
    const direct = byPsgc.get(psgc);
    if (direct) return direct;
    if (correspondence) {
        const corr = byCorrespondence.get(correspondence);
        if (corr) return corr;
    }
    return { pop_2015: null, pop_2020: null };
}

// Percent change in population from 2020 to 2024.
export function computePctChange(pop2020: number | null, pop2024: number | null): number | null {
    if (pop2020 == null || pop2024 == null || pop2020 === 0) return null;
    return ((pop2024 - pop2020) / pop2020) * 100;
}

// People per km² from 2024 population and area.
export function computeDensity(pop2024: number | null, areaKm2: number | null): number | null {
    if (pop2024 == null || areaKm2 == null || areaKm2 <= 0) return null;
    return pop2024 / areaKm2;
}

/** Geodesic area from WGS84 GeoJSON geometry (m² → km²). */
export function geoAreaKm2(geometry: Geometry | undefined | null): number | null {
    if (!geometry) return null;
    try {
        const sqM = area({ type: "Feature", properties: {}, geometry });
        if (!Number.isFinite(sqM) || sqM <= 0) return null;
        return Math.round((sqM / 1_000_000) * 100) / 100;
    } catch {
        return null;
    }
}

export interface StatsContext {
    pop2024: Map<string, Pop2024Row>;
    histByPsgc: Map<string, PopVintageRow>;
    histByCorrespondence: Map<string, PopVintageRow>;
    assetsByPsgc: Map<string, number>;
    gdpByPsgc: Map<string, { gdp_2022: number | null; gdp_2023: number | null; gdp_2024: number | null }>;
    ageSexByPsgc: Map<string, { pop_male_2020: number | null; pop_female_2020: number | null; age_sex_2020: unknown }>;
}

function parseNum(raw: string | undefined | null): number | null {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

// Indexes COA AFR CSV by PSGC → total assets in actual pesos (CSV is thousand pesos).
function loadAssetsMap(csvPath: string): Map<string, number> {
    if (!fs.existsSync(csvPath)) return new Map();
    const raw = fs.readFileSync(csvPath);
    const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const map = new Map<string, number>();
    for (const row of rows) {
        const psgc = padPsgc(row.psgc);
        const assets = parseNum(row.assets);
        // COA AFR figures are in thousand pesos; store actual pesos to match
        // division_stats (seed-afr-assets.ts) and the GDP/peso formatting.
        if (assets != null) map.set(psgc, assets * 1000);
    }
    return map;
}

// Indexes mapped GDP CSV by PSGC → 2022/2023/2024 GDP.
function loadGdpMap(csvPath: string): Map<string, { gdp_2022: number | null; gdp_2023: number | null; gdp_2024: number | null }> {
    if (!fs.existsSync(csvPath)) return new Map();
    const raw = fs.readFileSync(csvPath);
    const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const map = new Map<string, { gdp_2022: number | null; gdp_2023: number | null; gdp_2024: number | null }>();
    for (const row of rows) {
        const psgc = padPsgc(row.psgc);
        map.set(psgc, {
            gdp_2022: parseNum(row.gdp_2022),
            gdp_2023: parseNum(row.gdp_2023),
            gdp_2024: parseNum(row.gdp_2024),
        });
    }
    return map;
}

// Indexes household age/sex CSV by PSGC → 2020 male/female totals and age bands.
function loadAgeSexMap(csvPath: string): Map<string, { pop_male_2020: number | null; pop_female_2020: number | null; age_sex_2020: unknown }> {
    if (!fs.existsSync(csvPath)) return new Map();
    const raw = fs.readFileSync(csvPath, "utf8");
    const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];
    const map = new Map<string, { pop_male_2020: number | null; pop_female_2020: number | null; age_sex_2020: unknown }>();
    for (const row of rows) {
        const psgc = padPsgc(row.psgc);
        let age_sex_2020: unknown = null;
        try {
            if (row.age_sex_2020) age_sex_2020 = JSON.parse(row.age_sex_2020);
        } catch { /* leave null */ }
        map.set(psgc, {
            pop_male_2020: parseNum(row.pop_male_2020),
            pop_female_2020: parseNum(row.pop_female_2020),
            age_sex_2020,
        });
    }
    return map;
}

// Loads every source CSV once into lookup maps for repeated attachStats calls.
export function createStatsContext(publicDir: string): StatsContext {
    const pop2024 = loadPop2024Map(path.join(publicDir, "data/raw/psgc.csv"));
    const { byPsgc, byCorrespondence } = loadHistoricalPopMaps(path.join(publicDir, "data/raw/psgc0.csv"));
    const assetsByPsgc = loadAssetsMap(path.join(publicDir, "data/clean/lgu_finance_2024.csv"));
    const gdpByPsgc = loadGdpMap(path.join(publicDir, "data/clean/gdp_mapped.csv"));
    const ageSexByPsgc = loadAgeSexMap(path.join(publicDir, "data/clean/household_agesex_2020.csv"));
    return { pop2024, histByPsgc: byPsgc, histByCorrespondence: byCorrespondence, assetsByPsgc, gdpByPsgc, ageSexByPsgc };
}

// Enriches a geo row with all stats fields (pop, area, density, assets, GDP, age/sex),
// computing area from geometry when not already provided.
export function attachStats<T extends { psgc: string; correspondence?: string | null; geometry?: unknown }>(
    row: T,
    ctx: StatsContext,
    existingArea?: number | null,
): T & DivisionStatsFields {
    const psgc = padPsgc(row.psgc);
    const popRow = ctx.pop2024.get(psgc);
    const correspondence = row.correspondence ?? popRow?.correspondence ?? null;
    const hist = resolveHistoricalPop(psgc, correspondence, ctx.histByPsgc, ctx.histByCorrespondence);
    const pop_2024 = popRow?.pop_2024 ?? null;
    const area_km2 = existingArea ?? geoAreaKm2(row.geometry as Geometry | undefined);
    const gdpRow = ctx.gdpByPsgc.get(psgc);
    const ageSexRow = ctx.ageSexByPsgc.get(psgc);
    return {
        ...row,
        pop_2010: null,
        pop_2015: hist.pop_2015,
        pop_2020: hist.pop_2020,
        pop_2024,
        pop_male_2020: ageSexRow?.pop_male_2020 ?? null,
        pop_female_2020: ageSexRow?.pop_female_2020 ?? null,
        age_sex_2020: (ageSexRow?.age_sex_2020 as { age: string; both: number; male: number; female: number }[] | null) ?? null,
        area_km2,
        density_2024: computeDensity(pop_2024, area_km2),
        pct_change_2020_2024: computePctChange(hist.pop_2020, pop_2024),
        assets_2024: ctx.assetsByPsgc.get(psgc) ?? null,
        gdp_2022: gdpRow?.gdp_2022 ?? null,
        gdp_2023: gdpRow?.gdp_2023 ?? null,
        gdp_2024: gdpRow?.gdp_2024 ?? null,
    };
}

// Returns just the stats fields (no geometry) for DB seeding, normalizing nulls.
export function stripGeometryStats(row: DivisionStatsFields): DivisionStatsFields {
    return {
        pop_2010: row.pop_2010 ?? null,
        pop_2015: row.pop_2015,
        pop_2020: row.pop_2020,
        pop_2024: row.pop_2024,
        pop_male_2020: row.pop_male_2020 ?? null,
        pop_female_2020: row.pop_female_2020 ?? null,
        age_sex_2020: row.age_sex_2020 ?? null,
        area_km2: row.area_km2,
        density_2024: row.density_2024,
        pct_change_2020_2024: row.pct_change_2020_2024,
        assets_2024: row.assets_2024 ?? null,
        gdp_2022: row.gdp_2022 ?? null,
        gdp_2023: row.gdp_2023 ?? null,
        gdp_2024: row.gdp_2024 ?? null,
    };
}
