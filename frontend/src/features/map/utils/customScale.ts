// Data-driven numeric buckets and categorical palettes for custom map overlays.

import { NO_DATA_COLOR, type ScaleLevel } from "./densityScale";
import { POPULATION_RAMP, formatCompact } from "./populationScale";

export interface LegendItem {
    color: string;
    label: string;
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

function equalIntervalBreaks(min: number, max: number, buckets: number): number[] {
    if (max <= min) return [max];
    const step = (max - min) / buckets;
    return Array.from({ length: buckets }, (_, i) => min + step * (i + 1));
}

function bucketIndex(value: number, breaks: number[]): number {
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) return i;
    }
    return breaks.length;
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
    const bucketCount = Math.min(POPULATION_RAMP.length, Math.max(3, Math.ceil(sorted.length / 5)));
    const breaks =
        min === max
            ? [max]
            : equalIntervalBreaks(min, max, bucketCount - 1).slice(0, bucketCount - 1);
    const ramp = POPULATION_RAMP.slice(0, bucketCount);

    const colorForValue = (n: number | null | undefined): string => {
        if (n == null || n < 0) return NO_DATA_COLOR;
        if (min === max) return ramp[0];
        return ramp[bucketIndex(n, breaks)];
    };

    const legend: LegendItem[] = [];
    if (breaks.length === 0 || min === max) {
        legend.push({ color: ramp[0], label: formatCompact(min) });
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
