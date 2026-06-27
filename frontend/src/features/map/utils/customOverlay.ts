import type { MpaLevel } from "../constants";
import type { CustomDataset, CustomDatasetValueRow, CustomOverlay, CustomOverlayValue } from "../types";

// Infers administrative level from a 10-digit PSGC code.
export function inferLevelFromPsgc(psgc: string): MpaLevel | null {
    const code = psgc.padStart(10, "0");
    if (code === "0000000000") return "country";
    if (code.endsWith("00000000")) return "region";
    if (code.endsWith("00000")) return "province";
    if (code.endsWith("000")) return "municipality";
    return "barangay";
}

export function rowsToValuesByPsgc(rows: CustomDatasetValueRow[]): Record<string, CustomOverlayValue> {
    const out: Record<string, CustomOverlayValue> = {};
    for (const row of rows) {
        out[row.psgc.padStart(10, "0")] = {
            value: row.value ?? undefined,
            category: row.category ?? undefined,
            detail: row.detail ?? undefined,
        };
    }
    return out;
}

export function buildOverlayFromDataset(
    dataset: CustomDataset,
    rows: CustomDatasetValueRow[],
    source: CustomOverlay["source"] = "builtin",
): CustomOverlay {
    return {
        source,
        kind: dataset.kind,
        level: dataset.level,
        valuesByPsgc: rowsToValuesByPsgc(rows),
        meta: {
            title: dataset.title,
            unit: dataset.unit ?? undefined,
            sourceName: dataset.source_name ?? undefined,
            sourceUrl: dataset.source_url ?? undefined,
        },
    };
}
