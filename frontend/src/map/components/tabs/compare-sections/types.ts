import type { MapLevel } from "../../../constants";

export interface CompareSelection {
    level: MapLevel;
    regionPsgc: string | null;
    provincePsgc: string | null;
    municityPsgc: string | null;
    barangayPsgc: string | null;
}

export const DEFAULT_SELECTION: CompareSelection = {
    level: "municipality",
    regionPsgc: null,
    provincePsgc: null,
    municityPsgc: null,
    barangayPsgc: null,
};

export function emptySelection(level: MapLevel): CompareSelection {
    return { ...DEFAULT_SELECTION, level };
}
