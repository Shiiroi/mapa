// Build CustomOverlay objects from DB rows or CSV uploads; resolve PSGC tiers for multi-level data.

import type { MapLevel } from "../constants";
import type { CustomDataset, CustomDatasetValueRow, CustomOverlay, CustomOverlayValue, CustomSeriesDef } from "../types";

export const LEVEL_ORDER: MapLevel[] = ["country", "region", "province", "municipality", "barangay"];

// Sort admin tiers from country down to barangay for stable legend and level lists.
export function sortLevels(levels: MapLevel[]): MapLevel[] {
    return [...levels].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
}

// True when the overlay has values for the current map view level.
export function overlayActiveAtLevel(overlay: CustomOverlay, mapLevel: MapLevel): boolean {
    if (!overlay.levels.includes(mapLevel)) return false;
    const bucket = overlay.valuesByLevel[mapLevel];
    return bucket != null && Object.keys(bucket).length > 0;
}

// Infers administrative level from a 10-digit PSGC code.
export function inferLevelFromPsgc(psgc: string): MapLevel | null {
    const code = psgc.padStart(10, "0");
    if (code === "0000000000") return "country";
    if (code.endsWith("00000000")) return "region";
    if (code.endsWith("00000")) return "province";
    if (code.endsWith("000")) return "municipality";
    return "barangay";
}

// Resolve which admin tiers a PSGC belongs to (handles NCR dual region/province).
export function resolveTiersForPsgc(
    psgc: string,
    psgcLevels?: ReadonlyMap<string, MapLevel>,
    psgcLevelsByTier?: Partial<Record<MapLevel, ReadonlySet<string>>>,
): MapLevel[] {
    if (psgcLevelsByTier) {
        const tiers: MapLevel[] = [];
        for (const level of LEVEL_ORDER) {
            if (psgcLevelsByTier[level]?.has(psgc)) tiers.push(level);
        }
        if (tiers.length) return tiers;
    }
    const single = psgcLevels?.get(psgc) ?? inferLevelFromPsgc(psgc);
    return single ? [single] : [];
}

// Pick the most specific tier when a PSGC maps to multiple levels (e.g. NCR).
export function primaryTier(tiers: MapLevel[]): MapLevel {
    return tiers.reduce(
        (best, tier) => (LEVEL_ORDER.indexOf(tier) > LEVEL_ORDER.indexOf(best) ? tier : best),
        tiers[0],
    );
}

function detailToSeries(detail: unknown): Record<string, number> | undefined {
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) return undefined;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(detail as Record<string, unknown>)) {
        if (typeof value === "number" && Number.isFinite(value)) {
            out[key] = value;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

function rowToCell(row: CustomDatasetValueRow, kind: CustomOverlay["kind"]): CustomOverlayValue {
    const cell: CustomOverlayValue = {
        value: row.value ?? undefined,
        category: row.category ?? undefined,
        detail: row.detail ?? undefined,
    };
    if (kind === "series") {
        cell.series = detailToSeries(row.detail);
    }
    return cell;
}

// Flatten DB value rows into a PSGC-keyed lookup (used as valuesByPsgc fallback).
export function rowsToValuesByPsgc(
    rows: CustomDatasetValueRow[],
    kind: CustomOverlay["kind"],
): Record<string, CustomOverlayValue> {
    const out: Record<string, CustomOverlayValue> = {};
    for (const row of rows) {
        out[row.psgc.padStart(10, "0")] = rowToCell(row, kind);
    }
    return out;
}

// Build a multi-level CustomOverlay from a built-in dataset and its DB value rows.
export function buildOverlayFromDataset(
    dataset: CustomDataset,
    rows: CustomDatasetValueRow[],
    psgcLevels?: ReadonlyMap<string, MapLevel>,
    psgcLevelsByTier?: Partial<Record<MapLevel, ReadonlySet<string>>>,
    source: CustomOverlay["source"] = "builtin",
): CustomOverlay {
    const valuesByLevel: CustomOverlay["valuesByLevel"] = {};
    const valuesByPsgc: CustomOverlay["valuesByPsgc"] = {};
    const levelsSet = new Set<MapLevel>();

    for (const row of rows) {
        const psgc = row.psgc.padStart(10, "0");
        const tiers = resolveTiersForPsgc(psgc, psgcLevels, psgcLevelsByTier);
        if (!tiers.length) continue;

        const cell = rowToCell(row, dataset.kind);
        for (const tier of tiers) {
            if (!valuesByLevel[tier]) valuesByLevel[tier] = {};
            valuesByLevel[tier]![psgc] = cell;
            levelsSet.add(tier);
        }
        valuesByPsgc[psgc] = cell;
    }

    const levels = sortLevels([...levelsSet]);
    const overlay: CustomOverlay = {
        source,
        kind: dataset.kind,
        level: levels[0] ?? dataset.level,
        levels: levels.length ? levels : [dataset.level],
        valuesByLevel: levels.length ? valuesByLevel : { [dataset.level]: valuesByPsgc },
        valuesByPsgc,
        meta: {
            title: dataset.title,
            unit: dataset.unit ?? undefined,
            sourceName: dataset.source_name ?? undefined,
            sourceUrl: dataset.source_url ?? undefined,
        },
    };
    if (dataset.kind === "series" && dataset.series?.length) {
        overlay.series = dataset.series as CustomSeriesDef[];
    }
    return overlay;
}
