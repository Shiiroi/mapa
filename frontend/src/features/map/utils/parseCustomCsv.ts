// Parse uploaded custom CSV (single-value or multi-series) into overlay-ready structures.

import type { MapLevel } from "../constants";
import type { CustomOverlay, CustomSeriesDef, SeriesViewMode } from "../types";
import { sortLevels, resolveTiersForPsgc, primaryTier } from "./customOverlay";

export interface ParsedNumericCsv {
    kind: "numeric";
    title?: string;
    levels: MapLevel[];
    unit?: string;
    rows: { psgc: string; value: number; label?: string; level: MapLevel; tiers: MapLevel[] }[];
}

export interface ParsedSeriesCsv {
    kind: "series";
    title?: string;
    levels: MapLevel[];
    unit?: string;
    series: CustomSeriesDef[];
    rows: { psgc: string; label?: string; series: Record<string, number>; level: MapLevel; tiers: MapLevel[] }[];
    defaultView?: SeriesViewMode;
}

export type ParsedCustomCsv = ParsedNumericCsv | ParsedSeriesCsv;

export interface ParseCustomCsvResult {
    ok: true;
    data: ParsedCustomCsv;
}

export interface ParseCustomCsvError {
    ok: false;
    error: string;
}

interface CsvDirectives {
    title?: string;
    unit?: string;
    colors: Record<string, string>;
    seriesOrder?: string[];
    defaultView?: SeriesViewMode;
}

function seriesKeyFromHeader(header: string): string {
    return header.trim().replace(/\s+/g, "_");
}

function parseDirectiveLine(line: string): Partial<CsvDirectives> | null {
    const trimmed = line.replace(/^#\s*/, "").trim();
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) return null;
    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (!value) return null;

    if (key === "title") return { title: value };
    if (key === "unit") return { unit: value };
    if (key === "mode") {
        // Take the first token so a trailing annotation like
        // "lead (choose one of: ...)" still resolves to "lead".
        const mode = value.toLowerCase().split(/[\s(]/)[0] as SeriesViewMode;
        if (mode === "dominant" || mode === "lead" || mode === "share" || mode === "head2head") {
            return { defaultView: mode };
        }
        return null;
    }
    if (key === "series") {
        // Accept ";" or "," between items so directives can avoid commas
        // (commas split a comment across columns when opened in a spreadsheet).
        return { seriesOrder: value.split(/[;,]/).map((s) => s.trim()).filter(Boolean) };
    }
    if (key === "colors") {
        const colors: Record<string, string> = {};
        for (const part of value.split(/[;,]/)) {
            const eq = part.indexOf("=");
            if (eq === -1) continue;
            const name = part.slice(0, eq).trim();
            const color = part.slice(eq + 1).trim();
            if (name && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
                colors[seriesKeyFromHeader(name)] = color;
            }
        }
        return { colors };
    }
    return null;
}

function mergeDirectives(base: CsvDirectives, patch: Partial<CsvDirectives>): CsvDirectives {
    return {
        title: patch.title ?? base.title,
        unit: patch.unit ?? base.unit,
        colors: { ...base.colors, ...(patch.colors ?? {}) },
        seriesOrder: patch.seriesOrder ?? base.seriesOrder,
        defaultView: patch.defaultView ?? base.defaultView,
    };
}

function parseCsvLines(text: string): { directives: CsvDirectives; dataLines: string[] } {
    const allLines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    let directives: CsvDirectives = { colors: {} };
    const dataLines: string[] = [];

    for (const raw of allLines) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("#")) {
            const patch = parseDirectiveLine(trimmed);
            if (patch) directives = mergeDirectives(directives, patch);
            continue;
        }
        dataLines.push(trimmed);
    }

    return { directives, dataLines };
}

function validatePsgc(rawPsgc: string, lineNum: number, knownPsgcs: Set<string>, level: MapLevel | null): string | null {
    const psgc = rawPsgc.replace(/\D/g, "").padStart(10, "0");
    if (psgc.length !== 10) {
        return `Line ${lineNum}: invalid PSGC "${rawPsgc}".`;
    }
    if (level !== "barangay" && knownPsgcs.size > 0 && !knownPsgcs.has(psgc)) {
        return `Line ${lineNum}: unknown PSGC "${psgc}".`;
    }
    return null;
}

