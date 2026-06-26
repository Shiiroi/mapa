// React Query loader for regions, provinces, municity metadata, and geometries.

import { useQuery } from "@tanstack/react-query";
import { fetchCountry, fetchProvinces, fetchMunicitiesMeta, fetchMunicitiesGeometry, fetchRegions } from "../services/mapApi";
import type { CountryGeoJSON, ProvinceGeoJSON, MunicityGeoJSON, MunicityMeta, Region } from "../types";

interface UseMapLayersReturn {
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    regions: Region[];
    country: CountryGeoJSON | null;
    loading: boolean;
    error: Error | null;
}

export function useMapLayers(): UseMapLayersReturn {
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
        countryQuery.isLoading ||
        municitiesGeometryQuery.isFetching;
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
        error: error as Error | null,
    };
}
