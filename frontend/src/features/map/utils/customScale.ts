// Data-driven numeric buckets and categorical palettes for custom map overlays.

import { NO_DATA_COLOR, type ScaleLevel } from "./densityScale";
import { POPULATION_RAMP, formatCompact } from "./populationScale";

export interface LegendItem {
    color: string;
    label: string;
}

/**
 * 7 breaks → 8 buckets. Log-Jenks natural breaks snapped to m × 5 × 10ⁿ nice numbers.
 * Region/province from PSA accounts; municipality for HUC cities with published GDP.
 */
export const GDP_BREAKS_BY_LEVEL: Partial<Record<ScaleLevel, number[]>> = {
    region: [450e9, 600e9, 700e9, 900e9, 1.5e12, 3e12, 3.5e12],
    province: [20e9, 40e9, 65e9, 100e9, 200e9, 300e9, 500e9],
    municipality: [50e9, 85e9, 150e9, 200e9, 350e9, 450e9, 800e9],
};

/**
 * 7 breaks → 8 buckets. Log-Jenks natural breaks snapped to m × 5 × 10ⁿ nice numbers,
 * in actual pesos (AFR reports thousand pesos, stored × 1000).
 */
export const ASSETS_BREAKS_BY_LEVEL: Partial<Record<ScaleLevel, number[]>> = {
    region: [100e9, 150e9, 200e9, 250e9, 300e9, 350e9, 500e9],
    province: [3e9, 6e9, 9e9, 15e9, 20e9, 25e9, 45e9],
    municipality: [200e6, 400e6, 650e6, 1e9, 2e9, 5e9, 15e9],
};

function staticBreaksForLevel(
    table: Partial<Record<ScaleLevel, number[]>>,
    level: ScaleLevel,
): number[] | null {
    return table[level] ?? null;
}

function staticBucketIndex(value: number, breaks: number[]): number {
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) return i;
    }
    return POPULATION_RAMP.length - 1;
}

// Builds discrete legend rows (≤ / range / >) from a fixed set of breaks.
function staticLegendItems(breaks: number[]): LegendItem[] {
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

// Ramp color for a GDP value at the given level, or no-data gray.
export function colorForGdp(value: number | null | undefined, level: ScaleLevel): string {
    const breaks = staticBreaksForLevel(GDP_BREAKS_BY_LEVEL, level);
    if (value == null || value <= 0 || !breaks) return NO_DATA_COLOR;
    return POPULATION_RAMP[staticBucketIndex(value, breaks)];
}

// GDP legend rows for a level, or null if that level has no defined breaks.
export function gdpLegendItems(level: ScaleLevel): LegendItem[] | null {
    const breaks = staticBreaksForLevel(GDP_BREAKS_BY_LEVEL, level);
    return breaks ? staticLegendItems(breaks) : null;
}

// Ramp color for a total-assets value at the given level, or no-data gray.
export function colorForAssets(value: number | null | undefined, level: ScaleLevel): string {
    const breaks = staticBreaksForLevel(ASSETS_BREAKS_BY_LEVEL, level);
    if (value == null || value <= 0 || !breaks) return NO_DATA_COLOR;
    return POPULATION_RAMP[staticBucketIndex(value, breaks)];
}

// Assets legend rows for a level, or null if that level has no defined breaks.
export function assetsLegendItems(level: ScaleLevel): LegendItem[] | null {
    const breaks = staticBreaksForLevel(ASSETS_BREAKS_BY_LEVEL, level);
    return breaks ? staticLegendItems(breaks) : null;
}

/** Distinct colors for categorical overlays (election winners, etc.). */
export const CATEGORICAL_PALETTE = [
    "#e41a1c",
    "#377eb8",
    "#4daf4a",
    "#984ea3",
    "#ff7f00",
    "#a65628",
    "#f781bf",
    "#999999",
    "#66c2a5",
    "#fc8d62",
    "#8da0cb",
    "#e78ac3",
] as const;

function bucketIndex(value: number, breaks: number[]): number {
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) return i;
    }
    return breaks.length;
}