function buildSeriesDefs(
    headers: string[],
    seriesColumnIndices: number[],
    directives: CsvDirectives,
): CustomSeriesDef[] {
    const fromHeaders = seriesColumnIndices.map((idx) => {
        const label = headers[idx];
        const key = seriesKeyFromHeader(label);
        return { key, label, color: directives.colors[key] };
    });

    if (!directives.seriesOrder?.length) return fromHeaders;

    const byKey = new Map(fromHeaders.map((s) => [s.key, s]));
    const ordered: CustomSeriesDef[] = [];
    for (const name of directives.seriesOrder) {
        const key = seriesKeyFromHeader(name);
        const def = byKey.get(key);
        if (def) {
            ordered.push(def);
            byKey.delete(key);
        }
    }
    for (const def of byKey.values()) ordered.push(def);
    return ordered;
}
// Parses numeric (psgc,value) or multi-series (psgc,label,SeriesA,SeriesB,...) CSV.
// `psgcLevelsByTier` maps each tier to its member PSGCs (handles NCR sharing 1300000000
// at region and province). `psgcLevels` is a flat fallback for HUC disambiguation.
export function parseCustomCsv(
    text: string,
    knownPsgcs: Set<string>,
    psgcLevels?: ReadonlyMap<string, MapLevel>,
    psgcLevelsByTier?: Partial<Record<MapLevel, ReadonlySet<string>>>,
): ParseCustomCsvResult | ParseCustomCsvError {
    const { directives, dataLines } = parseCsvLines(text);

    if (dataLines.length < 2) {
        return { ok: false, error: "CSV must have a header row and at least one data row." };
    }

    const header = dataLines[0].split(",").map((h) => h.trim());
    const headerLower = header.map((h) => h.toLowerCase());
    const psgcIdx = headerLower.indexOf("psgc");
    const valueIdx = headerLower.indexOf("value");
    const labelIdx = headerLower.indexOf("label");

    if (psgcIdx === -1) {
        return { ok: false, error: 'Header must include column "psgc".' };
    }

    const reserved = new Set(["psgc", "value", "label"]);
    const seriesColumnIndices = headerLower
        .map((h, i) => (reserved.has(h) ? -1 : i))
        .filter((i) => i >= 0);

    const isNumeric = valueIdx !== -1;
    const isSeries = !isNumeric && seriesColumnIndices.length >= 2;

    if (!isNumeric && !isSeries) {
        return {
            ok: false,
            error: 'Include a "value" column for single-value data, or at least two numeric series columns.',
        };
    }

    if (isNumeric) {
        const rows: ParsedNumericCsv["rows"] = [];
        const levelsSet = new Set<MapLevel>();

        for (let i = 1; i < dataLines.length; i++) {
            const cols = dataLines[i].split(",").map((c) => c.trim());
            const rawPsgc = cols[psgcIdx];
            const rawValue = cols[valueIdx];
            if (!rawPsgc) continue;

            const psgc = rawPsgc.replace(/\D/g, "").padStart(10, "0");
            const tiers = resolveTiersForPsgc(psgc, psgcLevels, psgcLevelsByTier);
            if (!tiers.length) {
                return { ok: false, error: `Line ${i + 1}: could not infer level for PSGC "${rawPsgc}".` };
            }
            const rowLevel = primaryTier(tiers);

            const psgcErr = validatePsgc(rawPsgc, i + 1, knownPsgcs, rowLevel);
            if (psgcErr) return { ok: false, error: psgcErr };

            const value = Number(rawValue);
            if (!Number.isFinite(value)) {
                return { ok: false, error: `Line ${i + 1}: value must be a number.` };
            }

            rows.push({
                psgc,
                value,
                label: labelIdx >= 0 ? cols[labelIdx] : undefined,
                level: rowLevel,
                tiers,
            });
            for (const tier of tiers) levelsSet.add(tier);
        }

        if (rows.length === 0) return { ok: false, error: "No data rows found." };

        const levels = sortLevels([...levelsSet]);
        return {
            ok: true,
            data: {
                kind: "numeric",
                title: directives.title,
                levels,
                unit: directives.unit,
                rows,
            },
        };
    }

    const seriesDefs = buildSeriesDefs(header, seriesColumnIndices, directives);
    // Map each series key to its column index using the original-case header,
    // since series keys are derived from the original header (not lowercased).
    const seriesKeyToCol = new Map<string, number>();
    for (const idx of seriesColumnIndices) {
        seriesKeyToCol.set(seriesKeyFromHeader(header[idx]), idx);
    }
    const rows: ParsedSeriesCsv["rows"] = [];
    const levelsSet = new Set<MapLevel>();

    for (let i = 1; i < dataLines.length; i++) {
        const cols = dataLines[i].split(",").map((c) => c.trim());
        const rawPsgc = cols[psgcIdx];
        if (!rawPsgc) continue;

        const psgc = rawPsgc.replace(/\D/g, "").padStart(10, "0");
        const tiers = resolveTiersForPsgc(psgc, psgcLevels, psgcLevelsByTier);
        if (!tiers.length) {
            return { ok: false, error: `Line ${i + 1}: could not infer level for PSGC "${rawPsgc}".` };
        }
        const rowLevel = primaryTier(tiers);

        const psgcErr = validatePsgc(rawPsgc, i + 1, knownPsgcs, rowLevel);
        if (psgcErr) return { ok: false, error: psgcErr };

        const series: Record<string, number> = {};
        let hasValue = false;
        for (const def of seriesDefs) {
            const colIdx = seriesKeyToCol.get(def.key) ?? -1;
            if (colIdx < 0) continue;
            const num = Number(cols[colIdx]);
            if (!Number.isFinite(num)) {
                return { ok: false, error: `Line ${i + 1}: "${def.label}" must be a number.` };
            }
            series[def.key] = num;
            if (num > 0) hasValue = true;
        }

        if (!hasValue) continue;

        rows.push({
            psgc,
            label: labelIdx >= 0 ? cols[labelIdx] : undefined,
            series,
            level: rowLevel,
            tiers,
        });
        for (const tier of tiers) levelsSet.add(tier);
    }

    if (rows.length === 0) return { ok: false, error: "No data rows found." };

    const levels = sortLevels([...levelsSet]);
    return {
        ok: true,
        data: {
            kind: "series",
            title: directives.title,
            levels,
            unit: directives.unit,
            series: seriesDefs,
            rows,
            defaultView: directives.defaultView,
        },
    };
}

