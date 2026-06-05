import { useQuery } from "@tanstack/react-query";
import { fetchProvinces, fetchMunicities, fetchRegions } from "../services/mapApi";
import type { ProvinceGeoJSON, MunicityGeoJSON, Region } from "../types";

interface UseMapLayersReturn {
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    regions: Region[];
    loading: boolean;
    error: Error | null;
}

export function useMapLayers(): UseMapLayersReturn {
    const provincesQuery = useQuery<ProvinceGeoJSON[]>({
        queryKey: ["provinces"],
        queryFn: fetchProvinces,
    });

    const municitiesQuery = useQuery<MunicityGeoJSON[]>({
        queryKey: ["municities"],
        queryFn: fetchMunicities,
    });

    const regionsQuery = useQuery<Region[]>({
        queryKey: ["regions"],
        queryFn: fetchRegions,
    });

    const loading = provincesQuery.isLoading || municitiesQuery.isLoading || regionsQuery.isLoading;
    const error = provincesQuery.error ?? municitiesQuery.error ?? regionsQuery.error;

    return {
        provinces: provincesQuery.data ?? [],
        municities: municitiesQuery.data ?? [],
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
        queryFn: fetchMunicities,
    });
}
