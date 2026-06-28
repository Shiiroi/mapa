// Contextual density comparisons and human-readable analogies.

import type { DivisionStatsFields, MunicityGeoJSON, ProvinceGeoJSON, Region } from "../types";

export interface DensityBenchmarks {
    nationalMunicipalAvg: number | null;
    nationalProvincialAvg: number | null;
    nationalRegionalAvg: number | null;
}

// Mean of positive density values across rows, ignoring null/zero.
function avgDensity(rows: { density_2024: number | null }[]): number | null {
    const vals = rows.map((r) => r.density_2024).filter((d): d is number => d != null && d > 0);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// National average densities at each level, used as comparison baselines.
export function computeDensityBenchmarks(
    regions: Region[],
    provinces: ProvinceGeoJSON[],
    municities: MunicityGeoJSON[],
): DensityBenchmarks {
    return {
        nationalRegionalAvg: avgDensity(regions),
        nationalProvincialAvg: avgDensity(provinces),
        nationalMunicipalAvg: avgDensity(municities),
    };
}

// Picks the matching national average for a level (barangays use the municipal one).
function levelBenchmark(level: string, benchmarks: DensityBenchmarks): number | null {
    switch (level) {
        case "region":
            return benchmarks.nationalRegionalAvg;
        case "province":
            return benchmarks.nationalProvincialAvg;
        case "municipality":
        case "barangay":
            return benchmarks.nationalMunicipalAvg;
        default:
            return benchmarks.nationalMunicipalAvg;
    }
}

// Human-readable density blurb comparing a place to its level's national average
// and adding a qualitative analogy (urban, sparse, etc.).
export function buildDensityInsight(
    density: number | null,
    level: string,
    benchmarks: DensityBenchmarks,
): string | null {
    if (density == null) return null;

    const benchmark = levelBenchmark(level, benchmarks);
    const parts: string[] = [];

    if (benchmark != null && benchmark > 0) {
        const ratio = density / benchmark;
        if (ratio >= 1.5) {
            parts.push(`About ${ratio.toFixed(1)}× denser than the national ${level === "province" ? "provincial" : level === "region" ? "regional" : "municipal"} average.`);
        } else if (ratio <= 0.67) {
            parts.push(`About ${(1 / ratio).toFixed(1)}× less dense than the national ${level === "province" ? "provincial" : level === "region" ? "regional" : "municipal"} average.`);
        }
    }

    if (density >= 30000) {
        parts.push(
            "Extremely dense — comparable to packing several households into the footprint of a typical city block.",
        );
    } else if (density >= 15000) {
        parts.push("Very high density — similar to central business districts in major Philippine cities.");
    } else if (density >= 5000) {
        parts.push("Urban density — typical of established city neighborhoods.");
    } else if (density < 100) {
        parts.push("Sparse — more open land than built-up area per square kilometer.");
    }

    return parts.length ? parts.join(" ") : null;
}

// Extracts only the DivisionStatsFields subset from a larger row object.
export function pickStatsFields(row: DivisionStatsFields): DivisionStatsFields {
    return {
        pop_2010: row.pop_2010,
        pop_2015: row.pop_2015,
        pop_2020: row.pop_2020,
        pop_2024: row.pop_2024,
        pop_male_2020: row.pop_male_2020,
        pop_female_2020: row.pop_female_2020,
        age_sex_2020: row.age_sex_2020,
        area_km2: row.area_km2,
        density_2024: row.density_2024,
        pct_change_2020_2024: row.pct_change_2020_2024,
        assets_2024: row.assets_2024,
        gdp_2022: row.gdp_2022,
        gdp_2023: row.gdp_2023,
        gdp_2024: row.gdp_2024,
    };
}
