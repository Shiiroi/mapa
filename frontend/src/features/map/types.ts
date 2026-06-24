// TypeScript types for regions, provinces, and municipalities.

import type { Geometry } from "geojson";

export interface ProvinceGeoJSON {
    id: number;
    code: string;
    name: string;
    region_id: number;
    geometry: Geometry;
}

export interface MunicityGeoJSON {
    id: number;
    name: string;
    code: string;
    province_id: number | null;
    region_id: number | null;
    type: "city" | "municipality";
    geometry: Geometry;
}

export interface MunicityMeta {
    id: number;
    name: string;
    code: string;
    province_id: number | null;
    region_id: number | null;
    type: "city" | "municipality";
}

export interface Region {
    id: number;
    code: string;
    name: string;
    geometry: Geometry;
}
