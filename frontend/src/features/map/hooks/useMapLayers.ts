import { useQuery } from "@tanstack/react-query";
import { fetchProvinces, fetchMunicitiesMeta, fetchMunicitiesGeometry, fetchRegions } from "../services/mapApi";
import type { ProvinceGeoJSON, MunicityGeoJSON, MunicityMeta, Region } from "../types";

interface UseMapLayersReturn {
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    regions: Region[];
    loading: boolean;
    error: Error | null;
}

export function useMapLayers(): UseMapLayersReturn {
    const provincesQuery = useQuery<ProvinceGeoJSON[]>({
        queryKey: ["provinces"],
        queryFn: fetchProvinces,
        staleTime: 15 * 60 * 1000,
    });

    // Load lightweight metadata first (no geometry) — fast, won't timeout
    const municityMetaQuery = useQuery<MunicityMeta[]>({
        queryKey: ["municities", "meta"],
        queryFn: fetchMunicitiesMeta,
        staleTime: 20 * 60 * 1000,
    });

    // Full geometry — loaded on mount alongside everything else, cached for fast tab switching
    const municitiesGeometryQuery = useQuery<MunicityGeoJSON[]>({
        queryKey: ["municities", "geometry"],
        queryFn: fetchMunicitiesGeometry,
        staleTime: 20 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false, // don't retry — if geometry fails, user can retry manually
    });

    const regionsQuery = useQuery<Region[]>({
        queryKey: ["regions"],
        queryFn: fetchRegions,
        staleTime: 15 * 60 * 1000,
    });

    const loading = provincesQuery.isLoading || municityMetaQuery.isLoading || regionsQuery.isLoading || municitiesGeometryQuery.isFetching;
    const error = provincesQuery.error ?? municityMetaQuery.error ?? regionsQuery.error ?? municitiesGeometryQuery.error;

    return {
        provinces: provincesQuery.data ?? [],
        municities: municitiesGeometryQuery.data ?? [],
        municityMeta: municityMetaQuery.data ?? [],
        regions: regionsQuery.data ?? [],
        loading,
        error: error as Error | null,
    };
}

export function useProvinces() {
    return useQuery<ProvinceGeoJSON[]>({
        queryKey: ["provinces"],
        queryFn: fetchProvinces,
    });
}

export function useMunicities() {
    return useQuery<MunicityGeoJSON[]>({
        queryKey: ["municities"],
        queryFn: fetchMunicitiesGeometry,
    });
}
