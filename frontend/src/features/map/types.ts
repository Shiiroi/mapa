// TypeScript types for regions, provinces, and municipalities (PSGC-keyed).

import type { Geometry } from "geojson";

export type GeoLevel = "Reg" | "Prov" | "City" | "Mun" | "SubMun" | "Bgy" | "Country";
export type CityLevel = "HUC" | "CC" | "ICC";

/** Population, area, and density keyed by PSGC (from psgc.csv + psgc0.csv + geometry). */
export interface DivisionStatsFields {
    pop_2015: number | null;
    pop_2020: number | null;
    pop_2024: number | null;
    area_km2: number | null;
    density_2024: number | null;
    pct_change_2020_2024: number | null;
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
}
