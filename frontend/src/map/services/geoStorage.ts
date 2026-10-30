// Fetches GeoJSON from CDN (Cloudflare R2, falling back to Supabase Storage)

import { supabase } from "../../config/supabase";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";

const GEO_BUCKET = "geo";

// Bump this when geo JSON is re-uploaded so clients bypass stale browser HTTP cache
const GEO_DATA_VERSION = "2026-10-30.1";

const CDN_BASE_URL = (import.meta.env.VITE_GEO_CDN_URL as string | undefined)?.replace(/\/+$/, "");

// Per-request timeout so blocked/stalled connections fail fast and switch to the fallback
const FETCH_TIMEOUT_MS = 15_000;

// Remembers if direct CDN access failed in this session so subsequent fetches go straight to same-origin proxy
let preferSameOriginProxy = false;

// Appends cache-busting version query parameter to storage URLs
function withGeoVersion(url: string): string {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${GEO_DATA_VERSION}`;
}

// Resolves public storage URL with cache-busting parameter (CDN first, Supabase fallback)
export function getGeoStoragePublicUrl(fileName: string): string {
    const cleanFileName = fileName.replace(/^\/+/, "");
    if (CDN_BASE_URL && !preferSameOriginProxy) {
        return withGeoVersion(`${CDN_BASE_URL}/${cleanFileName}`);
    }
    if (typeof window !== "undefined") {
        return withGeoVersion(`/geo-cdn/${cleanFileName}`);
    }
    const { data } = supabase.storage.from(GEO_BUCKET).getPublicUrl(cleanFileName);
    return withGeoVersion(data.publicUrl);
}

const geoCache = new Map<string, unknown>();

async function fetchJsonWithTimeout<T>(url: string, label: string): Promise<T> {
    const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
        : undefined;
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res.ok) {
        throw new Error(`Storage ${label} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
}

// Downloads a file from the CDN bucket with automatic fallback to same-origin edge proxy and Supabase
export async function fetchGeoLayerFromStorage<T>(fileName: string, label: string): Promise<T> {
    if (geoCache.has(fileName)) {
        return geoCache.get(fileName) as T;
    }
    const cleanFileName = fileName.replace(/^\/+/, "");
    const candidateUrls: { url: string; kind: "cdn" | "proxy" | "supabase" }[] = [];

    if (CDN_BASE_URL) {
        const cdnEntry = { url: withGeoVersion(`${CDN_BASE_URL}/${cleanFileName}`), kind: "cdn" as const };
        const proxyEntry = typeof window !== "undefined"
            ? { url: withGeoVersion(`/geo-cdn/${cleanFileName}`), kind: "proxy" as const }
            : null;

        if (preferSameOriginProxy && proxyEntry) {
            candidateUrls.push(proxyEntry, cdnEntry);
        } else {
            candidateUrls.push(cdnEntry);
            if (proxyEntry) candidateUrls.push(proxyEntry);
        }
    } else if (typeof window !== "undefined") {
        candidateUrls.push({ url: withGeoVersion(`/geo-cdn/${cleanFileName}`), kind: "proxy" });
    }

    const supabaseUrl = withGeoVersion(supabase.storage.from(GEO_BUCKET).getPublicUrl(cleanFileName).data.publicUrl);
    candidateUrls.push({ url: supabaseUrl, kind: "supabase" });

    let primaryError: unknown = null;
    for (const candidate of candidateUrls) {
        try {
            const data = await fetchJsonWithTimeout<T>(candidate.url, label);
            if (candidate.kind === "proxy" && CDN_BASE_URL) {
                preferSameOriginProxy = true;
            }
            geoCache.set(fileName, data);
            return data;
        } catch (err) {
            if (!primaryError) {
                primaryError = err;
            }
        }
    }

    throw primaryError instanceof Error
        ? primaryError
        : new Error(`Failed to fetch ${label} (${cleanFileName})`);
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
