import { useEffect, useState } from "react";
import { fetchProvinces, fetchMunicities, fetchRegions } from "../services/geographyApi";
import type { ProvinceGeoJSON, MunicityGeoJSON, Region } from "../types/geography";

interface UseGeographyReturn {
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    regions: Region[];
    loading: boolean;
    error: Error | null;
}

export function useGeography(): UseGeographyReturn {
    const [provinces, setProvinces] = useState<ProvinceGeoJSON[]>([]);
    const [municities, setMunicities] = useState<MunicityGeoJSON[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const [provincesData, municitiesData, regionsData] = await Promise.all([fetchProvinces(), fetchMunicities(), fetchRegions()]);
                if (!cancelled) {
                    console.debug(
                        `[useGeography] Loaded: ${provincesData.length} provinces, ${municitiesData.length} municities, ${regionsData.length} regions`,
                    );
                    setProvinces(provincesData);
                    setMunicities(municitiesData);
                    setRegions(regionsData);
                }
            } catch (err) {
                if (!cancelled) setError(err as Error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return { provinces, municities, regions, loading, error };
}

export function useProvinces() {
    const [provinces, setProvinces] = useState<ProvinceGeoJSON[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        fetchProvinces()
            .then(setProvinces)
            .catch(setError)
            .finally(() => setLoading(false));
    }, []);

    return { provinces, loading, error };
}

export function useMunicities() {
    const [municities, setMunicities] = useState<MunicityGeoJSON[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        fetchMunicities()
            .then(setMunicities)
            .catch(setError)
            .finally(() => setLoading(false));
    }, []);

    return { municities, loading, error };
}
