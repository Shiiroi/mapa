// React Query loader for regions, provinces, municity metadata, and geometries.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCountry, fetchProvinces, fetchMunicitiesMeta, fetchMunicitiesGeometryForProvinces, fetchRegions } from "../services/mapApi";
import type { CountryGeoJSON, ProvinceGeoJSON, MunicityGeoJSON, MunicityMeta, Region } from "../types";

interface UseMapLayersOptions {
    // When true, loads municipality geometries
    loadMunicitiesGeometry?: boolean;
    selectedRegionPsgc?: string | null;
    selectedProvincePsgc?: string | null;
}

interface UseMapLayersReturn {
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    regions: Region[];
    country: CountryGeoJSON | null;
    // True while core layers needed for country, region, and province views are loading
    loading: boolean;
    // True while municipality geometries are still loading (city/municipality view only)
    municitiesLoading: boolean;
    error: Error | null;
}

// Loads and caches base map layers. Municity geometry is deferred until requested
// and is loaded per active province or region selection.
export function useMapLayers(options: UseMapLayersOptions = {}): UseMapLayersReturn {
    const {
        loadMunicitiesGeometry = false,
        selectedRegionPsgc = null,
        selectedProvincePsgc = null,
    } = options;

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

    // Determine the list of province PSGCs we need to load municipalities for
    const provincePsgcsToLoad = useMemo(() => {
        if (!loadMunicitiesGeometry) return [];
        if (selectedProvincePsgc) {
            return [selectedProvincePsgc];
        }
        if (selectedRegionPsgc && provincesQuery.data) {
            return provincesQuery.data
                .filter((p) => p.region_psgc === selectedRegionPsgc)
                .map((p) => p.psgc);
        }
        return [];
    }, [loadMunicitiesGeometry, selectedProvincePsgc, selectedRegionPsgc, provincesQuery.data]);

    const municitiesGeometryQuery = useQuery<MunicityGeoJSON[]>({
        queryKey: ["municities", "geometry", provincePsgcsToLoad],
        queryFn: () => fetchMunicitiesGeometryForProvinces(provincePsgcsToLoad),
        staleTime: 20 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false,
        enabled: loadMunicitiesGeometry && provincePsgcsToLoad.length > 0,
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
