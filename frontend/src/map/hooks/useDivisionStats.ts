// On-demand stats for a single place by PSGC (division_stats table).

import { useQuery } from "@tanstack/react-query";
import { fetchStatsByPsgc } from "../services/mapApi";
import type { DivisionStats } from "../types";

// Fetches and caches division_stats for one PSGC, disabled until a PSGC is given
export function useDivisionStats(psgc: string | null) {
    return useQuery<DivisionStats | null>({
        queryKey: ["division_stats", psgc],
        queryFn: () => fetchStatsByPsgc(psgc!),
        enabled: !!psgc,
        staleTime: Infinity,
        gcTime: 24 * 60 * 60 * 1000,
    });
}
