// React Query loader for regions, provinces, municity metadata, and geometries.

import { useQuery } from "@tanstack/react-query";
import { fetchCountry, fetchProvinces, fetchMunicitiesMeta, fetchMunicitiesGeometry, fetchRegions } from "../services/mapApi";
import type { CountryGeoJSON, ProvinceGeoJSON, MunicityGeoJSON, MunicityMeta, Region } from "../types";

interface UseMapLayersOptions {
    /** When true, loads all municity geometries (heavy; only needed for city/mun map view). */
    loadMunicitiesGeometry?: boolean;
}

interface UseMapLayersReturn {
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    regions: Region[];
    country: CountryGeoJSON | null;
    /** True while core layers needed for country/region/province views are loading. */
    loading: boolean;
    /** True while municity geometries are still loading (city/mun view only). */
    municitiesLoading: boolean;
    error: Error | null;
}

// Loads and caches base map layers. Municity geometry is deferred until requested
// so the Philippines view is not blocked by hundreds of per-province JSON files.
export function useMapLayers(options: UseMapLayersOptions = {}): UseMapLayersReturn {
    const { loadMunicitiesGeometry = false } = options;
    const provincesQuery = useQuery<ProvinceGeoJSON[]>({
        queryKey: ["provinces"],
        queryFn: fetchProvinces,
        staleTime: 15 * 60 * 1000,
    });

    const municityMetaQuery = useQuery<MunicityMeta[]>({
        queryKey: ["municities", "meta"],
        queryFn: fetchMunicitiesMeta,
        staleTime: 20 * 60 * 1000,
    });

    const municitiesGeometryQuery = useQuery<MunicityGeoJSON[]>({
        queryKey: ["municities", "geometry"],
        queryFn: fetchMunicitiesGeometry,
        staleTime: 20 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false,
        enabled: loadMunicitiesGeometry,
    });

    const regionsQuery = useQuery<Region[]>({
        queryKey: ["regions"],
        queryFn: fetchRegions,
        staleTime: 15 * 60 * 1000,
    });

    const countryQuery = useQuery<CountryGeoJSON>({
        queryKey: ["country"],
        queryFn: fetchCountry,
        staleTime: 15 * 60 * 1000,
    });

    const loading =
        provincesQuery.isLoading ||
        municityMetaQuery.isLoading ||
        regionsQuery.isLoading ||
        countryQuery.isLoading;
    const municitiesLoading = loadMunicitiesGeometry && municitiesGeometryQuery.isLoading;
    const error =
        provincesQuery.error ??
        municityMetaQuery.error ??
        regionsQuery.error ??
        countryQuery.error ??
        municitiesGeometryQuery.error;

    return {
        provinces: provincesQuery.data ?? [],
        municities: municitiesGeometryQuery.data ?? [],
        municityMeta: municityMetaQuery.data ?? [],
        regions: regionsQuery.data ?? [],
        country: countryQuery.data ?? null,
        loading,
        municitiesLoading,
        error: error as Error | null,
    };
}
