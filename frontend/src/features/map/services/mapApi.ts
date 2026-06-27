// Public API for map layers; PostgREST fallback for municity metadata only.

import { supabase } from "../../../config/supabase";
import type { BarangayGeoJSON, CountryGeoJSON, CustomDataset, CustomDatasetValueRow, DivisionStats, ProvinceGeoJSON, MunicityGeoJSON, MunicityMeta, Region } from "../types";
import {
    fetchBarangaysByMunicityFromStorage,
    fetchCountryFromStorage,
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
        .select("psgc, correspondence, name, geo_lvl, city_lvl, province_psgc, region_psgc")
        .order("name");

    if (error) throw error;
    return (data ?? []) as MunicityMeta[];
}

export async function fetchMunicitiesGeometry(): Promise<MunicityGeoJSON[]> {
    const all = await fetchMunicitiesGeometryFromStorage();
    console.info(`[fetchMunicitiesGeometry] Loaded ${all.length} municities with geometry`);
    return all;
}

export async function fetchProvincesByRegion(regionPsgc: string): Promise<ProvinceGeoJSON[]> {
    const provinces = await fetchProvincesFromStorage();
    return provinces.filter((p) => p.region_psgc === regionPsgc);
}

export async function fetchMunicitiesByProvince(provincePsgc: string): Promise<MunicityGeoJSON[]> {
    return fetchGeoLayerFromStorage<MunicityGeoJSON[]>(
        `municities/province-${provincePsgc}.json`,
        `fetchMunicitiesByProvince-${provincePsgc}`,
    );
}

export async function fetchCountry(): Promise<CountryGeoJSON> {
    return fetchCountryFromStorage();
}

export async function fetchBarangaysByMunicity(municityPsgc: string): Promise<BarangayGeoJSON[]> {
    return fetchBarangaysByMunicityFromStorage(municityPsgc);
}

export async function fetchStatsByPsgc(psgc: string): Promise<DivisionStats | null> {
    const { data, error } = await supabase.from("division_stats").select("*").eq("psgc", psgc).maybeSingle();
    if (error) throw error;
    return (data as DivisionStats | null) ?? null;
}

export async function fetchCustomDatasets(): Promise<CustomDataset[]> {
    const { data, error } = await supabase
        .from("custom_datasets")
        .select("id, title, description, category, kind, level, unit, value_label, source_name, source_url")
        .order("category")
        .order("title");
    if (error) throw error;
    return (data ?? []) as CustomDataset[];
}

export async function fetchCustomDatasetValues(datasetId: string): Promise<CustomDatasetValueRow[]> {
    const pageSize = 1000;
    let from = 0;
    const all: CustomDatasetValueRow[] = [];
    while (true) {
        const { data, error } = await supabase
            .from("custom_dataset_values")
            .select("dataset_id, psgc, value, category, detail")
            .eq("dataset_id", datasetId)
            .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        all.push(...(data as CustomDatasetValueRow[]));
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
}