// Turn parsed CSV data into a session CustomOverlay (mirrors buildOverlayFromDataset for uploads).
export function overlayFromParsedCsv(parsed: ParsedCustomCsv, title?: string): CustomOverlay {
    const overlayTitle = title?.trim() || parsed.title?.trim() || "Uploaded dataset";
    const valuesByLevel: CustomOverlay["valuesByLevel"] = {};
    const valuesByPsgc: CustomOverlay["valuesByPsgc"] = {};

    if (parsed.kind === "numeric") {
        for (const row of parsed.rows) {
            const cell = { value: row.value };
            for (const tier of row.tiers) {
                if (!valuesByLevel[tier]) valuesByLevel[tier] = {};
                valuesByLevel[tier]![row.psgc] = cell;
            }
            valuesByPsgc[row.psgc] = cell;
        }
        return {
            source: "upload",
            kind: "numeric",
            level: parsed.levels[0],
            levels: parsed.levels,
            valuesByLevel,
            valuesByPsgc,
            meta: { title: overlayTitle, unit: parsed.unit },
        };
    }

    for (const row of parsed.rows) {
        const cell = { series: row.series };
        for (const tier of row.tiers) {
            if (!valuesByLevel[tier]) valuesByLevel[tier] = {};
            valuesByLevel[tier]![row.psgc] = cell;
        }
        valuesByPsgc[row.psgc] = cell;
    }
    return {
        source: "upload",
        kind: "series",
        level: parsed.levels[0],
        levels: parsed.levels,
        valuesByLevel,
        valuesByPsgc,
        series: parsed.series,
        meta: {
            title: overlayTitle,
            unit: parsed.unit,
            defaultView: parsed.defaultView,
        },
    };
}

export const CUSTOM_CSV_TEMPLATE = `# SINGLE-VALUE MAP: one number per area.
# Required columns: psgc and value. The label column is optional (shown only in tooltips).
# Lines that start with # are settings or notes. They are ignored as data.
# Optional settings each go on their own # line:
# title: My dataset
# unit: people
# Tip: you may mix region / province / city / barangay rows. The level is read from each PSGC.
# The map only colors areas you provide. For the Philippines view, add a 0000000000 (whole-country) row, or it stays blank.
# Find PSGC codes at https://psa.gov.ph/classification/psgc
# (The line below is the real header. Keep the commas there - they make the columns.)
psgc,value,label
0400000000,16200000,CALABARZON
0405800000,3321325,Rizal
0410000000,3793295,Cavite
`;

export const CUSTOM_SERIES_CSV_TEMPLATE = `# MULTI-SERIES MAP: one row per area and one column per series (a candidate / category / type).
# Required columns: psgc plus two or more value columns. The label column is optional.
# The column headers ARE the series names. Avoid commas inside any header or label.
# Lines that start with # are settings or notes. They are ignored as data.
# Optional settings each go on their own # line. Separate list items with semicolons.
# title: 2022 President (sample)
# colors: Marcos=#bb1e1e; Robredo=#ec1c8f
# mode: lead    (choose one of: lead | dominant | share | head2head)
# Tip: you may mix region / province / city / barangay rows. The level is read from each PSGC.
# The map only colors areas you provide. For the Philippines view, add a 0000000000 (whole-country) row, or it stays blank.
# (The line below is the real header. Keep the commas there - they make the columns.)
psgc,label,Marcos,Robredo
1300000000,Metro Manila,2500000,1800000
0405800000,Rizal,450000,380000
0410000000,Cavite,420000,390000
`;
