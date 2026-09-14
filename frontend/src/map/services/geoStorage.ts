// Fetches GeoJSON from CDN (Cloudflare R2, falling back to Supabase Storage)

import { supabase } from "../../config/supabase";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

const GEO_BUCKET = "geo";

// Bump this when geo JSON is re-uploaded so clients bypass stale browser HTTP cache
const GEO_DATA_VERSION = "2026-07-03.1";

const CDN_BASE_URL = (import.meta.env.VITE_GEO_CDN_URL as string | undefined)?.replace(/\/+$/, "");

// Appends cache-busting version query parameter to storage URLs
function withGeoVersion(url: string): string {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${GEO_DATA_VERSION}`;
}

// Resolves public storage URL with cache-busting parameter (CDN first, Supabase fallback)
export function getGeoStoragePublicUrl(fileName: string): string {
    const cleanFileName = fileName.replace(/^\/+/, "");
    if (CDN_BASE_URL) {
        return withGeoVersion(`${CDN_BASE_URL}/${cleanFileName}`);
    }
    const { data } = supabase.storage.from(GEO_BUCKET).getPublicUrl(fileName);
    return withGeoVersion(data.publicUrl);
}

const geoCache = new Map<string, unknown>();

// Downloads a file from the CDN bucket with fallback
export async function fetchGeoLayerFromStorage<T>(fileName: string, label: string): Promise<T> {
    if (geoCache.has(fileName)) {
        return geoCache.get(fileName) as T;
    }
    const url = getGeoStoragePublicUrl(fileName);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Storage ${label} failed: ${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as T;
        geoCache.set(fileName, data);
        return data;
    } catch (err) {
        // If CDN failed and Supabase is configured as fallback, try Supabase
        if (CDN_BASE_URL) {
            try {
                const fallbackUrl = withGeoVersion(supabase.storage.from(GEO_BUCKET).getPublicUrl(fileName).data.publicUrl);
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) {
                    const data = (await fallbackRes.json()) as T;
                    geoCache.set(fileName, data);
                    return data;
                }
            } catch {
                // Ignore fallback error and throw the original error
            }
        }
        throw err;
    }
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
    const manifest = await fetchGeoLayerFromStorage<{ provincePsgcs: string[] }>("municities/manifest.json", "fetchMunicitiesManifest");

    const batches = await Promise.all(
        manifest.provincePsgcs.map((provincePsgc) =>
            fetchGeoLayerFromStorage<MunicityGeoJSON[]>(`municities/province-${provincePsgc}.json`, `fetchMunicitiesProvince-${provincePsgc}`),
        ),
    );

    return batches.flat();
}

// Fetches all municipality outlines belonging to a specific province
export async function fetchMunicitiesByProvinceFromStorage(provincePsgc: string): Promise<MunicityGeoJSON[]> {
    return fetchGeoLayerFromStorage<MunicityGeoJSON[]>(`municities/province-${provincePsgc}.json`, `fetchMunicitiesProvince-${provincePsgc}`);
}

// Fetches the national country outline from CDN
export async function fetchCountryFromStorage(): Promise<CountryGeoJSON> {
    return fetchGeoLayerFromStorage<CountryGeoJSON>("country.json", "fetchCountry");
}

// Fetches all barangay shapes belonging to a specific municipality
export async function fetchBarangaysByMunicityFromStorage(municityPsgc: string): Promise<BarangayGeoJSON[]> {
    return fetchGeoLayerFromStorage<BarangayGeoJSON[]>(`municities/bgy/${municityPsgc}.json`, `fetchBarangaysMunicity-${municityPsgc}`);
}
