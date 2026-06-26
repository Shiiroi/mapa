// TypeScript types for regions, provinces, and municipalities (PSGC-keyed).

import type { Geometry } from "geojson";

export type GeoLevel = "Reg" | "Prov" | "City" | "Mun" | "SubMun" | "Bgy" | "Country";
export type CityLevel = "HUC" | "CC" | "ICC";

export interface PsgcFields {
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
