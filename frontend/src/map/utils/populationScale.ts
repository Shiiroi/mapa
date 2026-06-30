// Per-level constant population scale for population choropleth.

import { DENSITY_RAMP, NO_DATA_COLOR, type ScaleLevel } from "./densityScale";

/**
 * Same green → magenta colors as the density legend, sampled to 8 buckets.
 */
function sampleRamp(n: number): string[] {
    const last = DENSITY_RAMP.length - 1;
    return Array.from({ length: n }, (_, i) => DENSITY_RAMP[Math.round((i * last) / (n - 1))]);
}

export const POPULATION_RAMP = sampleRamp(8);

/**
 * Upper-bound breaks per view level (7 breaks → 8 buckets).
 * Log-Jenks natural breaks snapped to m × 5 × 10ⁿ nice numbers.
 */
export const POPULATION_BREAKS_BY_LEVEL: Record<ScaleLevel, number[]> = {
    region: [3_000_000, 4_000_000, 4_500_000, 5_000_000, 5_500_000, 6_500_000, 15_000_000],
    province: [95_000, 150_000, 300_000, 700_000, 1_000_000, 2_000_000, 4_500_000],
    municipality: [5_000, 15_000, 25_000, 35_000, 55_000, 100_000, 250_000],
    barangay: [250, 550, 950, 1_500, 2_500, 5_000, 15_000],
};

export interface LegendItem {
    color: string;
    label: string;
}

// Compact human-readable number with K/M/B/T suffix (e.g. 12,300 → "12K").
export function formatCompact(n: number): string {
    if (n >= 1e12) return `${(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
    return String(Math.round(n));
}

function populationBucketIndex(value: number, breaks: number[]): number {
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) return i;
    }
    return POPULATION_RAMP.length - 1;
}

// Ramp color for a population value using the per-level breaks, or no-data gray.
export function colorForPopulation(
    value: number | null | undefined,
    level: ScaleLevel,
): string {
    if (value == null || value <= 0) return NO_DATA_COLOR;
    const breaks = POPULATION_BREAKS_BY_LEVEL[level];
    return POPULATION_RAMP[populationBucketIndex(value, breaks)];
}

// Discrete population legend rows (≤ / range / >) for the given level.
export function populationLegendItems(level: ScaleLevel): LegendItem[] {
    const breaks = POPULATION_BREAKS_BY_LEVEL[level];
    const items: LegendItem[] = [];
    items.push({ color: POPULATION_RAMP[0], label: `≤ ${formatCompact(breaks[0])}` });
    for (let i = 1; i < breaks.length; i++) {
        items.push({
            color: POPULATION_RAMP[i],
            label: `${formatCompact(breaks[i - 1])} – ${formatCompact(breaks[i])}`,
        });
    }
    items.push({
        color: POPULATION_RAMP[breaks.length],
        label: `> ${formatCompact(breaks[breaks.length - 1])}`,
    });
    return items;
}
