import type { MpaLevel } from "../constants";
import type { ScaleLevel } from "./densityScale";

export const SCALE_LEVEL_LABELS: Record<ScaleLevel, string> = {
    region: "region",
    province: "province",
    municipality: "city / municipality",
    barangay: "barangay",
};

export function scaleLevelFor(mode: MpaLevel): ScaleLevel {
    return mode === "country" ? "region" : mode;
}
