import { useQuery } from "@tanstack/react-query";
import { fetchCustomDatasetValues, fetchCustomDatasets } from "../services/mapApi";

export function useCustomDatasets() {
    return useQuery({
        queryKey: ["custom-datasets"],
        queryFn: fetchCustomDatasets,
        staleTime: 10 * 60 * 1000,
    });
}

export function useCustomDatasetValues(datasetId: string | null) {
    return useQuery({
        queryKey: ["custom-dataset-values", datasetId],
        queryFn: () => fetchCustomDatasetValues(datasetId!),
        enabled: !!datasetId,
        staleTime: 10 * 60 * 1000,
    });
}
