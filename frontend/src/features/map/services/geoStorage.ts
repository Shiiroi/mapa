// Fetches geo JSON from Supabase Storage, with /geo/ local fallback.

import { supabase } from "../../../config/supabase";
import type { MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

const GEO_BUCKET = "geo";

export function getGeoStoragePublicUrl(fileName: string): string {
    const { data } = supabase.storage.from(GEO_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
}

async function fetchFromLocal<T>(fileName: string, label: string): Promise<T> {
    const res = await fetch(`/geo/${fileName}`);
    if (!res.ok) {
        throw new Error(`Local ${label} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
}

// Tries Supabase Storage first, then static files under public/geo/.
export async function fetchGeoLayerFromStorage<T>(fileName: string, label: string): Promise<T> {
    try {
        const url = getGeoStoragePublicUrl(fileName);
        const res = await fetch(url);
        if (res.ok) {
            return (await res.json()) as T;
        }
        console.warn(`[geoStorage] Supabase ${label} failed (${res.status}), trying local fallback`);
    } catch (err) {
        console.warn(`[geoStorage] Supabase ${label} error, trying local fallback:`, err);
    }

    return fetchFromLocal<T>(fileName, label);
}

export async function fetchRegionsFromStorage(): Promise<Region[]> {
    return fetchGeoLayerFromStorage<Region[]>("regions.json", "fetchRegions");
}

export async function fetchProvincesFromStorage(): Promise<ProvinceGeoJSON[]> {
    return fetchGeoLayerFromStorage<ProvinceGeoJSON[]>("provinces.json", "fetchProvinces");
}

export async function fetchMunicitiesMetaFromStorage(): Promise<MunicityMeta[]> {
    return fetchGeoLayerFromStorage<MunicityMeta[]>("municities/meta.json", "fetchMunicitiesMeta");
}

export async function fetchMunicitiesGeometryFromStorage(): Promise<MunicityGeoJSON[]> {
    const manifest = await fetchGeoLayerFromStorage<{ provinceIds: number[] }>(
        "municities/manifest.json",
        "fetchMunicitiesManifest",
    );

    const batches = await Promise.all(
        manifest.provinceIds.map((provinceId) =>
            fetchGeoLayerFromStorage<MunicityGeoJSON[]>(
                `municities/province-${provinceId}.json`,
                `fetchMunicitiesProvince-${provinceId}`,
            ),
        ),
    );

    return batches.flat();
}

export async function fetchMunicitiesByProvinceFromStorage(provinceId: number): Promise<MunicityGeoJSON[]> {
    return fetchGeoLayerFromStorage<MunicityGeoJSON[]>(
        `municities/province-${provinceId}.json`,
        `fetchMunicitiesProvince-${provinceId}`,
    );
}
