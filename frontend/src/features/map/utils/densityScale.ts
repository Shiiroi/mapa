// Per-level constant density scale and colors for density choropleth.

export const NO_DATA_COLOR = "#d1d5db";

export type ScaleLevel = "region" | "province" | "municipality" | "barangay";

/**
 * Low → high density heat ramp (green → yellow → orange → red → magenta),
 * sampled from the full 17-color ramp to 8 buckets.
 */
export const DENSITY_RAMP = [
    "#1a9850",
    "#4cb05a",
    "#7fc866",
    "#addd8e",
    "#d9ef8b",
    "#f7fcb9",
    "#fee08b",
    "#fdc265",
    "#fca644",
    "#fc8d59",
    "#f4694c",
    "#e34a33",
    "#d73027",
    "#c01a4e",
    "#a50f6d",
    "#8b1a89",
    "#7b2d8e",
] as const;

function sampleRamp(n: number): string[] {
    const last = DENSITY_RAMP.length - 1;
    return Array.from({ length: n }, (_, i) => DENSITY_RAMP[Math.round((i * last) / (n - 1))]);
}

export const DENSITY_RAMP_8 = sampleRamp(8);

/**
 * Upper-bound breaks per view level (7 breaks → 8 buckets), per km².
 * Log-Jenks natural breaks snapped to m × 5 × 10ⁿ nice numbers.
 */
export const DENSITY_BREAKS_BY_LEVEL: Record<ScaleLevel, number[]> = {
    region: [100, 150, 250, 350, 450, 750, 1_000],
    province: [95, 200, 300, 450, 750, 1_500, 3_500],
    municipality: [35, 95, 200, 350, 700, 1_500, 6_500],
    barangay: [35, 150, 300, 700, 2_000, 6_500, 25_000],
};

export interface LegendItem {
    color: string;
    label: string;
}

function formatLegendValue(v: number): string {
    if (v === 0) return "0";
    if (v < 1) return v.toFixed(2);
    if (v < 10) return v.toFixed(1);
    return v.toLocaleString("en-PH");
}

function densityBucketIndex(value: number, breaks: number[]): number {
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) return i;
    }
    return DENSITY_RAMP_8.length - 1;
}

// Heat-ramp color for a density value using the per-level breaks, or no-data gray.
export function colorForDensity(
    value: number | null | undefined,
    level: ScaleLevel,
): string {
    if (value == null || value < 0) return NO_DATA_COLOR;
    const breaks = DENSITY_BREAKS_BY_LEVEL[level];
    return DENSITY_RAMP_8[densityBucketIndex(value, breaks)];
}

/** Discrete legend rows, low → high density (≤ / range / > per bucket). */
export function densityLegendItems(level: ScaleLevel): LegendItem[] {
    const breaks = DENSITY_BREAKS_BY_LEVEL[level];
    const items: LegendItem[] = [];
    items.push({
        color: DENSITY_RAMP_8[0],
        label: `≤ ${formatLegendValue(breaks[0])}/km²`,
    });
    for (let i = 1; i < breaks.length; i++) {
        items.push({
            color: DENSITY_RAMP_8[i],
            label: `${formatLegendValue(breaks[i - 1])} – ${formatLegendValue(breaks[i])}/km²`,
        });
    }
    items.push({
        color: DENSITY_RAMP_8[breaks.length],
        label: `> ${formatLegendValue(breaks[breaks.length - 1])}/km²`,
    });
    return items;
}
