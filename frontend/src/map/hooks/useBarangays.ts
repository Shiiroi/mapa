// On-demand barangays with geometry for a single municipality.

import { useQuery } from "@tanstack/react-query";
import { fetchBarangaysByMunicity } from "../services/mapApi";
import type { BarangayGeoJSON } from "../types";

export function useBarangays(municityPsgc: string | null, enabled: boolean) {
    return useQuery<BarangayGeoJSON[]>({
        queryKey: ["barangays", municityPsgc],
        queryFn: () => fetchBarangaysByMunicity(municityPsgc!),
        enabled: enabled && !!municityPsgc,
        staleTime: 10 * 60 * 1000,
    });
}
