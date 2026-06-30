// Data-agnostic multi-series overlay visualization (dominant, lead, share, head-to-head).

import type { CustomOverlay, CustomOverlayValue, CustomSeriesDef, SeriesViewMode, SeriesViewState } from "../types";
import { CATEGORICAL_PALETTE, type LegendItem } from "./customScale";
import { NO_DATA_COLOR } from "./densityScale";
import { POPULATION_RAMP } from "./populationScale";

const NEUTRAL = "#e5e7eb";
const LEAD_BREAKS = [0.05, 0.1, 0.2, 0.4] as const;

// Sums all non-negative series values in a cell (the denominator for shares).
export function seriesTotal(cell: CustomOverlayValue | undefined): number {
    if (!cell?.series) return 0;
    return Object.values(cell.series).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
}

// Fraction (0–1) of a cell's total contributed by one series, or null if no data.
export function seriesShare(cell: CustomOverlayValue | undefined, key: string): number | null {
    const total = seriesTotal(cell);
    if (total <= 0 || !cell?.series) return null;
    const val = cell.series[key];
    if (val == null || val < 0) return null;
    return val / total;
}

// Returns the series with the highest value in a cell (the "winner").
export function dominantSeries(cell: CustomOverlayValue | undefined): { key: string; value: number } | null {
    if (!cell?.series) return null;
    let best: { key: string; value: number } | null = null;
    for (const [key, value] of Object.entries(cell.series)) {
        if (value > 0 && (!best || value > best.value)) {
            best = { key, value };
        }
    }
    return best;
}

// Returns the runner-up series, excluding the given (usually dominant) key.
export function secondSeries(
    cell: CustomOverlayValue | undefined,
    excludeKey: string,
): { key: string; value: number } | null {
    if (!cell?.series) return null;
    let best: { key: string; value: number } | null = null;
    for (const [key, value] of Object.entries(cell.series)) {
        if (key === excludeKey || value <= 0) continue;
        if (!best || value > best.value) {
            best = { key, value };
        }
    }
    return best;
}

// Winner's lead over second place as a fraction of the cell total (0–1).
export function leadMargin(cell: CustomOverlayValue | undefined): number | null {
    const top = dominantSeries(cell);
    if (!top) return null;
    const total = seriesTotal(cell);
    if (total <= 0) return null;
    const second = secondSeries(cell, top.key);
    if (!second) return top.value / total;
    return (top.value - second.value) / total;
}

// Display label for a series key, falling back to the key itself.
export function seriesLabel(overlay: CustomOverlay, key: string): string {
    return overlay.series?.find((s) => s.key === key)?.label ?? key;
}

export function seriesModeLabel(mode: SeriesViewMode): string {
    switch (mode) {
        case "dominant":
            return "Dominant";
        case "lead":
            return "Lead";
        case "share":
            return "Share";
        case "head2head":
            return "Head-to-head";
    }
}

// Initial view state for an overlay: default mode plus first/second series as defaults.
export function defaultSeriesViewState(overlay: CustomOverlay): SeriesViewState {
    const keys = overlay.series?.map((s) => s.key) ?? [];
    const mode = overlay.meta.defaultView ?? "lead";
    return {
        mode,
        shareKey: keys[0],
        pairA: keys[0],
        pairB: keys[1] ?? keys[0],
    };
}

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    const full =
        h.length === 3
            ? h
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Linearly interpolates between two hex colors (t in [0,1]).
function blendColors(a: string, b: string, t: number): string {
    const [ar, ag, ab] = hexToRgb(a);
    const [br, bg, bb] = hexToRgb(b);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

// Assigns each series its defined color, or a palette color by index.
function buildSeriesColorMap(seriesDefs: CustomSeriesDef[]): Map<string, string> {
    const map = new Map<string, string>();
    seriesDefs.forEach((def, i) => {
        map.set(def.key, def.color ?? CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]);
    });
    return map;
}

// Maps a lead margin to a color intensity so wider leads render darker.
function leadBlendStrength(marginFraction: number): number {
    for (let i = 0; i < LEAD_BREAKS.length; i++) {
        if (marginFraction <= LEAD_BREAKS[i]) {
            return 0.25 + (i / LEAD_BREAKS.length) * 0.55;
        }
    }
    return 0.85;
}

function shareBucketIndex(share: number): number {
    const pct = share * 100;
    const breaks = [10, 20, 35, 50, 65, 80, 90];
    for (let i = 0; i < breaks.length; i++) {
        if (pct <= breaks[i]) return i;
    }
    return POPULATION_RAMP.length - 1;
}

// Picks A's or B's color (intensity scaled by the share gap) for head-to-head view.
function head2HeadColor(diff: number, colorA: string, colorB: string): string {
    const abs = Math.abs(diff);
    const strength = Math.min(0.9, 0.35 + abs * 1.5);
    if (diff >= 0) return blendColors(NEUTRAL, colorA, strength);
    return blendColors(NEUTRAL, colorB, strength);
}

export interface SeriesScaleResult {
    colorForPsgc: (psgc: string) => string;
    legend: LegendItem[];
    legendNote?: string;
    legendTitle: string;
}

