// TypeScript types for regions, provinces, and municipalities (PSGC-keyed).

import type { Geometry } from "geojson";
import type { MapLevel } from "./constants";

export type GeoLevel = "Reg" | "Prov" | "City" | "Mun" | "SubMun" | "Bgy" | "Country" | "Special";
export type CityLevel = "HUC" | "CC" | "ICC";

/** One five-year age band from 2020 CPH household population. */
export interface AgeSexBand {
    age: string;
    both: number;
    male: number;
    female: number;
}

/** Population, area, and density keyed by PSGC (from psgc.csv + psgc0.csv + geometry). */
export interface DivisionStatsFields {
    pop_2010: number | null;
    pop_2015: number | null;
    pop_2020: number | null;
    pop_2024: number | null;
    pop_male_2020: number | null;
    pop_female_2020: number | null;
    age_sex_2020: AgeSexBand[] | null;
    area_km2: number | null;
    density_2024: number | null;
    pct_change_2020_2024: number | null;
    assets_2024: number | null;
    gdp_2022: number | null;
    gdp_2023: number | null;
    gdp_2024: number | null;
}

export interface DivisionStats extends DivisionStatsFields {
    psgc: string;
    level: string;
    name?: string;
}

export interface PsgcFields extends DivisionStatsFields {
    psgc: string;
    correspondence: string | null;
    name: string;
    geo_lvl: GeoLevel;
    city_lvl: CityLevel | null;
}

export interface Region extends PsgcFields {
    geometry: Geometry;
}

export interface ProvinceGeoJSON extends PsgcFields {
    region_psgc: string;
    geometry: Geometry;
}

export interface MunicityGeoJSON extends PsgcFields {
    province_psgc: string | null;
    region_psgc: string | null;
    geometry: Geometry;
}

export interface MunicityMeta extends PsgcFields {
    province_psgc: string | null;
    region_psgc: string | null;
}

export interface CountryGeoJSON extends PsgcFields {
    geometry: Geometry;
}

export interface BarangayGeoJSON extends PsgcFields {
    municity_psgc: string;
    province_psgc: string | null;
    region_psgc: string | null;
    geometry: Geometry;
    note?: string | null;
}

/** One named series in a multi-series overlay (candidate, budget line, land-use class, etc.). */
export interface CustomSeriesDef {
    key: string;
    label: string;
    color?: string;
}

export type SeriesViewMode = "dominant" | "lead" | "share" | "head2head";

/** User-selected visualization mode for multi-series overlays. */
export interface SeriesViewState {
    mode: SeriesViewMode;
    shareKey?: string;
    pairA?: string;
    pairB?: string;
}

/** One value cell in a custom map overlay (numeric, categorical, or multi-series). */
export interface CustomOverlayValue {
    value?: number;
    category?: string;
    detail?: unknown;
    /** Per-series values keyed by CustomSeriesDef.key. */
    series?: Record<string, number>;
}

/** Active choropleth overlay from a built-in dataset or session CSV upload. */
export interface CustomOverlay {
    source: "builtin" | "upload";
    kind: "numeric" | "categorical" | "series";
    /** Primary level (first in `levels`; kept for backward-compatible labels). */
    level: MapLevel;
    /** Administrative tiers present in this dataset. */
    levels: MapLevel[];
    /** Values keyed by tier, then PSGC. Only the bucket matching the map view is rendered. */
    valuesByLevel: Partial<Record<MapLevel, Record<string, CustomOverlayValue>>>;
    /** Flat union of all tiers (used for tooltips and compare). */
    valuesByPsgc: Record<string, CustomOverlayValue>;
    /** Ordered series definitions (required when kind === "series"). */
    series?: CustomSeriesDef[];
    meta: {
        title: string;
        unit?: string;
        sourceName?: string;
        sourceUrl?: string;
        /** Default visualization mode for series overlays. */
        defaultView?: SeriesViewMode;
    };
}

export interface CustomDataset {
    id: string;
    title: string;
    description: string | null;
    category: string;
    kind: "numeric" | "categorical" | "series";
    level: MapLevel;
    unit: string | null;
    value_label: string | null;
    source_name: string | null;
    source_url: string | null;
    series: CustomSeriesDef[] | null;
}

export interface CustomDatasetValueRow {
    dataset_id: string;
    psgc: string;
    value: number | null;
    category: string | null;
    detail: unknown;
}
