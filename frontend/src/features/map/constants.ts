// Shared level types and feature flags for future bundles.

export const WHOLE_COUNTRY_DOWNLOAD_ENABLED = false;
export const BARANGAY_LEVEL_ENABLED = false;

export type MpaLevel = "region" | "province" | "municipality";

export type MpaResolution = "low" | "medium" | "high";

export const DEFAULT_RESOLUTION: MpaResolution = "medium";
