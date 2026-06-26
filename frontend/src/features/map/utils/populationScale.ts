// Adaptive (per-view) quantile scale for population choropleth.
//
// Unlike density, absolute population spans wildly different ranges per level
// (a region has millions; a barangay has thousands), so a single fixed scale
// would wash out every level. Instead we compute equal-count quantile breaks
// from whatever features are currently shown, giving good contrast at any level
// and a legend whose thresholds reflect that level.

import { DENSITY_RAMP, NO_DATA_COLOR } from "./densityScale";

/**
 * Same green → magenta colors as the density legend, sampled down to a handful
 * of buckets so population shares the map's color language. Only the ranges
 * differ (and adapt per level), not the colors.
 */
function sampleRamp(n: number): string[] {
    const last = DENSITY_RAMP.length - 1;
    return Array.from({ length: n }, (_, i) => DENSITY_RAMP[Math.round((i * last) / (n - 1))]);
}

export const POPULATION_RAMP = sampleRamp(7);

export interface LegendItem {
    color: string;
    label: string;
}

export function formatCompact(n: number): string {
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
    return String(Math.round(n));
}

function quantile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const w = idx - lo;
    return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/** Quantile break thresholds (length = buckets - 1) for positive values. */
export function computePopulationBreaks(
    values: number[],
    buckets = POPULATION_RAMP.length,
): number[] {
    const positive = values.filter((v) => v != null && v > 0).sort((a, b) => a - b);
    if (positive.length === 0) return [];
    const n = Math.min(buckets, POPULATION_RAMP.length);
    if (positive.length < n) {
        const uniq = [...new Set(positive)].sort((a, b) => a - b);
        return uniq.slice(0, -1);
    }
    const breaks: number[] = [];
    for (let i = 1; i < n; i++) breaks.push(Math.round(quantile(positive, i / n)));
    return breaks;
}

export function colorForPopulation(value: number | null | undefined, breaks: number[]): string {
    if (value == null || value <= 0) return NO_DATA_COLOR;
    // Single bucket (e.g. the whole-Philippines view has one feature) → just green.
    if (breaks.length === 0) return POPULATION_RAMP[0];
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) return POPULATION_RAMP[i];
    }
    return POPULATION_RAMP[breaks.length];
}

export function populationLegendItems(breaks: number[], values: number[]): LegendItem[] {
    const positive = values.filter((v) => v != null && v > 0);
    if (positive.length === 0) return [];
    // Single bucket (whole-Philippines view): just one green swatch.
    if (breaks.length === 0) {
        return [{ color: POPULATION_RAMP[0], label: formatCompact(Math.max(...positive)) }];
    }
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
