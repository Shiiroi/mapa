import type { MpaLevel } from "../constants";
import type { CustomDataset, CustomDatasetValueRow, CustomOverlay, CustomOverlayValue, CustomSeriesDef } from "../types";

export const LEVEL_ORDER: MpaLevel[] = ["country", "region", "province", "municipality", "barangay"];

export function sortLevels(levels: MpaLevel[]): MpaLevel[] {
    return [...levels].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
}

export function overlayActiveAtLevel(overlay: CustomOverlay, mapLevel: MpaLevel): boolean {
    if (!overlay.levels.includes(mapLevel)) return false;
    const bucket = overlay.valuesByLevel[mapLevel];
    return bucket != null && Object.keys(bucket).length > 0;
}

// Infers administrative level from a 10-digit PSGC code.
export function inferLevelFromPsgc(psgc: string): MpaLevel | null {
    const code = psgc.padStart(10, "0");
    if (code === "0000000000") return "country";
    if (code.endsWith("00000000")) return "region";
    if (code.endsWith("00000")) return "province";
    if (code.endsWith("000")) return "municipality";
    return "barangay";
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

export function rowsToValuesByPsgc(
    rows: CustomDatasetValueRow[],
    kind: CustomOverlay["kind"],
): Record<string, CustomOverlayValue> {
    const out: Record<string, CustomOverlayValue> = {};
    for (const row of rows) {
        const cell: CustomOverlayValue = {
            value: row.value ?? undefined,
            category: row.category ?? undefined,
            detail: row.detail ?? undefined,
        };
        if (kind === "series") {
            cell.series = detailToSeries(row.detail);
        }
        out[row.psgc.padStart(10, "0")] = cell;
    }
    return out;
}

export function buildOverlayFromDataset(
    dataset: CustomDataset,
    rows: CustomDatasetValueRow[],
    source: CustomOverlay["source"] = "builtin",
): CustomOverlay {
    const valuesByPsgc = rowsToValuesByPsgc(rows, dataset.kind);
    const overlay: CustomOverlay = {
        source,
        kind: dataset.kind,
        level: dataset.level,
        levels: [dataset.level],
        valuesByLevel: { [dataset.level]: valuesByPsgc },
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
