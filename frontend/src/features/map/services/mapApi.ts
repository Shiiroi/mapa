// Public API for map layers; PostgREST fallback for municity metadata only.

import { supabase } from "../../../config/supabase";
import type { ProvinceGeoJSON, MunicityGeoJSON, MunicityMeta, Region } from "../types";
import {
    fetchGeoLayerFromStorage,
    fetchMunicitiesGeometryFromStorage,
    fetchMunicitiesMetaFromStorage,
    fetchProvincesFromStorage,
    fetchRegionsFromStorage,
} from "./geoStorage";

export async function fetchRegions(): Promise<Region[]> {
    return fetchRegionsFromStorage();
}

export async function fetchProvinces(): Promise<ProvinceGeoJSON[]> {
    return fetchProvincesFromStorage();
}

export async function fetchMunicitiesMeta(): Promise<MunicityMeta[]> {
    try {
        return await fetchMunicitiesMetaFromStorage();
    } catch (storageErr) {
        console.warn("[fetchMunicitiesMeta] Storage failed, falling back to PostgREST:", storageErr);
        return fetchMunicitiesMetaFromDb();
    }
}

async function fetchMunicitiesMetaFromDb(): Promise<MunicityMeta[]> {
    const { data, error } = await supabase
        .from("municities")
        .select("id, name, code, province_id, region_id, type")
        .order("name");

    if (error) throw error;
    return (data ?? []) as MunicityMeta[];
}

export async function fetchMunicitiesGeometry(): Promise<MunicityGeoJSON[]> {
    const all = await fetchMunicitiesGeometryFromStorage();
    console.info(`[fetchMunicitiesGeometry] Loaded ${all.length} municities with geometry`);
    return all;
}

export async function fetchProvincesByRegion(regionId: number): Promise<ProvinceGeoJSON[]> {
    const provinces = await fetchProvincesFromStorage();
    return provinces.filter((p) => p.region_id === regionId);
}

export async function fetchMunicitiesByProvince(provinceId: number): Promise<MunicityGeoJSON[]> {
    return fetchGeoLayerFromStorage<MunicityGeoJSON[]>(
        `municities/province-${provinceId}.json`,
        `fetchMunicitiesByProvince-${provinceId}`,
    );
}
