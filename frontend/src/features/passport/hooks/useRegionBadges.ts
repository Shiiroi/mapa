import { useQuery } from "@tanstack/react-query";
import { fetchPassportStats } from "../services/passportApi";
import type { RegionBadge } from "../types";

export function useRegionBadges(userId: string | undefined) {
    const query = useQuery({
        queryKey: ["passport", "region-badges", userId],
        queryFn: () => fetchPassportStats(userId!),
        enabled: !!userId,
    });

    return {
        regionBadges: query.data?.regionBadges ?? ([] as RegionBadge[]),
        loading: query.isLoading,
        error: query.error,
    };
}