/** Linear-interpolated quantile of an ascending-sorted array (q in [0,1]). */
function quantile(sorted: number[], q: number): number {
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    return next != null ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

/** Rounds up to a human-friendly 1/2/2.5/5/10 * 10^n boundary. */
function niceRound(value: number): number {
    if (value <= 0) return value;
    const exp = Math.floor(Math.log10(value));
    const base = 10 ** exp;
    const frac = value / base;
    let niceFrac: number;
    if (frac <= 1) niceFrac = 1;
    else if (frac <= 2) niceFrac = 2;
    else if (frac <= 2.5) niceFrac = 2.5;
    else if (frac <= 5) niceFrac = 5;
    else niceFrac = 10;
    return niceFrac * base;
}

/** Samples `n` evenly-spaced colors from the shared green→magenta ramp. */
function sampleColors(n: number): string[] {
    if (n <= 1) return [POPULATION_RAMP[0]];
    if (n >= POPULATION_RAMP.length) return POPULATION_RAMP.slice(0, n);
    const last = POPULATION_RAMP.length - 1;
    return Array.from({ length: n }, (_, i) => POPULATION_RAMP[Math.round((i * last) / (n - 1))]);
}

// Quantile-based breaks (rounded to nice numbers) so skewed data like GDP/assets
// spread across the full color ramp instead of collapsing into one bucket.
function buildNiceBreaks(sorted: number[], min: number, max: number, targetBuckets: number): number[] {
    const breaks: number[] = [];
    for (let i = 1; i < targetBuckets; i++) {
        const rounded = niceRound(quantile(sorted, i / targetBuckets));
        if (rounded <= min || rounded >= max) continue;
        if (breaks.length === 0 || rounded > breaks[breaks.length - 1]) breaks.push(rounded);
    }
    return breaks;
}

// Builds numeric color map and legend from the values present on the map.
export function buildNumericOverlayScale(values: number[]): {
    colorForValue: (n: number | null | undefined) => string;
    legend: LegendItem[];
} {
    const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b);
    if (sorted.length === 0) {
        return {
            colorForValue: () => NO_DATA_COLOR,
            legend: [],
        };
    }
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    if (min === max) {
        const color = POPULATION_RAMP[0];
        return {
            colorForValue: (n) => (n == null || n < 0 ? NO_DATA_COLOR : color),
            legend: [{ color, label: formatCompact(min) }],
        };
    }

    const distinct = new Set(sorted).size;
    const targetBuckets = Math.min(POPULATION_RAMP.length, Math.max(3, distinct));
    const breaks = buildNiceBreaks(sorted, min, max, targetBuckets);
    const ramp = sampleColors(breaks.length + 1);

    const colorForValue = (n: number | null | undefined): string => {
        if (n == null || n < 0) return NO_DATA_COLOR;
        return ramp[bucketIndex(n, breaks)];
    };

    const legend: LegendItem[] = [];
    if (breaks.length === 0) {
        legend.push({ color: ramp[0], label: `${formatCompact(min)} – ${formatCompact(max)}` });
    } else {
        legend.push({ color: ramp[0], label: `≤ ${formatCompact(breaks[0])}` });
        for (let i = 1; i < breaks.length; i++) {
            legend.push({
                color: ramp[i],
                label: `${formatCompact(breaks[i - 1])} – ${formatCompact(breaks[i])}`,
            });
        }
        legend.push({ color: ramp[breaks.length], label: `> ${formatCompact(breaks[breaks.length - 1])}` });
    }

    return { colorForValue, legend };
}

// Assigns a stable color per category label.
export function buildCategoricalOverlayScale(categories: string[]): {
    categoryToColor: Map<string, string>;
    legend: LegendItem[];
} {
    const unique = [...new Set(categories.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const categoryToColor = new Map<string, string>();
    unique.forEach((cat, i) => {
        categoryToColor.set(cat, CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]);
    });
    const legend = unique.map((cat) => ({
        color: categoryToColor.get(cat)!,
        label: cat,
    }));
    return { categoryToColor, legend };
}

export function overlayLevelMatchesMap(overlayLevel: ScaleLevel | string, mapScaleLevel: ScaleLevel): boolean {
    return overlayLevel === mapScaleLevel;
}
