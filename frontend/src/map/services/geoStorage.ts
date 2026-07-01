// Fetches GeoJSON from the Supabase Storage CDN

import { supabase } from "../../config/supabase";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

const GEO_BUCKET = "geo";

// Bump this when geo JSON is re-uploaded so clients bypass stale browser HTTP cache
const GEO_DATA_VERSION = "2026-06-27.5";

// Appends cache-busting version query parameter to storage URLs
function withGeoVersion(url: string): string {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${GEO_DATA_VERSION}`;
}

// Resolves public storage URL with cache-busting parameter
export function getGeoStoragePublicUrl(fileName: string): string {
    const { data } = supabase.storage.from(GEO_BUCKET).getPublicUrl(fileName);
    return withGeoVersion(data.publicUrl);
}

// Downloads a file from the geo bucket. Geometries must be uploaded to storage via upload:geo script
export async function fetchGeoLayerFromStorage<T>(fileName: string, label: string): Promise<T> {
    const url = getGeoStoragePublicUrl(fileName);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Storage ${label} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
}

// Fetches region outlines from CDN
export async function fetchRegionsFromStorage(): Promise<Region[]> {
    return fetchGeoLayerFromStorage<Region[]>("regions.json", "fetchRegions");
}

// Fetches province outlines from CDN
export async function fetchProvincesFromStorage(): Promise<ProvinceGeoJSON[]> {
    return fetchGeoLayerFromStorage<ProvinceGeoJSON[]>("provinces.json", "fetchProvinces");
}

// Fetches municipality metadata catalog from CDN
export async function fetchMunicitiesMetaFromStorage(): Promise<MunicityMeta[]> {
    return fetchGeoLayerFromStorage<MunicityMeta[]>("municities/meta.json", "fetchMunicitiesMeta");
}

// Reads the manifest and downloads all province files to return a flat municipality list
export async function fetchMunicitiesGeometryFromStorage(): Promise<MunicityGeoJSON[]> {
    const manifest = await fetchGeoLayerFromStorage<{ provincePsgcs: string[] }>(
        "municities/manifest.json",
        "fetchMunicitiesManifest",
    );

    const batches = await Promise.all(
        manifest.provincePsgcs.map((provincePsgc) =>
            fetchGeoLayerFromStorage<MunicityGeoJSON[]>(
                `municities/province-${provincePsgc}.json`,
                `fetchMunicitiesProvince-${provincePsgc}`,
            ),
        ),
    );

    return batches.flat();
}

// Fetches all municipality outlines belonging to a specific province
export async function fetchMunicitiesByProvinceFromStorage(provincePsgc: string): Promise<MunicityGeoJSON[]> {
    return fetchGeoLayerFromStorage<MunicityGeoJSON[]>(
        `municities/province-${provincePsgc}.json`,
        `fetchMunicitiesProvince-${provincePsgc}`,
    );
}

// Fetches the national country outline from CDN
export async function fetchCountryFromStorage(): Promise<CountryGeoJSON> {
    return fetchGeoLayerFromStorage<CountryGeoJSON>("country.json", "fetchCountry");
}

// Fetches all barangay shapes belonging to a specific municipality
export async function fetchBarangaysByMunicityFromStorage(municityPsgc: string): Promise<BarangayGeoJSON[]> {
    return fetchGeoLayerFromStorage<BarangayGeoJSON[]>(
        `municities/bgy/${municityPsgc}.json`,
        `fetchBarangaysMunicity-${municityPsgc}`,
    );
}
