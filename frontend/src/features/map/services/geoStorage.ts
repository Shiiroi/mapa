// Fetches geo JSON from Supabase Storage, with /geo/ local fallback.

import { supabase } from "../../../config/supabase";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

const GEO_BUCKET = "geo";

/** Bump when geo JSON is re-uploaded so clients bypass stale browser HTTP cache. */
const GEO_DATA_VERSION = "2026-06-27.5";

function withGeoVersion(url: string): string {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${GEO_DATA_VERSION}`;
}

// Public Supabase Storage URL for a geo file, with cache-busting version query.
export function getGeoStoragePublicUrl(fileName: string): string {
    const { data } = supabase.storage.from(GEO_BUCKET).getPublicUrl(fileName);
    return withGeoVersion(data.publicUrl);
}

// Fetches a geo file from the bundled public/geo/ fallback path.
async function fetchFromLocal<T>(fileName: string, label: string): Promise<T> {
    const res = await fetch(withGeoVersion(`/geo/${fileName}`));
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

// Loads every province's municity geometry file (per the manifest) and flattens them.
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

export async function fetchMunicitiesByProvinceFromStorage(provincePsgc: string): Promise<MunicityGeoJSON[]> {
    return fetchGeoLayerFromStorage<MunicityGeoJSON[]>(
        `municities/province-${provincePsgc}.json`,
        `fetchMunicitiesProvince-${provincePsgc}`,
    );
}

export async function fetchCountryFromStorage(): Promise<CountryGeoJSON> {
    return fetchGeoLayerFromStorage<CountryGeoJSON>("country.json", "fetchCountry");
}

export async function fetchBarangaysByMunicityFromStorage(municityPsgc: string): Promise<BarangayGeoJSON[]> {
    return fetchGeoLayerFromStorage<BarangayGeoJSON[]>(
        `municities/bgy/${municityPsgc}.json`,
        `fetchBarangaysMunicity-${municityPsgc}`,
    );
}
