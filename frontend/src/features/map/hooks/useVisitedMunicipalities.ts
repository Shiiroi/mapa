import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVisitedPlaces, addVisitedPlace } from "../services/placesApi";

export function useVisitedMunicipalities(userId: string | undefined) {
    return useQuery({
        queryKey: ["visited-municipalities", userId],
        queryFn: () => fetchVisitedPlaces(userId!),
        enabled: !!userId,
    });
}

export function useAddVisitedPlace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, municityId, notes }: { userId: string; municityId: number; notes?: string }) =>
            addVisitedPlace(userId, municityId, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["visited-municipalities"] });
        },
    });
}
