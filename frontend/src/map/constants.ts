// Shared level types and feature flags for future bundles.

import type { ScaleLevel } from "./utils/densityScale";

export type MapLevel = "country" | "region" | "province" | "municipality" | "barangay";

export type MapResolution = "low" | "medium" | "high";

export const DEFAULT_RESOLUTION: MapResolution = "medium";

export const SCALE_LEVEL_LABELS: Record<ScaleLevel, string> = {
    region: "region",
    province: "province",
    municipality: "city / municipality",
    barangay: "barangay",
};

// Collapses country view to region scale; other modes map 1:1.
export function scaleLevelFor(mode: MapLevel): ScaleLevel {
    return mode === "country" ? "region" : mode;
}
