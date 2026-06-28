// Map sidebar "View by" levels to choropleth scale tiers and human-readable labels.

import type { MpaLevel } from "../constants";
import type { ScaleLevel } from "./densityScale";

export const SCALE_LEVEL_LABELS: Record<ScaleLevel, string> = {
    region: "region",
    province: "province",
    municipality: "city / municipality",
    barangay: "barangay",
};

// Collapses country view to region scale; other modes map 1:1.
export function scaleLevelFor(mode: MpaLevel): ScaleLevel {
    return mode === "country" ? "region" : mode;
}
