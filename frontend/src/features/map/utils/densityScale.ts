// Fixed absolute density scale and colors for density choropleth.

export const NO_DATA_COLOR = "#d1d5db";

/** CityPopulation-style upper-bound breaks (16 breaks → 17 buckets). */
export const DENSITY_BREAKS = [
    0.1, 1, 5, 10, 25, 50, 100, 250, 500,
    1000, 2500, 5000, 10000, 25000, 50000, 75000,
] as const;

/**
 * Low → high density heat ramp (green → yellow → orange → red → magenta),
 * one color per bucket.
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

export interface LegendItem {
    color: string;
    label: string;
}

/** Boundary values shown in the legend (0 plus each break) → 17 rows. */
const LEGEND_VALUES = [0, ...DENSITY_BREAKS] as const;

function formatLegendValue(v: number): string {
    if (v === 0) return "0";
    if (v < 1) return v.toFixed(2); // 0.10
    if (v < 10) return v.toFixed(1); // 1.0, 5.0
    return v.toLocaleString("en-PH"); // 10 … 75,000
}

/** Discrete legend rows, low → high density (one row per color bucket). */
export function legendItems(): LegendItem[] {
    return LEGEND_VALUES.map((v, i) => ({
        color: DENSITY_RAMP[i],
        label: `${formatLegendValue(v)}/km²`,
    }));
}

function densityBucketIndex(value: number): number {
    for (let i = 0; i < DENSITY_BREAKS.length; i++) {
        if (value < DENSITY_BREAKS[i]) return i;
    }
    return DENSITY_RAMP.length - 1;
}

export function colorForDensity(value: number | null | undefined): string {
    if (value == null) return NO_DATA_COLOR;
    if (value < 0) return NO_DATA_COLOR;
    return DENSITY_RAMP[densityBucketIndex(value)];
}
