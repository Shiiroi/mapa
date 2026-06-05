import type { GeoJSON } from "geojson";

export interface ProvinceGeoJSON {
    id: number;
    code: string;
    name: string;
    region_id: number;
    geometry: GeoJSON.Geometry;
}

export interface MunicityGeoJSON {
    id: number;
    name: string;
    code: string;
    province_id: number | null;
    region_id: number | null;
    type: "city" | "municipality";
    geometry: GeoJSON.Geometry;
}

export interface Region {
    id: number;
    code: string;
    name: string;
    geometry: GeoJSON.Geometry;
}