// Builds the per-PSGC color function and legend for a multi-series overlay,
// branching on the active view mode (dominant, lead, share, head-to-head).
export function buildSeriesScale(overlay: CustomOverlay, view: SeriesViewState): SeriesScaleResult {
    const seriesDefs = overlay.series ?? [];
    const colorMap = buildSeriesColorMap(seriesDefs);
    const noData = () => NO_DATA_COLOR;

    if (seriesDefs.length === 0) {
        return {
            colorForPsgc: noData,
            legend: [],
            legendTitle: overlay.meta.title,
        };
    }

    const labelFor = (key: string) => seriesLabel(overlay, key);

    if (view.mode === "dominant") {
        const legend = seriesDefs.map((def) => ({
            color: colorMap.get(def.key)!,
            label: def.label,
        }));
        return {
            colorForPsgc: (psgc) => {
                const cell = overlay.valuesByPsgc[psgc];
                const top = dominantSeries(cell);
                if (!top) return NO_DATA_COLOR;
                return colorMap.get(top.key) ?? NO_DATA_COLOR;
            },
            legend,
            legendTitle: `${overlay.meta.title} — Dominant`,
        };
    }

    if (view.mode === "lead") {
        const legend = seriesDefs.map((def) => ({
            color: colorMap.get(def.key)!,
            label: def.label,
        }));
        return {
            colorForPsgc: (psgc) => {
                const cell = overlay.valuesByPsgc[psgc];
                const top = dominantSeries(cell);
                if (!top) return NO_DATA_COLOR;
                const base = colorMap.get(top.key) ?? NO_DATA_COLOR;
                const margin = leadMargin(cell);
                if (margin == null) return base;
                const strength = leadBlendStrength(margin);
                return blendColors(NEUTRAL, base, strength);
            },
            legend,
            legendNote: "Darker = wider lead over second place",
            legendTitle: `${overlay.meta.title} — Lead`,
        };
    }

    if (view.mode === "share") {
        const shareKey = view.shareKey ?? seriesDefs[0]?.key;
        const shareLabel = shareKey ? labelFor(shareKey) : "Series";
        const breaks = [10, 20, 35, 50, 65, 80, 90];
        const legend: LegendItem[] = [{ color: POPULATION_RAMP[0], label: `≤ ${breaks[0]}%` }];
        for (let i = 1; i < breaks.length; i++) {
            legend.push({
                color: POPULATION_RAMP[i],
                label: `${breaks[i - 1]}% – ${breaks[i]}%`,
            });
        }
        legend.push({ color: POPULATION_RAMP[breaks.length], label: `> ${breaks[breaks.length - 1]}%` });

        return {
            colorForPsgc: (psgc) => {
                if (!shareKey) return NO_DATA_COLOR;
                const cell = overlay.valuesByPsgc[psgc];
                const share = seriesShare(cell, shareKey);
                if (share == null) return NO_DATA_COLOR;
                return POPULATION_RAMP[shareBucketIndex(share)];
            },
            legend,
            legendTitle: `${overlay.meta.title} — ${shareLabel} share`,
        };
    }

    // head2head
    const pairA = view.pairA ?? seriesDefs[0]?.key;
    const pairB = view.pairB ?? seriesDefs[1]?.key ?? seriesDefs[0]?.key;
    const colorA = pairA ? (colorMap.get(pairA) ?? CATEGORICAL_PALETTE[0]) : CATEGORICAL_PALETTE[0];
    const colorB = pairB ? (colorMap.get(pairB) ?? CATEGORICAL_PALETTE[1]) : CATEGORICAL_PALETTE[1];
    const labelA = pairA ? labelFor(pairA) : "A";
    const labelB = pairB ? labelFor(pairB) : "B";

    return {
        colorForPsgc: (psgc) => {
            if (!pairA || !pairB) return NO_DATA_COLOR;
            const cell = overlay.valuesByPsgc[psgc];
            const shareA = seriesShare(cell, pairA);
            const shareB = seriesShare(cell, pairB);
            if (shareA == null && shareB == null) return NO_DATA_COLOR;
            const diff = (shareA ?? 0) - (shareB ?? 0);
            if (Math.abs(diff) < 0.001) return NEUTRAL;
            return head2HeadColor(diff, colorA, colorB);
        },
        legend: [
            { color: colorA, label: labelA },
            { color: NEUTRAL, label: "Even" },
            { color: colorB, label: labelB },
        ],
        legendNote: "Color shows which series leads by share",
        legendTitle: `${overlay.meta.title} — ${labelA} vs ${labelB}`,
    };
}

// Human-readable hover summary for a cell, phrased for the active view mode.
export function formatSeriesTooltip(
    overlay: CustomOverlay,
    cell: CustomOverlayValue | undefined,
    view: SeriesViewState,
): string | null {
    if (!cell?.series) return null;
    const top = dominantSeries(cell);
    if (!top) return null;
    const total = seriesTotal(cell);
    const topLabel = seriesLabel(overlay, top.key);
    const topShare = total > 0 ? ((top.value / total) * 100).toFixed(1) : "0";
    const margin = leadMargin(cell);
    const marginPct = margin != null ? (margin * 100).toFixed(1) : null;

    if (view.mode === "share" && view.shareKey) {
        const share = seriesShare(cell, view.shareKey);
        if (share == null) return null;
        return `${seriesLabel(overlay, view.shareKey)}: ${(share * 100).toFixed(1)}%`;
    }

    if (view.mode === "head2head" && view.pairA && view.pairB) {
        const shareA = seriesShare(cell, view.pairA);
        const shareB = seriesShare(cell, view.pairB);
        if (shareA == null && shareB == null) return null;
        return `${seriesLabel(overlay, view.pairA)} ${((shareA ?? 0) * 100).toFixed(1)}% · ${seriesLabel(overlay, view.pairB)} ${((shareB ?? 0) * 100).toFixed(1)}%`;
    }

    if (marginPct != null) {
        return `${topLabel} (${topShare}%, +${marginPct} pt lead)`;
    }
    return `${topLabel} (${topShare}%)`;
}
