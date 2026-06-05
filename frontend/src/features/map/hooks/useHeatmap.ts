import { useQuery } from "@tanstack/react-query";
import { fetchVisitedPlaces } from "../services/placesApi";
import type { VisitedPlace } from "../services/placesApi";

export function useHeatmap(userId: string | undefined) {
    return useQuery<VisitedPlace[]>({
        queryKey: ["heatmap", userId],
        queryFn: () => fetchVisitedPlaces(userId!),
        enabled: !!userId,
    });
}
