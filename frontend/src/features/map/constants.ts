// Shared level types and feature flags for future bundles.

import type { ScaleLevel } from "./utils/densityScale";

export type MpaLevel = "country" | "region" | "province" | "municipality" | "barangay";

export type MpaResolution = "low" | "medium" | "high";

export const DEFAULT_RESOLUTION: MpaResolution = "medium";

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
