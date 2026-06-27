import type { MpaLevel } from "../constants";
import type { CustomOverlay } from "../types";
import { inferLevelFromPsgc } from "./customOverlay";

export interface ParsedCustomCsv {
    title: string;
    level: MpaLevel;
    rows: { psgc: string; value: number; label?: string }[];
}

export interface ParseCustomCsvResult {
    ok: true;
    data: ParsedCustomCsv;
}

export interface ParseCustomCsvError {
    ok: false;
    error: string;
}

// Parses a minimal numeric CSV: header `psgc,value` with optional `label` column.
export function parseCustomCsv(text: string, knownPsgcs: Set<string>): ParseCustomCsvResult | ParseCustomCsvError {
    const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"));

    if (lines.length < 2) {
        return { ok: false, error: "CSV must have a header row and at least one data row." };
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const psgcIdx = header.indexOf("psgc");
    const valueIdx = header.indexOf("value");
    const labelIdx = header.indexOf("label");

    if (psgcIdx === -1 || valueIdx === -1) {
        return { ok: false, error: 'Header must include columns "psgc" and "value".' };
    }

    const rows: { psgc: string; value: number; label?: string }[] = [];
    let level: MpaLevel | null = null;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const rawPsgc = cols[psgcIdx];
        const rawValue = cols[valueIdx];
        if (!rawPsgc) continue;

        const psgc = rawPsgc.replace(/\D/g, "").padStart(10, "0");
        if (psgc.length !== 10) {
            return { ok: false, error: `Line ${i + 1}: invalid PSGC "${rawPsgc}".` };
        }

        if (knownPsgcs.size > 0 && !knownPsgcs.has(psgc)) {
            return { ok: false, error: `Line ${i + 1}: unknown PSGC "${psgc}".` };
        }

        const value = Number(rawValue);
        if (!Number.isFinite(value)) {
            return { ok: false, error: `Line ${i + 1}: value must be a number.` };
        }

        const rowLevel = inferLevelFromPsgc(psgc);
        if (!rowLevel) {
            return { ok: false, error: `Line ${i + 1}: could not infer level for PSGC "${psgc}".` };
        }
        if (level == null) level = rowLevel;
        else if (level !== rowLevel) {
            return { ok: false, error: "All rows must share the same administrative level." };
        }

        rows.push({
            psgc,
            value,
            label: labelIdx >= 0 ? cols[labelIdx] : undefined,
        });
    }

    if (rows.length === 0) {
        return { ok: false, error: "No data rows found." };
    }
    if (!level) {
        return { ok: false, error: "Could not infer administrative level." };
    }

    return { ok: true, data: { title: "Uploaded dataset", level, rows } };
}

export function overlayFromParsedCsv(parsed: ParsedCustomCsv, title?: string): CustomOverlay {
    const valuesByPsgc: CustomOverlay["valuesByPsgc"] = {};
    for (const row of parsed.rows) {
        valuesByPsgc[row.psgc] = { value: row.value };
    }
    const overlayTitle = title?.trim() || parsed.title;
    return {
        source: "upload",
        kind: "numeric",
        level: parsed.level,
        valuesByPsgc,
        meta: { title: overlayTitle, unit: undefined },
    };
}

export const CUSTOM_CSV_TEMPLATE = `# psgc: 10-digit Philippine Standard Geographic Code
#   Find codes at: https://psa.gov.ph/classification/psgc
#   Province ends in 00000, city/municipality ends in 000, barangay is full 10 digits
# value: numeric value for this area (all rows must be the same level)
# label: optional place name for display (does not affect matching)
psgc,value,label
0405800000,3321325,Rizal
0410000000,3793295,Cavite
`;
