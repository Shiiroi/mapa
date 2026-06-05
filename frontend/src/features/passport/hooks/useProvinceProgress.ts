import { useQuery } from "@tanstack/react-query";
import { fetchPassportStats } from "../services/passportApi";
import type { ProvinceProgress } from "../types";

export function useProvinceProgress(userId: string | undefined) {
    const query = useQuery({
        queryKey: ["passport", "province-progress", userId],
        queryFn: () => fetchPassportStats(userId!),
        enabled: !!userId,
    });

    return {
        provinceProgress: query.data?.provinceProgress ?? ([] as ProvinceProgress[]),
        loading: query.isLoading,
        error: query.error,
    };
}
